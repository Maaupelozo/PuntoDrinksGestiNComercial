import { useMemo, useState, type ReactNode } from 'react'

type Page = 'Dashboard' | 'Ventas' | 'Control de stock' | 'Precios y rentabilidad' | 'Compras' | 'Gastos' | 'Combos y promociones' | 'Reportes' | 'Proveedores' | 'Configuración'
type IconName = 'grid' | 'sale' | 'box' | 'chart' | 'cart' | 'wallet' | 'gift' | 'report' | 'truck' | 'settings' | 'search' | 'bell' | 'plus' | 'chevron' | 'dots' | 'arrow' | 'calendar' | 'download' | 'menu' | 'check' | 'warning'

const nav: { label: Page; icon: IconName }[] = [
  { label: 'Dashboard', icon: 'grid' }, { label: 'Ventas', icon: 'sale' }, { label: 'Control de stock', icon: 'box' },
  { label: 'Precios y rentabilidad', icon: 'chart' }, { label: 'Compras', icon: 'cart' }, { label: 'Gastos', icon: 'wallet' },
  { label: 'Combos y promociones', icon: 'gift' }, { label: 'Reportes', icon: 'report' }, { label: 'Proveedores', icon: 'truck' },
  { label: 'Configuración', icon: 'settings' },
]

const products = [
  { name: 'Fernet Branca', meta: '750 ml · Aperitivo', stock: 18, min: 8, cost: 8900, price: 14500, tone: '#251913' },
  { name: 'Skyy Vodka', meta: '750 ml · Vodka', stock: 5, min: 6, cost: 7800, price: 12800, tone: '#1673b9' },
  { name: 'Coca-Cola', meta: '2.25 L · Gaseosa', stock: 32, min: 10, cost: 1900, price: 3200, tone: '#cf2525' },
  { name: 'Sprite', meta: '2.25 L · Gaseosa', stock: 2, min: 8, cost: 1850, price: 3100, tone: '#29a765' },
  { name: 'Monster Energy', meta: '473 ml · Energizante', stock: 24, min: 12, cost: 1700, price: 2900, tone: '#171717' },
  { name: 'Cerveza Corona', meta: '710 ml · Cerveza', stock: 0, min: 6, cost: 2400, price: 4100, tone: '#e2ae25' },
]

const money = (value: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value)

