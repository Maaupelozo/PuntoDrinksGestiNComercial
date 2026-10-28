export type SupplierRecord = {
  id: string
  owner_id: string
  name: string
  phone: string
  address: string | null
  email: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type PurchaseRecord = {
  id: string
  owner_id: string
  supplier_id: string | null
  purchase_date: string
  status: 'confirmed'
  total: number
  payment_method: string | null
  notes: string | null
  idempotency_key: string
  request_fingerprint: string
  created_at: string
}

export type PurchaseItemRecord = {
  id: string
  purchase_id: string
  owner_id: string
  product_id: string
  product_name: string
  product_sku: string | null
  quantity: number
  unit_cost: number
  subtotal: number
  created_at: string
}

export interface SupplierInput {
  name: string
  phone: string
  address: string | null
  email: string | null
  notes: string | null
}

export interface PurchaseLineInput {
  productId: string
  quantity: number
  unitCost: number
}

export interface PurchaseInput {
  idempotencyKey: string
  purchaseDate: string
  supplierId: string | null
  paymentMethod: string | null
  notes: string | null
  items: PurchaseLineInput[]
}
