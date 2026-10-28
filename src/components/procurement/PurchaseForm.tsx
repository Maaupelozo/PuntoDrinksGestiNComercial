import { useState, type FormEvent } from 'react'
import { Button } from '../ui/Button'
import { StatusMessage } from '../ui/StatusMessage'
import { cordobaDate, lineSubtotal, validatePurchase } from '../../lib/procurement-rules'
import { errorMessage } from '../../lib/errors'
import { money } from '../../utils/money'
import type { ProductRecord } from '../../types/inventory'
import type { PurchaseInput, SupplierRecord } from '../../types/procurement'

type DraftLine = { key: string; productId: string; quantity: string; unitCost: string }

export function PurchaseForm({ products, suppliers, onSave, onCancel }: {
  products: ProductRecord[]
  suppliers: SupplierRecord[]
  onSave: (input: PurchaseInput) => Promise<void>
  onCancel: () => void
}) {
  const activeProducts = products.filter(product => product.is_active)
  const activeSuppliers = suppliers.filter(supplier => supplier.is_active)
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const [date, setDate] = useState(() => cordobaDate())
  const [supplierId, setSupplierId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<DraftLine[]>(() => [
    { key: crypto.randomUUID(), productId: activeProducts[0]?.id ?? '', quantity: '1', unitCost: String(activeProducts[0]?.unit_cost ?? '') },
  ])
  const [prepared, setPrepared] = useState<PurchaseInput | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const total = lines.reduce((sum, line) => {
    const quantity = Number(line.quantity)
    const cost = Number(line.unitCost)
    return sum + (Number.isFinite(quantity) && Number.isFinite(cost) && quantity > 0 && cost >= 0
      ? lineSubtotal(quantity, cost) : 0)
  }, 0)

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setPrepared(null)
    setLines(current => current.map(line => line.key === key ? { ...line, ...patch } : line))
  }

  function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    try {
      const input = validatePurchase({
        idempotencyKey, purchaseDate: date, supplierId: supplierId || null,
        paymentMethod, notes,
        items: lines.map(line => ({
          productId: line.productId, quantity: Number(line.quantity), unitCost: Number(line.unitCost),
        })),
      })
      for (const item of input.items) {
        if (!activeProducts.some(product => product.id === item.productId)) {
          throw new Error('Seleccioná únicamente productos activos.')
        }
      }
      if (input.supplierId && !activeSuppliers.some(supplier => supplier.id === input.supplierId)) {
        throw new Error('Seleccioná un proveedor activo.')
      }
      setPrepared(input)
    } catch (failure) {
      setError(errorMessage(failure))
    }
  }

  async function confirm() {
    if (!prepared || busy) return
    setBusy(true)
    setError(null)
    try {
      await onSave(prepared)
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setBusy(false)
    }
  }

  return <form onSubmit={prepare}>
    {error && <StatusMessage message={error}/>}
    {!activeProducts.length && <StatusMessage message="Agregá productos activos desde Control de stock antes de registrar una compra."/>}
    <div className="form-grid">
      <label className="field"><span>Fecha de compra</span><div><input type="date" required value={date} onChange={event => { setDate(event.target.value); setPrepared(null) }}/></div></label>
      <label className="field"><span>Proveedor</span><select value={supplierId} onChange={event => { setSupplierId(event.target.value); setPrepared(null) }}><option value="">Sin proveedor</option>{activeSuppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
    </div>
    <div className="purchase-lines">
      <div className="panel-title"><h3>Productos comprados</h3><Button secondary onClick={() => { setPrepared(null); setLines(current => [...current, { key: crypto.randomUUID(), productId: '', quantity: '1', unitCost: '' }]) }} disabled={!activeProducts.length || lines.length >= 100}>Agregar línea</Button></div>
      {lines.map((line, index) => <div className="purchase-line" key={line.key}>
        <label className="select-field">Producto {index + 1}<select value={line.productId} onChange={event => {
          const product = activeProducts.find(value => value.id === event.target.value)
          updateLine(line.key, { productId: event.target.value, unitCost: product ? String(product.unit_cost) : '' })
        }} required><option value="">Seleccionar producto</option>{activeProducts.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
        <label className="field"><span>Cantidad</span><div><input type="number" min="1" step="1" required value={line.quantity} onChange={event => updateLine(line.key, { quantity: event.target.value })}/></div></label>
        <label className="field"><span>Costo unitario pagado</span><div><input type="number" min="0" step="0.01" required value={line.unitCost} onChange={event => updateLine(line.key, { unitCost: event.target.value })}/></div></label>
        <strong>{money(Number(line.quantity) * Number(line.unitCost) || 0)}</strong>
        <button type="button" aria-label={`Quitar producto ${index + 1}`} disabled={lines.length === 1} onClick={() => { setPrepared(null); setLines(current => current.filter(value => value.key !== line.key)) }}>×</button>
      </div>)}
    </div>
    <div className="form-grid">
      <label className="field"><span>Medio de pago</span><div><input maxLength={100} value={paymentMethod} onChange={event => { setPaymentMethod(event.target.value); setPrepared(null) }}/></div></label>
      <div className="purchase-total"><span>Total de compra</span><strong>{money(total)}</strong></div>
    </div>
    <label className="field"><span>Observaciones</span><textarea maxLength={2000} value={notes} onChange={event => { setNotes(event.target.value); setPrepared(null) }}/></label>
    {prepared && <StatusMessage tone="success" message={`Confirmá la compra de ${prepared.items.length} productos por ${money(total)}. Se actualizarán el stock y el costo promedio.`}/>}
    <div className="form-actions"><Button secondary onClick={onCancel}>Cancelar</Button>{prepared
      ? <Button disabled={busy} onClick={() => void confirm()}>{busy ? 'Guardando…' : 'Confirmar compra'}</Button>
      : <Button type="submit" disabled={!activeProducts.length}>Revisar compra</Button>}</div>
  </form>
}
