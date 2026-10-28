import { requireSupabase } from '../lib/supabase'
import { parseMoney, validateMovement, validateProduct } from '../lib/inventory-rules'
import type { ProductInput, StockAdjustment } from '../types/inventory'

export async function listProducts() {
  const { data, error } = await requireSupabase().from('products').select('*').order('name')
  if (error) throw error
  return data
}

export async function createProduct(input: ProductInput) {
  const valid = validateProduct(input)
  const { data, error } = await requireSupabase().rpc('create_product', {
    p_name: valid.name,
    p_category: valid.category,
    p_sku: valid.sku,
    p_unit_cost: valid.unitCost,
    p_sale_price: valid.salePrice,
    p_initial_stock: valid.initialStock,
    p_min_stock: valid.minStock,
  })
  if (error) throw error
  return data
}

export async function updateProduct(productId: string, input: ProductInput) {
  const valid = validateProduct(input)
  const { data, error } = await requireSupabase().rpc('update_product', {
    p_product_id: productId,
    p_name: valid.name,
    p_category: valid.category,
    p_sku: valid.sku,
    p_unit_cost: valid.unitCost,
    p_sale_price: valid.salePrice,
    p_min_stock: valid.minStock,
  })
  if (error) throw error
  return data
}

export async function deactivateProduct(productId: string) {
  const { data, error } = await requireSupabase().rpc('deactivate_product', { p_product_id: productId })
  if (error) throw error
  return data
}

export async function adjustStock(input: StockAdjustment, currentStock: number) {
  validateMovement(input.type, input.delta, input.reason, currentStock)
  const { data, error } = await requireSupabase().rpc('adjust_stock', {
    p_product_id: input.productId,
    p_movement_type: input.type,
    p_quantity_delta: input.delta,
    p_reason: input.reason.trim(),
  })
  if (error) throw error
  return data
}

export async function updatePrices(productId: string, unitCost: number, salePrice: number) {
  parseMoney(String(unitCost), 'Costo unitario')
  parseMoney(String(salePrice), 'Precio de venta')
  const { data, error } = await requireSupabase().rpc('update_product_prices', {
    p_product_id: productId,
    p_unit_cost: unitCost,
    p_sale_price: salePrice,
  })
  if (error) throw error
  return data
}

export async function listMovements(productId: string) {
  const { data, error } = await requireSupabase().from('inventory_movements').select('*')
    .eq('product_id', productId).order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function listPriceHistory(productId: string) {
  const { data, error } = await requireSupabase().from('price_history').select('*')
    .eq('product_id', productId).order('changed_at', { ascending: false })
  if (error) throw error
  return data
}
