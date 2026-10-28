import { useState, type FormEvent } from 'react'
import { Button } from '../ui/Button'
import { StatusMessage } from '../ui/StatusMessage'
import { errorMessage } from '../../lib/errors'
import { parseMoney, parseUnits, validateProduct } from '../../lib/inventory-rules'
import type { ProductInput, ProductRecord } from '../../types/inventory'
import { useBusinessSettings } from '../../context/BusinessSettingsContext'
import { useEffect } from 'react'

export function ProductForm({ product, onSave, onCancel }: {
  product?: ProductRecord
  onSave: (input: ProductInput) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(product?.name ?? '')
  const [category, setCategory] = useState(product?.category ?? '')
  const [sku, setSku] = useState(product?.sku ?? '')
  const [cost, setCost] = useState(String(product?.unit_cost ?? ''))
  const [price, setPrice] = useState(String(product?.sale_price ?? ''))
  const [stock, setStock] = useState('0')
  const { settings } = useBusinessSettings()
  const [minimum, setMinimum] = useState(String(product?.min_stock ?? settings.default_min_stock))
  const [minimumTouched, setMinimumTouched] = useState(false)
  useEffect(() => {
    if (!product && !minimumTouched) setMinimum(String(settings.default_min_stock))
  }, [product, minimumTouched, settings.default_min_stock])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const input = validateProduct({
        name, category, sku,
        unitCost: parseMoney(cost, 'Costo unitario'),
        salePrice: parseMoney(price, 'Precio de venta'),
        initialStock: product ? 0 : parseUnits(stock, 'Stock inicial'),
        minStock: parseUnits(minimum, 'Stock mínimo'),
      })
      await onSave(input)
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setBusy(false)
    }
  }

  return <form onSubmit={submit}>
    {error && <StatusMessage message={error}/>}
    <div className="form-grid">
      <label className="field"><span>Nombre</span><div><input value={name} maxLength={160} required onChange={event => setName(event.target.value)}/></div></label>
      <label className="field"><span>Categoría</span><div><input value={category} maxLength={100} required onChange={event => setCategory(event.target.value)}/></div></label>
      <label className="field"><span>SKU (opcional)</span><div><input value={sku} maxLength={80} onChange={event => setSku(event.target.value)}/></div></label>
      <label className="field"><span>Costo unitario</span><div><input type="number" min="0" step="0.01" value={cost} required onChange={event => setCost(event.target.value)}/><em>$</em></div></label>
      <label className="field"><span>Precio de venta</span><div><input type="number" min="0" step="0.01" value={price} required onChange={event => setPrice(event.target.value)}/><em>$</em></div></label>
      {!product && <label className="field"><span>Stock inicial</span><div><input type="number" min="0" step="1" value={stock} required onChange={event => setStock(event.target.value)}/></div></label>}
      <label className="field"><span>Stock mínimo</span><div><input type="number" min="0" step="1" value={minimum} required onChange={event => { setMinimumTouched(true); setMinimum(event.target.value) }}/></div></label>
    </div>
    {product && <p className="formula">Para modificar el stock usá Entrada, Salida o Ajuste en Control de stock.</p>}
    <div className="form-actions"><Button secondary onClick={onCancel}>Cancelar</Button><Button type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar producto'}</Button></div>
  </form>
}
