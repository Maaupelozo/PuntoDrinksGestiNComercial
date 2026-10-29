import { useMemo, useState } from 'react'
import { Module } from '../components/ui/Module'
import { Search } from '../components/ui/Search'
import { Button } from '../components/ui/Button'
import { ProductPic } from '../components/ui/ProductPic'
import { Badge } from '../components/ui/Badge'
import { Icon } from '../components/ui/Icon'
import { Modal } from '../components/ui/Modal'
import { LoadingRows } from '../components/ui/LoadingRows'
import { StatusMessage } from '../components/ui/StatusMessage'
import { ProductForm } from '../components/inventory/ProductForm'
import { StockMovementForm } from '../components/inventory/StockMovementForm'
import { HistoryList } from '../components/inventory/HistoryList'
import { useInventory } from '../context/InventoryContext'
import { createProduct, updateProduct, adjustStock, deactivateProduct } from '../services/inventory'
import { errorMessage } from '../lib/errors'
import { money } from '../utils/money'
import type { ProductRecord } from '../types/inventory'

type Dialog =
  | { kind: 'create' | 'select-entry' }
  | { kind: 'details' | 'edit' | 'movement' | 'history' | 'deactivate'; product: ProductRecord }

export function StockPage() {
  const { products, loading, error, refresh } = useInventory()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [status, setStatus] = useState('active')
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [entryProductId, setEntryProductId] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const categories = useMemo(() => [...new Set(products.map(product => product.category))].sort(), [products])
  const filtered = products.filter(product =>
    product.name.toLowerCase().includes(search.toLowerCase()) &&
    (category === 'all' || product.category === category) &&
    (status === 'all' || status === 'active' && product.is_active ||
      status === 'inactive' && !product.is_active ||
      status === 'low' && product.is_active && product.stock_quantity > 0 && product.stock_quantity <= product.min_stock ||
      status === 'empty' && product.is_active && product.stock_quantity === 0),
  )
  const pages = Math.max(1, Math.ceil(filtered.length / 6))
  const currentPage = Math.min(page, pages)
  const visible = filtered.slice((currentPage - 1) * 6, currentPage * 6)
  const activeProducts = products.filter(product => product.is_active)
  const subtitle = `${activeProducts.length} productos · ${activeProducts.reduce((sum, product) => sum + product.stock_quantity, 0)} unidades en inventario`

  function open(next: Dialog) { setDialog(next); setDialogError(null); setNotice(null) }
  async function deactivate(product: ProductRecord) {
    setBusy(true)
    setDialogError(null)
    try {
      await deactivateProduct(product.id)
      await refresh()
      setDialog(null)
      setNotice(`${product.name} fue desactivado.`)
    } catch (failure) { setDialogError(errorMessage(failure)) }
    finally { setBusy(false) }
  }

  return <Module title="Control de stock" subtitle={subtitle} action="Agregar producto" onAction={() => open({ kind: 'create' })}>
    {notice && <StatusMessage tone="success" message={notice}/>}
    {error && <StatusMessage message={error}/>}
    <div className="toolbar">
      <Search value={search} onChange={value => { setSearch(value); setPage(1) }} placeholder="Buscar productos..."/>
      <div className="filter-wrap">
        <select aria-label="Filtrar categoría" value={category} onChange={event => { setCategory(event.target.value); setPage(1) }}>
          <option value="all">Categoría: Todas</option>{categories.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
        <select aria-label="Filtrar estado" value={status} onChange={event => { setStatus(event.target.value); setPage(1) }}>
          <option value="active">Estado: Activos</option><option value="all">Todos</option><option value="low">Stock bajo</option><option value="empty">Sin stock</option><option value="inactive">Inactivos</option>
        </select>
        <Button onClick={() => { setEntryProductId(activeProducts[0]?.id ?? ''); open({ kind: 'select-entry' }) }}>Entrada de mercadería</Button>
      </div>
    </div>
    {loading ? <LoadingRows/> : filtered.length === 0 ? <div className="empty-state">No hay productos para mostrar. Podés agregar una bebida con el botón superior.</div> : <>
      <div className="data-table"><div className="data-row data-head"><span>Producto</span><span>Categoría</span><span>Disponible</span><span>Stock mínimo</span><span>Estado</span><span/></div>
        {visible.map(product => <div className="data-row" key={product.id}>
          <span className="product-cell"><ProductPic product={product}/><span><button className="product-name" onClick={() => open({ kind: 'details', product })}>{product.name}</button><small>{product.sku ?? 'Sin SKU'}</small></span></span>
          <span>{product.category}</span><strong>{product.stock_quantity} un.</strong><span>{product.min_stock} un.</span>
          <span><Badge type={!product.is_active ? 'neutral' : product.stock_quantity === 0 ? 'danger' : product.stock_quantity <= product.min_stock ? 'warning' : 'success'}>
            {!product.is_active ? 'Inactivo' : product.stock_quantity === 0 ? 'Sin stock' : product.stock_quantity <= product.min_stock ? 'Stock bajo' : 'Disponible'}
          </Badge></span>
          <button title={`Ver detalles de ${product.name}`} aria-label={`Ver detalles de ${product.name}`} onClick={() => open({ kind: 'details', product })}><Icon name="dots"/></button>
        </div>)}
      </div>
      <div className="pagination"><span>Mostrando {(currentPage - 1) * 6 + 1}–{Math.min(currentPage * 6, filtered.length)} de {filtered.length} productos</span><div>
        <button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>‹</button>
        {Array.from({ length: pages }, (_, index) => <button className={currentPage === index + 1 ? 'active' : ''} key={index} onClick={() => setPage(index + 1)}>{index + 1}</button>)}
        <button disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>›</button>
      </div></div>
    </>}
    {dialog && <Modal title={dialog.kind === 'create' ? 'Agregar producto' : dialog.kind === 'select-entry' ? 'Entrada de mercadería' : dialog.kind === 'edit' ? 'Editar producto' : dialog.kind === 'movement' ? `Movimiento de ${dialog.product.name}` : dialog.kind === 'history' ? `Movimientos de ${dialog.product.name}` : dialog.kind === 'deactivate' ? 'Desactivar producto' : 'Producto'} onClose={() => setDialog(null)}>
      {dialog.kind === 'create' && <ProductForm onCancel={() => setDialog(null)} onSave={async input => { await createProduct(input); await refresh(); setDialog(null); setNotice(`${input.name} fue creado.`) }}/>}
      {dialog.kind === 'edit' && <ProductForm product={dialog.product} onCancel={() => setDialog(null)} onSave={async input => { await updateProduct(dialog.product.id, input); await refresh(); setDialog(null); setNotice(`${input.name} fue actualizado.`) }}/>}
      {dialog.kind === 'select-entry' && <>
        {activeProducts.length ? <><label className="select-field">Producto<select value={entryProductId} onChange={event => setEntryProductId(event.target.value)}>{activeProducts.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><div className="form-actions"><Button secondary onClick={() => setDialog(null)}>Cancelar</Button><Button onClick={() => { const product = products.find(value => value.id === entryProductId); if (product) open({ kind: 'movement', product }) }}>Continuar</Button></div></> : <div className="empty-state">Agregá un producto antes de registrar una entrada.</div>}
      </>}
      {dialog.kind === 'details' && <><div className="detail-grid">
        <div><span>Nombre</span><b>{dialog.product.name}</b></div><div><span>Categoría</span><b>{dialog.product.category}</b></div>
        <div><span>SKU</span><b>{dialog.product.sku ?? 'Sin SKU'}</b></div><div><span>Stock</span><b>{dialog.product.stock_quantity} un.</b></div>
        <div><span>Stock mínimo</span><b>{dialog.product.min_stock} un.</b></div><div><span>Costo unitario</span><b>{Number(dialog.product.unit_cost) <= 0 ? 'Pendiente' : money(dialog.product.unit_cost)}</b></div>
        <div><span>Precio de venta</span><b>{money(dialog.product.sale_price)}</b></div><div><span>Estado</span><b>{dialog.product.is_active ? 'Activo' : 'Inactivo'}</b></div>
      </div><div className="form-actions"><Button secondary onClick={() => open({ kind: 'history', product: dialog.product })}>Movimientos</Button>{dialog.product.is_active && <><Button secondary onClick={() => open({ kind: 'movement', product: dialog.product })}>Ajustar stock</Button><Button secondary onClick={() => open({ kind: 'deactivate', product: dialog.product })}>Desactivar</Button><Button onClick={() => open({ kind: 'edit', product: dialog.product })}>Editar</Button></>}</div></>}
      {dialog.kind === 'movement' && <StockMovementForm product={dialog.product} onCancel={() => setDialog(null)} onSave={async input => { await adjustStock(input, dialog.product.stock_quantity); await refresh(); setDialog(null); setNotice('Movimiento de stock registrado.') }}/>}
      {dialog.kind === 'history' && <HistoryList productId={dialog.product.id} kind="stock"/>}
      {dialog.kind === 'deactivate' && <><p>¿Desactivar {dialog.product.name}? El producto dejará de estar disponible y sus movimientos quedarán en el historial.</p>{dialogError && <StatusMessage message={dialogError}/>}<div className="form-actions"><Button secondary onClick={() => setDialog(null)}>Cancelar</Button><Button disabled={busy} onClick={() => void deactivate(dialog.product)}>{busy ? 'Guardando…' : 'Confirmar desactivación'}</Button></div></>}
    </Modal>}
  </Module>
}
