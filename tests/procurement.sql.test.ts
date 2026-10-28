import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const owner = '10000000-0000-4000-8000-000000000011'
const other = '10000000-0000-4000-8000-000000000012'
const idempotencyKey = '30000000-0000-4000-8000-000000000011'
let db: PGlite
let supplierId: string
let vodkaId: string
let energyId: string
let purchaseId: string
let purchaseItems: { product_id: string; quantity: number; unit_cost: number }[]

const rows = async <T>(sql: string, params?: unknown[]) => (await db.query<T>(sql, params)).rows
async function asUser(id: string) {
  await db.exec(`set role authenticated; set request.jwt.claim.sub = '${id}';`)
}
async function register(key: string, items: typeof purchaseItems, supplier: string | null = supplierId) {
  return rows<{ id: string; total: string }>(
    'select * from public.register_purchase($1,$2,$3,$4,$5,$6::jsonb)',
    [key, '2026-10-26', supplier, 'Efectivo', 'Reposición', JSON.stringify(items)],
  )
}

describe('purchase and supplier migration', () => {
  beforeAll(async () => {
    db = await PGlite.create()
    await db.exec(`
      create role authenticated; create role anon;
      create schema auth;
      create table auth.users(id uuid primary key);
      insert into auth.users(id) values ('${owner}'), ('${other}');
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;
      grant usage on schema auth to authenticated;
      grant execute on function auth.uid() to authenticated;
    `)
    await db.exec(readFileSync('supabase/migrations/202610260001_inventory_pricing.sql', 'utf8'))
    await db.exec(readFileSync('supabase/migrations/202610260002_purchases_suppliers.sql', 'utf8'))
    await asUser(owner)
  })
  afterAll(async () => { await db.close() })

  it('creates and edits a supplier, then isolates it by owner', async () => {
    const [supplier] = await rows<{ id: string; owner_id: string; name: string }>(
      "select * from public.create_supplier('Mayorista A','351-555',null,null,null)",
    )
    supplierId = supplier.id
    expect(supplier.owner_id).toBe(owner)
    const [updated] = await rows<{ name: string; phone: string }>(
      "select * from public.update_supplier($1,'Mayorista Central','351-777',null,null,null)", [supplierId],
    )
    expect(updated).toMatchObject({ name: 'Mayorista Central', phone: '351-777' })
    await asUser(other)
    expect(await rows('select * from public.suppliers')).toHaveLength(0)
    await expect(db.query(
      "select public.update_supplier($1,'Ajeno','000',null,null,null)", [supplierId],
    )).rejects.toThrow(/Proveedor no encontrado/)
    await asUser(owner)
    await expect(db.query(
      "insert into public.suppliers(name,phone) values('Falso','000')",
    )).rejects.toThrow(/permission denied/)
  })

  it('registers two lines, movements and weighted costs in one purchase', async () => {
    const [vodka] = await rows<{ id: string }>("select * from public.create_product('Skyy','Vodka',null,8000,12000,6,2)")
    const [energy] = await rows<{ id: string }>("select * from public.create_product('Monster','Energizante',null,2000,3500,0,2)")
    vodkaId = vodka.id
    energyId = energy.id
    purchaseItems = [
      { product_id: vodkaId, quantity: 4, unit_cost: 12000 },
      { product_id: energyId, quantity: 12, unit_cost: 2300 },
    ]
    const [purchase] = await register(idempotencyKey, purchaseItems)
    purchaseId = purchase.id
    expect(Number(purchase.total)).toBe(75600)
    const products = await rows<{ id: string; stock_quantity: number; unit_cost: string; sale_price: string }>(
      'select id,stock_quantity,unit_cost,sale_price from public.products where id in ($1,$2)', [vodkaId, energyId],
    )
    expect(products.find(item => item.id === vodkaId)).toMatchObject({ stock_quantity: 10, unit_cost: '9600.00', sale_price: '12000.00' })
    expect(products.find(item => item.id === energyId)).toMatchObject({ stock_quantity: 12, unit_cost: '2300.00', sale_price: '3500.00' })
    const lines = await rows<{ product_id: string; unit_cost: string; subtotal: string }>(
      'select product_id,unit_cost,subtotal from public.purchase_items where purchase_id=$1', [purchaseId],
    )
    expect(lines).toHaveLength(2)
    expect(lines.find(line => line.product_id === vodkaId)).toMatchObject({ unit_cost: '12000.00', subtotal: '48000.00' })
    const movements = await rows<{ purchase_item_id: string; quantity_delta: number; new_stock: number }>(
      'select purchase_item_id,quantity_delta,new_stock from public.inventory_movements where purchase_id=$1', [purchaseId],
    )
    expect(movements).toHaveLength(2)
    expect(movements.every(movement => Boolean(movement.purchase_item_id))).toBe(true)
    const history = await rows<{ product_id: string; new_cost: string }>(
      'select product_id,new_cost from public.price_history where product_id in ($1,$2)', [vodkaId, energyId],
    )
    expect(history.find(change => change.product_id === vodkaId)?.new_cost).toBe('9600.00')
    expect(history.find(change => change.product_id === energyId)?.new_cost).toBe('2300.00')
  })

  it('returns the same purchase for retries and rejects a reused key with changed contents', async () => {
    const [retried] = await register(idempotencyKey, purchaseItems)
    expect(retried.id).toBe(purchaseId)
    const [count] = await rows<{ count: number }>('select count(*)::int as count from public.purchases')
    expect(count.count).toBe(1)
    await expect(register(idempotencyKey, [{ ...purchaseItems[0], quantity: 5 }]))
      .rejects.toThrow(/clave de idempotencia/)
  })

  it('rolls back all lines and stock changes if a later item fails', async () => {
    const [before] = await rows<{ stock_quantity: number }>('select stock_quantity from public.products where id=$1', [vodkaId])
    const [movementCount] = await rows<{ count: number }>('select count(*)::int as count from public.inventory_movements')
    await expect(register('30000000-0000-4000-8000-000000000012', [
      { product_id: vodkaId, quantity: 2, unit_cost: 9000 },
      { product_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', quantity: 2, unit_cost: 100 },
    ])).rejects.toThrow(/Producto no encontrado/)
    const [after] = await rows<{ stock_quantity: number }>('select stock_quantity from public.products where id=$1', [vodkaId])
    const [afterMovementCount] = await rows<{ count: number }>('select count(*)::int as count from public.inventory_movements')
    const [purchaseCount] = await rows<{ count: number }>('select count(*)::int as count from public.purchases')
    expect(after.stock_quantity).toBe(before.stock_quantity)
    expect(afterMovementCount.count).toBe(movementCount.count)
    expect(purchaseCount.count).toBe(1)
  })

  it('blocks direct purchase writes and other owners, while preserving inactive supplier history', async () => {
    await expect(db.query("update public.purchases set total=0 where id=$1", [purchaseId])).rejects.toThrow(/permission denied/)
    await expect(db.query("delete from public.purchase_items where purchase_id=$1", [purchaseId])).rejects.toThrow(/permission denied/)
    await asUser(other)
    expect(await rows('select * from public.purchases')).toHaveLength(0)
    expect(await rows('select * from public.purchase_items')).toHaveLength(0)
    expect(await rows('select * from public.inventory_movements where purchase_id=$1', [purchaseId])).toHaveLength(0)
    await expect(register('30000000-0000-4000-8000-000000000013', purchaseItems, supplierId))
      .rejects.toThrow(/Proveedor no encontrado/)
    await asUser(owner)
    const [supplier] = await rows<{ is_active: boolean }>('select * from public.deactivate_supplier($1)', [supplierId])
    expect(supplier.is_active).toBe(false)
    expect((await rows('select * from public.purchases where supplier_id=$1', [supplierId]))).toHaveLength(1)
    await expect(register('30000000-0000-4000-8000-000000000014', purchaseItems))
      .rejects.toThrow(/Proveedor no encontrado/)
  })
})
