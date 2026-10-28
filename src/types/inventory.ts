export type ProductRecord = {
  id: string
  owner_id: string
  name: string
  category: string
  sku: string | null
  unit_cost: number
  sale_price: number
  stock_quantity: number
  min_stock: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type MovementType = 'entry' | 'exit' | 'adjustment'

export type InventoryMovement = {
  id: string
  product_id: string
  owner_id: string
  movement_type: MovementType
  quantity_delta: number
  previous_stock: number
  new_stock: number
  reason: string
  created_at: string
  purchase_id: string | null
  purchase_item_id: string | null
  sale_id: string | null
  sale_item_component_id: string | null
}

export type PriceHistory = {
  id: string
  product_id: string
  owner_id: string
  previous_cost: number
  new_cost: number
  previous_price: number
  new_price: number
  changed_at: string
}

export interface ProductInput {
  name: string
  category: string
  sku: string | null
  unitCost: number
  salePrice: number
  minStock: number
  initialStock: number
}

export interface StockAdjustment {
  productId: string
  type: MovementType
  delta: number
  reason: string
}
