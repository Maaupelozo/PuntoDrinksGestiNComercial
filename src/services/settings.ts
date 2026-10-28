import { requireSupabase } from '../lib/supabase'
import { validateBusinessSettings } from '../lib/settings-rules'
import { defaultBusinessSettings, type BusinessSettingsInput } from '../types/settings'

export async function loadBusinessSettings(ownerId: string) {
  const { data, error } = await requireSupabase().from('business_settings').select('*')
    .eq('owner_id', ownerId).maybeSingle()
  if (error) throw error
  return data ?? defaultBusinessSettings(ownerId)
}

export async function saveBusinessSettings(ownerId: string, input: BusinessSettingsInput) {
  const valid = validateBusinessSettings(input)
  const client = requireSupabase()
  const updated = await client.from('business_settings').update(valid)
    .eq('owner_id', ownerId).select('*').maybeSingle()
  if (updated.error) throw updated.error
  if (updated.data) return updated.data
  const inserted = await client.from('business_settings').insert({ owner_id: ownerId, ...valid })
    .select('*').single()
  if (inserted.error) throw inserted.error
  return inserted.data
}
