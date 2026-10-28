import { describe, expect, it } from 'vitest'
import { cartNeeds, comboAvailability, comboCost, comboMargin, validateCombo, validateSale } from '../src/lib/sales-rules'
import type { ProductRecord } from '../src/types/inventory'
import type { ComboItemRecord, ComboRecord } from '../src/types/sales'

const product = (id: string, stock: number, cost: number): ProductRecord => ({
  id, owner_id: 'owner', name: id, category: 'Bebida', sku: null, unit_cost: cost,
  sale_price: cost * 1.5, stock_quantity: stock, min_stock: 0, is_active: true,
  created_at: '', updated_at: '',
})
const combo = { id: 'combo', is_active: true } as ComboRecord
const items = [
  { combo_id: 'combo', product_id: 'a', quantity: 1 },
  { combo_id: 'combo', product_id: 'b', quantity: 2 },
] as ComboItemRecord[]

describe('sales and combo rules', () => {
  it('calculates cost, margin and complete combo availability', () => {
    const products = [product('a', 10, 8000), product('b', 5, 2000)]
    expect(comboCost(items, products)).toBe(12000)
    expect(comboMargin(15000, 12000)).toBe(20)
    expect(comboAvailability(items, products)).toBe(2)
    expect(comboAvailability(items, [products[0], { ...products[1], is_active: false }])).toBe(0)
  })
  it('aggregates standalone and combo needs on the same product', () => {
    expect([...cartNeeds([{ productId: 'a', quantity: 1 }, { comboId: 'combo', quantity: 2 }], [combo], items)])
      .toEqual([['a', 3], ['b', 4]])
  })
  it('rejects duplicate and invalid items before sending', () => {
    expect(() => validateCombo({ name: 'Promo', description: null, salePrice: 100,
      items: [{ productId: 'a', quantity: 1 }, { productId: 'a', quantity: 2 }] })).toThrow()
    expect(() => validateSale({ idempotencyKey: '40000000-0000-4000-8000-000000000021',
      paymentMethod: 'cash', items: [{ productId: 'a', quantity: 1 }, { productId: 'a', quantity: 1 }] })).toThrow()
    expect(() => validateSale({ idempotencyKey: '40000000-0000-4000-8000-000000000021',
      paymentMethod: 'cash', items: [{ productId: 'a', comboId: 'combo', quantity: 1 }] })).toThrow()
  })
})
