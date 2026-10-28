import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { errorMessage } from '../lib/errors'
import { listProducts } from '../services/inventory'
import type { ProductRecord } from '../types/inventory'

interface InventoryState {
  products: ProductRecord[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const InventoryContext = createContext<InventoryState | null>(null)

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<ProductRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)
  const refresh = useCallback(async () => {
    const currentRequest = ++requestId.current
    setLoading(true)
    try {
      const nextProducts = await listProducts()
      if (currentRequest === requestId.current) {
        setProducts(nextProducts)
        setError(null)
      }
    } catch (failure) {
      if (currentRequest === requestId.current) setError(errorMessage(failure))
    } finally {
      if (currentRequest === requestId.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    return () => { requestId.current++ }
  }, [refresh])

  return <InventoryContext.Provider value={{ products, loading, error, refresh }}>{children}</InventoryContext.Provider>
}

export function useInventory() {
  const context = useContext(InventoryContext)
  if (!context) throw new Error('InventoryProvider no está disponible.')
  return context
}
