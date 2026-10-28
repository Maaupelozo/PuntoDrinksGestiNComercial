import { requireSupabase } from '../lib/supabase'
import { validateCombo, validateSale } from '../lib/sales-rules'
import type { ComboInput, ComboItemRecord, ComboRecord, SaleComponentRecord, SaleInput, SaleItemRecord, SaleRecord } from '../types/sales'

async function collectRows<T>(load: (from: number, to: number) => PromiseLike<{
  data: T[] | null; error: { message: string } | null
}>): Promise<T[]> {
  const rows: T[] = []
  const pageSize = 500
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await load(from, from + pageSize - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < pageSize) return rows
  }
}

export async function listSalesModule() {
  const client = requireSupabase()
  const [combos, comboItems, sales, saleItems, components] = await Promise.all([
    collectRows<ComboRecord>((from, to) => client.from('combos').select('*').order('name').range(from, to)),
    collectRows<ComboItemRecord>((from, to) => client.from('combo_items').select('*').order('id').range(from, to)),
    collectRows<SaleRecord>((from, to) => client.from('sales').select('*').order('sold_at', { ascending: false }).order('id').range(from, to)),
    collectRows<SaleItemRecord>((from, to) => client.from('sale_items').select('*').order('id').range(from, to)),
    collectRows<SaleComponentRecord>((from, to) => client.from('sale_item_components').select('*').order('id').range(from, to)),
  ])
  return { combos, comboItems, sales, saleItems, components }
}

export async function saveCombo(id: string | null, input: ComboInput) {
  const valid = validateCombo(input)
  const { data, error } = await requireSupabase().rpc('save_combo', {
    p_combo_id: id, p_name: valid.name, p_description: valid.description,
    p_sale_price: valid.salePrice,
    p_items: valid.items.map(item => ({ product_id: item.productId, quantity: item.quantity })),
  })
  if (error) throw error
  return data
}

export async function setComboActive(id: string, active: boolean) {
  const { data, error } = await requireSupabase().rpc('set_combo_active', {
    p_combo_id: id, p_active: active,
  })
  if (error) throw error
  return data
}

export async function confirmSale(input: SaleInput) {
  const valid = validateSale(input)
  const { data, error } = await requireSupabase().rpc('confirm_sale', {
    p_idempotency_key: valid.idempotencyKey, p_payment_method: valid.paymentMethod,
    p_items: valid.items.map(item => ({
      ...(item.productId ? { product_id: item.productId } : { combo_id: item.comboId }),
      quantity: item.quantity,
    })),
  })
  if (error) throw error
  return data
}
