import { useState } from 'react'
import { Module } from '../components/ui/Module'
import { MiniStats } from '../components/ui/MiniStats'
import { Search } from '../components/ui/Search'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { LoadingRows } from '../components/ui/LoadingRows'
import { StatusMessage } from '../components/ui/StatusMessage'
import { ComboForm } from '../components/sales/ComboForm'
import { useSales } from '../context/SalesContext'
import { useInventory } from '../context/InventoryContext'
import { saveCombo, setComboActive } from '../services/sales'
import { comboAvailability, comboCost, comboMargin } from '../lib/sales-rules'
import { errorMessage } from '../lib/errors'
import { money } from '../utils/money'
import type { ComboInput, ComboRecord } from '../types/sales'

type Dialog = { kind: 'create' } | { kind: 'edit' | 'details'; combo: ComboRecord }

export function CombosPage() {
  const { combos, comboItems, loading, error, refresh } = useSales()
  const { products } = useInventory()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('active')
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const active = combos.filter(combo => combo.is_active)
  const filtered = combos.filter(combo => {
    const components = comboItems.filter(item => item.combo_id === combo.id)
    const names = components.map(item => products.find(product => product.id === item.product_id)?.name ?? '')
    return (status === 'all' || (status === 'active') === combo.is_active)
      && [combo.name, ...names].some(value => value.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
  })
  const stats: [string, string, string][] = [
    ['Combos activos', String(active.length), `${combos.length} en total`],
    ['Disponibles para vender', String(active.reduce((sum, combo) => sum + comboAvailability(comboItems.filter(item => item.combo_id === combo.id), products), 0)), 'Según stock actual'],
    ['Ganancia estimada', money(active.reduce((sum, combo) => sum + combo.sale_price - comboCost(comboItems.filter(item => item.combo_id === combo.id), products), 0)), 'Por una unidad de cada combo activo'],
  ]
  async function save(input: ComboInput) {
    if (input.items.some(item => Number(products.find(product => product.id === item.productId)?.unit_cost ?? 0) <= 0))
      throw new Error('Cargá los costos pendientes en Precios antes de crear este combo.')
    await saveCombo(dialog?.kind === 'edit' ? dialog.combo.id : null, input)
    await refresh()
    setDialog(null)
    setNotice(`Combo ${dialog?.kind === 'edit' ? 'actualizado' : 'creado'} correctamente.`)
  }
  async function toggle(combo: ComboRecord) {
    if (busy) return
    setBusy(true); setActionError(null)
    try {
      await setComboActive(combo.id, !combo.is_active)
      await refresh()
      setNotice(`Combo ${combo.is_active ? 'desactivado' : 'activado'}.`)
      setDialog(null)
    } catch (failure) { setActionError(errorMessage(failure)) }
    finally { setBusy(false) }
  }
  const describe = (combo: ComboRecord) => comboItems.filter(item => item.combo_id === combo.id)
    .map(item => `${item.quantity} × ${products.find(product => product.id === item.product_id)?.name ?? 'Producto'}`).join(' · ')

  return <Module title="Combos y promociones" subtitle="Promociones calculadas sobre el stock real" action="Crear combo" onAction={() => { setDialog({ kind: 'create' }); setActionError(null) }}>
    {notice && <StatusMessage tone="success" message={notice}/>}{error && <StatusMessage message={error}/>}
    <MiniStats stats={stats}/>
    <div className="toolbar"><Search value={search} onChange={setSearch} placeholder="Buscar combos o bebidas..."/><div className="filter-wrap"><select aria-label="Filtrar combos" value={status} onChange={event => setStatus(event.target.value)}><option value="active">Activos</option><option value="all">Todos</option><option value="inactive">Inactivos</option></select></div></div>
    {loading ? <LoadingRows/> : filtered.length ? <div className="data-table generic combo-table">
      <div className="data-row data-head"><span>Combo</span><span>Componentes</span><span>Disponibilidad</span><span>Precio promo</span><span>Costo / ganancia</span><span>Estado</span></div>
      {filtered.map(combo => {
        const items = comboItems.filter(item => item.combo_id === combo.id)
        const cost = comboCost(items, products)
        const costPending = items.some(item => Number(products.find(product => product.id === item.product_id)?.unit_cost ?? 0) <= 0)
        const available = comboAvailability(items, products)
        return <div className="data-row" key={combo.id}>
          <span><button className="product-name" onClick={() => setDialog({ kind: 'details', combo })}>{combo.name}</button></span>
          <span>{describe(combo)}</span><span>{available ? `${available} combos` : 'Sin stock'}</span>
          <strong>{money(combo.sale_price)}</strong><span>{costPending ? 'Costo y ganancia pendientes' : `${money(cost)} / ${money(combo.sale_price - cost)} (${comboMargin(combo.sale_price, cost)}%)`}</span>
          <span><Badge type={combo.is_active ? 'success' : 'neutral'}>{combo.is_active ? 'Activo' : 'Inactivo'}</Badge></span>
        </div>
      })}</div> : <div className="empty-state">No hay combos para mostrar. Podés crear uno con el botón superior.</div>}
    {dialog && <Modal title={dialog.kind === 'create' ? 'Crear combo' : dialog.kind === 'edit' ? 'Editar combo' : dialog.combo.name} onClose={() => setDialog(null)}>
      {dialog.kind === 'create' && <ComboForm products={products} onSave={save} onCancel={() => setDialog(null)}/>}
      {dialog.kind === 'edit' && <ComboForm combo={dialog.combo} items={comboItems.filter(item => item.combo_id === dialog.combo.id)} products={products} onSave={save} onCancel={() => setDialog(null)}/>}
      {dialog.kind === 'details' && <><div className="detail-grid">
        <div><span>Descripción</span><b>{dialog.combo.description ?? 'Sin descripción'}</b></div>
        <div><span>Estado</span><b>{dialog.combo.is_active ? 'Activo' : 'Inactivo'}</b></div>
        <div><span>Precio promocional</span><b>{money(dialog.combo.sale_price)}</b></div>
        <div><span>Costo actual</span><b>{comboItems.some(item => item.combo_id === dialog.combo.id && Number(products.find(product => product.id === item.product_id)?.unit_cost ?? 0) <= 0) ? 'Pendiente' : money(comboCost(comboItems.filter(item => item.combo_id === dialog.combo.id), products))}</b></div>
        <div><span>Ganancia estimada</span><b>{comboItems.some(item => item.combo_id === dialog.combo.id && Number(products.find(product => product.id === item.product_id)?.unit_cost ?? 0) <= 0) ? 'Pendiente' : money(dialog.combo.sale_price - comboCost(comboItems.filter(item => item.combo_id === dialog.combo.id), products))}</b></div>
        <div><span>Disponibles</span><b>{comboAvailability(comboItems.filter(item => item.combo_id === dialog.combo.id), products)}</b></div>
        <div><span>Creado</span><b>{new Date(dialog.combo.created_at).toLocaleString('es-AR')}</b></div>
        <div><span>Actualizado</span><b>{new Date(dialog.combo.updated_at).toLocaleString('es-AR')}</b></div>
      </div><h4>Productos incluidos</h4><div className="history-list">{comboItems.filter(item => item.combo_id === dialog.combo.id).map(item =>
        <div className="history-row" key={item.id}><b>{products.find(product => product.id === item.product_id)?.name ?? 'Producto'} · {item.quantity} un.</b><strong>{money((products.find(product => product.id === item.product_id)?.unit_cost ?? 0) * item.quantity)}</strong></div>)}</div>
      {actionError && <StatusMessage message={actionError}/>}
      <div className="form-actions"><Button secondary disabled={busy} onClick={() => void toggle(dialog.combo)}>{dialog.combo.is_active ? 'Desactivar' : 'Activar'}</Button>{dialog.combo.is_active && <Button onClick={() => setDialog({ kind: 'edit', combo: dialog.combo })}>Editar</Button>}</div></>}
    </Modal>}
  </Module>
}
