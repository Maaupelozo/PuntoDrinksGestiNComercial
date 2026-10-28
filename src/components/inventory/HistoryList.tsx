import { useEffect, useState } from 'react'
import { LoadingRows } from '../ui/LoadingRows'
import { StatusMessage } from '../ui/StatusMessage'
import { errorMessage } from '../../lib/errors'
import { listMovements, listPriceHistory } from '../../services/inventory'
import type { InventoryMovement, PriceHistory } from '../../types/inventory'
import { money } from '../../utils/money'

const date = (value: string) => new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))

export function HistoryList({ productId, kind }: { productId: string; kind: 'stock' | 'price' }) {
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [prices, setPrices] = useState<PriceHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    const load = kind === 'stock' ? listMovements(productId) : listPriceHistory(productId)
    load.then(rows => {
      if (!active) return
      if (kind === 'stock') setMovements(rows as InventoryMovement[])
      else setPrices(rows as PriceHistory[])
      setError(null)
    }).catch(failure => { if (active) setError(errorMessage(failure)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [productId, kind])

  if (loading) return <LoadingRows count={3}/>
  if (error) return <StatusMessage message={error}/>
  if (kind === 'stock') return <div className="history-list">{movements.length ? movements.map(item => <div className="history-row" key={item.id}>
    <b>{item.movement_type === 'entry' ? 'Entrada' : item.movement_type === 'exit' ? 'Salida' : 'Ajuste'} · {item.quantity_delta > 0 ? '+' : ''}{item.quantity_delta} un.</b><span>{item.previous_stock} → {item.new_stock} un.</span><small>{date(item.created_at)} · {item.reason}</small>
  </div>) : <div className="empty-state">Todavía no hay movimientos.</div>}</div>
  return <div className="history-list">{prices.length ? prices.map(item => <div className="history-row" key={item.id}>
    <b>Precio: {money(item.previous_price)} → {money(item.new_price)}</b><span>Costo: {money(item.previous_cost)} → {money(item.new_cost)}</span><small>{date(item.changed_at)}</small>
  </div>) : <div className="empty-state">Todavía no hay cambios de costo o precio.</div>}</div>
}
