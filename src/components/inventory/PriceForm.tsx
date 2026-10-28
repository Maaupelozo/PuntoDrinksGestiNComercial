import { useState, type FormEvent } from 'react'
import { Button } from '../ui/Button'
import { StatusMessage } from '../ui/StatusMessage'
import { parseMoney } from '../../lib/inventory-rules'
import { errorMessage } from '../../lib/errors'
import type { ProductRecord } from '../../types/inventory'

export function PriceForm({ product, onSave, onCancel }: {
  product: ProductRecord
  onSave: (cost: number, price: number) => Promise<void>
  onCancel: () => void
}) {
  const [cost, setCost] = useState(String(product.unit_cost))
  const [price, setPrice] = useState(String(product.sale_price))
  const [pending, setPending] = useState<{ cost: number; price: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    try {
      const next = { cost: parseMoney(cost, 'Costo unitario'), price: parseMoney(price, 'Precio de venta') }
      if (next.cost === product.unit_cost && next.price === product.sale_price) throw new Error('No hay cambios para guardar.')
      setPending(next)
    } catch (failure) { setError(errorMessage(failure)) }
  }

  async function confirm() {
    if (!pending) return
    setBusy(true)
    setError(null)
    try { await onSave(pending.cost, pending.price) }
    catch (failure) { setError(errorMessage(failure)); setPending(null) }
    finally { setBusy(false) }
  }

  return <form onSubmit={prepare}>
    <p>{product.name}</p>
    {error && <StatusMessage message={error}/>}
    <div className="form-grid">
      <label className="field"><span>Costo unitario</span><div><input type="number" step="0.01" min="0" required value={cost} onChange={event => { setCost(event.target.value); setPending(null) }}/><em>$</em></div></label>
      <label className="field"><span>Precio de venta</span><div><input type="number" step="0.01" min="0" required value={price} onChange={event => { setPrice(event.target.value); setPending(null) }}/><em>$</em></div></label>
    </div>
    {pending && <StatusMessage tone="success" message="Confirmá el cambio de costo y precio. Quedará registrado en el historial."/>}
    <div className="form-actions"><Button secondary onClick={onCancel}>Cancelar</Button>{pending ? <Button disabled={busy} onClick={() => void confirm()}>{busy ? 'Guardando…' : 'Confirmar cambio'}</Button> : <Button type="submit">Continuar</Button>}</div>
  </form>
}