function Icon({ name, size = 19 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    sale: <><path d="M4 7h16l-1 13H5L4 7Z"/><path d="M8 7a4 4 0 0 1 8 0"/></>, box: <><path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="M4 7v10l8 4 8-4V7M12 11v10"/></>,
    chart: <><path d="M4 19V9m6 10V5m6 14v-7m5 7H2"/></>, cart: <><path d="M3 4h2l2 11h11l2-7H6"/><circle cx="9" cy="19" r="1"/><circle cx="17" cy="19" r="1"/></>,
    wallet: <><path d="M4 6h15a2 2 0 0 1 2 2v11H4a2 2 0 0 1-2-2V6a3 3 0 0 1 3-3h12"/><path d="M16 11h5v4h-5a2 2 0 0 1 0-4Z"/></>,
    gift: <><rect x="3" y="8" width="18" height="13" rx="1"/><path d="M12 8v13M2 8h20M12 8H8a3 3 0 1 1 4-3v3Zm0 0h4a3 3 0 1 0-4-3v3Z"/></>,
    report: <><path d="M5 3h11l3 3v15H5V3Z"/><path d="M9 17v-4m3 4V9m3 8v-6"/></>, truck: <><path d="M3 6h11v11H3V6Zm11 4h4l3 4v3h-7v-7Z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19 13.5v-3l-2-.7-.7-1.7.9-1.9-2.1-2.1-1.9.9-1.7-.7L10.5 2h-3l-.7 2.3-1.7.7-1.9-.9-2.1 2.1.9 1.9-.7 1.7-2.3.7v3l2.3.7.7 1.7-.9 1.9 2.1 2.1 1.9-.9 1.7.7.7 2.3h3l.7-2.3 1.7-.7 1.9.9 2.1-2.1-.9-1.9.7-1.7 2.3-.7Z" transform="translate(2) scale(.83)"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>, bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"/></>,
    plus: <path d="M12 5v14M5 12h14"/>, chevron: <path d="m9 18 6-6-6-6"/>, dots: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    arrow: <><path d="M5 12h14m-5-5 5 5-5 5"/></>, calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4m8-4v4M3 10h18"/></>,
    download: <><path d="M12 3v12m-4-4 4 4 4-4M4 20h16"/></>, menu: <path d="M4 7h16M4 12h16M4 17h16"/>, check: <path d="m5 12 4 4L19 6"/>,
    warning: <><path d="M12 3 2 20h20L12 3Z"/><path d="M12 9v5m0 3h.01"/></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function Button({ children, secondary = false, onClick, className = '' }: { children: ReactNode; secondary?: boolean; onClick?: () => void; className?: string }) {
  return <button className={`btn ${secondary ? 'btn-secondary' : ''} ${className}`} onClick={onClick}>{children}</button>
}
function Badge({ children, type = 'neutral' }: { children: ReactNode; type?: 'success' | 'warning' | 'danger' | 'neutral' | 'info' }) {
  return <span className={`badge ${type}`}>{children}</span>
}
function Search({ value = '', onChange, placeholder = 'Buscar...' }: { value?: string; onChange?: (v: string) => void; placeholder?: string }) {
  return <label className="search"><Icon name="search" size={17}/><input value={value} onChange={e => onChange?.(e.target.value)} placeholder={placeholder}/></label>
}
function Field({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return <label className="field"><span>{label}</span><div><input defaultValue={value}/>{suffix && <em>{suffix}</em>}</div></label>
}

function Sidebar({ page, setPage, open, close }: { page: Page; setPage: (p: Page) => void; open: boolean; close: () => void }) {
  return <><aside className={`sidebar ${open ? 'open' : ''}`}>
    <div className="brand"><span>PD</span><div><b>PUNTO</b><small>DRINKS</small></div></div>
    <nav>{nav.map(item => <button key={item.label} className={page === item.label ? 'active' : ''} onClick={() => { setPage(item.label); close() }}><Icon name={item.icon}/><span>{item.label}</span></button>)}</nav>
    <div className="side-user"><div className="avatar">MA</div><div><b>Martín Álvarez</b><small>Propietario</small></div><Icon name="chevron" size={15}/></div>
  </aside>{open && <button className="backdrop" onClick={close} aria-label="Cerrar menú"/>}</>
}

function Header({ page, openMenu }: { page: Page; openMenu: () => void }) {
  return <header className="header"><button className="menu-btn" onClick={openMenu}><Icon name="menu"/></button><div><small>Gestión comercial</small><h1>{page}</h1></div><div className="header-actions"><button className="icon-btn"><Icon name="bell"/><i/></button><div className="avatar">MA</div></div></header>
}

function Dashboard({ go }: { go: (p: Page) => void }) {
  const cards = [
    ['Ventas de hoy', '$ 286.450', '+12,8%', 'vs. ayer', 'up'], ['Ganancia bruta', '$ 96.820', '33,8%', 'margen', 'up'],
    ['Ganancia neta', '$ 72.340', '+8,4%', 'vs. ayer', 'up'], ['Compras', '$ 84.200', '2', 'recepciones', ''],
    ['Gastos operativos', '$ 24.480', '-4,2%', 'vs. ayer', 'down'], ['Productos disponibles', '86', '4', 'con stock bajo', 'warn'],
  ]
  return <div className="stack">
    <div className="welcome"><div><h2>Buen día, Martín</h2><p>Este es el resumen de Punto Drinks para hoy, 24 de octubre.</p></div><div className="actions"><Button secondary><Icon name="calendar" size={17}/> Hoy</Button><Button onClick={() => go('Ventas')}><Icon name="plus" size={17}/> Nueva venta</Button></div></div>
    <section className="metric-grid">{cards.map(([label, value, delta, note, tone]) => <article className="metric" key={label}><div className="metric-label"><span>{label}</span><Icon name="dots"/></div><strong>{value}</strong><div><span className={tone}>{tone === 'up' ? '↗ ' : tone === 'down' ? '↘ ' : ''}{delta}</span> {note}</div></article>)}</section>
    <section className="dashboard-grid">
      <article className="panel sales-chart"><PanelTitle title="Evolución de ventas" subtitle="Ingresos de los últimos 7 días" action="Ver reporte"/>
        <div className="chart-total"><strong>$ 1.486.200</strong><Badge type="success">↗ 16,2%</Badge></div>
        <div className="line-chart"><svg viewBox="0 0 700 210" preserveAspectRatio="none"><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d62828" stopOpacity=".16"/><stop offset="1" stopColor="#d62828" stopOpacity="0"/></linearGradient></defs><path className="area" d="M0 175 C75 150 95 164 145 128 S235 152 290 105 S380 110 435 78 S520 110 570 55 S650 61 700 25 L700 210 L0 210Z"/><path className="line" d="M0 175 C75 150 95 164 145 128 S235 152 290 105 S380 110 435 78 S520 110 570 55 S650 61 700 25"/></svg><div>{['Vie 18','Sáb 19','Dom 20','Lun 21','Mar 22','Mié 23','Hoy'].map(x => <span key={x}>{x}</span>)}</div></div>
      </article>
      <article className="panel alerts"><PanelTitle title="Alertas de stock" subtitle="4 productos requieren atención" action="Ver inventario"/>
        {products.filter(p => p.stock <= p.min).slice(0,3).map(p => <div className="alert-row" key={p.name}><ProductPic product={p}/><div><b>{p.name}</b><small>{p.stock === 0 ? 'Sin unidades disponibles' : `${p.stock} unidades · Mínimo ${p.min}`}</small></div><Badge type={p.stock === 0 ? 'danger' : 'warning'}>{p.stock === 0 ? 'Sin stock' : 'Stock bajo'}</Badge></div>)}
        <button className="text-link" onClick={() => go('Control de stock')}>Revisar todos los productos <Icon name="arrow" size={15}/></button>
      </article>
    </section>
    <section className="dashboard-grid bottom">
      <article className="panel"><PanelTitle title="Productos más vendidos" subtitle="Unidades vendidas este mes" action="Ver detalle"/>
        {products.slice(0,4).map((p, i) => <div className="rank" key={p.name}><span>{i + 1}</span><ProductPic product={p}/><div><b>{p.name}</b><small>{p.meta}</small></div><strong>{[128, 94, 82, 64][i]} <small>un.</small></strong></div>)}
      </article>
      <article className="panel recent"><PanelTitle title="Últimas ventas" subtitle="Operaciones recientes" action="Ver todas"/>
        <div className="table-head"><span>Venta</span><span>Pago</span><span>Total</span></div>
        {[['#V-1048','Fernet + Coca · 2 ítems','Mercado Pago','$ 19.800'],['#V-1047','Monster Energy · 3 ítems','Efectivo','$ 8.700'],['#V-1046','Combo previa · 1 ítem','Transferencia','$ 17.900'],['#V-1045','Skyy Vodka · 1 ítem','Efectivo','$ 12.800']].map(v => <div className="sale-row" key={v[0]}><div><b>{v[0]}</b><small>{v[1]}</small></div><Badge>{v[2]}</Badge><strong>{v[3]}</strong></div>)}
      </article>
    </section>
  </div>
}

function PanelTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: string }) {
  return <div className="panel-title"><div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>{action && <button>{action} <Icon name="chevron" size={14}/></button>}</div>
}
function ProductPic({ product }: { product: typeof products[number] }) {
  return <span className="product-pic" style={{ background: product.tone }}>{product.name.split(' ').map(w => w[0]).slice(0,2).join('')}</span>
}

function Sales() {
  const [cart, setCart] = useState<{ idx: number; qty: number }[]>([{ idx: 0, qty: 1 }, { idx: 2, qty: 1 }])
  const [search, setSearch] = useState('')
  const [done, setDone] = useState(false)
  const total = cart.reduce((s, x) => s + products[x.idx].price * x.qty, 0)
  const add = (idx: number) => setCart(c => c.some(x => x.idx === idx) ? c.map(x => x.idx === idx ? { ...x, qty: Math.min(x.qty + 1, products[idx].stock) } : x) : [...c, { idx, qty: 1 }])
  return <div className="stack">
    <div className="welcome"><div><h2>Nueva venta</h2><p>Seleccioná productos o combos y confirmá el cobro.</p></div><Button secondary>Ver historial</Button></div>
    {done && <div className="success-banner"><Icon name="check"/><div><b>Venta #V-1049 registrada correctamente</b><span>El stock y los resultados fueron actualizados.</span></div><button onClick={() => setDone(false)}>×</button></div>}
    <div className="pos-grid"><section className="panel product-browser"><div className="filters"><Search value={search} onChange={setSearch} placeholder="Buscar bebida, categoría o código..."/><Button secondary>Todos los productos</Button></div>
      <div className="product-grid">{products.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).map((p, idx) => { const realIdx = products.indexOf(p); return <button className="product-card" key={p.name} disabled={!p.stock} onClick={() => add(realIdx)}><ProductPic product={p}/><div><b>{p.name}</b><small>{p.meta}</small><strong>{money(p.price)}</strong><span className={p.stock <= p.min ? 'low' : ''}>{p.stock ? `${p.stock} disponibles` : 'Sin stock'}</span></div><i><Icon name="plus" size={16}/></i></button>})}</div>
    </section><aside className="panel checkout"><PanelTitle title="Resumen de venta" subtitle={`${cart.reduce((s,x)=>s+x.qty,0)} productos`}/>
      <div className="cart-lines">{cart.map(x => <div className="cart-line" key={x.idx}><ProductPic product={products[x.idx]}/><div><b>{products[x.idx].name}</b><small>{money(products[x.idx].price)} c/u</small><div className="stepper"><button onClick={() => setCart(c => c.map(y => y.idx === x.idx ? {...y, qty: Math.max(1,y.qty-1)}:y))}>−</button><span>{x.qty}</span><button onClick={() => add(x.idx)}>+</button></div></div><strong>{money(products[x.idx].price*x.qty)}</strong></div>)}</div>
      <div className="totals"><div><span>Subtotal</span><b>{money(total)}</b></div><div><span>Descuento</span><b>$ 0</b></div><div className="grand"><span>Total</span><strong>{money(total)}</strong></div></div>
      <div className="payment"><span>Método de pago</span><div><button className="selected">Efectivo</button><button>Transferencia</button><button>Mercado Pago</button></div></div>
      <Button className="confirm" onClick={() => setDone(true)}>Confirmar venta <Icon name="arrow" size={18}/></Button><small className="safe"><Icon name="check" size={14}/> Se validará el stock antes de confirmar</small>
    </aside></div>
  </div>
}

function Stock() {
  const [search, setSearch] = useState('')
  return <Module title="Control de stock" subtitle="86 productos · 1.248 unidades en inventario" action="Agregar producto">
    <div className="toolbar"><Search value={search} onChange={setSearch} placeholder="Buscar productos..."/><div><Button secondary>Categoría: Todas</Button><Button secondary>Estado: Todos</Button><Button>Entrada de mercadería</Button></div></div>
    <div className="data-table"><div className="data-row data-head"><span>Producto</span><span>Categoría</span><span>Disponible</span><span>Stock mínimo</span><span>Estado</span><span/></div>
      {products.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).map(p => <div className="data-row" key={p.name}><span className="product-cell"><ProductPic product={p}/><span><b>{p.name}</b><small>{p.meta.split(' · ')[0]} · SKU-00{products.indexOf(p)+1}</small></span></span><span>{p.meta.split(' · ')[1]}</span><strong>{p.stock} un.</strong><span>{p.min} un.</span><span><Badge type={p.stock === 0 ? 'danger' : p.stock <= p.min ? 'warning' : 'success'}>{p.stock === 0 ? 'Sin stock' : p.stock <= p.min ? 'Stock bajo' : 'Disponible'}</Badge></span><button><Icon name="dots"/></button></div>)}
    </div><div className="pagination"><span>Mostrando 1–6 de 86 productos</span><div><button>‹</button><button className="active">1</button><button>2</button><button>3</button><button>›</button></div></div>
  </Module>
}

