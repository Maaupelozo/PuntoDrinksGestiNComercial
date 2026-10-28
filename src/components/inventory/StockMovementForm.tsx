import { useState, type FormEvent } from 'react'
import { Button } from '../ui/Button'
import { StatusMessage } from '../ui/StatusMessage'
import { errorMessage } from '../../lib/errors'
import { parseUnits, validateMovement } from '../../lib/inventory-rules'
import type { MovementType, ProductRecord, StockAdjustment } from '../../types/inventory'

export function StockMovementForm({ product, initialType = 'entry', onSave, onCancel }: {
  product: ProductRecord
  initialType?: MovementType
  onSave: (input: StockAdjustment) => Promise<void>
  onCancel: () => void
}) {
  const [type, setType] = useState<MovementType>(initialType)
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState<StockAdjustment | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    try {
      const amount = type === 'adjustment' ? Number(quantity) : parseUnits(quantity, 'Cantidad')
      const delta = type === 'exit' ? -amount : amount
      validateMovement(type, delta, reason, product.stock_quantity)
      setPending({ productId: product.id, type, delta, reason: reason.trim() })
    } catch (failure) { setError(errorMessage(failure)) }
  }

  async function confirm() {
    if (!pending) return
    setBusy(true)
    setError(null)
    try { await onSave(pending) } catch (failure) { setError(errorMessage(failure)); setPending(null) }
    finally { setBusy(false) }
  }

  return <form onSubmit={prepare}>
    <p>Stock disponible: <b>{product.stock_quantity} unidades</b></p>
    {error && <StatusMessage message={error}/>}
    <label className="select-field">Tipo de movimiento<select value={type} onChange={event => { setType(event.target.value as MovementType); setPending(null) }}>
      <option value="entry">Entrada</option><option value="exit">Salida</option><option value="adjustment">Ajuste</option>
    </select></label>
    <label className="field"><span>{type === 'adjustment' ? 'Variación de unidades (positiva o negativa)' : 'Cantidad de unidades'}</span><div>
      <input type="number" step="1" min={type === 'adjustment' ? undefined : '1'} value={quantity} onChange={event => { setQuantity(event.target.value); setPending(null) }} required/>
    </div></label>
    <label className="field"><span>Motivo</span><div><input value={reason} maxLength={500} onChange={event => { setReason(event.target.value); setPending(null) }} required/></div></label>
    {pending && <StatusMessage tone="success" message={`Confirmá ${pending.type === 'entry' ? 'la entrada' : pending.type === 'exit' ? 'la salida' : 'el ajuste'} de ${Math.abs(pending.delta)} unidades. Stock resultante: ${product.stock_quantity + pending.delta}.`}/>}
    <div className="form-actions"><Button secondary onClick={onCancel}>Cancelar</Button>{pending ? <Button onClick={() => void confirm()} disabled={busy}>{busy ? 'Guardando…' : 'Confirmar movimiento'}</Button> : <Button type="submit">Continuar</Button>}</div>
  </form>
}
