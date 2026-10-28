import { describe, expect, it } from 'vitest'
import { cordobaDate, lineSubtotal, validatePurchase, validateSupplier, weightedAverageCost } from '../src/lib/procurement-rules'

const purchase = {
  idempotencyKey: '30000000-0000-4000-8000-000000000021',
  purchaseDate: '2026-10-26',
  supplierId: null,
  paymentMethod: null,
  notes: null,
  items: [
    { productId: 'a', quantity: 6, unitCost: 8500 },
    { productId: 'b', quantity: 12, unitCost: 2300 },
  ],
}

describe('procurement rules', () => {
  it('calculates line subtotals, total and moving weighted average', () => {
    expect(lineSubtotal(6, 8500) + lineSubtotal(12, 2300)).toBe(78600)
    expect(weightedAverageCost(6, 8000, 4, 12000)).toBe(9600)
    expect(weightedAverageCost(0, 8000, 4, 12000)).toBe(12000)
    expect(validatePurchase(purchase).items).toHaveLength(2)
  })

  it('rejects empty, duplicated and invalid purchase lines', () => {
    expect(() => validatePurchase({ ...purchase, items: [] })).toThrow()
    expect(() => validatePurchase({ ...purchase, items: [purchase.items[0], purchase.items[0]] })).toThrow()
    expect(() => validatePurchase({ ...purchase, items: [{ ...purchase.items[0], quantity: -1 }] })).toThrow()
    expect(() => validatePurchase({ ...purchase, items: [{ ...purchase.items[0], unitCost: 12.345 }] })).toThrow()
    expect(() => validatePurchase({ ...purchase, purchaseDate: '2026-02-30' })).toThrow()
  })

  it('uses the Cordoba calendar date around UTC midnight', () => {
    expect(cordobaDate(new Date('2026-10-26T01:00:00Z'))).toBe('2026-10-25')
    expect(cordobaDate(new Date('2026-10-26T15:00:00Z'))).toBe('2026-10-26')
  })

  it('validates supplier contact fields', () => {
    expect(validateSupplier({ name: ' Mayorista ', phone: ' 351 ', address: '', email: '', notes: '' }))
      .toMatchObject({ name: 'Mayorista', phone: '351', address: null, email: null })
    expect(() => validateSupplier({ name: 'A', phone: '', address: null, email: null, notes: null })).toThrow()
    expect(() => validateSupplier({ name: 'A', phone: '1', address: null, email: 'bad', notes: null })).toThrow()
  })
})