function Prices() {
  const [cost, setCost] = useState(7800), [percent, setPercent] = useState(40), [method, setMethod] = useState<'markup'|'margin'>('markup')
  const suggested = method === 'markup' ? cost * (1 + percent / 100) : cost / (1 - Math.min(percent, 95) / 100)
  return <Module title="Precios y rentabilidad" subtitle="Costos, márgenes y precios de venta" action="Actualizar precios">
    <div className="price-layout"><div className="data-table price-table"><div className="data-row data-head"><span>Producto</span><span>Costo unitario</span><span>Precio venta</span><span>Ganancia</span><span>Margen / Recargo</span><span/></div>{products.slice(0,5).map(p => <div className="data-row" key={p.name}><span className="product-cell"><ProductPic product={p}/><b>{p.name}</b></span><span>{money(p.cost)}</span><strong>{money(p.price)}</strong><span className="profit">{money(p.price-p.cost)}</span><span><b>{Math.round((p.price-p.cost)/p.price*100)}%</b><small>{Math.round((p.price-p.cost)/p.cost*100)}% sobre costo</small></span><button><Icon name="dots"/></button></div>)}</div>
      <aside className="panel calculator"><PanelTitle title="Calculadora de precios" subtitle="Simulá sin modificar el precio actual"/><Field label="Costo del producto" value={String(cost)} suffix="$"/><div className="method"><span>Método de cálculo</span><button className={method==='markup'?'active':''} onClick={()=>setMethod('markup')}>Recargo sobre costo</button><button className={method==='margin'?'active':''} onClick={()=>setMethod('margin')}>Margen sobre venta</button></div><label className="range"><span>Porcentaje deseado <b>{percent}%</b></span><input type="range" min="5" max="80" value={percent} onChange={e=>setPercent(+e.target.value)}/></label><div className="suggestion"><span>Precio sugerido</span><strong>{money(suggested)}</strong><div><span>Ganancia estimada <b>{money(suggested-cost)}</b></span><span>Margen resultante <b>{((suggested-cost)/suggested*100).toFixed(1)}%</b></span></div></div><Button className="confirm">Aplicar al producto</Button><p className="formula">Los cambios solo se aplican a ventas futuras. El historial conserva sus valores originales.</p></aside>
    </div>
  </Module>
}

