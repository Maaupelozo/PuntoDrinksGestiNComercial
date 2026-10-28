import { useRef, useState } from 'react'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { Search } from '../components/ui/Search'
import { ProductPic } from '../components/ui/ProductPic'
import { PanelTitle } from '../components/ui/PanelTitle'
import { MiniStats } from '../components/ui/MiniStats'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { LoadingRows } from '../components/ui/LoadingRows'
import { StatusMessage } from '../components/ui/StatusMessage'
import { useInventory } from '../context/InventoryContext'
import { useSales } from '../context/SalesContext'
import { confirmSale } from '../services/sales'
import { cartNeeds, comboAvailability, comboCost } from '../lib/sales-rules'
import { cordobaDate, purchaseTimeZone } from '../lib/procurement-rules'
import { errorMessage } from '../lib/errors'
import { money } from '../utils/money'
import type { PaymentMethod, SaleInput, SaleRecord } from '../types/sales'

type CartLine = { kind: 'product' | 'combo'; id: string; quantity: number }
type View = 'new' | 'history'
type Period = 'today' | 'month' | 'all' | 'custom'
const paymentLabels: Record<PaymentMethod, string> = {
  cash: 'Efectivo', transfer: 'Transferencia', mercado_pago: 'Mercado Pago',
}
const localDate = (value: string) => cordobaDate(new Date(value))
const dateTime = (value: string) => new Date(value).toLocaleString('es-AR', { timeZone: purchaseTimeZone })

