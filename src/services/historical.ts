import { requireSupabase } from '../lib/supabase'
import type { HistoricalRecord } from '../types/historical'

export async function listHistoricalRecords(): Promise<HistoricalRecord[]> {
  const records: HistoricalRecord[] = []
  for (let from = 0; ; from += 500) {
    const { data, error } = await requireSupabase().from('historical_records').select('*')
      .order('business_date', { ascending: false }).order('source_key').range(from, from + 499)
    if (error) throw error
    records.push(...(data ?? []))
    if (!data || data.length < 500) return records
  }
}
