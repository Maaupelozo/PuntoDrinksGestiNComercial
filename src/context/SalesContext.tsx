import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { errorMessage } from '../lib/errors'
import { listSalesModule } from '../services/sales'
import type { ComboItemRecord, ComboRecord, SaleComponentRecord, SaleItemRecord, SaleRecord } from '../types/sales'

interface SalesState {
  combos: ComboRecord[]; comboItems: ComboItemRecord[]; sales: SaleRecord[]
  saleItems: SaleItemRecord[]; components: SaleComponentRecord[]
  loading: boolean; error: string | null; refresh: () => Promise<void>
}
const SalesContext = createContext<SalesState | null>(null)

export function SalesProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Omit<SalesState, 'loading' | 'error' | 'refresh'>>({
    combos: [], comboItems: [], sales: [], saleItems: [], components: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)
  const refresh = useCallback(async () => {
    const current = ++requestId.current
    setLoading(true)
    try {
      const next = await listSalesModule()
      if (current === requestId.current) { setData(next); setError(null) }
    } catch (failure) {
      if (current === requestId.current) setError(errorMessage(failure))
    } finally {
      if (current === requestId.current) setLoading(false)
    }
  }, [])
  useEffect(() => { void refresh(); return () => { requestId.current++ } }, [refresh])
  return <SalesContext.Provider value={{ ...data, loading, error, refresh }}>{children}</SalesContext.Provider>
}

export function useSales() {
  const context = useContext(SalesContext)
  if (!context) throw new Error('SalesProvider no está disponible.')
  return context
}
