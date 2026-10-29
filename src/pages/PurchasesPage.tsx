import { useState } from 'react'
import { Link } from 'react-router'
import { Module } from '../components/ui/Module'
import { MiniStats } from '../components/ui/MiniStats'
import { Search } from '../components/ui/Search'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { LoadingRows } from '../components/ui/LoadingRows'
import { StatusMessage } from '../components/ui/StatusMessage'
import { PurchaseForm } from '../components/procurement/PurchaseForm'
import { useProcurement } from '../context/ProcurementContext'
import { useInventory } from '../context/InventoryContext'
import { useHistoricalRecords } from '../hooks/useHistoricalRecords'
import { registerPurchase } from '../services/procurement'
import { cordobaDate } from '../lib/procurement-rules'
import { money } from '../utils/money'
import type { PurchaseInput, PurchaseRecord } from '../types/procurement'

type Dialog = { kind: 'create' } | { kind: 'details'; purchase: PurchaseRecord }
type Period = 'today' | 'month' | 'all' | 'custom'
const displayDate = (date: string) => date.split('-').reverse().join('/')

export function PurchasesPage() {
  const { suppliers, purchases, items, loading, error, refresh } = useProcurement()
  const { products, refresh: refreshInventory } = useInventory()
  const { records: historicalRecords, loading: historyLoading, error: historyError } = useHistoricalRecords()
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState<Period>('month')
  const [supplierId, setSupplierId] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const today = cordobaDate()
  const month = today.slice(0, 7)
  const todayPurchases = purchases.filter(purchase => purchase.purchase_date === today)
  const monthPurchases = purchases.filter(purchase => purchase.purchase_date.startsWith(month))
  const historicalPurchases = historicalRecords.filter(record => record.kind === 'purchase')
  const historicalTotal = (records: typeof historicalPurchases) => records.reduce((sum, record) => sum + Number(record.amount), 0)
  const todayHistory = historicalPurchases.filter(record => record.business_date === today)
  const monthHistory = historicalPurchases.filter(record => record.business_date.startsWith(month))
  const filteredHistory = historicalPurchases.filter(record => {
    const date = record.business_date
    return (period === 'all' || period === 'today' && date === today ||
      period === 'month' && date.startsWith(month) || period === 'custom' &&
      (!fromDate || date >= fromDate) && (!toDate || date <= toDate)) &&
      (supplierId === 'all') && record.description.toLocaleLowerCase().includes(search.toLocaleLowerCase())
  })
  const stats: [string, string, string][] = [
    ['Compras de hoy', money(todayPurchases.reduce((sum, purchase) => sum + purchase.total, 0) + historicalTotal(todayHistory)), `${todayPurchases.length} operaciones${todayHistory.length ? ` + ${todayHistory.length} registros históricos` : ''}`],
    ['Compras del mes', money(monthPurchases.reduce((sum, purchase) => sum + purchase.total, 0) + historicalTotal(monthHistory)), `${monthPurchases.length} operaciones${monthHistory.length ? ` + ${monthHistory.length} registros históricos` : ''}`],
    ['Operaciones y registros', String(purchases.length + historicalPurchases.length), money(purchases.reduce((sum, purchase) => sum + purchase.total, 0) + historicalTotal(historicalPurchases))],
  ]
  const supplierName = (id: string | null) => suppliers.find(supplier => supplier.id === id)?.name ?? 'Sin proveedor'
  const filtered = purchases.filter(purchase => {
    const inPeriod = period === 'all' || period === 'today' && purchase.purchase_date === today ||
      period === 'month' && purchase.purchase_date.startsWith(month) ||
      period === 'custom' && (!fromDate || purchase.purchase_date >= fromDate) && (!toDate || purchase.purchase_date <= toDate)
    const term = search.toLocaleLowerCase()
    const matchingText = [purchase.id, supplierName(purchase.supplier_id),
      ...items.filter(item => item.purchase_id === purchase.id).map(item => item.product_name)]
      .some(value => value.toLocaleLowerCase().includes(term))
    return inPeriod && (supplierId === 'all' || purchase.supplier_id === supplierId) && matchingText
  })
  const filteredItems = items.filter(item => filtered.some(purchase => purchase.id === item.purchase_id))
  const topProducts = Object.values(filteredItems.reduce<Record<string, { name: string; quantity: number; total: number }>>((result, item) => {
    const entry = result[item.product_id] ?? { name: item.product_name, quantity: 0, total: 0 }
    entry.quantity += item.quantity
    entry.total += item.subtotal
    result[item.product_id] = entry
    return result
  }, {})).sort((a, b) => b.quantity - a.quantity).slice(0, 5)
  const supplierTotals = Object.entries(filtered.reduce<Record<string, number>>((result, purchase) => {
    const key = purchase.supplier_id ?? 'none'
    result[key] = (result[key] ?? 0) + purchase.total
    return result
  }, {})).sort((a, b) => b[1] - a[1])
  const costEvolution = filteredItems.slice().sort((a, b) => {
    const aPurchase = purchases.find(purchase => purchase.id === a.purchase_id)!
    const bPurchase = purchases.find(purchase => purchase.id === b.purchase_id)!
    return bPurchase.purchase_date.localeCompare(aPurchase.purchase_date) || b.created_at.localeCompare(a.created_at)
  }).slice(0, 10)

  async function save(input: PurchaseInput) {
    const saved = await registerPurchase(input)
    await Promise.all([refresh(), refreshInventory()])
    setDialog({ kind: 'details', purchase: saved })
    setNotice(`Compra confirmada por ${money(saved.total)}. El stock y los costos se actualizaron.`)
  }

  return <Module title="Compras" subtitle="Reposición de mercadería y recepciones" action="Registrar compra" onAction={() => { setNotice(null); setDialog({ kind: 'create' }) }}>
    {notice && <StatusMessage tone="success" message={notice}/>}
    {error && <StatusMessage message={error}/>}
    {historyError && <StatusMessage message={historyError}/>}
    <MiniStats stats={stats}/>
    {!!historicalPurchases.length && <p className="historical-notice">Los importes históricos se incluyen en estos totales. El detalle está en <Link to="/historico">Histórico de octubre</Link>; esta lista muestra compras registradas desde la aplicación.</p>}
    <div className="toolbar"><Search value={search} onChange={setSearch} placeholder="Buscar compras..."/><div className="filter-wrap">
      <select aria-label="Filtrar período" value={period} onChange={event => setPeriod(event.target.value as Period)}>
        <option value="today">Hoy</option><option value="month">Este mes</option><option value="all">Todo el historial</option><option value="custom">Período personalizado</option>
      </select>
      <select aria-label="Filtrar proveedor" value={supplierId} onChange={event => setSupplierId(event.target.value)}>
        <option value="all">Todos los proveedores</option>{suppliers.map(supplier => <option value={supplier.id} key={supplier.id}>{supplier.name}</option>)}
      </select>
    </div></div>
    {period === 'custom' && <div className="period-fields">
      <label className="select-field">Desde<input type="date" value={fromDate} onChange={event => setFromDate(event.target.value)}/></label>
      <label className="select-field">Hasta<input type="date" value={toDate} min={fromDate || undefined} onChange={event => setToDate(event.target.value)}/></label>
      <strong>Total del período: {money(filtered.reduce((sum, purchase) => sum + purchase.total, 0) + historicalTotal(filteredHistory))}</strong>
    </div>}
    {loading || historyLoading ? <LoadingRows/> : filtered.length ? <div className="data-table generic purchase-table">
      <div className="data-row data-head"><span>Compra</span><span>Proveedor</span><span>Fecha</span><span>Productos</span><span>Total</span><span>Estado</span></div>
      {filtered.map(purchase => <div className="data-row" key={purchase.id}>
        <span><button className="product-name" onClick={() => setDialog({ kind: 'details', purchase })}>#{purchase.id.slice(0, 8).toUpperCase()}</button></span>
        <span>{supplierName(purchase.supplier_id)}</span><span>{displayDate(purchase.purchase_date)}</span>
        <span>{items.filter(item => item.purchase_id === purchase.id).length} productos</span>
        <strong>{money(purchase.total)}</strong><span><Badge type="success">Confirmada</Badge></span>
      </div>)}
    </div> : <div className="empty-state">{filteredHistory.length ? 'Las compras de este período están en Histórico de octubre.' : 'No hay compras para mostrar. Podés registrar una con el botón superior.'}</div>}
    <div className="procurement-reports">
      <section className="panel"><h3>Total por proveedor</h3>{supplierTotals.length ? supplierTotals.map(([id, total]) =>
        <div className="report-line" key={id}><span>{supplierName(id === 'none' ? null : id)}</span><strong>{money(total)}</strong></div>,
      ) : <p>Sin compras en el período.</p>}</section>
      <section className="panel"><h3>Productos más comprados</h3>{topProducts.length ? topProducts.map(product =>
        <div className="report-line" key={product.name}><span>{product.name} · {product.quantity} un.</span><strong>{money(product.total)}</strong></div>,
      ) : <p>Sin productos en el período.</p>}</section>
      <section className="panel"><h3>Evolución de costos de compra</h3>{costEvolution.length ? costEvolution.map(item =>
        <div className="report-line" key={item.id}><span>{displayDate(purchases.find(purchase => purchase.id === item.purchase_id)!.purchase_date)} · {item.product_name}</span><strong>{money(item.unit_cost)} / un.</strong></div>,
      ) : <p>Sin costos en el período.</p>}</section>
    </div>
    {dialog && <Modal title={dialog.kind === 'create' ? 'Registrar compra' : `Compra #${dialog.purchase.id.slice(0, 8).toUpperCase()}`} onClose={() => setDialog(null)}>
      {dialog.kind === 'create' && <PurchaseForm products={products.filter(product => product.is_active)} suppliers={suppliers} onSave={save} onCancel={() => setDialog(null)}/>}
      {dialog.kind === 'details' && <><div className="detail-grid">
        <div><span>Fecha</span><b>{displayDate(dialog.purchase.purchase_date)}</b></div><div><span>Proveedor</span><b>{supplierName(dialog.purchase.supplier_id)}</b></div>
        <div><span>Estado</span><b>Confirmada</b></div><div><span>Medio de pago</span><b>{dialog.purchase.payment_method ?? 'Sin especificar'}</b></div>
        <div><span>Total</span><b>{money(dialog.purchase.total)}</b></div><div><span>Observaciones</span><b>{dialog.purchase.notes ?? 'Sin observaciones'}</b></div>
      </div><h4>Productos y costos pagados</h4><div className="history-list">
        {items.filter(item => item.purchase_id === dialog.purchase.id).map(item =>
          <div className="history-row" key={item.id}><b>{item.product_name} · {item.quantity} un. × {money(item.unit_cost)}</b><strong>{money(item.subtotal)}</strong><small>Stock ingresado · Costo histórico conservado</small></div>,
        )}
      </div><p className="formula">Las compras confirmadas no se editan ni anulan. Los costos de cada línea permanecen en el historial.</p></>}
    </Modal>}
  </Module>
}
