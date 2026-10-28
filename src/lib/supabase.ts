import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const configurationError =
  !url || !publishableKey
    ? 'Faltan VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en .env.local.'
    : null

export const supabase = configurationError
  ? null
  : createClient<Database>(url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    })

export function requireSupabase() {
  if (!supabase) throw new Error(configurationError ?? 'No se pudo conectar con Supabase.')
  return supabase
}
