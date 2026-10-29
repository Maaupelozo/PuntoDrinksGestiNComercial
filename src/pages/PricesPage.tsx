import { useEffect, useMemo, useState } from 'react'
import { Module } from '../components/ui/Module'
import { ProductPic } from '../components/ui/ProductPic'
import { Icon } from '../components/ui/Icon'
import { PanelTitle } from '../components/ui/PanelTitle'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Search } from '../components/ui/Search'
import { Modal } from '../components/ui/Modal'
import { LoadingRows } from '../components/ui/LoadingRows'
import { StatusMessage } from '../components/ui/StatusMessage'
import { PriceForm } from '../components/inventory/PriceForm'
import { HistoryList } from '../components/inventory/HistoryList'
import { useInventory } from '../context/InventoryContext'
import { updatePrices } from '../services/inventory'
import { errorMessage } from '../lib/errors'
import { parseMoney, profitability, suggestedPrice } from '../lib/inventory-rules'
import { money } from '../utils/money'
import type { ProductRecord } from '../types/inventory'

function percent(value: number | null) { return value === null ? '—' : `${value.toFixed(1)}%` }

type Dialog = { kind: 'details' | 'edit' | 'history'; product: ProductRecord }

export function PricesPage() {
  const { products, loading, error, refresh } = useInventory()
  const activeProducts = products.filter(product => product.is_active)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState('name')
  const [selectedId, setSelectedId] = useState('')
  const [cost, setCost] = useState('')
  const [percentage, setPercentage] = useState('40')
  const [method, setMethod] = useState<'markup' | 'margin'>('markup')
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [calculatorError, setCalculatorError] = useState<string | null>(null)
  const [pending, setPending] = useState<{ product: ProductRecord; cost: number; price: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const selected = activeProducts.find(product => product.id === selectedId) ?? activeProducts[0]
  const categories = useMemo(() => [...new Set(activeProducts.map(product => product.category))].sort(), [products])
  const filtered = activeProducts.filter(product => product.name.toLowerCase().includes(search.toLowerCase()) && (category === 'all' || product.category === category))
    .sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      const aValue = profitability(a.unit_cost, a.sale_price).markup ?? -Infinity
      const bValue = profitability(b.unit_cost, b.sale_price).markup ?? -Infinity
      return sort === 'profit-desc' ? bValue - aValue : aValue - bValue
    })

  useEffect(() => { setCost(selected ? String(selected.unit_cost) : '') }, [selected?.id, selected?.unit_cost])

  let suggested: number | null = null
  let calculationError: string | null = null
  try {
    if (cost && percentage) suggested = suggestedPrice(parseMoney(cost, 'Costo unitario'), Number(percentage), method)
  } catch (failure) { calculationError = errorMessage(failure) }
  const costNumber = cost ? Number(cost) : 0
  const result = suggested === null ? null : profitability(costNumber, suggested)

  async function applySuggested() {
    if (!pending) return
    setBusy(true)
    setCalculatorError(null)
    try {
      await updatePrices(pending.product.id, pending.cost, pending.price)
      await refresh()
      setNotice(`Precio de ${pending.product.name} actualizado.`)
      setPending(null)
    } catch (failure) { setCalculatorError(errorMessage(failure)) }
    finally { setBusy(false) }
  }

  function prepareSuggested() {
    setCalculatorError(null)
    try {
      if (!selected || suggested === null || !percentage.trim()) throw new Error('Seleccioná un producto y completá los valores de la calculadora.')
      const price = Math.round((suggested + Number.EPSILON) * 100) / 100
      if (price === selected.sale_price && costNumber === selected.unit_cost) throw new Error('El producto ya tiene ese costo y precio.')
      setPending({ product: selected, cost: parseMoney(cost, 'Costo unitario'), price })
    } catch (failure) { setCalculatorError(errorMessage(failure)) }
  }

  return <Module title="Precios y rentabilidad" subtitle="Costos, márgenes y precios de venta" action="Actualizar precios" onAction={() => { if (selected) setDialog({ kind: 'edit', product: selected }) }}>
    {notice && <StatusMessage tone="success" message={notice}/>}
    {error && <StatusMessage message={error}/>}
    <div className="toolbar"><Search value={search} onChange={setSearch} placeholder="Buscar productos..."/><div className="filter-wrap">
      <select aria-label="Filtrar categoría" value={category} onChange={event => setCategory(event.target.value)}><option value="all">Categoría: Todas</option>{categories.map(value => <option key={value} value={value}>{value}</option>)}</select>
      <select aria-label="Ordenar por rentabilidad" value={sort} onChange={event => setSort(event.target.value)}><option value="name">Orden: Nombre</option><option value="profit-desc">Rentabilidad: Mayor</option><option value="profit-asc">Rentabilidad: Menor</option></select>
    </div></div>
    <div className="price-layout"><div>
      {loading ? <LoadingRows/> : filtered.length ? <div className="data-table price-table">
        <div className="data-row data-head"><span>Producto</span><span>Costo unitario</span><span>Precio venta</span><span>Ganancia</span><span>Margen / Recargo</span><span/></div>
        {filtered.map(product => { const metrics = profitability(product.unit_cost, product.sale_price); const pendingCost = Number(product.unit_cost) <= 0; return <div className="data-row" key={product.id}>
          <span className="product-cell"><ProductPic product={product}/><button className="product-name" onClick={() => setDialog({ kind: 'details', product })}>{product.name}</button></span>
          <span>{pendingCost ? 'Pendiente' : money(product.unit_cost)}</span><strong>{money(product.sale_price)}</strong>
          <span className={metrics.profit < 0 ? 'profit negative' : 'profit'}>{pendingCost ? 'Pendiente' : money(metrics.profit)}</span>
          <span><b>{pendingCost ? '—' : percent(metrics.margin)}</b><small>{pendingCost ? 'Costo por confirmar' : `${percent(metrics.markup)} sobre costo`}</small>{!pendingCost && metrics.profit < 0 && <Badge type="danger">Margen negativo</Badge>}</span>
          <button aria-label={`Ver precios de ${product.name}`} title={`Ver precios de ${product.name}`} onClick={() => setDialog({ kind: 'details', product })}><Icon name="dots"/></button>
        </div>})}
      </div> : <div className="empty-state">No hay productos para mostrar. Agregá uno desde Control de stock.</div>}
    </div>
    <aside className="panel calculator">
      <PanelTitle title="Calculadora de precios" subtitle="Simulá sin modificar el precio actual"/>
      <label className="select-field">Producto<select aria-label="Producto de la calculadora" value={selected?.id ?? ''} onChange={event => { setSelectedId(event.target.value); setPending(null) }} disabled={!activeProducts.length}>
        {activeProducts.length ? activeProducts.map(product => <option key={product.id} value={product.id}>{product.name}</option>) : <option value="">Sin productos</option>}
      </select></label>
      <label className="field"><span>Costo del producto</span><div><input type="number" min="0" step="0.01" value={cost} onChange={event => { setCost(event.target.value); setPending(null) }}/><em>$</em></div></label>
      <div className="method"><span>Método de cálculo</span><button className={method === 'markup' ? 'active' : ''} onClick={() => { setMethod('markup'); setPending(null) }}>Recargo sobre costo</button><button className={method === 'margin' ? 'active' : ''} onClick={() => { setMethod('margin'); setPending(null) }}>Margen sobre venta</button></div>
      <label className="range"><span>Porcentaje deseado <b>{percentage || '—'}%</b></span><input type="range" min="0" max="99" value={Math.min(99, Math.max(0, Number(percentage) || 0))} onChange={event => { setPercentage(event.target.value); setPending(null) }}/></label>
      <input className="percentage-input" type="number" min="0" max={method === 'margin' ? '99.99' : undefined} step="0.01" aria-label="Porcentaje deseado" value={percentage} onChange={event => { setPercentage(event.target.value); setPending(null) }}/>
      {(calculationError || calculatorError) && <StatusMessage message={calculatorError ?? calculationError!}/>}
      <div className="suggestion"><span>Precio sugerido</span><strong>{suggested === null ? '—' : money(suggested)}</strong><div><span>Ganancia estimada <b>{result ? money(result.profit) : '—'}</b></span><span>Margen bruto <b>{result ? percent(result.margin) : '—'}</b></span><span>Sobre costo <b>{result ? percent(result.markup) : '—'}</b></span></div></div>
      {pending && <StatusMessage tone="success" message={`Confirmá el costo ${money(pending.cost)} y el precio ${money(pending.price)} para ${pending.product.name}. El cambio quedará en el historial.`}/>}
      {pending ? <Button className="confirm" disabled={busy} onClick={() => void applySuggested()}>{busy ? 'Guardando…' : 'Confirmar nuevo precio'}</Button> : <Button className="confirm" disabled={!selected || suggested === null} onClick={prepareSuggested}>Aplicar al producto</Button>}
      <p className="formula">Los cambios solo se aplican a ventas futuras. El historial conserva sus valores originales.</p>
    </aside></div>
    {dialog && <Modal title={dialog.kind === 'history' ? `Historial de ${dialog.product.name}` : dialog.kind === 'edit' ? 'Editar costo y precio' : dialog.product.name} onClose={() => setDialog(null)}>
      {dialog.kind === 'edit' && <PriceForm product={dialog.product} onCancel={() => setDialog(null)} onSave={async (unitCost, salePrice) => { await updatePrices(dialog.product.id, unitCost, salePrice); await refresh(); setDialog(null); setNotice(`Precio de ${dialog.product.name} actualizado.`) }}/ >}
      {dialog.kind === 'history' && <HistoryList kind="price" productId={dialog.product.id}/>}
      {dialog.kind === 'details' && <><div className="detail-grid"><div><span>Producto</span><b>{dialog.product.name}</b></div><div><span>Costo</span><b>{Number(dialog.product.unit_cost) <= 0 ? 'Pendiente' : money(dialog.product.unit_cost)}</b></div><div><span>Precio de venta</span><b>{money(dialog.product.sale_price)}</b></div><div><span>Ganancia por unidad</span><b>{Number(dialog.product.unit_cost) <= 0 ? 'Pendiente' : money(profitability(dialog.product.unit_cost, dialog.product.sale_price).profit)}</b></div><div><span>Margen bruto</span><b>{Number(dialog.product.unit_cost) <= 0 ? '—' : percent(profitability(dialog.product.unit_cost, dialog.product.sale_price).margin)}</b></div><div><span>Sobre costo</span><b>{Number(dialog.product.unit_cost) <= 0 ? '—' : percent(profitability(dialog.product.unit_cost, dialog.product.sale_price).markup)}</b></div></div><div className="form-actions"><Button secondary onClick={() => setDialog({ kind: 'history', product: dialog.product })}>Historial</Button><Button onClick={() => setDialog({ kind: 'edit', product: dialog.product })}>Editar</Button></div></>}
    </Modal>}
  </Module>
}
