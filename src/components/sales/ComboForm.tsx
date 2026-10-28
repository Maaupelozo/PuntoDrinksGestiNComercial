import { useState, type FormEvent } from 'react'
import { Button } from '../ui/Button'
import { StatusMessage } from '../ui/StatusMessage'
import { errorMessage } from '../../lib/errors'
import { comboMargin, validateCombo } from '../../lib/sales-rules'
import { money } from '../../utils/money'
import type { ProductRecord } from '../../types/inventory'
import type { ComboInput, ComboItemRecord, ComboRecord } from '../../types/sales'

type DraftLine = { key: string; productId: string; quantity: string }

export function ComboForm({ combo, items = [], products, onSave, onCancel }: {
  combo?: ComboRecord; items?: ComboItemRecord[]; products: ProductRecord[]
  onSave: (input: ComboInput) => Promise<void>; onCancel: () => void
}) {
  const active = products.filter(product => product.is_active)
  const [name, setName] = useState(combo?.name ?? '')
  const [description, setDescription] = useState(combo?.description ?? '')
  const [price, setPrice] = useState(String(combo?.sale_price ?? ''))
  const [lines, setLines] = useState<DraftLine[]>(items.length
    ? items.map(item => ({ key: item.id, productId: item.product_id, quantity: String(item.quantity) }))
    : [{ key: crypto.randomUUID(), productId: '', quantity: '1' }])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cost = lines.reduce((sum, line) => {
    const product = products.find(value => value.id === line.productId)
    return sum + (product?.unit_cost ?? 0) * (Number(line.quantity) || 0)
  }, 0)
  const amount = Number(price) || 0

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setError(null)
    try {
      const input = validateCombo({ name, description, salePrice: Number(price),
        items: lines.map(line => ({ productId: line.productId, quantity: Number(line.quantity) })) })
      if (input.items.some(item => !active.some(product => product.id === item.productId)))
        throw new Error('Seleccioná productos activos.')
      setBusy(true)
      await onSave(input)
    } catch (failure) { setError(errorMessage(failure)) }
    finally { setBusy(false) }
  }

  return <form onSubmit={event => void submit(event)}>
    {error && <StatusMessage message={error}/>}
    {!active.length && <StatusMessage message="Creá productos activos en Stock antes de armar un combo."/>}
    <div className="form-grid">
      <label className="field"><span>Nombre del combo</span><div><input required maxLength={160} value={name} onChange={event => setName(event.target.value)}/></div></label>
      <label className="field"><span>Precio promocional</span><div><input type="number" required min="0" step="0.01" value={price} onChange={event => setPrice(event.target.value)}/></div></label>
    </div>
    <label className="field"><span>Descripción opcional</span><textarea maxLength={2000} value={description} onChange={event => setDescription(event.target.value)}/></label>
    <div className="purchase-lines">
      <div className="panel-title"><h3>Componentes</h3><Button secondary disabled={lines.length >= 100 || !active.length} onClick={() => setLines(current => [...current, { key: crypto.randomUUID(), productId: '', quantity: '1' }])}>Agregar producto</Button></div>
      {lines.map((line, index) => <div className="combo-form-line" key={line.key}>
        <label className="select-field">Producto {index + 1}<select required value={line.productId} onChange={event => setLines(current => current.map(value => value.key === line.key ? { ...value, productId: event.target.value } : value))}>
          <option value="">Seleccionar producto</option>{active.map(product => <option value={product.id} key={product.id}>{product.name}</option>)}
        </select></label>
        <label className="field"><span>Cantidad</span><div><input type="number" min="1" step="1" required value={line.quantity} onChange={event => setLines(current => current.map(value => value.key === line.key ? { ...value, quantity: event.target.value } : value))}/></div></label>
        <button type="button" aria-label={`Quitar componente ${index + 1}`} disabled={lines.length === 1} onClick={() => setLines(current => current.filter(value => value.key !== line.key))}>×</button>
      </div>)}
    </div>
    <div className="combo-calculation"><span>Costo actual <b>{money(cost)}</b></span><span>Ganancia estimada <b>{money(amount - cost)}</b></span><span>Margen bruto <b>{comboMargin(amount, cost)}%</b></span></div>
    <p className="formula">La venta guardará el precio y los costos vigentes al confirmarse.</p>
    <div className="form-actions"><Button secondary onClick={onCancel}>Cancelar</Button><Button type="submit" disabled={busy || !active.length}>{busy ? 'Guardando…' : combo ? 'Guardar cambios' : 'Crear combo'}</Button></div>
  </form>
}
