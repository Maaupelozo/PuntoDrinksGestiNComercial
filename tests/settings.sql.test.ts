import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const owner = '10000000-0000-4000-8000-000000000051'
const other = '10000000-0000-4000-8000-000000000052'
let db: PGlite
const asUser = async (id: string) => db.exec(`set role authenticated; set request.jwt.claim.sub = '${id}';`)

describe('business settings RLS and validation', () => {
  beforeAll(async () => {
    db = await PGlite.create()
    await db.exec(`create role authenticated; create role anon; create schema auth;
      create table auth.users(id uuid primary key);
      insert into auth.users(id) values ('${owner}'), ('${other}');
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid; $$;
      grant usage on schema auth to authenticated;
      grant execute on function auth.uid() to authenticated;`)
    for (const file of ['202610260001_inventory_pricing.sql',
      '202610260002_purchases_suppliers.sql', '202610270001_sales_combos.sql',
      '202610270002_expenses_reports.sql', '202610270003_financial_daily_date.sql',
      '202610270004_business_settings.sql'])
      await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'))
    await asUser(owner)
  })
  afterAll(async () => { await db.close() })

  it('persists own settings and uses fixed currency and timezone', async () => {
    const inserted = await db.query<{ business_name: string; currency: string; time_zone: string }>(
      'insert into public.business_settings(owner_id,business_name,default_min_stock) values ($1,$2,$3) returning business_name,currency,time_zone',
      [owner, 'Punto Drinks', 4])
    expect(inserted.rows[0]).toMatchObject({ business_name: 'Punto Drinks', currency: 'ARS',
      time_zone: 'America/Argentina/Cordoba' })
    const updated = await db.query<{ default_min_stock: number }>(
      'update public.business_settings set default_min_stock=7,phone=$1 where owner_id=$2 returning default_min_stock',
      ['351-555', owner])
    expect(updated.rows[0].default_min_stock).toBe(7)
    expect((await db.query('select * from public.business_settings')).rows).toHaveLength(1)
  })

  it('rejects malformed preferences and owner spoofing', async () => {
    await expect(db.query('update public.business_settings set default_min_stock=-1 where owner_id=$1', [owner]))
      .rejects.toThrow(/check constraint/)
    await expect(db.query('update public.business_settings set logo_url=$1 where owner_id=$2',
      ['http://example.com/logo.png', owner])).rejects.toThrow(/check constraint/)
    await expect(db.query('update public.business_settings set owner_id=$1 where owner_id=$2', [other, owner]))
      .rejects.toThrow(/permission denied/)
    await expect(db.query('delete from public.business_settings where owner_id=$1', [owner]))
      .rejects.toThrow(/permission denied/)
  })

  it('isolates users and denies anonymous reads', async () => {
    await asUser(other)
    expect((await db.query('select * from public.business_settings')).rows).toHaveLength(0)
    expect((await db.query('update public.business_settings set business_name=$1 where owner_id=$2 returning *',
      ['Ajeno', owner])).rows).toHaveLength(0)
    await expect(db.query('insert into public.business_settings(owner_id,business_name) values ($1,$2)',
      [owner, 'Falsificado'])).rejects.toThrow(/row-level security|duplicate key/)
    await db.exec('set role anon;')
    await expect(db.query('select * from public.business_settings')).rejects.toThrow(/permission denied/)
  })
})
