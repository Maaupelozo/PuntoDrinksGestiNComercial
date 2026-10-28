import { parseMoney, parseUnits } from './inventory-rules'
import type { PurchaseInput, SupplierInput } from '../types/procurement'

export const purchaseTimeZone = 'America/Argentina/Cordoba'
const maxPurchaseTotal = 999_999_999_999.99

export function cordobaDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: purchaseTimeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const part = (name: string) => parts.find(value => value.type === name)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function validateSupplier(input: SupplierInput): SupplierInput {
  const name = input.name.trim()
  const phone = input.phone.trim()
  const address = input.address?.trim() || null
  const email = input.email?.trim() || null
  const notes = input.notes?.trim() || null
  if (!name || name.length > 160) throw new Error('Ingresá un nombre de hasta 160 caracteres.')
  if (!phone || phone.length > 80) throw new Error('Ingresá un teléfono de hasta 80 caracteres.')
  if (address && address.length > 300) throw new Error('La dirección no puede superar los 300 caracteres.')
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    throw new Error('Ingresá un correo válido.')
  }
  if (notes && notes.length > 2000) throw new Error('Las observaciones no pueden superar los 2000 caracteres.')
  return { name, phone, address, email, notes }
}

export function lineSubtotal(quantity: number, unitCost: number) {
  return Math.round(quantity * unitCost * 100) / 100
}

export function weightedAverageCost(oldStock: number, oldCost: number, quantity: number, paidCost: number) {
  const value = oldStock === 0 ? paidCost : (oldStock * oldCost + quantity * paidCost) / (oldStock + quantity)
  return Math.round(value * 100) / 100
}

export function validatePurchase(input: PurchaseInput): PurchaseInput {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.idempotencyKey)) {
    throw new Error('La compra necesita una clave de confirmación válida.')
  }
  const date = new Date(`${input.purchaseDate}T12:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.purchaseDate) || Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== input.purchaseDate) {
    throw new Error('Ingresá una fecha de compra válida.')
  }
  if (!input.items.length || input.items.length > 100) throw new Error('Agregá entre 1 y 100 productos a la compra.')
  const seen = new Set<string>()
  let total = 0
  for (const item of input.items) {
    if (!item.productId || seen.has(item.productId)) throw new Error('No repitas productos en la compra.')
    seen.add(item.productId)
    parseUnits(String(item.quantity), 'Cantidad')
    if (item.quantity === 0) throw new Error('La cantidad debe ser mayor que cero.')
    parseMoney(String(item.unitCost), 'Costo unitario')
    total += lineSubtotal(item.quantity, item.unitCost)
    if (total > maxPurchaseTotal) throw new Error('El total supera el máximo permitido.')
  }
  const paymentMethod = input.paymentMethod?.trim() || null
  const notes = input.notes?.trim() || null
  if (paymentMethod && paymentMethod.length > 100) throw new Error('El medio de pago es demasiado largo.')
  if (notes && notes.length > 2000) throw new Error('Las observaciones son demasiado largas.')
  return { ...input, paymentMethod, notes }
}
