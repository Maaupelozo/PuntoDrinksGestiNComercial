import { useEffect, useState } from 'react'
import { Module } from '../components/ui/Module'
import { MiniStats } from '../components/ui/MiniStats'
import { Search } from '../components/ui/Search'
import { LoadingRows } from '../components/ui/LoadingRows'
import { StatusMessage } from '../components/ui/StatusMessage'
import { listHistoricalRecords } from '../services/historical'
import { errorMessage } from '../lib/errors'
import { money } from '../utils/money'
import type { HistoricalKind, HistoricalRecord } from '../types/historical'

const tabs: { kind: HistoricalKind; label: string }[] = [
  { kind: 'sale', label: 'Ventas' }, { kind: 'expense', label: 'Gastos' },
  { kind: 'purchase', label: 'Compras' }, { kind: 'count', label: 'Conteo físico' },
]
const statusLabels: Record<string, string> = {
  confirmed: 'Importe confirmado', reconstructed: 'Precio reconstruido',
  confirmed_composition: 'Importe y composición confirmados',
  allocation_pending: 'Costo por producto pendiente',
  unclassified: 'No detallado', counted: 'Conteo físico',
}
const dateLabel = (value: string) => value.split('-').reverse().join('/')
const sum = (records: HistoricalRecord[], kind: HistoricalKind) =>
  records.filter(record => record.kind === kind).reduce((total, record) => total + Number(record.amount ?? 0), 0)

export function HistoricalPage() {
  const [records, setRecords] = useState<HistoricalRecord[]>([])
  const [kind, setKind] = useState<HistoricalKind>('sale')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    listHistoricalRecords().then(data => { if (active) { setRecords(data); setError(null) } })
      .catch(failure => { if (active) setError(errorMessage(failure)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const filtered = records.filter(record => record.kind === kind &&
    [record.description, record.details.note ?? '', ...(record.details.components?.map(item => item.name) ?? [])]
      .some(value => value.toLocaleLowerCase().includes(search.toLocaleLowerCase())))
  const physical = records.filter(record => record.kind === 'count')
    .reduce((total, record) => total + Number(record.quantity ?? 0), 0)
  const stats: [string, string, string][] = [
    ['Ventas reconstruidas', money(sum(records, 'sale')), `${records.filter(record => record.kind === 'sale').length} renglones`],
    ['Gastos no detallados', money(sum(records, 'expense')), `${records.filter(record => record.kind === 'expense').length} egresos`],
    ['Compras identificadas', money(sum(records, 'purchase')), `${records.filter(record => record.kind === 'purchase').length} registros`],
  ]
  return <Module title="Histórico de octubre" subtitle="Movimientos reconstruidos y conteo físico de 2026">
    {error && <StatusMessage message={error}/>}
    {loading ? <LoadingRows/> : <>
      <MiniStats stats={stats}/>
      <p className="historical-notice">Estos registros conservan las fechas y los importes originales. Los costos históricos, medios de pago y algunas asignaciones de producto siguen pendientes. Por eso todavía no integran la ganancia ni modifican el stock operativo de Dashboard y Reportes.</p>
      <div className="historical-controls"><div className="finance-grouping">{tabs.map(tab =>
        <button type="button" key={tab.kind} className={kind === tab.kind ? 'active' : ''} onClick={() => setKind(tab.kind)}>{tab.label} ({records.filter(record => record.kind === tab.kind).length})</button>)}</div>
        <Search value={search} onChange={setSearch} placeholder="Buscar en el histórico..."/>
      </div>
      {kind === 'count' && <p className="historical-count">Conteo físico al 28/10/2026: <strong>{physical} unidades</strong>. Este conteo no es una compra ni un ajuste.</p>}
      <div className="historical-records">{filtered.map(record => <article className="historical-record" key={record.id}>
        <div className="historical-record-heading"><div><small>{dateLabel(record.business_date)} · {record.details.source ?? record.source_key}</small><h3>{record.description}</h3></div>
          <strong>{record.amount === null ? `${record.quantity} un.` : money(Number(record.amount))}</strong></div>
        <div className="historical-record-meta"><span className="badge">{statusLabels[record.record_status] ?? record.record_status}</span>
          {record.quantity !== null && record.kind !== 'count' && <span>{record.quantity} un.</span>}
          {record.kind !== 'count' && <span>Pago: {record.details.paymentMethod ?? 'No informado'}</span>}</div>
        {record.details.components?.length ? <ul className="historical-components">{record.details.components.map((component, index) =>
          <li key={`${component.name}-${index}`}>{component.quantity} × {component.name}{component.unitCost != null ? ` · Costo ${money(component.unitCost)} c/u` : ''}</li>)}</ul> : null}
        {record.details.note && <p className="historical-note">{record.details.note}</p>}
        {record.details.priceStatus && <p className="historical-note">Precio: {record.details.priceStatus}</p>}
      </article>)}</div>
      {!filtered.length && <div className="empty-state">No hay registros para mostrar.</div>}
    </>}
  </Module>
}
