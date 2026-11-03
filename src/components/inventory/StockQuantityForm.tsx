import { useState, type FormEvent } from 'react'
import { Button } from '../ui/Button'
import { StatusMessage } from '../ui/StatusMessage'
import { errorMessage } from '../../lib/errors'
import { parseUnits } from '../../lib/inventory-rules'
import type { ProductRecord } from '../../types/inventory'

export function StockQuantityForm({ product, onSave, onCancel }: {
  product: ProductRecord
  onSave: (quantity: number, reason: string) => Promise<void>
  onCancel: () => void
}) {
  const [quantity, setQuantity] = useState(String(product.stock_quantity))
  const [reason, setReason] = useState('')
  const [prepared, setPrepared] = useState<{ quantity: number; reason: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    try {
      const target = parseUnits(quantity, 'Cantidad final')
      if (target === product.stock_quantity) throw new Error('La cantidad final debe ser distinta de la actual.')
      if (!reason.trim() || reason.trim().length > 500) throw new Error('Ingresá un motivo de hasta 500 caracteres.')
      setPrepared({ quantity: target, reason: reason.trim() })
    } catch (failure) { setError(errorMessage(failure)) }
  }

  async function confirm() {
    if (!prepared || busy) return
    setBusy(true)
    setError(null)
    try { await onSave(prepared.quantity, prepared.reason) }
    catch (failure) { setError(errorMessage(failure)); setPrepared(null) }
    finally { setBusy(false) }
  }

  return <form onSubmit={prepare}>
    <p>Stock actual de <b>{product.name}</b>: <b>{product.stock_quantity} unidades</b>.</p>
    <p className="formula">Usá esta opción para corregir un conteo. Si compraste mercadería, registrala en Compras.</p>
    {error && <StatusMessage message={error}/>}
    <label className="field"><span>Cantidad final en stock</span><div>
      <input type="number" min="0" max="2147483647" step="1" required value={quantity}
        onChange={event => { setQuantity(event.target.value); setPrepared(null) }}/>
    </div></label>
    <label className="field"><span>Motivo del ajuste</span><div>
      <input required maxLength={500} value={reason}
        onChange={event => { setReason(event.target.value); setPrepared(null) }} placeholder="Por ejemplo: conteo físico"/>
    </div></label>
    {prepared && <StatusMessage tone="success" message={`El stock cambiará de ${product.stock_quantity} a ${prepared.quantity} unidades (${prepared.quantity - product.stock_quantity > 0 ? '+' : ''}${prepared.quantity - product.stock_quantity}). Este ajuste quedará en el historial.`}/>}
    <div className="form-actions"><Button secondary onClick={onCancel}>Cancelar</Button>
      {prepared ? <Button disabled={busy} onClick={() => void confirm()}>{busy ? 'Guardando…' : 'Confirmar cantidad'}</Button>
        : <Button type="submit">Revisar cambio</Button>}
    </div>
  </form>
}
