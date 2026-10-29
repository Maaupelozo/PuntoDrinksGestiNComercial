import { useState } from 'react'
import { Link } from 'react-router'
import { Module } from '../components/ui/Module'
import { MiniStats } from '../components/ui/MiniStats'
import { PanelTitle } from '../components/ui/PanelTitle'
import { Button } from '../components/ui/Button'
import { LoadingRows } from '../components/ui/LoadingRows'
import { StatusMessage } from '../components/ui/StatusMessage'
import { PeriodPicker, selectedRange } from '../components/finance/PeriodPicker'
import { FinancialBars } from '../components/finance/FinancialBars'
import { useFinancialReport } from '../hooks/useFinancialReport'
import { groupFinancialDays, percentChange, type Grouping, type PeriodPreset } from '../lib/finance-rules'
import { downloadReportCsv, downloadReportPdf, financialSummaryRows } from '../lib/report-export'
import { errorMessage } from '../lib/errors'
import { money, moneyOrPending } from '../utils/money'

const percent = (value: number) => `${value.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`
const comparison = (current: number | null, previous: number | null) => {
  if (current === null || previous === null) return 'Pendiente de costos históricos'
  const change = percentChange(current, previous)
  return change === null ? 'Sin base anterior' : `${change >= 0 ? '+' : ''}${percent(change)} vs. período anterior`
}