const genericData: Record<string, { subtitle: string; action: string; stats: [string,string,string][]; columns: string[]; rows: string[][] }> = {
  Compras: { subtitle:'Reposición de mercadería y recepciones', action:'Registrar compra', stats:[['Compras del mes','$ 842.600','12 operaciones'],['Pendiente de recepción','$ 126.400','2 órdenes'],['Proveedores activos','8','3 usados este mes']], columns:['Compra','Proveedor','Fecha','Productos','Total','Estado'], rows:[['#C-0248','Distribuidora Norte','24/10/2026','8 productos','$ 84.200','Recibida'],['#C-0247','Bebidas del Sur','22/10/2026','4 productos','$ 126.400','Pendiente'],['#C-0246','Coca-Cola Andina','18/10/2026','6 productos','$ 92.800','Recibida']] },
  Gastos: { subtitle:'Egresos operativos separados de la mercadería', action:'Registrar gasto', stats:[['Gastos de hoy','$ 24.480','4 registros'],['Gastos del mes','$ 286.240','−4,2% vs. mes anterior'],['Mayor categoría','Transporte','32% del total']], columns:['Detalle','Categoría','Fecha','Medio de pago','Importe','Estado'], rows:[['Combustible reparto','Transporte','24/10/2026','Mercado Pago','$ 12.800','Registrado'],['Bolsas y embalaje','Insumos','24/10/2026','Efectivo','$ 7.200','Registrado'],['Comisión plataforma','Comisiones','23/10/2026','Débito','$ 4.480','Registrado']] },
  'Combos y promociones': { subtitle:'Promociones calculadas sobre el stock real', action:'Crear combo', stats:[['Combos activos','6','2 próximos a vencer'],['Ventas del mes','84','unidades'],['Ganancia estimada','$ 248.300','margen promedio 29%']], columns:['Combo','Componentes','Disponibilidad','Precio promo','Margen','Estado'], rows:[['Previa clásica','Skyy + Sprite','2 combos','$ 15.500','29%','Activo'],['Fernet completo','Fernet + Coca-Cola','18 combos','$ 16.900','31%','Activo'],['Noche Corona','6 × Cerveza Corona','Sin stock','$ 21.900','27%','Pausado']] },
  Proveedores: { subtitle:'Contactos, compras y evolución de costos', action:'Nuevo proveedor', stats:[['Proveedores activos','8','2 preferidos'],['Compras del mes','$ 842.600','12 operaciones'],['Saldo pendiente','$ 126.400','1 proveedor']], columns:['Proveedor','Contacto','Productos','Última compra','Total comprado','Estado'], rows:[['Distribuidora Norte','11 4524-8801','24 productos','24/10/2026','$ 386.200','Activo'],['Bebidas del Sur','11 3380-1290','18 productos','22/10/2026','$ 248.600','Activo'],['Coca-Cola Andina','0800-888-8888','8 productos','18/10/2026','$ 207.800','Activo']] },
}

