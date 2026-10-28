import { useState } from 'react'
import { Module } from '../components/ui/Module'
import { MiniStats } from '../components/ui/MiniStats'
import { Search } from '../components/ui/Search'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { LoadingRows } from '../components/ui/LoadingRows'
import { StatusMessage } from '../components/ui/StatusMessage'
import { SupplierForm } from '../components/procurement/SupplierForm'
import { useProcurement } from '../context/ProcurementContext'
import { createSupplier, deactivateSupplier, updateSupplier } from '../services/procurement'
import { cordobaDate } from '../lib/procurement-rules'
import { errorMessage } from '../lib/errors'
import { money } from '../utils/money'
import type { SupplierInput, SupplierRecord } from '../types/procurement'

type Dialog = { kind: 'create' } | { kind: 'details' | 'edit' | 'deactivate'; supplier: SupplierRecord }
const displayDate = (date: string) => date.split('-').reverse().join('/')

export function SuppliersPage() {
  const { suppliers, purchases, items, loading, error, refresh } = useProcurement()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('active')
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const month = cordobaDate().slice(0, 7)
  const monthPurchases = purchases.filter(purchase => purchase.purchase_date.startsWith(month))
  const stats: [string, string, string][] = [
    ['Proveedores activos', String(suppliers.filter(supplier => supplier.is_active).length), 'disponibles para nuevas compras'],
    ['Compras del mes', money(monthPurchases.reduce((sum, purchase) => sum + purchase.total, 0)), `${monthPurchases.length} operaciones`],
    ['Total comprado', money(purchases.reduce((sum, purchase) => sum + purchase.total, 0)), 'historial confirmado'],
  ]
  const filtered = suppliers.filter(supplier =>
    (status === 'all' || status === 'active' && supplier.is_active || status === 'inactive' && !supplier.is_active) &&
    [supplier.name, supplier.phone, supplier.email ?? ''].some(value => value.toLocaleLowerCase().includes(search.toLocaleLowerCase())),
  )

  function open(next: Dialog) { setDialog(next); setNotice(null); setDialogError(null) }
  async function save(input: SupplierInput) {
    if (dialog?.kind === 'edit') await updateSupplier(dialog.supplier.id, input)
    else await createSupplier(input)
    await refresh()
    setDialog(null)
    setNotice(`${input.name} fue ${dialog?.kind === 'edit' ? 'actualizado' : 'creado'}.`)
  }
  async function deactivate(supplier: SupplierRecord) {
    setBusy(true)
    setDialogError(null)
    try {
      await deactivateSupplier(supplier.id)
      await refresh()
      setDialog(null)
      setNotice(`${supplier.name} fue desactivado. Sus compras siguen disponibles.`)
    } catch (failure) { setDialogError(errorMessage(failure)) }
    finally { setBusy(false) }
  }

  return <Module title="Proveedores" subtitle="Contactos, compras y evolución de costos" action="Nuevo proveedor" onAction={() => open({ kind: 'create' })}>
    {notice && <StatusMessage tone="success" message={notice}/>}
    {error && <StatusMessage message={error}/>}
    <MiniStats stats={stats}/>
    <div className="toolbar"><Search value={search} onChange={setSearch} placeholder="Buscar proveedores..."/><div className="filter-wrap">
      <select aria-label="Filtrar proveedores" value={status} onChange={event => setStatus(event.target.value)}>
        <option value="active">Activos</option><option value="all">Todos</option><option value="inactive">Inactivos</option>
      </select>
    </div></div>
    {loading ? <LoadingRows/> : filtered.length ? <div className="data-table generic supplier-table">
      <div className="data-row data-head"><span>Proveedor</span><span>Contacto</span><span>Productos</span><span>Última compra</span><span>Total comprado</span><span>Estado</span></div>
      {filtered.map(supplier => {
        const history = purchases.filter(purchase => purchase.supplier_id === supplier.id)
        const productCount = new Set(items.filter(item => history.some(purchase => purchase.id === item.purchase_id)).map(item => item.product_id)).size
        return <div className="data-row" key={supplier.id}>
          <span><button className="product-name" onClick={() => open({ kind: 'details', supplier })}>{supplier.name}</button></span>
          <span>{supplier.phone}</span><span>{productCount} productos</span>
          <span>{history.length ? displayDate(history[0].purchase_date) : 'Sin compras'}</span>
          <strong>{money(history.reduce((sum, purchase) => sum + purchase.total, 0))}</strong>
          <span><Badge type={supplier.is_active ? 'success' : 'neutral'}>{supplier.is_active ? 'Activo' : 'Inactivo'}</Badge></span>
        </div>
      })}
    </div> : <div className="empty-state">No hay proveedores para mostrar. Podés crear uno con el botón superior.</div>}
    {dialog && <Modal title={dialog.kind === 'create' ? 'Nuevo proveedor' : dialog.kind === 'edit' ? 'Editar proveedor' : dialog.kind === 'deactivate' ? 'Desactivar proveedor' : dialog.supplier.name} onClose={() => setDialog(null)}>
      {dialog.kind === 'create' && <SupplierForm onSave={save} onCancel={() => setDialog(null)}/>}
      {dialog.kind === 'edit' && <SupplierForm supplier={dialog.supplier} onSave={save} onCancel={() => setDialog(null)}/>}
      {dialog.kind === 'deactivate' && <><p>¿Desactivar {dialog.supplier.name}? Sus compras históricas se conservarán.</p>{dialogError && <StatusMessage message={dialogError}/>}<div className="form-actions"><Button secondary onClick={() => setDialog(null)}>Cancelar</Button><Button disabled={busy} onClick={() => void deactivate(dialog.supplier)}>{busy ? 'Guardando…' : 'Confirmar desactivación'}</Button></div></>}
      {dialog.kind === 'details' && (() => {
        const history = purchases.filter(purchase => purchase.supplier_id === dialog.supplier.id)
        return <><div className="detail-grid">
          <div><span>Nombre</span><b>{dialog.supplier.name}</b></div><div><span>Teléfono</span><b>{dialog.supplier.phone}</b></div>
          <div><span>Dirección</span><b>{dialog.supplier.address ?? 'Sin dirección'}</b></div><div><span>Correo</span><b>{dialog.supplier.email ?? 'Sin correo'}</b></div>
          <div><span>Operaciones</span><b>{history.length}</b></div><div><span>Total comprado</span><b>{money(history.reduce((sum, purchase) => sum + purchase.total, 0))}</b></div>
          <div><span>Estado</span><b>{dialog.supplier.is_active ? 'Activo' : 'Inactivo'}</b></div>
          <div><span>Observaciones</span><b>{dialog.supplier.notes ?? 'Sin observaciones'}</b></div>
        </div><h4>Historial de compras</h4><div className="history-list">{history.length ? history.map(purchase =>
          <div className="history-row" key={purchase.id}><b>{displayDate(purchase.purchase_date)}</b><strong>{money(purchase.total)}</strong><small>{items.filter(item => item.purchase_id === purchase.id).length} productos · Confirmada</small></div>,
        ) : <div className="empty-state">Este proveedor todavía no tiene compras.</div>}</div>
        {dialog.supplier.is_active && <div className="form-actions"><Button secondary onClick={() => open({ kind: 'deactivate', supplier: dialog.supplier })}>Desactivar</Button><Button onClick={() => open({ kind: 'edit', supplier: dialog.supplier })}>Editar</Button></div>}</>
      })()}
    </Modal>}
  </Module>
}
