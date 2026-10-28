import { createContext, useCallback, useContext, useEffect, useMemo, useRef,
  useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { errorMessage } from '../lib/errors'
import { loadBusinessSettings, saveBusinessSettings } from '../services/settings'
import { defaultBusinessSettings, type BusinessSettingsInput,
  type BusinessSettingsRecord } from '../types/settings'

interface BusinessSettingsState {
  settings: BusinessSettingsRecord
  loading: boolean
  error: string | null
  save: (input: BusinessSettingsInput) => Promise<void>
  refresh: () => Promise<void>
}
const Context = createContext<BusinessSettingsState | null>(null)

export function BusinessSettingsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const ownerId = session!.user.id
  const [settings, setSettings] = useState(() => defaultBusinessSettings(ownerId))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)
  const refresh = useCallback(async () => {
    const current = ++requestId.current
    setLoading(true)
    try {
      const result = await loadBusinessSettings(ownerId)
      if (current === requestId.current) { setSettings(result); setError(null) }
    } catch (failure) {
      if (current === requestId.current) setError(errorMessage(failure))
    } finally { if (current === requestId.current) setLoading(false) }
  }, [ownerId])
  useEffect(() => { void refresh(); return () => { requestId.current++ } }, [refresh])
  const value = useMemo<BusinessSettingsState>(() => ({ settings, loading, error,
    refresh,
    async save(input) {
      const result = await saveBusinessSettings(ownerId, input)
      setSettings(result)
      setError(null)
    },
  }), [settings, loading, error, refresh, ownerId])
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useBusinessSettings() {
  const value = useContext(Context)
  if (!value) throw new Error('BusinessSettingsProvider no está disponible.')
  return value
}
