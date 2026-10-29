import { useEffect, useState } from 'react'
import { errorMessage } from '../lib/errors'
import { listHistoricalRecords } from '../services/historical'
import type { HistoricalRecord } from '../types/historical'

export function useHistoricalRecords() {
  const [records, setRecords] = useState<HistoricalRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    listHistoricalRecords().then(data => { if (active) { setRecords(data); setError(null) } })
      .catch(failure => { if (active) setError(errorMessage(failure)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  return { records, loading, error }
}
