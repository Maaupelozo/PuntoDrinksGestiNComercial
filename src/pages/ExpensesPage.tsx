import { useCallback, useEffect, useRef, useState } from 'react'
import { Module } from '../components/ui/Module'
import { MiniStats } from '../components/ui/MiniStats'
import { Search } from '../components/ui/Search'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { LoadingRows } from '../components/ui/LoadingRows'
import { StatusMessage } from '../components/ui/StatusMessage'
import { ExpenseForm } from '../components/finance/ExpenseForm'
import { PeriodPicker, selectedRange } from '../components/finance/PeriodPicker'
import { useFinancialReport } from '../hooks/useFinancialReport'
import { expensePaymentLabels, periodRange, type PeriodPreset } from '../lib/finance-rules'
import { errorMessage } from '../lib/errors'
import { getFinancialReport, listExpenseAudit, listExpenses, saveExpense, voidExpense } from '../services/finance'
import { money } from '../utils/money'
import type { ExpenseAuditRecord, ExpenseInput, ExpenseRecord } from '../types/finance'

type Dialog = { kind: 'create' } | { kind: 'edit' | 'details' | 'void'; expense: ExpenseRecord }
const displayDate = (date: string) => date.split('-').reverse().join('/')

export function ExpensesPage() {
  const [preset, setPreset] = useState<PeriodPreset>('month')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const { range, error: periodError } = selectedRange(preset, from, to)
  const { report, loading: reportLoading, error: reportError, refresh: refreshReport } = useFinancialReport(range)
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([])
  const [todayTotal, setTodayTotal] = useState(0)
  const [monthTotal, setMonthTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [status, setStatus] = useState('posted')
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [audit, setAudit] = useState<ExpenseAuditRecord[]>([])
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [busy, setBusy] = useState(false)
  const refresh = useCallback(async () => {
    const current = ++requestId.current
    if (!range) { setExpenses([]); setLoading(false); setError(null); return }
    setLoading(true)
    try {
      const [records, today, month] = await Promise.all([
        listExpenses(range), getFinancialReport(periodRange('today')),
        getFinancialReport(periodRange('month')),
      ])
      if (current === requestId.current) {
        setExpenses(records); setTodayTotal(today.summary.expenses)
        setMonthTotal(month.summary.expenses); setError(null)
      }
    } catch (failure) {
      if (current === requestId.current) setError(errorMessage(failure))
    } finally { if (current === requestId.current) setLoading(false) }
  }, [range?.start, range?.endExclusive])
  useEffect(() => { void refresh(); return () => { requestId.current++ } }, [refresh])
  const categories = [...new Set(expenses.map(expense => expense.category))].sort()
  const filtered = expenses.filter(expense =>
    (status === 'all' || expense.status === status) &&
    (category === 'all' || expense.category === category) &&
    [expense.description, expense.notes ?? ''].some(value =>
      value.toLocaleLowerCase().includes(search.toLocaleLowerCase())))
  const stats: [string, string, string][] = [
    ['Gastos de hoy', money(todayTotal), 'Operativos vigentes'],
    ['Gastos del mes', money(monthTotal), 'Sin compras de mercadería'],
    ['Gastos del período', money(report?.summary.expenses ?? 0), `${report?.summary.expense_count ?? 0} registros vigentes`],
  ]
  async function save(input: ExpenseInput) {
    await saveExpense(dialog?.kind === 'edit' ? dialog.expense.id : null, input)
    await Promise.all([refresh(), refreshReport()])
    setDialog(null)
    setNotice(dialog?.kind === 'edit' ? 'Gasto actualizado.' : 'Gasto registrado.')
  }
  async function openDetails(expense: ExpenseRecord) {
    setDialog({ kind: 'details', expense }); setAudit([]); setActionError(null)
    try { setAudit(await listExpenseAudit(expense.id)) }
    catch (failure) { setActionError(errorMessage(failure)) }
  }
  async function confirmVoid(expense: ExpenseRecord) {
    if (busy) return
    setBusy(true); setActionError(null)
    try {
      await voidExpense(expense.id, voidReason)
      await Promise.all([refresh(), refreshReport()])
      setDialog(null); setVoidReason(''); setNotice('Gasto anulado. El historial de auditoría se conserva.')
    } catch (failure) { setActionError(errorMessage(failure)) }
    finally { setBusy(false) }
  }
  return <Module title="Gastos" subtitle="Egresos operativos separados de la mercadería" action="Registrar gasto" onAction={() => { setDialog({ kind: 'create' }); setActionError(null) }}>
    {notice && <StatusMessage tone="success" message={notice}/>}
    {(error || reportError) && <StatusMessage message={error || reportError || ''}/>}
    <MiniStats stats={stats}/>
    <PeriodPicker preset={preset} onPreset={setPreset} from={from} to={to} onFrom={setFrom} onTo={setTo} error={periodError}/>
    <div className="toolbar"><Search value={search} onChange={setSearch} placeholder="Buscar gastos..."/><div className="filter-wrap">
      <select aria-label="Filtrar categoría" value={category} onChange={event => setCategory(event.target.value)}><option value="all">Todas las categorías</option>{categories.map(value => <option value={value} key={value}>{value}</option>)}</select>
      <select aria-label="Filtrar estado" value={status} onChange={event => setStatus(event.target.value)}><option value="posted">Vigentes</option><option value="voided">Anulados</option><option value="all">Todos</option></select>
    </div></div>
    {loading || reportLoading ? <LoadingRows/> : filtered.length ? <div className="data-table generic expense-table">
      <div className="data-row data-head"><span>Detalle</span><span>Categoría</span><span>Fecha</span><span>Medio de pago</span><span>Importe</span><span>Estado</span></div>
      {filtered.map(expense => <div className="data-row" key={expense.id}>
        <span><button className="product-name" onClick={() => void openDetails(expense)}>{expense.description}</button></span>
        <span>{expense.category}</span><span>{displayDate(expense.expense_date)}</span>
        <span>{expensePaymentLabels[expense.payment_method]}</span><strong>{money(expense.amount)}</strong>
        <span><Badge type={expense.status === 'posted' ? 'success' : 'neutral'}>{expense.status === 'posted' ? 'Registrado' : 'Anulado'}</Badge></span>
      </div>)}</div> : <div className="empty-state">No hay gastos para mostrar en este período.</div>}
    <p className="formula">Las compras reponen inventario; sus importes no se suman a los gastos operativos.</p>
    {dialog && <Modal title={dialog.kind === 'create' ? 'Registrar gasto' : dialog.kind === 'edit' ? 'Editar gasto' : dialog.kind === 'void' ? 'Anular gasto' : dialog.expense.description} onClose={() => setDialog(null)}>
      {dialog.kind === 'create' && <ExpenseForm categories={categories} onSave={save} onCancel={() => setDialog(null)}/>}
      {dialog.kind === 'edit' && <ExpenseForm expense={dialog.expense} categories={categories} onSave={save} onCancel={() => setDialog(null)}/>}
      {dialog.kind === 'details' && <><div className="detail-grid">
        <div><span>Fecha</span><b>{displayDate(dialog.expense.expense_date)}</b></div><div><span>Categoría</span><b>{dialog.expense.category}</b></div>
        <div><span>Importe</span><b>{money(dialog.expense.amount)}</b></div><div><span>Pago</span><b>{expensePaymentLabels[dialog.expense.payment_method]}</b></div>
        <div><span>Estado</span><b>{dialog.expense.status === 'posted' ? 'Registrado' : 'Anulado'}</b></div>
        <div><span>Observaciones</span><b>{dialog.expense.notes ?? 'Sin observaciones'}</b></div>
        {dialog.expense.status === 'voided' && <><div><span>Motivo de anulación</span><b>{dialog.expense.void_reason}</b></div><div><span>Anulado el</span><b>{new Date(dialog.expense.voided_at!).toLocaleString('es-AR')}</b></div></>}
      </div><h4>Auditoría</h4><div className="history-list">{audit.map(entry => <div className="history-row" key={entry.id}><b>{entry.action === 'created' ? 'Creado' : entry.action === 'updated' ? 'Editado' : 'Anulado'}</b><strong>{new Date(entry.created_at).toLocaleString('es-AR')}</strong><small>{money(entry.old_record?.amount ?? 0)} → {money(entry.new_record.amount)}</small></div>)}</div>
      {actionError && <StatusMessage message={actionError}/>}
      {dialog.expense.status === 'posted' && <div className="form-actions"><Button secondary onClick={() => { setDialog({ kind: 'void', expense: dialog.expense }); setActionError(null) }}>Anular</Button><Button onClick={() => setDialog({ kind: 'edit', expense: dialog.expense })}>Editar</Button></div>}</>}
      {dialog.kind === 'void' && <><p>El gasto seguirá en el historial, pero dejará de sumar en los reportes.</p><label className="field"><span>Motivo de anulación</span><textarea maxLength={500} value={voidReason} onChange={event => setVoidReason(event.target.value)}/></label>{actionError && <StatusMessage message={actionError}/>}<div className="form-actions"><Button secondary onClick={() => setDialog(null)}>Cancelar</Button><Button disabled={busy || !voidReason.trim()} onClick={() => void confirmVoid(dialog.expense)}>{busy ? 'Anulando…' : 'Confirmar anulación'}</Button></div></>}
    </Modal>}
  </Module>
}
