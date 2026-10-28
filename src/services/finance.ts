import { requireSupabase } from '../lib/supabase'
import { validateExpense } from '../lib/finance-rules'
import type { DateRange, ExpenseInput, ExpenseRecord, FinancialReport } from '../types/finance'

export async function listExpenses(range: DateRange): Promise<ExpenseRecord[]> {
  const client = requireSupabase()
  const records: ExpenseRecord[] = []
  for (let from = 0; ; from += 500) {
    const { data, error } = await client.from('expenses').select('*')
      .gte('expense_date', range.start).lt('expense_date', range.endExclusive)
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false }).order('id')
      .range(from, from + 499)
    if (error) throw error
    records.push(...(data ?? []))
    if (!data || data.length < 500) return records
  }
}
export async function listExpenseAudit(expenseId: string) {
  const { data, error } = await requireSupabase().from('expense_audit').select('*')
    .eq('expense_id', expenseId).order('created_at', { ascending: false })
  if (error) throw error
  return data
}
export async function saveExpense(id: string | null, input: ExpenseInput) {
  const valid = validateExpense(input)
  const { data, error } = await requireSupabase().rpc('save_expense', {
    p_expense_id: id, p_expense_date: valid.expenseDate,
    p_description: valid.description, p_category: valid.category,
    p_amount: valid.amount, p_payment_method: valid.paymentMethod,
    p_notes: valid.notes,
  })
  if (error) throw error
  return data
}
export async function voidExpense(id: string, reason: string) {
  const trimmed = reason.trim()
  if (!trimmed || trimmed.length > 500) throw new Error('Indicá un motivo de hasta 500 caracteres.')
  const { data, error } = await requireSupabase().rpc('void_expense', {
    p_expense_id: id, p_reason: trimmed,
  })
  if (error) throw error
  return data
}
export async function getFinancialReport(range: DateRange): Promise<FinancialReport> {
  const { data, error } = await requireSupabase().rpc('financial_report', {
    p_start_date: range.start, p_end_date: range.endExclusive,
  })
  if (error) throw error
  return data
}