export function ReportsPage() {
  const [preset, setPreset] = useState<PeriodPreset>('month')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [grouping, setGrouping] = useState<Grouping>('day')
  const [exportError, setExportError] = useState<string | null>(null)
  const { range, error: periodError } = selectedRange(preset, from, to)
  const { report, previous, loading, error, refresh } = useFinancialReport(range)
  const summary = report?.summary
  const stats: [string, string, string][] = summary ? [
    ['Ingresos', money(summary.revenue), comparison(summary.revenue, previous?.summary.revenue ?? 0)],
    ['Costo vendido', moneyOrPending(summary.cogs), summary.cogs === null ? 'Faltan costos históricos' : 'Snapshots de ventas'],
    ['Ganancia bruta', moneyOrPending(summary.gross_profit), summary.gross_profit === null ? 'Faltan costos históricos' : summary.revenue ? `Margen ${percent(summary.gross_profit / summary.revenue * 100)}` : 'Sin ventas'],
    ['Gastos operativos', money(summary.expenses), `${summary.expense_count} gastos vigentes`],
    ['Resultado operativo', moneyOrPending(summary.net_operating_result), comparison(summary.net_operating_result, previous?.summary.net_operating_result ?? 0)],
    ['Compras de mercadería', money(summary.purchases), 'Separadas del resultado'],
    ['Balance de importes', money(summary.cashflow_estimate), 'No equivale a caja conciliada'],
  ] : []
  const groups = report ? groupFinancialDays(report.daily, grouping) : []
  const expenseTotal = summary?.expenses ?? 0
  async function exportPdf() {
    if (!report || !range) return
    setExportError(null)
    try { await downloadReportPdf(report, range) }
    catch (failure) { setExportError(errorMessage(failure)) }
  }
  return <Module title="Reportes y estadísticas" subtitle="Resultados económicos y flujo del negocio" action={report && range ? 'Exportar CSV' : undefined} onAction={() => { if (report && range) downloadReportCsv(report, range) }}>
    {(error || exportError) && <StatusMessage message={error || exportError || ''}/>}
    <p className="historical-notice">Las ventas, compras y gastos del <Link to="/historico">Histórico de octubre</Link> se incluyen por sus importes y fechas. La ganancia y el ticket promedio quedan pendientes donde faltan costos o tickets identificados. El stock histórico aún no modifica el inventario actual.</p>
    <div className="report-filter finance-filter"><PeriodPicker preset={preset} onPreset={setPreset} from={from} to={to} onFrom={setFrom} onTo={setTo} error={periodError}/>
      <div><Button secondary disabled={!report || !range || loading} onClick={() => void exportPdf()}>Exportar PDF</Button><Button secondary onClick={() => void refresh()}>Actualizar</Button></div></div>
    {loading ? <LoadingRows/> : report && summary ? <>
      <MiniStats stats={stats} className="reports"/>
      <section className="finance-summary panel"><PanelTitle title="Resultado del período" subtitle={range?.label ?? ''}/>
        {financialSummaryRows(report).map(([label, value]) => <div className="report-line" key={label}><span>{label}</span><strong className={value !== null && value < 0 ? 'profit negative' : ''}>{moneyOrPending(value)}</strong></div>)}
        <p className="formula">Resultado neto operativo = ganancia bruta − gastos operativos. No equivale necesariamente a utilidad neta contable o fiscal.</p>
        <p className="formula">Balance de importes = ventas − compras − gastos. Los medios de pago históricos son desconocidos; no representa caja conciliada.</p>
      </section>
      <div className="finance-comparison"><div><span>Ventas anteriores</span><strong>{money(previous?.summary.revenue ?? 0)}</strong><small>{comparison(summary.revenue, previous?.summary.revenue ?? 0)}</small></div>
        <div><span>Resultado anterior</span><strong>{moneyOrPending(previous?.summary.net_operating_result ?? 0)}</strong><small>{comparison(summary.net_operating_result, previous?.summary.net_operating_result ?? 0)}</small></div>
        <div><span>Margen operativo</span><strong>{summary.net_operating_result === null ? 'Pendiente' : summary.revenue ? percent(summary.net_operating_result / summary.revenue * 100) : '—'}</strong><small>Sobre ventas del período</small></div>
        <div><span>Ticket promedio</span><strong>{moneyOrPending(summary.average_ticket)}</strong><small>{report.historical?.sale_rows ? `${summary.sales_count} operaciones y renglones históricos` : `${summary.sales_count} operaciones`}</small></div></div>
      <div className="report-grid"><article className="panel"><div className="panel-title"><div><h3>Evolución de ventas</h3><p>Datos diarios, semanales o mensuales</p></div></div>
        <div className="finance-grouping">{([['day','Día'],['week','Semana'],['month','Mes']] as const).map(([value,label]) => <button key={value} className={grouping === value ? 'active' : ''} onClick={() => setGrouping(value)}>{label}</button>)}</div>
        <FinancialBars days={report.daily} grouping={grouping}/>
        <div className="finance-group-list">{groups.map(group => <div className="report-line" key={group.key}><span>{group.key} · {group.salesCount} {report.historical?.sale_rows ? 'operaciones/renglones' : 'ventas'}</span><strong>{money(group.revenue)}</strong></div>)}</div>
      </article><article className="panel"><PanelTitle title="Entradas y salidas registradas" subtitle="Ventas, compras y gastos por período"/>
        <FinancialBars days={report.daily} grouping={grouping} showExpenses/>
        <div className="finance-legend"><span><i className="revenue"/>Ventas</span><span><i className="purchases"/>Compras</span><span><i className="expenses"/>Gastos</span></div>
        <div className="report-line"><span>Balance de importes</span><strong className={summary.cashflow_estimate < 0 ? 'profit negative' : ''}>{money(summary.cashflow_estimate)}</strong></div>
      </article></div>
      <div className="procurement-reports">
        <section className="panel"><h3>Gastos por categoría</h3>{report.expense_categories.length ? report.expense_categories.map(item => <div className="report-line" key={item.category}><span>{item.category} · {item.count} registros</span><strong>{money(item.total)} · {expenseTotal ? percent(item.total / expenseTotal * 100) : '0%'}</strong></div>) : <p>Sin gastos operativos en el período.</p>}</section>
        <section className="panel"><h3>Productos más vendidos</h3>{report.top_products.length ? report.top_products.map(item => <div className="report-line" key={item.product_id}><span>{item.name} · {item.units} un.</span><strong>{money(item.direct_revenue)} individual</strong></div>) : <p>{report.historical?.sale_rows ? 'El detalle de productos históricos está en Histórico de octubre.' : 'Sin productos vendidos.'}</p>}<p>Este ranking muestra ventas operativas. Las unidades incluyen componentes de combos. El ingreso individual excluye descuentos de combos; no se distribuye su ganancia por bebida.</p></section>
        <section className="panel"><h3>Productos más comprados</h3>{report.top_purchased.length ? report.top_purchased.map(item => <div className="report-line" key={item.product_id}><span>{item.name} · {item.units} un.</span><strong>{money(item.total)}</strong></div>) : <p>{report.historical?.purchase_rows ? 'El detalle de compras históricas está en Histórico de octubre.' : 'Sin compras en el período.'}</p>}</section>
        <section className="panel"><h3>Compras por proveedor</h3>{report.supplier_totals.length ? report.supplier_totals.map(item => <div className="report-line" key={item.supplier_id ?? 'none'}><span>{item.name} · {item.purchases} compras</span><strong>{money(item.total)}</strong></div>) : <p>{report.historical?.purchase_rows ? 'Los proveedores históricos no están identificados por compra.' : 'Sin compras en el período.'}</p>}</section>
        <section className="panel"><h3>Inventario actual</h3><div className="report-line"><span>Productos disponibles</span><strong>{report.inventory.available_products}</strong></div><div className="report-line"><span>Stock bajo / sin stock</span><strong>{report.inventory.low_stock_products} / {report.inventory.out_of_stock_products}</strong></div><div className="report-line"><span>Valor estimado al costo promedio</span><strong>{money(report.inventory.estimated_value)}</strong></div><p>Es una valuación aproximada del stock activo actual, no una cifra histórica del período.</p></section>
      </div>
      <div className="report-grid"><section className="panel"><h3>Ventas diarias</h3><div className="finance-group-list">{report.daily.map(day => <div className="report-line" key={day.date}><span>{day.date} · {day.sales_count} {report.historical?.sale_rows ? 'operaciones/renglones' : 'operaciones'}</span><strong>{money(day.revenue)}</strong></div>)}</div></section>
        <section className="panel"><h3>Gastos y compras diarios</h3><div className="finance-group-list">{report.daily.map(day => <div className="report-line" key={day.date}><span>{day.date}</span><strong>{money(day.expenses)} gastos · {money(day.purchases)} compras</strong></div>)}</div></section></div>
    </> : <div className="empty-state">Elegí un período válido para consultar los reportes.</div>}
  </Module>
}
