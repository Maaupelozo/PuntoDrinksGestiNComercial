import { requireSupabase } from '../lib/supabase'
import { validatePurchase, validateSupplier } from '../lib/procurement-rules'
import type { PurchaseInput, SupplierInput } from '../types/procurement'

export async function listProcurement() {
  const client = requireSupabase()
  const [supplierResult, purchaseResult, itemResult] = await Promise.all([
    client.from('suppliers').select('*').order('name'),
    client.from('purchases').select('*').order('purchase_date', { ascending: false })
      .order('created_at', { ascending: false }),
    client.from('purchase_items').select('*'),
  ])
  if (supplierResult.error) throw supplierResult.error
  if (purchaseResult.error) throw purchaseResult.error
  if (itemResult.error) throw itemResult.error
  return {
    suppliers: supplierResult.data,
    purchases: purchaseResult.data,
    items: itemResult.data,
  }
}

export async function createSupplier(input: SupplierInput) {
  const valid = validateSupplier(input)
  const { data, error } = await requireSupabase().rpc('create_supplier', {
    p_name: valid.name, p_phone: valid.phone, p_address: valid.address,
    p_email: valid.email, p_notes: valid.notes,
  })
  if (error) throw error
  return data
}

export async function updateSupplier(id: string, input: SupplierInput) {
  const valid = validateSupplier(input)
  const { data, error } = await requireSupabase().rpc('update_supplier', {
    p_supplier_id: id, p_name: valid.name, p_phone: valid.phone,
    p_address: valid.address, p_email: valid.email, p_notes: valid.notes,
  })
  if (error) throw error
  return data
}

export async function deactivateSupplier(id: string) {
  const { data, error } = await requireSupabase().rpc('deactivate_supplier', { p_supplier_id: id })
  if (error) throw error
  return data
}

export async function registerPurchase(input: PurchaseInput) {
  const valid = validatePurchase(input)
  const { data, error } = await requireSupabase().rpc('register_purchase', {
    p_idempotency_key: valid.idempotencyKey,
    p_purchase_date: valid.purchaseDate,
    p_supplier_id: valid.supplierId,
    p_payment_method: valid.paymentMethod,
    p_notes: valid.notes,
    p_items: valid.items.map(item => ({
      product_id: item.productId, quantity: item.quantity, unit_cost: item.unitCost,
    })),
  })
  if (error) throw error
  return data
}
