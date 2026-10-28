import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage } from '../lib/errors'
import { previousEquivalentRange } from '../lib/finance-rules'
import { getFinancialReport } from '../services/finance'
import type { DateRange, FinancialReport } from '../types/finance'

export function useFinancialReport(range: DateRange | null) {
  const [report, setReport] = useState<FinancialReport | null>(null)
  const [previous, setPrevious] = useState<FinancialReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)
  const refresh = useCallback(async () => {
    const current = ++requestId.current
    if (!range) { setReport(null); setPrevious(null); setLoading(false); setError(null); return }
    setLoading(true)
    setReport(null)
    setPrevious(null)
    try {
      const [next, prior] = await Promise.all([
        getFinancialReport(range), getFinancialReport(previousEquivalentRange(range)),
      ])
      if (current === requestId.current) {
        setReport(next); setPrevious(prior); setError(null)
      }
    } catch (failure) {
      if (current === requestId.current) setError(errorMessage(failure))
    } finally { if (current === requestId.current) setLoading(false) }
  }, [range?.start, range?.endExclusive])
  useEffect(() => { void refresh(); return () => { requestId.current++ } }, [refresh])
  return { report, previous, loading, error, refresh }
}
