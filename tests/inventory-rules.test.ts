import { describe, expect, it } from 'vitest'
import { parseMoney, parseUnits, profitability, suggestedPrice, validateMovement, validateProduct } from '../src/lib/inventory-rules'

describe('inventory input rules', () => {
  it('accepts cents and rejects invalid money or quantities', () => {
    expect(parseMoney('8000,25', 'Costo')).toBe(8000.25)
    expect(() => parseMoney('-1', 'Costo')).toThrow()
    expect(() => parseMoney('1.999', 'Costo')).toThrow()
    expect(() => parseMoney('NaN', 'Costo')).toThrow()
    expect(parseUnits('10', 'Stock')).toBe(10)
    expect(() => parseUnits('1.5', 'Stock')).toThrow()
    expect(() => parseUnits('-1', 'Stock')).toThrow()
  })

  it('checks product fields and movement bounds before calling the database', () => {
    const input = { name: ' Skyy ', category: ' Vodka ', sku: ' X1 ', unitCost: 8000, salePrice: 12000, initialStock: 10, minStock: 2 }
    expect(validateProduct(input)).toMatchObject({ name: 'Skyy', category: 'Vodka', sku: 'X1' })
    expect(() => validateProduct({ ...input, category: ' ' })).toThrow()
    expect(() => validateMovement('exit', -11, 'Venta', 10)).toThrow(/Stock insuficiente/)
    expect(() => validateMovement('entry', -2, 'Compra', 10)).toThrow()
    expect(() => validateMovement('adjustment', 2, ' ', 10)).toThrow()
    expect(() => validateMovement('exit', -2, 'Venta', 10)).not.toThrow()
  })
})

describe('pricing calculations', () => {
  it('keeps markup and gross margin distinct', () => {
    expect(suggestedPrice(8000, 50, 'markup')).toBe(12000)
    expect(suggestedPrice(8000, 50, 'margin')).toBe(16000)
    expect(profitability(8000, 12000)).toEqual({ profit: 4000, margin: 4000 / 12000 * 100, markup: 50 })
    expect(profitability(0, 0)).toEqual({ profit: 0, margin: null, markup: null })
    expect(profitability(13000, 12000).profit).toBe(-1000)
  })

  it('rejects impossible or out-of-range suggestions', () => {
    expect(() => suggestedPrice(8000, 100, 'margin')).toThrow()
    expect(() => suggestedPrice(-1, 30, 'markup')).toThrow()
    expect(() => suggestedPrice(8000, Number.POSITIVE_INFINITY, 'markup')).toThrow()
  })
})
