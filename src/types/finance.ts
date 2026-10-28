export type ExpensePaymentMethod = 'cash' | 'transfer' | 'mercado_pago' | 'debit' | 'credit' | 'other'
export type ExpenseStatus = 'posted' | 'voided'

export type ExpenseRecord = {
  id: string; owner_id: string; expense_date: string; description: string
  category: string; amount: number; payment_method: ExpensePaymentMethod
  notes: string | null; status: ExpenseStatus; voided_at: string | null
  voided_by: string | null; void_reason: string | null
  created_at: string; updated_at: string
}
export type ExpenseAuditRecord = {
  id: string; expense_id: string; owner_id: string; actor_id: string
  action: 'created' | 'updated' | 'voided'; old_record: ExpenseRecord | null
  new_record: ExpenseRecord; created_at: string
}
export interface ExpenseInput {
  expenseDate: string; description: string; category: string; amount: number
  paymentMethod: ExpensePaymentMethod; notes: string | null
}
export interface DateRange {
  start: string
  endExclusive: string
  label: string
}
export interface FinancialSummary {
  revenue: number; cogs: number; gross_profit: number; expenses: number
  net_operating_result: number; purchases: number; cashflow_estimate: number
  sales_count: number; expense_count: number; purchase_count: number
  average_ticket: number
}
export interface FinancialDay {
  date: string; revenue: number; cogs: number; gross_profit: number
  expenses: number; purchases: number; sales_count: number
}
export interface FinancialReport {
  period: { start: string; end_exclusive: string }
  summary: FinancialSummary
  daily: FinancialDay[]
  expense_categories: { category: string; total: number; count: number }[]
  top_products: { product_id: string; name: string; units: number; direct_revenue: number }[]
  top_purchased: { product_id: string; name: string; units: number; total: number }[]
  supplier_totals: { supplier_id: string | null; name: string; total: number; purchases: number }[]
  recent_sales: { id: string; sale_number: string; sold_at: string
    payment_method: string; total_amount: number; gross_profit: number }[]
  inventory: { available_products: number; low_stock_products: number
    out_of_stock_products: number; estimated_value: number
    alerts: { id: string; name: string; stock_quantity: number; min_stock: number }[] }
}
