import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const owner = '10000000-0000-4000-8000-000000000021'
const other = '10000000-0000-4000-8000-000000000022'
let db: PGlite
let a: string
let b: string
let combo: string
const rows = async <T>(sql: string, params?: unknown[]) => (await db.query<T>(sql, params)).rows
async function asUser(id: string) { await db.exec(`set role authenticated; set request.jwt.claim.sub = '${id}';`) }
async function sale(key: string, items: unknown[], method = 'cash') {
  return rows<{ id: string; total_amount: string; total_cost: string; gross_profit: string }>(
    'select * from public.confirm_sale($1,$2,$3::jsonb)', [key, method, JSON.stringify(items)])
}
const key = (last: string) => `40000000-0000-4000-8000-0000000000${last}`

describe('sales and combos migration', () => {
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
    for (const file of [
      '202610260001_inventory_pricing.sql', '202610260002_purchases_suppliers.sql',
      '202610270001_sales_combos.sql',
    ]) await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'))
    await asUser(owner)
    a = (await rows<{ id: string }>("select id from public.create_product('Bebida A','Bebida',null,8000,12000,5,1)"))[0].id
    b = (await rows<{ id: string }>("select id from public.create_product('Bebida B','Bebida',null,2000,3500,5,1)"))[0].id
  })
  afterAll(async () => { await db.close() })

  it('creates, edits and deactivates combos with owner isolation', async () => {
    combo = (await rows<{ id: string }>('select id from public.save_combo(null,$1,null,$2,$3::jsonb)',
      ['Combo inicial', 15000, JSON.stringify([{ product_id: a, quantity: 1 }, { product_id: b, quantity: 2 }])]))[0].id
    const [edited] = await rows<{ name: string; sale_price: string }>(
      'select name,sale_price from public.save_combo($1,$2,null,$3,$4::jsonb)',
      [combo, 'Combo final', 14000, JSON.stringify([{ product_id: a, quantity: 1 }, { product_id: b, quantity: 2 }])])
    expect(edited).toMatchObject({ name: 'Combo final', sale_price: '14000.00' })
    await asUser(other)
    expect(await rows('select * from public.combos')).toHaveLength(0)
    expect(await rows('select * from public.combo_items')).toHaveLength(0)
    await expect(db.query('select public.set_combo_active($1,false)', [combo])).rejects.toThrow(/Combo no encontrado/)
    await asUser(owner)
    await expect(db.query("insert into public.combos(name,sale_price) values('Falso',1)"))
      .rejects.toThrow(/permission denied/)
    expect((await rows<{ is_active: boolean }>('select * from public.set_combo_active($1,false)', [combo]))[0].is_active).toBe(false)
    expect((await rows<{ is_active: boolean }>('select * from public.set_combo_active($1,true)', [combo]))[0].is_active).toBe(true)
  })

  it('sells a mixed cart, aggregates stock, and retains historical snapshots', async () => {
    const [result] = await sale(key('21'), [{ product_id: a, quantity: 1 }, { combo_id: combo, quantity: 2 }])
    expect(Number(result.total_amount)).toBe(40000)
    expect(Number(result.total_cost)).toBe(32000)
    expect(Number(result.gross_profit)).toBe(8000)
    const products = await rows<{ id: string; stock_quantity: number; unit_cost: string }>(
      'select id,stock_quantity,unit_cost from public.products where id in ($1,$2)', [a, b])
    expect(products.find(p => p.id === a)).toMatchObject({ stock_quantity: 2, unit_cost: '8000.00' })
    expect(products.find(p => p.id === b)).toMatchObject({ stock_quantity: 1, unit_cost: '2000.00' })
    const items = await rows<{ item_name: string; quantity: number; unit_cost_snapshot: string; gross_profit: string }>(
      'select item_name,quantity,unit_cost_snapshot,gross_profit from public.sale_items where sale_id=$1', [result.id])
    expect(items).toHaveLength(2)
    expect(items.find(item => item.item_name === 'Combo final')).toMatchObject({ quantity: 2, unit_cost_snapshot: '12000.00', gross_profit: '4000.00' })
    const components = await rows<{ product_name: string; quantity: number }>(
      'select product_name,quantity from public.sale_item_components where sale_id=$1', [result.id])
    expect(components).toHaveLength(3)
    const movements = await rows<{ sale_item_component_id: string; quantity_delta: number; new_stock: number }>(
      'select sale_item_component_id,quantity_delta,new_stock from public.inventory_movements where sale_id=$1', [result.id])
    expect(movements).toHaveLength(3)
    expect(movements.every(m => m.sale_item_component_id)).toBe(true)
    await rows('select public.update_product_prices($1,15000,20000)', [a])
    const [historic] = await rows<{ total_cost: string; total_amount: string }>(
      'select total_cost,total_amount from public.sales where id=$1', [result.id])
    expect(historic).toMatchObject({ total_cost: '32000.00', total_amount: '40000.00' })
    await rows('select public.save_combo($1,$2,null,$3,$4::jsonb)',
      [combo, 'Combo cambiado', 25000, JSON.stringify([{ product_id: a, quantity: 1 }])])
    expect((await rows<{ item_name: string }>('select item_name from public.sale_items where sale_id=$1 and combo_id=$2', [result.id, combo]))[0].item_name)
      .toBe('Combo final')
    expect(await rows('select * from public.sale_item_components where sale_id=$1', [result.id])).toHaveLength(3)
    expect((await sale(key('21'), [{ product_id: a, quantity: 1 }, { combo_id: combo, quantity: 2 }]))[0].id).toBe(result.id)
    await expect(sale(key('21'), [{ product_id: a, quantity: 2 }])).rejects.toThrow(/idempotencia/)
  })

  it('sells multiple standalone products and then a single product at current prices', async () => {
    const [multi] = await sale(key('25'), [
      { product_id: a, quantity: 1, unit_price_snapshot: 1, total_cost: 0, owner_id: other },
      { product_id: b, quantity: 1 },
    ], 'transfer')
    expect(Number(multi.total_amount)).toBe(23500)
    expect(Number(multi.total_cost)).toBe(17000)
    expect(Number(multi.gross_profit)).toBe(6500)
    const [single] = await sale(key('26'), [{ product_id: a, quantity: 1 }], 'mercado_pago')
    expect(Number(single.total_amount)).toBe(20000)
    expect(Number(single.total_cost)).toBe(15000)
    expect((await rows<{ stock_quantity: number }>('select stock_quantity from public.products where id=$1', [a]))[0].stock_quantity).toBe(0)
    expect((await rows<{ stock_quantity: number }>('select stock_quantity from public.products where id=$1', [b]))[0].stock_quantity).toBe(0)
  })

  it('rejects insufficient stock, tampered totals, cross-user items and direct writes', async () => {
    const [before] = await rows<{ count: number }>('select count(*)::int as count from public.sales')
    await expect(sale(key('22'), [{ product_id: a, quantity: 1 }, { combo_id: combo, quantity: 1 }]))
      .rejects.toThrow(/Stock insuficiente/)
    const c = (await rows<{ id: string }>("select id from public.create_product('Bebida C','Bebida',null,100,150,1,0)"))[0].id
    await expect(sale(key('23'), [{ product_id: c, quantity: 1, unit_price: 1, total: 1 }, { product_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', quantity: 1 }]))
      .rejects.toThrow(/Producto no encontrado/)
    expect((await rows<{ stock_quantity: number }>('select stock_quantity from public.products where id=$1', [c]))[0].stock_quantity).toBe(1)
    expect((await rows<{ count: number }>('select count(*)::int as count from public.sales'))[0].count).toBe(before.count)
    await expect(db.query('update public.sales set total_amount=0')).rejects.toThrow(/permission denied/)
    await expect(db.query('delete from public.sale_items')).rejects.toThrow(/permission denied/)
    await asUser(other)
    expect(await rows('select * from public.sales')).toHaveLength(0)
    expect(await rows('select * from public.sale_items')).toHaveLength(0)
    expect(await rows('select * from public.sale_item_components')).toHaveLength(0)
    await expect(sale(key('24'), [{ combo_id: combo, quantity: 1 }])).rejects.toThrow(/Combo no encontrado/)
    await db.exec('set role anon;')
    await expect(db.query('select * from public.sales')).rejects.toThrow(/permission denied/)
    await expect(db.query("select public.confirm_sale($1,'cash','[]'::jsonb)", [key('27')]))
      .rejects.toThrow(/permission denied/)
    await asUser(owner)
  })

  it('keeps purchase average cost and combo sale profit consistent across modules', async () => {
    const d = (await rows<{ id: string }>("select id from public.create_product('Bebida D','Bebida',null,8000,15000,2,0)"))[0].id
    await rows('select public.register_purchase($1,$2,null,null,null,$3::jsonb)',
      [key('31'), '2026-10-27', JSON.stringify([{ product_id: d, quantity: 2, unit_cost: 12000 }])])
    const [afterPurchase] = await rows<{ stock_quantity: number; unit_cost: string }>(
      'select stock_quantity,unit_cost from public.products where id=$1', [d])
    expect(afterPurchase).toMatchObject({ stock_quantity: 4, unit_cost: '10000.00' })
    const newCombo = (await rows<{ id: string }>('select id from public.save_combo(null,$1,null,$2,$3::jsonb)',
      ['Promo D', 30000, JSON.stringify([{ product_id: d, quantity: 2 }])]))[0].id
    const [confirmed] = await sale(key('32'), [{ combo_id: newCombo, quantity: 1 }])
    expect(Number(confirmed.total_amount)).toBe(30000)
    expect(Number(confirmed.total_cost)).toBe(20000)
    expect(Number(confirmed.gross_profit)).toBe(10000)
    expect((await rows<{ stock_quantity: number; unit_cost: string }>(
      'select stock_quantity,unit_cost from public.products where id=$1', [d]))[0])
      .toMatchObject({ stock_quantity: 2, unit_cost: '10000.00' })
    await rows('select public.register_purchase($1,$2,null,null,null,$3::jsonb)',
      [key('33'), '2026-10-27', JSON.stringify([{ product_id: d, quantity: 2, unit_cost: 16000 }])])
    expect((await rows<{ unit_cost: string }>('select unit_cost from public.products where id=$1', [d]))[0].unit_cost).toBe('13000.00')
    expect((await rows<{ total_cost: string; gross_profit: string }>('select total_cost,gross_profit from public.sales where id=$1', [confirmed.id]))[0])
      .toMatchObject({ total_cost: '20000.00', gross_profit: '10000.00' })
    expect(await rows('select * from public.inventory_movements where sale_id=$1', [confirmed.id])).toHaveLength(1)
  })
})
