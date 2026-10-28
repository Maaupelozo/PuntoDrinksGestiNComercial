import { parseMoney } from './inventory-rules'
import { cordobaDate } from './procurement-rules'
import type { DateRange, ExpenseInput, FinancialDay } from '../types/finance'

export const expenseCategories = [
  'Combustible', 'Transporte', 'Bolsas y embalaje', 'Comisiones',
  'Servicios', 'Publicidad y marketing', 'Mantenimiento', 'Otros gastos',
] as const
export const expensePaymentLabels = {
  cash: 'Efectivo', transfer: 'Transferencia', mercado_pago: 'Mercado Pago',
  debit: 'Débito', credit: 'Crédito', other: 'Otro',
} as const
export type PeriodPreset = 'today' | 'yesterday' | 'week' | 'month' |
  'previousMonth' | 'last7' | 'last30' | 'custom'

export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}
export function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
export function dayCount(start: string, endExclusive: string) {
  return Math.round((Date.parse(`${endExclusive}T12:00:00Z`) -
    Date.parse(`${start}T12:00:00Z`)) / 86400000)
}
export function periodRange(preset: PeriodPreset, today = cordobaDate(),
  customFrom = '', customTo = ''): DateRange {
  if (!validDate(today)) throw new Error('Fecha actual inválida.')
  const tomorrow = addDays(today, 1)
  const monthStart = `${today.slice(0, 7)}-01`
  const nextMonth = today.slice(5, 7) === '12'
    ? `${Number(today.slice(0, 4)) + 1}-01-01`
    : `${today.slice(0, 4)}-${String(Number(today.slice(5, 7)) + 1).padStart(2, '0')}-01`
  const previousMonthEnd = monthStart
  const previousMonthStart = `${addDays(monthStart, -1).slice(0, 7)}-01`
  const weekday = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7
  const ranges: Record<Exclude<PeriodPreset, 'custom'>, DateRange> = {
    today: { start: today, endExclusive: tomorrow, label: 'Hoy' },
    yesterday: { start: addDays(today, -1), endExclusive: today, label: 'Ayer' },
    week: { start: addDays(today, -weekday), endExclusive: tomorrow, label: 'Esta semana' },
    month: { start: monthStart, endExclusive: nextMonth, label: 'Este mes' },
    previousMonth: { start: previousMonthStart, endExclusive: previousMonthEnd, label: 'Mes anterior' },
    last7: { start: addDays(today, -6), endExclusive: tomorrow, label: 'Últimos 7 días' },
    last30: { start: addDays(today, -29), endExclusive: tomorrow, label: 'Últimos 30 días' },
  }
  if (preset !== 'custom') return ranges[preset]
  if (!validDate(customFrom) || !validDate(customTo) || customTo < customFrom ||
    dayCount(customFrom, addDays(customTo, 1)) > 3660) {
    throw new Error('Elegí un período válido de hasta diez años.')
  }
  return { start: customFrom, endExclusive: addDays(customTo, 1),
    label: `${customFrom.split('-').reverse().join('/')} al ${customTo.split('-').reverse().join('/')}` }
}
export function previousEquivalentRange(range: DateRange): DateRange {
  const days = dayCount(range.start, range.endExclusive)
  return { start: addDays(range.start, -days), endExclusive: range.start,
    label: 'Período anterior equivalente' }
}
export function percentChange(current: number, previous: number) {
  return previous === 0 ? null : (current - previous) / Math.abs(previous) * 100
}
export function validateExpense(input: ExpenseInput): ExpenseInput {
  const description = input.description.trim()
  const category = input.category.trim()
  const notes = input.notes?.trim() || null
  if (!validDate(input.expenseDate) || input.expenseDate < '1900-01-01' ||
    input.expenseDate > '2100-12-31') throw new Error('Ingresá una fecha válida.')
  if (!description || description.length > 300) throw new Error('Ingresá un concepto de hasta 300 caracteres.')
  if (!category || category.length > 100) throw new Error('Ingresá una categoría de hasta 100 caracteres.')
  parseMoney(String(input.amount), 'Importe')
  if (input.amount <= 0) throw new Error('El importe debe ser mayor que cero.')
  if (!(input.paymentMethod in expensePaymentLabels)) throw new Error('Elegí un medio de pago válido.')
  if (notes && notes.length > 2000) throw new Error('Las observaciones son demasiado largas.')
  return { ...input, description, category, notes }
}

export type Grouping = 'day' | 'week' | 'month'
export function groupFinancialDays(days: FinancialDay[], grouping: Grouping) {
  const groups = new Map<string, { key: string; revenue: number; cogs: number;
    expenses: number; purchases: number; salesCount: number }>()
  for (const day of days) {
    const key = grouping === 'day' ? day.date : grouping === 'month'
      ? day.date.slice(0, 7) : addDays(day.date,
        -((new Date(`${day.date}T12:00:00Z`).getUTCDay() + 6) % 7))
    const group = groups.get(key) ?? { key, revenue: 0, cogs: 0, expenses: 0,
      purchases: 0, salesCount: 0 }
    group.revenue += Number(day.revenue)
    group.cogs += Number(day.cogs)
    group.expenses += Number(day.expenses)
    group.purchases += Number(day.purchases)
    group.salesCount += day.sales_count
    groups.set(key, group)
  }
  return [...groups.values()]
}
