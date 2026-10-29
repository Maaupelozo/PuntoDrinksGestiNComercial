export type HistoricalKind = 'sale' | 'purchase' | 'expense' | 'count'

export type HistoricalComponent = {
  name: string
  quantity: number
  unitCost?: number | null
}

export type HistoricalDetails = {
  source?: string
  note?: string
  priceStatus?: string
  paymentMethod?: string | null
  components?: HistoricalComponent[]
  unitCost?: number | null
  presentation?: string
}

export type HistoricalRecord = {
  id: string
  owner_id: string
  source_key: string
  source_fingerprint: string
  kind: HistoricalKind
  business_date: string
  description: string
  quantity: number | null
  amount: number | null
  record_status: string
  details: HistoricalDetails
  imported_at: string
}
