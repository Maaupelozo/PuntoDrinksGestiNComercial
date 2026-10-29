import { describe, expect, it } from 'vitest'
import { addDays, groupFinancialDays, periodRange, previousEquivalentRange,
  validateExpense } from '../src/lib/finance-rules'
import { buildReportCsv, buildReportPdf, financialSummaryRows } from '../src/lib/report-export'
import { mergeHistoricalReport } from '../src/lib/merge-historical-report'
import type { FinancialReport } from '../src/types/finance'

describe('financial periods and exports', () => {
  it('handles month boundaries, leap years and equivalent prior periods', () => {
    expect(periodRange('today', '2026-10-27')).toMatchObject({ start: '2026-10-27', endExclusive: '2026-10-28' })
    expect(periodRange('previousMonth', '2026-03-02')).toMatchObject({ start: '2026-02-01', endExclusive: '2026-03-01' })
    expect(periodRange('month', '2024-02-29')).toMatchObject({ start: '2024-02-01', endExclusive: '2024-03-01' })
    expect(periodRange('week', '2026-10-27')).toMatchObject({ start: '2026-10-26', endExclusive: '2026-10-28' })
    expect(previousEquivalentRange(periodRange('last7', '2026-10-27')))
      .toMatchObject({ start: '2026-10-14', endExclusive: '2026-10-21' })
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(() => periodRange('custom', '2026-10-27', '2026-02-30', '2026-03-01')).toThrow()
    expect(() => periodRange('custom', '2026-10-27', '2026-10-28', '2026-10-27')).toThrow()
  })

  it('rejects invalid expenses and groups daily data without dropping dates', () => {
    const input = { expenseDate: '2026-10-27', description: ' Combustible ', category: ' Transporte ', amount: 5000, paymentMethod: 'cash' as const, notes: null }
    expect(validateExpense(input)).toMatchObject({ description: 'Combustible', category: 'Transporte' })
    expect(() => validateExpense({ ...input, amount: -1 })).toThrow()
    expect(() => validateExpense({ ...input, amount: 1.001 })).toThrow()
    const days = [{ date: '2026-10-26', revenue: 100, cogs: 70, gross_profit: 30, expenses: 5, purchases: 90, sales_count: 1 },
      { date: '2026-10-27', revenue: 50, cogs: 30, gross_profit: 20, expenses: 2, purchases: 0, sales_count: 1 }]
    expect(groupFinancialDays(days, 'week')).toEqual([{ key: '2026-10-26', revenue: 150,
      cogs: 100, expenses: 7, purchases: 90, salesCount: 2 }])
  })

  it('keeps CSV and PDF summary values aligned and protects CSV formula cells', async () => {
    const report: FinancialReport = {
      period: { start: '2026-10-27', end_exclusive: '2026-10-28' },
      summary: { revenue: 100000, cogs: 70000, gross_profit: 30000, expenses: 5000,
        net_operating_result: 25000, purchases: 90000, cashflow_estimate: 5000,
        sales_count: 1, expense_count: 1, purchase_count: 1, average_ticket: 100000 },
      daily: [{ date: '2026-10-27', revenue: 100000, cogs: 70000, gross_profit: 30000,
        expenses: 5000, purchases: 90000, sales_count: 1 }],
      expense_categories: [{ category: '=SUM(1,2)', total: 5000, count: 1 }],
      top_products: [], top_purchased: [], supplier_totals: [], recent_sales: [],
      inventory: { available_products: 0, low_stock_products: 0,
        out_of_stock_products: 0, estimated_value: 0, alerts: [] },
    }
    const range = { start: '2026-10-27', endExclusive: '2026-10-28', label: 'Hoy' }
    expect(financialSummaryRows(report)).toHaveLength(7)
    const csv = buildReportCsv(report, range)
    expect(csv).toContain('"Resultado neto operativo";25000,00')
    expect(csv).toContain('"Compras de mercadería (separadas)";90000,00')
    expect(csv).toContain('"\'=SUM(1,2)";5000,00')
    expect(csv.startsWith('\ufeffsep=;')).toBe(true)
    const pdf = await buildReportPdf(report, range)
    expect(pdf.output()).toContain('%PDF-')
    expect(pdf.getNumberOfPages()).toBe(1)
  })

  it('includes historical amounts by date without inventing costs or ticket averages', () => {
    const range = { start: '2026-10-01', endExclusive: '2026-11-01', label: 'Octubre' }
    const base: FinancialReport = {
      period: { start: range.start, end_exclusive: range.endExclusive },
      summary: { revenue: 100, cogs: 60, gross_profit: 40, expenses: 10,
        net_operating_result: 30, purchases: 20, cashflow_estimate: 70,
        sales_count: 1, expense_count: 1, purchase_count: 1, average_ticket: 100 },
      daily: [{ date: '2026-10-09', revenue: 100, cogs: 60, gross_profit: 40,
        expenses: 10, purchases: 20, sales_count: 1 }],
      expense_categories: [{ category: 'Otros gastos', total: 10, count: 1 }],
      top_products: [], top_purchased: [], supplier_totals: [], recent_sales: [],
      inventory: { available_products: 0, low_stock_products: 0,
        out_of_stock_products: 0, estimated_value: 0, alerts: [] },
    }
    const records = [
      { kind: 'sale' as const, business_date: '2026-10-09', amount: 1200 },
      { kind: 'expense' as const, business_date: '2026-10-10', amount: 300 },
      { kind: 'purchase' as const, business_date: '2026-10-10', amount: 500 },
      { kind: 'count' as const, business_date: '2026-10-28', amount: null },
      { kind: 'sale' as const, business_date: '2026-09-30', amount: 999 },
    ]
    expect(mergeHistoricalReport(base, [], range)).toBe(base)
    const merged = mergeHistoricalReport(base, records, range)
    expect(merged.summary).toMatchObject({ revenue: 1300, cogs: null,
      gross_profit: null, expenses: 310, net_operating_result: null,
      purchases: 520, cashflow_estimate: 470, sales_count: 2,
      expense_count: 2, purchase_count: 2, average_ticket: null })
    expect(merged.historical).toMatchObject({ sale_rows: 1, expense_rows: 1, purchase_rows: 1 })
    expect(merged.daily).toHaveLength(2)
    expect(merged.daily[0]).toMatchObject({ revenue: 1300, cogs: null, gross_profit: null })
    expect(merged.expense_categories).toContainEqual({ category: 'No detallado', total: 300, count: 1 })
    const csv = buildReportCsv(merged, range)
    expect(csv).toContain('"Ganancia bruta";"Pendiente"')
    expect(csv).toContain('"No detallado";300,00;1,00')
  })
})
