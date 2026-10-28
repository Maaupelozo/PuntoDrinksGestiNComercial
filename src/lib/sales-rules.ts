import { parseMoney, parseUnits } from './inventory-rules'
import type { ProductRecord } from '../types/inventory'
import type { ComboInput, ComboItemRecord, ComboRecord, SaleInput } from '../types/sales'

export function comboCost(items: ComboItemRecord[], products: ProductRecord[]) {
  return Math.round(items.reduce((sum, item) =>
    sum + item.quantity * Number(products.find(product => product.id === item.product_id)?.unit_cost ?? 0), 0) * 100) / 100
}

export function comboAvailability(items: ComboItemRecord[], products: ProductRecord[]) {
  if (!items.length) return 0
  return Math.min(...items.map(item => {
    const product = products.find(value => value.id === item.product_id)
    return product?.is_active ? Math.floor(product.stock_quantity / item.quantity) : 0
  }))
}

export function comboMargin(price: number, cost: number) {
  return price > 0 ? Math.round((price - cost) / price * 10000) / 100 : 0
}

export function cartNeeds(items: SaleInput['items'], combos: ComboRecord[],
  components: ComboItemRecord[]) {
  const needs = new Map<string, number>()
  for (const item of items) {
    if (item.productId) needs.set(item.productId, (needs.get(item.productId) ?? 0) + item.quantity)
    else if (item.comboId) {
      if (!combos.some(combo => combo.id === item.comboId && combo.is_active)) continue
      for (const component of components.filter(value => value.combo_id === item.comboId)) {
        needs.set(component.product_id,
          (needs.get(component.product_id) ?? 0) + item.quantity * component.quantity)
      }
    }
  }
  return needs
}

export function validateCombo(input: ComboInput): ComboInput {
  const name = input.name.trim()
  const description = input.description?.trim() || null
  if (!name || name.length > 160) throw new Error('Ingresá un nombre de hasta 160 caracteres.')
  if (description && description.length > 2000) throw new Error('La descripción es demasiado larga.')
  parseMoney(String(input.salePrice), 'Precio promocional')
  if (!input.items.length || input.items.length > 100) throw new Error('Agregá entre 1 y 100 componentes.')
  const seen = new Set<string>()
  for (const item of input.items) {
    if (!item.productId || seen.has(item.productId)) throw new Error('Seleccioná productos distintos.')
    seen.add(item.productId)
    parseUnits(String(item.quantity), 'Cantidad')
    if (!item.quantity) throw new Error('La cantidad debe ser mayor que cero.')
  }
  return { ...input, name, description }
}

export function validateSale(input: SaleInput): SaleInput {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.idempotencyKey))
    throw new Error('La venta necesita una clave de confirmación válida.')
  if (!['cash', 'transfer', 'mercado_pago'].includes(input.paymentMethod))
    throw new Error('Elegí un método de pago válido.')
  if (!input.items.length || input.items.length > 100) throw new Error('Agregá entre 1 y 100 artículos.')
  const seen = new Set<string>()
  for (const item of input.items) {
    if (Boolean(item.productId) === Boolean(item.comboId)) throw new Error('Artículo de venta inválido.')
    const key = item.productId ? `p:${item.productId}` : `c:${item.comboId}`
    if (seen.has(key)) throw new Error('No repitas artículos en la venta.')
    seen.add(key)
    parseUnits(String(item.quantity), 'Cantidad')
    if (!item.quantity) throw new Error('La cantidad debe ser mayor que cero.')
  }
  return input
}
