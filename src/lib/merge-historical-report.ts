import type { DateRange, FinancialDay, FinancialReport, HistoricalReportTotals } from '../types/finance'
import type { HistoricalRecord } from '../types/historical'

type ReportHistoryRow = Pick<HistoricalRecord, 'kind' | 'business_date' | 'amount'>

// Historical sale rows are not necessarily distinct tickets. Their cost and payment
// method are unknown, so only the documented amounts can be combined safely.
export function mergeHistoricalReport(report: FinancialReport, records: ReportHistoryRow[], range: DateRange): FinancialReport {
  const relevant = records.filter(record => record.business_date >= range.start &&
    record.business_date < range.endExclusive && record.kind !== 'count')
  if (!relevant.length) return report

  const historical: HistoricalReportTotals = {
    sale_rows: 0, expense_rows: 0, purchase_rows: 0,
    revenue: 0, expenses: 0, purchases: 0,
  }
  const days = new Map<string, FinancialDay>(report.daily.map(day => [day.date, { ...day }]))
  for (const record of relevant) {
    const amount = Number(record.amount)
    const day = days.get(record.business_date) ?? {
      date: record.business_date, revenue: 0, cogs: 0, gross_profit: 0,
      expenses: 0, purchases: 0, sales_count: 0,
    }
    if (record.kind === 'sale') {
      historical.sale_rows++
      historical.revenue += amount
      day.revenue += amount
      day.sales_count++
      day.cogs = null
      day.gross_profit = null
    } else if (record.kind === 'expense') {
      historical.expense_rows++
      historical.expenses += amount
      day.expenses += amount
    } else if (record.kind === 'purchase') {
      historical.purchase_rows++
      historical.purchases += amount
      day.purchases += amount
    }
    days.set(day.date, day)
  }
  const source = report.summary
  const expenseCategories = report.expense_categories.map(category => ({ ...category }))
  if (historical.expense_rows) {
    const uncategorized = expenseCategories.find(category => category.category === 'No detallado')
    if (uncategorized) {
      uncategorized.total += historical.expenses
      uncategorized.count += historical.expense_rows
    } else expenseCategories.push({ category: 'No detallado', total: historical.expenses, count: historical.expense_rows })
  }
  return {
    ...report,
    historical,
    summary: {
      ...source,
      revenue: Number(source.revenue) + historical.revenue,
      cogs: historical.sale_rows ? null : source.cogs,
      gross_profit: historical.sale_rows ? null : source.gross_profit,
      expenses: Number(source.expenses) + historical.expenses,
      net_operating_result: historical.sale_rows ? null : Number(source.net_operating_result) - historical.expenses,
      purchases: Number(source.purchases) + historical.purchases,
      cashflow_estimate: Number(source.cashflow_estimate) + historical.revenue - historical.expenses - historical.purchases,
      sales_count: source.sales_count + historical.sale_rows,
      expense_count: source.expense_count + historical.expense_rows,
      purchase_count: source.purchase_count + historical.purchase_rows,
      average_ticket: historical.sale_rows ? null : source.average_ticket,
    },
    daily: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
    expense_categories: expenseCategories,
  }
}
