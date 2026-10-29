import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const owner = '10000000-0000-4000-8000-000000000051'
const other = '10000000-0000-4000-8000-000000000052'
const entries = [
  { source_key: 'test-sale-01', kind: 'sale', business_date: '2026-10-06',
    description: 'Producto A', quantity: 1, amount: 1200,
    record_status: 'confirmed', details: { source: 'Prueba local' } },
  { source_key: 'test-expense-01', kind: 'expense', business_date: '2026-10-10',
    description: 'No detallado', quantity: null, amount: 300,
    record_status: 'unclassified', details: { paymentMethod: null } },
  { source_key: 'test-count-01', kind: 'count', business_date: '2026-10-28',
    description: 'Producto C', quantity: 3, amount: null,
    record_status: 'counted', details: {} },
]
let db: PGlite
async function asUser(id: string) {
  await db.exec(`set role authenticated; set request.jwt.claim.sub = '${id}';`)
}
const rows = async <T>(sql: string, params?: unknown[]) => (await db.query<T>(sql, params)).rows

describe('historical ledger migration', () => {
  beforeAll(async () => {
    db = await PGlite.create()
    await db.exec(`
      create role authenticated; create role anon; create schema auth; create schema private;
      create table auth.users(id uuid primary key);
      insert into auth.users(id) values ('${owner}'), ('${other}');
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid; $$;
      grant usage on schema auth to authenticated;
      grant execute on function auth.uid() to authenticated;
    `)
    await db.exec(readFileSync('supabase/migrations/202610280001_historical_ledger.sql', 'utf8'))
    await asUser(owner)
  })
  afterAll(async () => { await db.close() })

  it('imports exact records, preserves business dates, and skips identical retries', async () => {
    const first = (await rows<{ result: { inserted: number; already_present: number } }>(
      'select public.import_historical_records($1::jsonb) as result', [JSON.stringify(entries)]))[0].result
    expect(first).toEqual({ inserted: 3, already_present: 0 })
    const retry = (await rows<{ result: { inserted: number; already_present: number } }>(
      'select public.import_historical_records($1::jsonb) as result', [JSON.stringify(entries)]))[0].result
    expect(retry).toEqual({ inserted: 0, already_present: 3 })
    expect(await rows<{ business_date: string; amount: string | null }>(
      'select business_date::text, amount from public.historical_records order by source_key'))
      .toMatchObject([{ business_date: '2026-10-28', amount: null },
        { business_date: '2026-10-10', amount: '300.00' },
        { business_date: '2026-10-06', amount: '1200.00' }])
  })

  it('rejects changed duplicates and rolls back an entire invalid batch', async () => {
    await expect(rows('select public.import_historical_records($1::jsonb)',
      [JSON.stringify([{ ...entries[0], amount: 1 }])])).rejects.toThrow(/ya existe con otros datos/)
    await expect(rows('select public.import_historical_records($1::jsonb)',
      [JSON.stringify([{ ...entries[0], source_key: 'new-valid' },
        { ...entries[1], source_key: 'new-invalid', amount: -3 }])])).rejects.toThrow(/Importe histórico inválido/)
    expect(await rows('select id from public.historical_records')).toHaveLength(3)
  })

  it('isolates owners and rejects anonymous or direct writes', async () => {
    await expect(rows("update public.historical_records set amount=1 where source_key='test-sale-01'"))
      .rejects.toThrow(/permission denied/)
    await asUser(other)
    expect(await rows('select * from public.historical_records')).toHaveLength(0)
    const result = (await rows<{ result: { inserted: number } }>(
      'select public.import_historical_records($1::jsonb) as result',
      [JSON.stringify([entries[0]])]))[0].result
    expect(result.inserted).toBe(1)
    expect(await rows('select * from public.historical_records')).toHaveLength(1)
    await db.exec('set role anon;')
    await expect(rows('select * from public.historical_records')).rejects.toThrow(/permission denied/)
    await expect(rows('select public.import_historical_records($1::jsonb)',
      [JSON.stringify(entries)])).rejects.toThrow(/permission denied/)
  })
})
