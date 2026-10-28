import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const owner = '10000000-0000-4000-8000-000000000001'
const other = '10000000-0000-4000-8000-000000000002'
let db: PGlite
let productId: string

const rows = async <T>(sql: string, params?: unknown[]) =>
  (await db.query<T>(sql, params)).rows

async function asUser(id: string) {
  await db.exec(`set role authenticated; set request.jwt.claim.sub = '${id}';`)
}

describe('inventory migration', () => {
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
    await asUser(owner)
  })

  afterAll(async () => { await db.close() })

  it('creates stock and its opening movement atomically', async () => {
    const [product] = await rows<{ id: string; stock_quantity: number; owner_id: string }>(`
      select * from public.create_product('Skyy','Vodka','SKY-1',8000,12000,10,3)
    `)
    productId = product.id
    expect(product.owner_id).toBe(owner)
    expect(product.stock_quantity).toBe(10)
    const [movement] = await rows<{ quantity_delta: number; previous_stock: number; new_stock: number }>(
      'select quantity_delta, previous_stock, new_stock from public.inventory_movements where product_id = $1', [productId],
    )
    expect(movement).toMatchObject({ quantity_delta: 10, previous_stock: 0, new_stock: 10 })
  })

  it('records exits and rejects negative stock without writing history', async () => {
    const [updated] = await rows<{ stock_quantity: number }>(
      "select * from public.adjust_stock($1,'exit',-2,'Venta')", [productId],
    )
    expect(updated.stock_quantity).toBe(8)
    await expect(db.query("select public.adjust_stock($1,'exit',-9,'Inválido')", [productId])).rejects.toThrow(/Stock insuficiente/)
    const [stock] = await rows<{ stock_quantity: number }>('select stock_quantity from public.products where id=$1', [productId])
    const [count] = await rows<{ count: number }>('select count(*)::int as count from public.inventory_movements where product_id=$1', [productId])
    expect(stock.stock_quantity).toBe(8)
    expect(count.count).toBe(2)
  })

  it('records only actual cost or price changes', async () => {
    await db.query('select public.update_product_prices($1,8000,13000)', [productId])
    await db.query('select public.update_product_prices($1,8000,13000)', [productId])
    const history = await rows<{ previous_price: string; new_price: string }>(
      'select previous_price, new_price from public.price_history where product_id=$1', [productId],
    )
    expect(history).toHaveLength(1)
    expect(Number(history[0].previous_price)).toBe(12000)
    expect(Number(history[0].new_price)).toBe(13000)
  })

  it('denies direct writes and keeps another owner isolated', async () => {
    await expect(db.query('update public.products set stock_quantity=99 where id=$1', [productId])).rejects.toThrow(/permission denied/)
    await expect(db.query('delete from public.inventory_movements where product_id=$1', [productId])).rejects.toThrow(/permission denied/)
    await asUser(other)
    expect(await rows('select * from public.products')).toHaveLength(0)
    expect(await rows('select * from public.inventory_movements')).toHaveLength(0)
    expect(await rows('select * from public.price_history')).toHaveLength(0)
    await expect(db.query('select public.adjust_stock($1,\'exit\',-1,\'No autorizado\')', [productId])).rejects.toThrow(/Producto no encontrado/)
    await asUser(owner)
  })

  it('deactivates instead of deleting a product with history', async () => {
    const [product] = await rows<{ is_active: boolean }>('select * from public.deactivate_product($1)', [productId])
    expect(product.is_active).toBe(false)
    await expect(db.query("select public.adjust_stock($1,'entry',1,'Reposición')", [productId])).rejects.toThrow(/Producto no encontrado/)
    const [count] = await rows<{ count: number }>('select count(*)::int as count from public.inventory_movements where product_id=$1', [productId])
    expect(count.count).toBe(2)
  })
})