function GenericModule({ page }: { page: keyof typeof genericData }) {
  const d=genericData[page]
  return <Module title={page} subtitle={d.subtitle} action={d.action}><div className="mini-stats">{d.stats.map(s=><div key={s[0]}><span>{s[0]}</span><strong>{s[1]}</strong><small>{s[2]}</small></div>)}</div><div className="toolbar"><Search placeholder={`Buscar en ${page.toLowerCase()}...`}/><Button secondary><Icon name="calendar" size={16}/> Este mes</Button></div><div className="data-table generic"><div className="data-row data-head">{d.columns.map(c=><span key={c}>{c}</span>)}</div>{d.rows.map((r,i)=><div className="data-row" key={i}>{r.map((c,j)=><span key={j}>{j===0?<b>{c}</b>:j===r.length-1?<Badge type={c==='Pausado'||c==='Pendiente'?'warning':'success'}>{c}</Badge>:c}</span>)}</div>)}</div></Module>
}

function Reports() {
  return <Module title="Reportes y estadísticas" subtitle="Resultados económicos y flujo del negocio" action="Exportar reporte"><div className="report-filter"><Button secondary><Icon name="calendar" size={16}/> 01/10/2026 — 24/10/2026</Button><div><button className="active">Mes</button><button>Semana</button><button>Personalizado</button></div></div><div className="mini-stats reports">{[['Ingresos','$ 3.842.600','+14,2%'],['Costo vendido','$ 2.424.800','63,1%'],['Ganancia bruta','$ 1.417.800','36,9%'],['Gastos operativos','$ 286.240','7,4%'],['Ganancia neta','$ 1.131.560','29,4%'],['Flujo de caja','$ 624.720','Cobros − pagos']].map(s=><div key={s[0]}><span>{s[0]}</span><strong>{s[1]}</strong><small>{s[2]}</small></div>)}</div><div className="report-grid"><article className="panel"><PanelTitle title="Ingresos y rentabilidad" subtitle="Comparación semanal"/><div className="bars">{[48,67,53,82,74,92,88].map((h,i)=><div key={i}><i style={{height:`${h}%`}}/><span>S{i+1}</span></div>)}</div></article><article className="panel"><PanelTitle title="Composición de egresos" subtitle="No confunde compras con costo vendido"/><div className="donut"><div/><ul><li><i className="red"/>Costo vendido <b>63%</b></li><li><i className="black"/>Compras de inventario <b>25%</b></li><li><i className="gray"/>Gastos operativos <b>12%</b></li></ul></div></article></div></Module>
}

