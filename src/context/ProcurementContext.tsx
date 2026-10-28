import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { errorMessage } from '../lib/errors'
import { listProcurement } from '../services/procurement'
import type { PurchaseItemRecord, PurchaseRecord, SupplierRecord } from '../types/procurement'

interface ProcurementState {
  suppliers: SupplierRecord[]
  purchases: PurchaseRecord[]
  items: PurchaseItemRecord[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const ProcurementContext = createContext<ProcurementState | null>(null)

export function ProcurementProvider({ children }: { children: ReactNode }) {
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([])
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([])
  const [items, setItems] = useState<PurchaseItemRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)
  const refresh = useCallback(async () => {
    const current = ++requestId.current
    setLoading(true)
    try {
      const next = await listProcurement()
      if (current === requestId.current) {
        setSuppliers(next.suppliers)
        setPurchases(next.purchases)
        setItems(next.items)
        setError(null)
      }
    } catch (failure) {
      if (current === requestId.current) setError(errorMessage(failure))
    } finally {
      if (current === requestId.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    return () => { requestId.current++ }
  }, [refresh])

  return <ProcurementContext.Provider value={{ suppliers, purchases, items, loading, error, refresh }}>
    {children}
  </ProcurementContext.Provider>
}

export function useProcurement() {
  const context = useContext(ProcurementContext)
  if (!context) throw new Error('ProcurementProvider no está disponible.')
  return context
}