export function SalesPage() {
  const { products, loading: inventoryLoading, error: inventoryError, refresh: refreshInventory } = useInventory()
  const { combos, comboItems, sales, saleItems, components, loading, error, refresh } = useSales()
  const [view, setView] = useState<View>('new')
  const [search, setSearch] = useState('')
  const [catalog, setCatalog] = useState<'all' | 'products' | 'combos'>('all')
  const [cart, setCart] = useState<CartLine[]>([])
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [period, setPeriod] = useState<Period>('month')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [historySearch, setHistorySearch] = useState('')
  const [prepared, setPrepared] = useState<SaleInput | null>(null)
  const [detail, setDetail] = useState<SaleRecord | null>(null)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const idempotencyKey = useRef<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const today = cordobaDate()
  const month = today.slice(0, 7)
  const currentProducts = products.filter(product => product.is_active)
  const currentCombos = combos.filter(combo => combo.is_active)
  const inputItems = (lines: CartLine[]) => lines.map(line => ({
    ...(line.kind === 'product' ? { productId: line.id } : { comboId: line.id }),
    quantity: line.quantity,
  }))
  const needs = cartNeeds(inputItems(cart), combos, comboItems)
  const shortage = [...needs].find(([id, quantity]) => {
    const product = products.find(value => value.id === id)
    return !product?.is_active || quantity > product.stock_quantity
  })
  const lineName = (line: CartLine) => line.kind === 'product'
    ? products.find(value => value.id === line.id)?.name ?? 'Producto no disponible'
    : combos.find(value => value.id === line.id)?.name ?? 'Combo no disponible'
  const linePrice = (line: CartLine) => Number(line.kind === 'product'
    ? products.find(value => value.id === line.id)?.sale_price ?? 0
    : combos.find(value => value.id === line.id)?.sale_price ?? 0)
  const total = cart.reduce((sum, line) => sum + linePrice(line) * line.quantity, 0)
  const filteredSales = sales.filter(sale => {
    const date = localDate(sale.sold_at)
    const inPeriod = period === 'all' || period === 'today' && date === today ||
      period === 'month' && date.startsWith(month) || period === 'custom' &&
      (!fromDate || date >= fromDate) && (!toDate || date <= toDate)
    const names = saleItems.filter(item => item.sale_id === sale.id).map(item => item.item_name)
    return inPeriod && [sale.id, sale.sale_number, paymentLabels[sale.payment_method], ...names]
      .some(value => value.toLocaleLowerCase().includes(historySearch.toLocaleLowerCase()))
  })
  const todaySales = sales.filter(sale => localDate(sale.sold_at) === today)
  const monthSales = sales.filter(sale => localDate(sale.sold_at).startsWith(month))
  const count = filteredSales.length
  const stats: [string, string, string][] = [
    ['Vendido hoy', money(todaySales.reduce((sum, sale) => sum + Number(sale.total_amount), 0)), `${todaySales.length} ventas`],
    ['Vendido este mes', money(monthSales.reduce((sum, sale) => sum + Number(sale.total_amount), 0)), `${monthSales.length} ventas`],
    ['Ventas del período', String(count), `${period === 'all' ? 'Todo el historial' : period === 'today' ? 'Hoy' : period === 'month' ? 'Este mes' : 'Personalizado'}`],
    ['Ganancia bruta', money(filteredSales.reduce((sum, sale) => sum + Number(sale.gross_profit), 0)), 'Antes de gastos operativos'],
    ['Ticket promedio', money(count ? filteredSales.reduce((sum, sale) => sum + Number(sale.total_amount), 0) / count : 0), `${count} operaciones`],
  ]

  function changeCart(next: CartLine[]) {
    setCart(next)
    setPrepared(null)
    idempotencyKey.current = null
    setActionError(null)
  }
  function add(kind: CartLine['kind'], id: string) {
    const current = cart.find(line => line.kind === kind && line.id === id)
    const next = current ? cart.map(line => line === current ? { ...line, quantity: line.quantity + 1 } : line)
      : [...cart, { kind, id, quantity: 1 }]
    const required = cartNeeds(inputItems(next), combos, comboItems)
    const over = [...required].some(([productId, quantity]) =>
      quantity > (products.find(product => product.id === productId)?.stock_quantity ?? 0))
    if (over) { setActionError('Stock insuficiente para agregar ese artículo.'); return }
    changeCart(next)
  }
  function prepare() {
    if (!cart.length || shortage) return
    setActionError(null)
    idempotencyKey.current ??= crypto.randomUUID()
    setPrepared({ idempotencyKey: idempotencyKey.current, paymentMethod: method, items: inputItems(cart) })
  }
  async function confirm() {
    if (!prepared || busyRef.current) return
    busyRef.current = true
    setBusy(true); setActionError(null)
    try {
      const saved = await confirmSale(prepared)
      await Promise.all([refresh(), refreshInventory()])
      setCart([]); setPrepared(null); idempotencyKey.current = null; setDetail(saved); setNotice(`Venta confirmada por ${money(saved.total_amount)}. Ganancia bruta: ${money(saved.gross_profit)}.`)
    } catch (failure) { setActionError(errorMessage(failure)) }
    finally { busyRef.current = false; setBusy(false) }
  }
  function showHistory() { setView('history'); setPrepared(null) }

  return <div className="stack">
    <div className="welcome"><div><h2>{view === 'new' ? 'Nueva venta' : 'Historial de ventas'}</h2><p>Seleccioná productos o combos y confirmá el cobro.</p></div>
      <Button secondary onClick={() => view === 'new' ? showHistory() : setView('new')}>{view === 'new' ? 'Ver historial' : 'Nueva venta'}</Button></div>
    {notice && <StatusMessage tone="success" message={notice}/>}
    {(error || inventoryError) && <StatusMessage message={error || inventoryError || ''}/>}
    {view === 'new' ? <div className="pos-grid">
      <section className="panel product-browser">
        <div className="filters"><Search value={search} onChange={setSearch} placeholder="Buscar bebida o combo..."/>
          <select aria-label="Filtrar catálogo" value={catalog} onChange={event => setCatalog(event.target.value as typeof catalog)}><option value="all">Todos</option><option value="products">Productos</option><option value="combos">Combos</option></select></div>
        {inventoryLoading || loading ? <LoadingRows/> : <div className="product-grid">
          {catalog !== 'combos' && currentProducts.filter(product => [product.name, product.category, product.sku ?? ''].some(value => value.toLocaleLowerCase().includes(search.toLocaleLowerCase()))).map(product =>
            <button className="product-card" key={product.id} disabled={product.stock_quantity === 0} onClick={() => add('product', product.id)}>
              <ProductPic product={product}/><div><b>{product.name}</b><small>{product.category}</small><strong>{money(product.sale_price)}</strong><span className={product.stock_quantity <= product.min_stock ? 'low' : ''}>{product.stock_quantity ? `${product.stock_quantity} disponibles` : 'Sin stock'}</span></div><i><Icon name="plus" size={16}/></i>
            </button>)}
          {catalog !== 'products' && currentCombos.filter(combo => combo.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()) ||
            comboItems.some(item => item.combo_id === combo.id && products.find(product => product.id === item.product_id)?.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()))).map(combo => {
              const lines = comboItems.filter(item => item.combo_id === combo.id)
              const available = comboAvailability(lines, products)
              return <button className="product-card" key={combo.id} disabled={!available} onClick={() => add('combo', combo.id)}>
                <ProductPic product={combo}/><div><b>{combo.name}</b><small>{lines.map(item => `${item.quantity}× ${products.find(product => product.id === item.product_id)?.name ?? 'Producto'}`).join(' · ')}</small><strong>{money(combo.sale_price)}</strong><span>{available ? `${available} combos disponibles` : 'Sin stock'}</span></div><i><Icon name="plus" size={16}/></i>
              </button>
            })}
          {!currentProducts.length && !currentCombos.length && <div className="empty-state">No hay productos ni combos activos. Agregá productos desde Stock.</div>}
        </div>}
      </section>
      <aside id="sales-checkout" className="panel checkout"><PanelTitle title="Resumen de venta" subtitle={`${cart.reduce((sum, line) => sum + line.quantity, 0)} artículos`}/>
        <div className="cart-lines">{cart.length ? cart.map(line => <div className="cart-line" key={`${line.kind}:${line.id}`}>
          <ProductPic product={{ name: lineName(line) }}/><div><b>{lineName(line)}</b><small>{money(linePrice(line))} c/u · {line.kind === 'combo' ? 'Combo' : 'Producto'}</small>
            <div className="stepper"><button aria-label={`Disminuir ${lineName(line)}`} onClick={() => changeCart(cart.map(value => value === line ? { ...value, quantity: Math.max(1, value.quantity - 1) } : value))}>−</button><span>{line.quantity}</span><button aria-label={`Aumentar ${lineName(line)}`} onClick={() => add(line.kind, line.id)}>+</button></div>
          </div><strong>{money(linePrice(line) * line.quantity)}</strong><button className="cart-remove" aria-label={`Quitar ${lineName(line)}`} onClick={() => changeCart(cart.filter(value => value !== line))}>×</button>
        </div>) : <div className="empty-state">Seleccioná un producto o combo para comenzar.</div>}</div>
        <div className="totals"><div><span>Subtotal</span><b>{money(total)}</b></div><div><span>Descuento</span><b>$ 0</b></div><div className="grand"><span>Total</span><strong>{money(total)}</strong></div></div>
        <div className="payment"><span>Método de pago</span><div>{(Object.keys(paymentLabels) as PaymentMethod[]).map(value => <button key={value} className={method === value ? 'selected' : ''} onClick={() => { setMethod(value); setPrepared(null); idempotencyKey.current = null }}>{paymentLabels[value]}</button>)}</div></div>
        {shortage && <StatusMessage message="El carrito supera el stock disponible. Reducí cantidades para continuar."/>}
        {actionError && <StatusMessage message={actionError}/>}
        <Button className="confirm" disabled={!cart.length || Boolean(shortage) || busy || loading || inventoryLoading} onClick={prepare}>Revisar venta <Icon name="arrow" size={18}/></Button>
        <small className="safe"><Icon name="check" size={14}/> El stock y los precios se verifican al confirmar.</small>
      </aside>
      {cart.length > 0 && <button className="mobile-cart-jump" onClick={() => document.getElementById('sales-checkout')?.scrollIntoView({ behavior: 'smooth' })}>Ver carrito · {cart.reduce((sum, line) => sum + line.quantity, 0)} · {money(total)}</button>}
    </div> : <section className="panel module-panel">
      <MiniStats stats={stats}/>
      <div className="toolbar"><Search value={historySearch} onChange={setHistorySearch} placeholder="Buscar venta o artículo..."/><div className="filter-wrap"><select aria-label="Filtrar período de ventas" value={period} onChange={event => setPeriod(event.target.value as Period)}><option value="today">Hoy</option><option value="month">Este mes</option><option value="all">Todo el historial</option><option value="custom">Período personalizado</option></select></div></div>
      {period === 'custom' && <div className="period-fields"><label className="select-field">Desde<input type="date" value={fromDate} onChange={event => setFromDate(event.target.value)}/></label><label className="select-field">Hasta<input type="date" value={toDate} min={fromDate || undefined} onChange={event => setToDate(event.target.value)}/></label></div>}
      {loading ? <LoadingRows/> : filteredSales.length ? <div className="data-table generic sales-table"><div className="data-row data-head"><span>Venta</span><span>Fecha y hora</span><span>Artículos</span><span>Pago</span><span>Total / ganancia</span><span>Estado</span></div>
        {filteredSales.map(sale => <div className="data-row" key={sale.id}><span><button className="product-name" onClick={() => setDetail(sale)}>#{sale.sale_number.slice(0, 8).toUpperCase()}</button></span><span>{dateTime(sale.sold_at)}</span><span>{saleItems.filter(item => item.sale_id === sale.id).map(item => `${item.quantity}× ${item.item_name}`).join(' · ')}</span><span>{paymentLabels[sale.payment_method]}</span><strong>{money(sale.total_amount)}<small className="sale-profit">Ganancia {money(sale.gross_profit)}</small></strong><span><Badge type="success">Confirmada</Badge></span></div>)}</div>
      : <div className="empty-state">No hay ventas en este período.</div>}
      <div className="procurement-reports"><section className="panel"><h3>Últimas ventas</h3>{sales.slice(0, 5).map(sale => <div className="report-line" key={sale.id}><button className="product-name" onClick={() => setDetail(sale)}>#{sale.sale_number.slice(0, 8).toUpperCase()} · {dateTime(sale.sold_at)}</button><strong>{money(sale.total_amount)}</strong></div>)}{!sales.length && <p>Sin ventas confirmadas.</p>}</section></div>
    </section>}
    {prepared && <Modal title="Confirmar venta" onClose={() => { if (!busy) setPrepared(null) }}>
      <div className="history-list">{cart.map(line => <div className="history-row" key={`${line.kind}:${line.id}`}><b>{line.quantity} × {lineName(line)}</b><strong>{money(linePrice(line) * line.quantity)}</strong><small>{line.kind === 'combo' ? `Costo actual estimado: ${money(comboCost(comboItems.filter(item => item.combo_id === line.id), products) * line.quantity)}` : 'Producto individual'}</small></div>)}</div>
      <div className="detail-grid"><div><span>Total estimado</span><b>{money(total)}</b></div><div><span>Pago</span><b>{paymentLabels[method]}</b></div></div>
      <p className="formula">Supabase confirmará el precio, costo y stock vigentes. Si cambiaron, el resumen definitivo puede variar.</p>
      {actionError && <StatusMessage message={actionError}/>}
      <div className="form-actions"><Button secondary disabled={busy} onClick={() => setPrepared(null)}>Volver</Button><Button disabled={busy} onClick={() => void confirm()}>{busy ? 'Confirmando…' : 'Confirmar venta'}</Button></div>
    </Modal>}
    {detail && !prepared && <Modal title={`Venta #${detail.sale_number.slice(0, 8).toUpperCase()}`} onClose={() => setDetail(null)}>
      <div className="detail-grid"><div><span>Identificador</span><b className="break-word">{detail.id}</b></div><div><span>Fecha y hora</span><b>{dateTime(detail.sold_at)}</b></div><div><span>Pago</span><b>{paymentLabels[detail.payment_method]}</b></div><div><span>Estado</span><b>Confirmada</b></div><div><span>Importe</span><b>{money(detail.total_amount)}</b></div><div><span>Costo histórico</span><b>{money(detail.total_cost)}</b></div><div><span>Ganancia bruta</span><b>{money(detail.gross_profit)}</b></div></div>
      <h4>Artículos y componentes</h4><div className="history-list">{saleItems.filter(item => item.sale_id === detail.id).map(item => <div className="history-row" key={item.id}><b>{item.quantity} × {item.item_name}</b><strong>{money(item.subtotal)}</strong><small>Precio {money(item.unit_price_snapshot)} · Costo {money(item.total_cost)} · Ganancia {money(item.gross_profit)}</small>
        {components.filter(component => component.sale_item_id === item.id).map(component => <small key={component.id}>{component.quantity} × {component.product_name} · Costo {money(component.total_cost)}</small>)}
      </div>)}</div><p className="formula">Las ventas confirmadas conservan sus precios y costos históricos. La anulación queda pendiente de un proceso correctivo auditado.</p>
    </Modal>}
  </div>
}
