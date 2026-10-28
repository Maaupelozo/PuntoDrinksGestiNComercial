import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const owner = '10000000-0000-4000-8000-000000000041'
const other = '10000000-0000-4000-8000-000000000042'
let db: PGlite
let expenseId: string
let saleId: string
const rows = async <T>(sql: string, params?: unknown[]) => (await db.query<T>(sql, params)).rows
async function asUser(id: string) {
  await db.exec(`set role authenticated; set request.jwt.claim.sub = '${id}';`)
}
async function report(start = '2026-10-27', end = '2026-10-28') {
  return (await rows<{ value: any }>('select public.financial_report($1,$2) as value', [start, end]))[0].value
}

describe('expenses and financial reporting migration', () => {
  beforeAll(async () => {
    db = await PGlite.create()
    await db.exec(`
      create role authenticated; create role anon; create schema auth;
      create table auth.users(id uuid primary key);
      insert into auth.users(id) values ('${owner}'), ('${other}');
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid; $$;
      grant usage on schema auth to authenticated;
      grant execute on function auth.uid() to authenticated;
    `)
    for (const file of ['202610260001_inventory_pricing.sql',
      '202610260002_purchases_suppliers.sql', '202610270001_sales_combos.sql',
      '202610270002_expenses_reports.sql',
      '202610270003_financial_daily_date.sql']) {
      await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'))
    }
    await asUser(owner)
  })
  afterAll(async () => { await db.close() })

  it('calculates the required 100k / 70k / 90k / 5k scenario without double counting purchases', async () => {
    const soldProduct = (await rows<{ id: string }>(
      "select id from public.create_product('Vendida','Bebida',null,70000,100000,1,0)"))[0].id
    const purchasedProduct = (await rows<{ id: string }>(
      "select id from public.create_product('Comprada','Bebida',null,90000,90000,0,0)"))[0].id
    await rows('select public.register_purchase($1,$2,null,null,null,$3::jsonb)', [
      '40000000-0000-4000-8000-000000000041', '2026-10-27',
      JSON.stringify([{ product_id: purchasedProduct, quantity: 1, unit_cost: 90000 }]),
    ])
    saleId = (await rows<{ id: string }>('select id from public.confirm_sale($1,$2,$3::jsonb)', [
      '40000000-0000-4000-8000-000000000042', 'cash',
      JSON.stringify([{ product_id: soldProduct, quantity: 1 }]),
    ]))[0].id
    await db.exec('reset role;')
    await rows("update public.sales set sold_at='2026-10-27 15:00:00+00' where id=$1", [saleId])
    await asUser(owner)
    expenseId = (await rows<{ id: string }>(
      'select id from public.save_expense(null,$1,$2,$3,$4,$5,null)',
      ['2026-10-27', 'Combustible', 'Combustible', 5000, 'cash']))[0].id
    const result = await report()
    expect(result.summary).toMatchObject({ revenue: 100000, cogs: 70000,
      gross_profit: 30000, expenses: 5000, net_operating_result: 25000,
      purchases: 90000, cashflow_estimate: 5000, sales_count: 1,
      average_ticket: 100000 })
    expect(result.daily).toHaveLength(1)
    expect(result.daily[0].date).toBe('2026-10-27')
    expect(result.top_products).toMatchObject([{ name: 'Vendida', units: 1, direct_revenue: 100000 }])
    expect(result.top_purchased).toMatchObject([{ name: 'Comprada', units: 1, total: 90000 }])
    expect(result.expense_categories).toMatchObject([{ category: 'Combustible', total: 5000 }])
  })

  it('counts combo components as units without attributing combo revenue twice', async () => {
    const product = (await rows<{ id: string }>(
      "select id from public.create_product('Componente combo','Bebida',null,1000,1800,2,0)"))[0].id
    const combo = (await rows<{ id: string }>('select id from public.save_combo(null,$1,null,$2,$3::jsonb)',
      ['Promo temporal', 5000, JSON.stringify([{ product_id: product, quantity: 2 }])]))[0].id
    const sale = (await rows<{ id: string }>('select id from public.confirm_sale($1,$2,$3::jsonb)', [
      '40000000-0000-4000-8000-000000000043', 'cash',
      JSON.stringify([{ combo_id: combo, quantity: 1 }]),
    ]))[0].id
    await db.exec('reset role;')
    await rows("update public.sales set sold_at='2026-10-29 15:00:00+00' where id=$1", [sale])
    await asUser(owner)
    const result = await report('2026-10-29', '2026-10-30')
    expect(result.summary).toMatchObject({ revenue: 5000, cogs: 2000,
      gross_profit: 3000, net_operating_result: 3000 })
    expect(result.top_products).toMatchObject([{ name: 'Componente combo',
      units: 2, direct_revenue: 0 }])
  })

  it('uses Cordoba day boundaries, exclusive end and empty periods', async () => {
    await db.exec('reset role;')
    await rows("update public.sales set sold_at='2026-10-28 02:30:00+00' where id=$1", [saleId])
    await asUser(owner)
    expect((await report()).summary.revenue).toBe(100000)
    await db.exec('reset role;')
    await rows("update public.sales set sold_at='2026-10-28 03:30:00+00' where id=$1", [saleId])
    await asUser(owner)
    expect((await report()).summary.revenue).toBe(0)
    expect((await report('2026-10-28', '2026-10-29')).summary.revenue).toBe(100000)
    expect((await report('2026-09-01', '2026-09-02')).summary)
      .toMatchObject({ revenue: 0, cogs: 0, expenses: 0, net_operating_result: 0 })
    await db.exec('reset role;')
    await rows("update public.sales set sold_at='2026-10-27 15:00:00+00' where id=$1", [saleId])
    await asUser(owner)
  })

  it('edits and voids an expense with immutable audit rows', async () => {
    const updated = (await rows<{ amount: string }>(
      'select amount from public.save_expense($1,$2,$3,$4,$5,$6,$7)',
      [expenseId, '2026-10-27', 'Combustible corregido', 'Transporte', 6000, 'transfer', 'Corrección']))[0]
    expect(updated.amount).toBe('6000.00')
    expect((await report()).summary.net_operating_result).toBe(24000)
    const voided = (await rows<{ status: string; void_reason: string }>(
      'select status,void_reason from public.void_expense($1,$2)',
      [expenseId, 'Duplicado']))[0]
    expect(voided).toMatchObject({ status: 'voided', void_reason: 'Duplicado' })
    expect((await report()).summary.net_operating_result).toBe(30000)
    expect((await rows<{ action: string }>('select action from public.expense_audit where expense_id=$1 order by created_at,id', [expenseId])).map(row => row.action).sort())
      .toEqual(['created', 'updated', 'voided'].sort())
    await expect(db.query('select public.void_expense($1,$2)', [expenseId, 'Otra vez']))
      .rejects.toThrow(/ya anulado/)
    await expect(db.query('select public.save_expense($1,$2,$3,$4,$5,$6,null)',
      [expenseId, '2026-10-27', 'Alteración', 'Otros gastos', 1, 'cash']))
      .rejects.toThrow(/anulado/)
  })

  it('rejects bad amounts, direct writes and cross-owner or anonymous reads', async () => {
    await expect(db.query('select public.save_expense(null,$1,$2,$3,$4,$5,null)',
      ['2026-10-27', 'Inválido', 'Otros gastos', -1, 'cash'])).rejects.toThrow(/inválidos/)
    await expect(db.query('update public.expenses set amount=1 where id=$1', [expenseId]))
      .rejects.toThrow(/permission denied/)
    await expect(db.query('delete from public.expense_audit where expense_id=$1', [expenseId]))
      .rejects.toThrow(/permission denied/)
    await asUser(other)
    expect(await rows('select * from public.expenses')).toHaveLength(0)
    expect(await rows('select * from public.expense_audit')).toHaveLength(0)
    expect((await report()).summary).toMatchObject({ revenue: 0, purchases: 0, expenses: 0 })
    await expect(db.query('select public.void_expense($1,$2)', [expenseId, 'Ajeno']))
      .rejects.toThrow(/no encontrado/)
    await db.exec('set role anon;')
    await expect(db.query('select * from public.expenses')).rejects.toThrow(/permission denied/)
    await expect(db.query("select public.financial_report('2026-10-27','2026-10-28')"))
      .rejects.toThrow(/permission denied/)
    await asUser(owner)
  })
})
