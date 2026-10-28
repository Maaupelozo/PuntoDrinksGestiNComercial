import type { MovementType, ProductInput } from '../types/inventory'

export const maximumMoney = 9_999_999_999.99

export function parseMoney(value: string, field: string): number {
  const number = Number(value.replace(',', '.'))
  if (!value.trim() || !Number.isFinite(number) || number < 0 || number > maximumMoney ||
      Math.abs(number * 100 - Math.round(number * 100)) > 1e-6) {
    throw new Error(`${field}: ingresá un importe no negativo con hasta dos decimales.`)
  }
  return number
}

export function parseUnits(value: string, field: string): number {
  const number = Number(value)
  if (!value.trim() || !Number.isSafeInteger(number) || number < 0 || number > 2_147_483_647) {
    throw new Error(`${field}: ingresá un número entero no negativo.`)
  }
  return number
}

export function validateProduct(input: ProductInput): ProductInput {
  const name = input.name.trim()
  const category = input.category.trim()
  const sku = input.sku?.trim() || null
  if (!name || name.length > 160) throw new Error('Ingresá un nombre de hasta 160 caracteres.')
  if (!category || category.length > 100) throw new Error('Ingresá una categoría de hasta 100 caracteres.')
  if (sku && sku.length > 80) throw new Error('El SKU no puede superar los 80 caracteres.')
  for (const [label, value] of [['Costo unitario', input.unitCost], ['Precio de venta', input.salePrice]] as const) {
    parseMoney(String(value), label)
  }
  for (const [label, value] of [['Stock inicial', input.initialStock], ['Stock mínimo', input.minStock]] as const) {
    parseUnits(String(value), label)
  }
  return { ...input, name, category, sku }
}

export function validateMovement(type: MovementType, delta: number, reason: string, currentStock: number) {
  if (!Number.isSafeInteger(delta) || delta === 0) throw new Error('Ingresá una cantidad entera mayor que cero.')
  if (type === 'entry' && delta < 0 || type === 'exit' && delta > 0) throw new Error('La cantidad no coincide con el tipo de movimiento.')
  if (currentStock + delta < 0) throw new Error('Stock insuficiente para registrar la salida.')
  if (!reason.trim() || reason.trim().length > 500) throw new Error('Ingresá un motivo de hasta 500 caracteres.')
}

export function profitability(cost: number, price: number) {
  const profit = price - cost
  return {
    profit,
    margin: price > 0 ? profit / price * 100 : null,
    markup: cost > 0 ? profit / cost * 100 : null,
  }
}

export function suggestedPrice(cost: number, percentage: number, method: 'markup' | 'margin') {
  if (!Number.isFinite(cost) || cost < 0 || cost > maximumMoney) throw new Error('Ingresá un costo válido.')
  if (!Number.isFinite(percentage) || percentage < 0 || (method === 'margin' && percentage >= 100)) {
    throw new Error('Ingresá un porcentaje válido. El margen debe ser menor al 100%.')
  }
  const price = method === 'markup' ? cost * (1 + percentage / 100) : cost / (1 - percentage / 100)
  if (!Number.isFinite(price) || price > maximumMoney) throw new Error('El precio sugerido supera el máximo permitido.')
  return price
}
