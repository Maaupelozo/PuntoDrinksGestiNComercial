import { useState, type FormEvent } from 'react'
import { Button } from '../ui/Button'
import { StatusMessage } from '../ui/StatusMessage'
import { cordobaDate } from '../../lib/procurement-rules'
import { expenseCategories, expensePaymentLabels, validateExpense } from '../../lib/finance-rules'
import { errorMessage } from '../../lib/errors'
import type { ExpenseInput, ExpenseRecord, ExpensePaymentMethod } from '../../types/finance'

export function ExpenseForm({ expense, categories, onSave, onCancel }: {
  expense?: ExpenseRecord; categories: string[]
  onSave: (input: ExpenseInput) => Promise<void>; onCancel: () => void
}) {
  const known = [...new Set([...expenseCategories, ...categories])]
  const initialCategory = expense?.category ?? expenseCategories[0]
  const [date, setDate] = useState(expense?.expense_date ?? cordobaDate())
  const [description, setDescription] = useState(expense?.description ?? '')
  const [category, setCategory] = useState(known.includes(initialCategory as typeof known[number]) ? initialCategory : 'custom')
  const [customCategory, setCustomCategory] = useState(category === 'custom' ? initialCategory : '')
  const [amount, setAmount] = useState(String(expense?.amount ?? ''))
  const [payment, setPayment] = useState<ExpensePaymentMethod>(expense?.payment_method ?? 'cash')
  const [notes, setNotes] = useState(expense?.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setError(null)
    try {
      const input = validateExpense({ expenseDate: date, description,
        category: category === 'custom' ? customCategory : category,
        amount: Number(amount), paymentMethod: payment, notes })
      setBusy(true)
      await onSave(input)
    } catch (failure) { setError(errorMessage(failure)) }
    finally { setBusy(false) }
  }
  return <form onSubmit={event => void submit(event)}>
    {error && <StatusMessage message={error}/>}
    <div className="form-grid">
      <label className="field"><span>Fecha del gasto</span><div><input type="date" required value={date} onChange={event => setDate(event.target.value)}/></div></label>
      <label className="field"><span>Concepto</span><div><input required maxLength={300} value={description} onChange={event => setDescription(event.target.value)}/></div></label>
      <label className="field"><span>Categoría</span><select value={category} onChange={event => setCategory(event.target.value)}>{known.map(value => <option value={value} key={value}>{value}</option>)}<option value="custom">Nueva categoría…</option></select></label>
      <label className="field"><span>Importe</span><div><input type="number" min="0.01" step="0.01" required value={amount} onChange={event => setAmount(event.target.value)}/></div></label>
      {category === 'custom' && <label className="field"><span>Nueva categoría</span><div><input required maxLength={100} value={customCategory} onChange={event => setCustomCategory(event.target.value)}/></div></label>}
      <label className="field"><span>Método de pago</span><select value={payment} onChange={event => setPayment(event.target.value as ExpensePaymentMethod)}>{Object.entries(expensePaymentLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
    </div>
    <label className="field"><span>Observaciones opcionales</span><textarea maxLength={2000} value={notes} onChange={event => setNotes(event.target.value)}/></label>
    <p className="formula">Los gastos operativos se muestran separados de las compras de mercadería.</p>
    <div className="form-actions"><Button secondary onClick={onCancel}>Cancelar</Button><Button type="submit" disabled={busy}>{busy ? 'Guardando…' : expense ? 'Guardar cambios' : 'Registrar gasto'}</Button></div>
  </form>
}
