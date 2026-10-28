export type PaymentMethod = 'cash' | 'transfer' | 'mercado_pago'

export type ComboRecord = {
  id: string; owner_id: string; name: string; description: string | null
  sale_price: number; is_active: boolean; created_at: string; updated_at: string
}
export type ComboItemRecord = {
  id: string; combo_id: string; owner_id: string; product_id: string; quantity: number
}
export type SaleRecord = {
  id: string; owner_id: string; sale_number: string; sold_at: string
  payment_method: PaymentMethod; total_amount: number; total_cost: number
  gross_profit: number; status: 'confirmed'; idempotency_key: string
  request_fingerprint: string; created_at: string
}
export type SaleItemRecord = {
  id: string; sale_id: string; owner_id: string; product_id: string | null
  combo_id: string | null; item_name: string; quantity: number
  unit_price_snapshot: number; unit_cost_snapshot: number
  subtotal: number; total_cost: number; gross_profit: number; created_at: string
}
export type SaleComponentRecord = {
  id: string; sale_item_id: string; sale_id: string; owner_id: string
  product_id: string; product_name: string; quantity: number
  unit_cost_snapshot: number; total_cost: number
}
export type ComboInput = {
  name: string; description: string | null; salePrice: number
  items: { productId: string; quantity: number }[]
}
export type SaleInput = {
  idempotencyKey: string; paymentMethod: PaymentMethod
  items: { productId?: string; comboId?: string; quantity: number }[]
}