function Settings() {
  return <Module title="Configuración" subtitle="Negocio, usuarios y preferencias"><div className="settings-grid"><aside className="settings-nav">{['Información del negocio','Perfil de usuario','Usuarios y roles','Stock y categorías','Preferencias','Respaldo y exportación'].map((x,i)=><button className={i===0?'active':''} key={x}>{x}<Icon name="chevron" size={15}/></button>)}</aside><section className="panel settings-form"><PanelTitle title="Información del negocio" subtitle="Datos visibles en reportes y comprobantes"/><div className="form-grid"><Field label="Nombre comercial" value="Punto Drinks"/><Field label="CUIT (opcional)" value=""/><Field label="Teléfono" value="+54 9 11 4582-1200"/><Field label="Email" value="hola@puntodrinks.com"/><Field label="Moneda" value="ARS — Peso argentino"/><Field label="Zona horaria" value="Argentina (UTC−3)"/></div><div className="form-footer"><Button secondary>Cancelar</Button><Button>Guardar cambios</Button></div></section></div></Module>
}

function Module({ title, subtitle, action, children }: { title: string; subtitle: string; action?: string; children: ReactNode }) {
  return <div className="stack"><div className="welcome"><div><h2>{title}</h2><p>{subtitle}</p></div>{action&&<Button><Icon name="plus" size={17}/>{action}</Button>}</div><section className="panel module-panel">{children}</section></div>
}

