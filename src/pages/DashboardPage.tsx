import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { Badge } from '../components/ui/Badge'
import { PanelTitle } from '../components/ui/PanelTitle'
import { ProductPic } from '../components/ui/ProductPic'
import { LoadingRows } from '../components/ui/LoadingRows'
import { StatusMessage } from '../components/ui/StatusMessage'
import { PeriodPicker, selectedRange } from '../components/finance/PeriodPicker'
import { FinancialBars } from '../components/finance/FinancialBars'
import { useFinancialReport } from '../hooks/useFinancialReport'
import { expensePaymentLabels, percentChange, type PeriodPreset } from '../lib/finance-rules'
import { purchaseTimeZone } from '../lib/procurement-rules'
import { money } from '../utils/money'

const changeLabel = (current: number, previous: number) => {
  const change = percentChange(current, previous)
  return change === null ? 'Sin base anterior' : `${change >= 0 ? '+' : ''}${change.toLocaleString('es-AR', { maximumFractionDigits: 1 })}% vs. período anterior`
}

export function DashboardPage() {
  const navigate = useNavigate()
  const [preset, setPreset] = useState<PeriodPreset>('today')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const { range, error: periodError } = selectedRange(preset, from, to)
  const { report, previous, loading, error, refresh } = useFinancialReport(range)
  const summary = report?.summary
  const inventory = report?.inventory
  const periodLabel = range?.label.toLocaleLowerCase() ?? 'del período'
  const metrics: [string, string, string, string][] = summary && inventory ? [
    [`Ventas ${periodLabel}`, money(summary.revenue), changeLabel(summary.revenue, previous?.summary.revenue ?? 0), ''],
    ['Ganancia bruta', money(summary.gross_profit), 'Ingresos − costo histórico vendido', summary.gross_profit < 0 ? 'down' : 'up'],
    ['Resultado operativo', money(summary.net_operating_result), 'Antes de impuestos y ajustes', summary.net_operating_result < 0 ? 'down' : 'up'],
    ['Compras de mercadería', money(summary.purchases), `${summary.purchase_count} recepciones`, ''],
    ['Gastos operativos', money(summary.expenses), `${summary.expense_count} registros`, ''],
    ['Productos disponibles', String(inventory.available_products), 'Stock actual', ''],
    ['Stock bajo / sin stock', `${inventory.low_stock_products} / ${inventory.out_of_stock_products}`, 'Productos para revisar', 'warn'],
    ['Ventas realizadas', String(summary.sales_count), `Ticket promedio ${money(summary.average_ticket)}`, ''],
  ] : []
  return <div className="stack">
    <div className="welcome"><div><h2>Buen día</h2><p>Resumen real de Punto Drinks para {new Intl.DateTimeFormat('es-AR', { dateStyle: 'long', timeZone: purchaseTimeZone }).format(new Date())}.</p></div>
      <div className="actions"><Button secondary onClick={() => void refresh()}>Actualizar</Button><Button onClick={() => navigate('/ventas')}><Icon name="plus" size={17}/> Nueva venta</Button></div></div>
    <PeriodPicker preset={preset} onPreset={setPreset} from={from} to={to} onFrom={setFrom} onTo={setTo} dashboard error={periodError}/>
    {error && <StatusMessage message={error}/>}
    {loading ? <LoadingRows/> : report && summary && inventory ? <>
      <section className="metric-grid finance-metrics">{metrics.map(([label, value, note, tone]) => <article className="metric" key={label}><div className="metric-label"><span>{label}</span><Icon name="dots"/></div><strong>{value}</strong><div className={tone}>{note}</div></article>)}</section>
      <section className="dashboard-grid"><article className="panel sales-chart"><PanelTitle title="Evolución de ventas" subtitle={`Ingresos reales · ${range?.label ?? ''}`}/><div className="chart-total"><strong>{money(summary.revenue)}</strong><Badge type={summary.gross_profit < 0 ? 'danger' : 'success'}>Bruta {money(summary.gross_profit)}</Badge></div><FinancialBars days={report.daily}/><button className="text-link" onClick={() => navigate('/reportes')}>Ver reporte <Icon name="arrow" size={15}/></button></article>
        <article className="panel alerts"><PanelTitle title="Alertas de stock" subtitle={`${inventory.low_stock_products + inventory.out_of_stock_products} productos requieren atención`}/>{inventory.alerts.length ? inventory.alerts.map(product => <div className="alert-row" key={product.id}><ProductPic product={product}/><div><b>{product.name}</b><small>{product.stock_quantity === 0 ? 'Sin unidades disponibles' : `${product.stock_quantity} unidades · Mínimo ${product.min_stock}`}</small></div><Badge type={product.stock_quantity === 0 ? 'danger' : 'warning'}>{product.stock_quantity === 0 ? 'Sin stock' : 'Stock bajo'}</Badge></div>) : <div className="empty-state">No hay alertas de stock.</div>}<button className="text-link" onClick={() => navigate('/stock')}>Revisar todos los productos <Icon name="arrow" size={15}/></button></article></section>
      <section className="dashboard-grid bottom"><article className="panel"><PanelTitle title="Productos más vendidos" subtitle="Unidades del período, incluidos combos"/>{report.top_products.length ? report.top_products.map((product, index) => <div className="rank" key={product.product_id}><span>{index + 1}</span><ProductPic product={product}/><div><b>{product.name}</b><small>Ingreso individual {money(product.direct_revenue)}</small></div><strong>{product.units} <small>un.</small></strong></div>) : <div className="empty-state">Todavía no hay productos vendidos.</div>}<button className="text-link" onClick={() => navigate('/reportes')}>Ver detalle <Icon name="arrow" size={15}/></button></article>
        <article className="panel recent"><PanelTitle title="Últimas ventas" subtitle="Operaciones confirmadas del período"/><div className="table-head"><span>Venta</span><span>Pago</span><span>Total / ganancia</span></div>{report.recent_sales.length ? report.recent_sales.map(sale => <div className="sale-row" key={sale.id}><div><b>#{sale.sale_number.slice(0, 8).toUpperCase()}</b><small>{new Date(sale.sold_at).toLocaleString('es-AR', { timeZone: purchaseTimeZone })}</small></div><Badge>{expensePaymentLabels[sale.payment_method as keyof typeof expensePaymentLabels] ?? sale.payment_method}</Badge><strong>{money(sale.total_amount)}<small className="sale-profit">Bruta {money(sale.gross_profit)}</small></strong></div>) : <div className="empty-state">No hay ventas en este período.</div>}<button className="text-link" onClick={() => navigate('/ventas')}>Ver todas <Icon name="arrow" size={15}/></button></article></section>
      <section className="finance-quick panel"><PanelTitle title="Accesos rápidos" subtitle="Operaciones habituales"/><div><Button secondary onClick={() => navigate('/ventas')}>Nueva venta</Button><Button secondary onClick={() => navigate('/compras')}>Registrar compra</Button><Button secondary onClick={() => navigate('/gastos')}>Registrar gasto</Button><Button secondary onClick={() => navigate('/stock')}>Consultar stock</Button></div></section>
      <p className="formula">El resultado operativo descuenta gastos operativos del margen bruto. Las compras de mercadería se muestran por separado y no se restan dos veces.</p>
    </> : <div className="empty-state">Elegí un período válido para consultar el Dashboard.</div>}
  </div>
}