export default function App() {
  const [page,setPage]=useState<Page>('Dashboard'), [menu,setMenu]=useState(false)
  const content=useMemo(()=> {
    if(page==='Dashboard') return <Dashboard go={setPage}/>
    if(page==='Ventas') return <Sales/>
    if(page==='Control de stock') return <Stock/>
    if(page==='Precios y rentabilidad') return <Prices/>
    if(page==='Reportes') return <Reports/>
    if(page==='Configuración') return <Settings/>
    return <GenericModule page={page as keyof typeof genericData}/>
  },[page])
  return <div className="app"><Sidebar page={page} setPage={setPage} open={menu} close={()=>setMenu(false)}/><main><Header page={page} openMenu={()=>setMenu(true)}/><div className="content">{content}</div></main><nav className="mobile-nav">{[{p:'Dashboard',i:'grid',l:'Inicio'},{p:'Ventas',i:'sale',l:'Ventas'},{p:'Control de stock',i:'box',l:'Stock'},{p:'Reportes',i:'report',l:'Reportes'}].map(x=><button className={page===x.p?'active':''} key={x.p} onClick={()=>setPage(x.p as Page)}><Icon name={x.i as IconName}/><span>{x.l}</span></button>)}<button onClick={()=>setMenu(true)}><Icon name="menu"/><span>Más</span></button></nav></div>
}
