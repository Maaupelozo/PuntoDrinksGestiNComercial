import { expect, test, type Page } from '@playwright/test'
import { loadEnv } from 'vite'
import { cordobaDate } from '../src/lib/procurement-rules'

const projectUrl = loadEnv('development', process.cwd(), 'VITE_SUPABASE_').VITE_SUPABASE_URL
const projectRef = new URL(projectUrl).hostname.split('.')[0]
const userId = '10000000-0000-4000-8000-000000000001'
const now = new Date().toISOString()
const user = { id: userId, aud: 'authenticated', email: 'dueno@puntodrinks.com', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: now }
const expiresAt = Math.floor(Date.now() / 1000) + 24 * 60 * 60
const jwt = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: userId, role: 'authenticated', exp: expiresAt })).toString('base64url'), 'test-signature'].join('.')
const session = { access_token: jwt, refresh_token: 'test-refresh', token_type: 'bearer', expires_in: 86400, expires_at: expiresAt, user }
const initialProducts = [
  { id: '20000000-0000-4000-8000-000000000001', owner_id: userId, name: 'Skyy Vodka', category: 'Vodka', sku: 'SKY-1', unit_cost: 8000, sale_price: 12000, stock_quantity: 10, min_stock: 3, is_active: true, created_at: now, updated_at: now },
  { id: '20000000-0000-4000-8000-000000000002', owner_id: userId, name: 'Coca-Cola', category: 'Gaseosa', sku: 'COCA-1', unit_cost: 1900, sale_price: 3200, stock_quantity: 0, min_stock: 5, is_active: true, created_at: now, updated_at: now },
]

type Product = typeof initialProducts[number]

async function mockApi(page: Page, authenticated = true, failProducts = false, reportDays = 1, withHistory = false) {
  const mockUser = structuredClone(user)
  const mockSession = { ...session, user: mockUser }
  const resetRequests: any[] = []
  const authUpdates: any[] = []
  const settings = { owner_id: userId, business_name: 'Punto Drinks', phone: null,
    address: null, currency: 'ARS', time_zone: 'America/Argentina/Cordoba',
    default_min_stock: 0, logo_url: null, created_at: now, updated_at: now }
  const products: Product[] = structuredClone(initialProducts)
  const movements: any[] = []
  const history: any[] = []
  const suppliers: any[] = []
  const purchases: any[] = []
  const purchaseItems: any[] = []
  const combos: any[] = []
  const comboItems: any[] = []
  const sales: any[] = []
  const saleItems: any[] = []
  const saleComponents: any[] = []
  const expenses: any[] = []
  const expenseAudit: any[] = []
  if (authenticated) {
    await page.addInitScript(({ key, value }) => {
      if (!sessionStorage.getItem('mock-auth-ready')) {
        localStorage.setItem(key, JSON.stringify(value))
        sessionStorage.setItem('mock-auth-ready', '1')
      }
    }, { key: `sb-${projectRef}-auth-token`, value: mockSession })
  }
  await page.route('**/auth/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/token')) {
      const body = route.request().postDataJSON()
      if (body.password === 'correct-password') await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSession) })
      else await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ msg: 'Invalid login credentials' }) })
    } else if (path.endsWith('/recover')) { resetRequests.push(route.request().postDataJSON()); await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }) }
    else if (path.endsWith('/user') && route.request().method() === 'PUT') {
      const body = route.request().postDataJSON()
      authUpdates.push(body)
      if (body.data) mockUser.user_metadata = { ...mockUser.user_metadata, ...body.data }
      if (body.email) mockUser.email = body.email
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: mockUser }) })
    }
    else if (path.endsWith('/logout')) await route.fulfill({ status: 204 })
    else await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockUser) })
  })
  await page.route('**/rest/v1/**', async route => {
    const url = new URL(route.request().url())
    const path = url.pathname
    const body = route.request().postDataJSON() as Record<string, any> | null
    const json = (data: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
    if (path.endsWith('/historical_records')) return json(withHistory ? [
      { id: '90000000-0000-4000-8000-000000000001', owner_id: userId,
        source_key: 'test-sale-01', source_fingerprint: 'a'.repeat(32),
        kind: 'sale', business_date: '2026-10-09', description: 'Venta de prueba',
        quantity: 1, amount: 1200, record_status: 'confirmed_composition',
        details: { source: 'Prueba local', paymentMethod: null,
          components: [{ name: 'Producto A', quantity: 1 }, { name: 'Producto B', quantity: 2 }] }, imported_at: now },
      { id: '90000000-0000-4000-8000-000000000002', owner_id: userId,
        source_key: 'test-expense-01', source_fingerprint: 'b'.repeat(32),
        kind: 'expense', business_date: '2026-10-10', description: 'No detallado',
        quantity: null, amount: 300, record_status: 'unclassified',
        details: { source: 'Prueba local', paymentMethod: null }, imported_at: now },
      { id: '90000000-0000-4000-8000-000000000004', owner_id: userId,
        source_key: 'test-purchase-01', source_fingerprint: 'd'.repeat(32),
        kind: 'purchase', business_date: '2026-10-10', description: 'Compra de prueba',
        quantity: null, amount: 500, record_status: 'allocation_pending',
        details: { source: 'Prueba local', paymentMethod: null }, imported_at: now },
      { id: '90000000-0000-4000-8000-000000000003', owner_id: userId,
        source_key: 'test-count-01', source_fingerprint: 'c'.repeat(32),
        kind: 'count', business_date: '2026-10-28', description: 'Producto C',
        quantity: 3, amount: null, record_status: 'counted',
        details: { source: 'Prueba local' }, imported_at: now },
    ] : [])
    if (path.endsWith('/business_settings')) {
      if (route.request().method() === 'PATCH' || route.request().method() === 'POST') Object.assign(settings, body, { updated_at: new Date().toISOString() })
      return json(settings)
    }
    if (path.endsWith('/expenses')) {
      const start = (url.searchParams.get('expense_date') ?? '').replace('gte.', '')
      return json(expenses.filter(item => !start || item.expense_date >= start))
    }
    if (path.endsWith('/expense_audit')) return json(expenseAudit.filter(item => `eq.${item.expense_id}` === url.searchParams.get('expense_id')).reverse())
    if (path.endsWith('/rpc/save_expense') && body) {
      const prior = expenses.find(item => item.id === body.p_expense_id)
      const expense = prior ?? { id: crypto.randomUUID(), owner_id: userId, status: 'posted', created_at: now, voided_at: null, voided_by: null, void_reason: null }
      const old = prior ? structuredClone(prior) : null
      Object.assign(expense, { expense_date: body.p_expense_date, description: body.p_description, category: body.p_category, amount: body.p_amount, payment_method: body.p_payment_method, notes: body.p_notes, updated_at: new Date().toISOString() })
      if (!prior) expenses.push(expense)
      expenseAudit.push({ id: crypto.randomUUID(), expense_id: expense.id, action: prior ? 'updated' : 'created', old_record: old, new_record: structuredClone(expense), created_at: now })
      return json(expense)
    }
    if (path.endsWith('/rpc/void_expense') && body) {
      const expense = expenses.find(item => item.id === body.p_expense_id)
      if (!expense) return json({ code: 'P0002', message: 'Gasto no encontrado' }, 404)
      const old = structuredClone(expense)
      Object.assign(expense, { status: 'voided', voided_at: now, voided_by: userId, void_reason: body.p_reason })
      expenseAudit.push({ id: crypto.randomUUID(), expense_id: expense.id, action: 'voided', old_record: old, new_record: structuredClone(expense), created_at: now })
      return json(expense)
    }
    if (path.endsWith('/rpc/financial_report') && body) {
      const start = body.p_start_date as string
      const end = body.p_end_date as string
      const within = (value: string) => value >= start && value < end
      const selectedSales = sales.filter(item => within(cordobaDate(new Date(item.sold_at))))
      const selectedPurchases = purchases.filter(item => within(item.purchase_date))
      const selectedExpenses = expenses.filter(item => item.status === 'posted' && within(item.expense_date))
      const revenue = selectedSales.reduce((sum, item) => sum + item.total_amount, 0)
      const cogs = selectedSales.reduce((sum, item) => sum + item.total_cost, 0)
      const spending = selectedExpenses.reduce((sum, item) => sum + item.amount, 0)
      const bought = selectedPurchases.reduce((sum, item) => sum + item.total, 0)
      const daily = Array.from({ length: reportDays }, (_, index) => ({
        date: new Date(Date.parse(`${start}T12:00:00Z`) + index * 86_400_000).toISOString().slice(0, 10),
        revenue: index === 0 ? revenue : 0,
        cogs: index === 0 ? cogs : 0,
        gross_profit: index === 0 ? revenue - cogs : 0,
        expenses: index === 0 ? spending : 0,
        purchases: index === 0 ? bought : 0,
        sales_count: index === 0 ? selectedSales.length : 0,
      }))
      return json({ period: { start, end_exclusive: end }, summary: { revenue, cogs, gross_profit: revenue - cogs, expenses: spending, net_operating_result: revenue - cogs - spending, purchases: bought, cashflow_estimate: revenue - bought - spending, sales_count: selectedSales.length, expense_count: selectedExpenses.length, purchase_count: selectedPurchases.length, average_ticket: selectedSales.length ? revenue / selectedSales.length : 0 }, daily, expense_categories: selectedExpenses.map(item => ({ category: item.category, total: item.amount, count: 1 })), top_products: [], top_purchased: [], supplier_totals: [], recent_sales: selectedSales.slice(-5).reverse(), inventory: { available_products: products.filter(item => item.is_active && item.stock_quantity > 0).length, low_stock_products: products.filter(item => item.is_active && item.stock_quantity > 0 && item.stock_quantity <= item.min_stock).length, out_of_stock_products: products.filter(item => item.is_active && item.stock_quantity === 0).length, estimated_value: products.reduce((sum, item) => sum + item.stock_quantity * item.unit_cost, 0), alerts: products.filter(item => item.is_active && item.stock_quantity <= item.min_stock).slice(0, 5) } })
    }
    if (path.endsWith('/combos')) return json(combos.slice().sort((a, b) => a.name.localeCompare(b.name)))
    if (path.endsWith('/combo_items')) return json(comboItems)
    if (path.endsWith('/sales')) return json(sales.slice().reverse())
    if (path.endsWith('/sale_items')) return json(saleItems)
    if (path.endsWith('/sale_item_components')) return json(saleComponents)
    if (path.endsWith('/suppliers')) return json(suppliers.slice().sort((a, b) => a.name.localeCompare(b.name)))
    if (path.endsWith('/purchases')) return json(purchases.slice().reverse())
    if (path.endsWith('/purchase_items')) return json(purchaseItems)
    if (path.endsWith('/products')) {
      if (failProducts) return json({ code: 'PGRST205', message: 'Missing table' }, 404)
      return json(products.slice().sort((a, b) => a.name.localeCompare(b.name)))
    }
    if (path.endsWith('/inventory_movements')) return json(movements.filter((item: any) => `eq.${item.product_id}` === url.searchParams.get('product_id')))
    if (path.endsWith('/price_history')) return json(history.filter((item: any) => `eq.${item.product_id}` === url.searchParams.get('product_id')))
    if (path.endsWith('/rpc/create_supplier') && body) {
      const supplier = { id: `40000000-0000-4000-8000-${String(suppliers.length + 1).padStart(12, '0')}`, owner_id: userId, name: body.p_name, phone: body.p_phone, address: body.p_address, email: body.p_email, notes: body.p_notes, is_active: true, created_at: now, updated_at: now }
      suppliers.push(supplier)
      return json(supplier)
    }
    if (path.endsWith('/rpc/update_supplier') && body) {
      const supplier = suppliers.find(item => item.id === body.p_supplier_id)
      if (!supplier) return json({ code: 'P0002', message: 'Proveedor no encontrado' }, 404)
      Object.assign(supplier, { name: body.p_name, phone: body.p_phone, address: body.p_address, email: body.p_email, notes: body.p_notes })
      return json(supplier)
    }
    if (path.endsWith('/rpc/deactivate_supplier') && body) {
      const supplier = suppliers.find(item => item.id === body.p_supplier_id)
      if (!supplier) return json({ code: 'P0002', message: 'Proveedor no encontrado' }, 404)
      supplier.is_active = false
      return json(supplier)
    }
    if (path.endsWith('/rpc/register_purchase') && body) {
      const prior = purchases.find(item => item.idempotency_key === body.p_idempotency_key)
      if (prior) return json(prior)
      const lines = body.p_items as { product_id: string; quantity: number; unit_cost: number }[]
      if (!lines.length || lines.some(line => !products.some(product => product.id === line.product_id && product.is_active))) {
        return json({ code: 'P0002', message: 'Producto no encontrado o inactivo' }, 404)
      }
      const id = `50000000-0000-4000-8000-${String(purchases.length + 1).padStart(12, '0')}`
      const purchase = { id, owner_id: userId, supplier_id: body.p_supplier_id, purchase_date: body.p_purchase_date, status: 'confirmed', total: lines.reduce((sum, line) => sum + line.quantity * line.unit_cost, 0), payment_method: body.p_payment_method, notes: body.p_notes, idempotency_key: body.p_idempotency_key, request_fingerprint: 'mock', created_at: now }
      purchases.push(purchase)
      lines.forEach((line, index) => {
        const product = products.find(item => item.id === line.product_id)!
        const itemId = `60000000-0000-4000-8000-${String(purchaseItems.length + 1).padStart(12, '0')}`
        purchaseItems.push({ id: itemId, purchase_id: id, owner_id: userId, product_id: product.id, product_name: product.name, product_sku: product.sku, quantity: line.quantity, unit_cost: line.unit_cost, subtotal: line.quantity * line.unit_cost, created_at: now })
        const oldStock = product.stock_quantity
        const nextCost = oldStock === 0 ? line.unit_cost : Math.round((oldStock * product.unit_cost + line.quantity * line.unit_cost) / (oldStock + line.quantity) * 100) / 100
        if (nextCost !== product.unit_cost) history.push({ id: `purchase-h${index}`, product_id: product.id, previous_cost: product.unit_cost, new_cost: nextCost, previous_price: product.sale_price, new_price: product.sale_price, changed_at: now })
        product.unit_cost = nextCost
        product.stock_quantity += line.quantity
        movements.push({ id: `purchase-m${index}`, product_id: product.id, movement_type: 'entry', quantity_delta: line.quantity, previous_stock: oldStock, new_stock: product.stock_quantity, reason: 'Compra de mercadería', purchase_id: id, purchase_item_id: itemId, created_at: now })
      })
      return json(purchase)
    }
    if (path.endsWith('/rpc/save_combo') && body) {
      const combo = combos.find(item => item.id === body.p_combo_id)
      if (body.p_combo_id && !combo) return json({ code: 'P0002', message: 'Combo no encontrado' }, 404)
      const saved = combo ?? { id: `70000000-0000-4000-8000-${String(combos.length + 1).padStart(12, '0')}`, owner_id: userId, is_active: true, created_at: now }
      Object.assign(saved, { name: body.p_name, description: body.p_description, sale_price: body.p_sale_price, updated_at: now })
      if (!combo) combos.push(saved)
      for (let i = comboItems.length - 1; i >= 0; i--) if (comboItems[i].combo_id === saved.id) comboItems.splice(i, 1)
      for (const line of body.p_items) comboItems.push({ id: crypto.randomUUID(), combo_id: saved.id, owner_id: userId, product_id: line.product_id, quantity: line.quantity })
      return json(saved)
    }
    if (path.endsWith('/rpc/set_combo_active') && body) {
      const combo = combos.find(item => item.id === body.p_combo_id)
      if (!combo) return json({ code: 'P0002', message: 'Combo no encontrado' }, 404)
      combo.is_active = body.p_active
      return json(combo)
    }
    if (path.endsWith('/rpc/confirm_sale') && body) {
      const prior = sales.find(item => item.idempotency_key === body.p_idempotency_key)
      if (prior) return json(prior)
      const lines = body.p_items as { product_id?: string; combo_id?: string; quantity: number }[]
      const needed = new Map<string, number>()
      for (const line of lines) {
        if (line.product_id) needed.set(line.product_id, (needed.get(line.product_id) ?? 0) + line.quantity)
        else for (const component of comboItems.filter(item => item.combo_id === line.combo_id))
          needed.set(component.product_id, (needed.get(component.product_id) ?? 0) + component.quantity * line.quantity)
      }
      if ([...needed].some(([id, quantity]) => !products.some(product => product.id === id && product.is_active && product.stock_quantity >= quantity)))
        return json({ code: '22023', message: 'Stock insuficiente' }, 400)
      const id = `80000000-0000-4000-8000-${String(sales.length + 1).padStart(12, '0')}`
      const saved = { id, owner_id: userId, sale_number: id, sold_at: new Date().toISOString(), payment_method: body.p_payment_method, total_amount: 0, total_cost: 0, gross_profit: 0, status: 'confirmed', idempotency_key: body.p_idempotency_key, request_fingerprint: 'mock', created_at: now }
      for (const line of lines) {
        const product = products.find(item => item.id === line.product_id)
        const combo = combos.find(item => item.id === line.combo_id)
        const parts = product ? [{ product_id: product.id, quantity: 1 }] : comboItems.filter(item => item.combo_id === combo?.id)
        const unitCost = parts.reduce((sum, part) => sum + products.find(item => item.id === part.product_id)!.unit_cost * part.quantity, 0)
        const price = product?.sale_price ?? combo!.sale_price
        const itemId = crypto.randomUUID()
        const item = { id: itemId, sale_id: id, owner_id: userId, product_id: product?.id ?? null, combo_id: combo?.id ?? null, item_name: product?.name ?? combo!.name, quantity: line.quantity, unit_price_snapshot: price, unit_cost_snapshot: unitCost, subtotal: price * line.quantity, total_cost: unitCost * line.quantity, gross_profit: (price - unitCost) * line.quantity, created_at: now }
        saleItems.push(item)
        for (const part of parts) {
          const source = products.find(value => value.id === part.product_id)!
          const quantity = part.quantity * line.quantity
          saleComponents.push({ id: crypto.randomUUID(), sale_item_id: itemId, sale_id: id, owner_id: userId, product_id: source.id, product_name: source.name, quantity, unit_cost_snapshot: source.unit_cost, total_cost: quantity * source.unit_cost })
          movements.push({ id: crypto.randomUUID(), product_id: source.id, movement_type: 'exit', quantity_delta: -quantity, previous_stock: source.stock_quantity, new_stock: source.stock_quantity - quantity, reason: 'Venta confirmada', sale_id: id, created_at: now })
          source.stock_quantity -= quantity
        }
        saved.total_amount += item.subtotal
        saved.total_cost += item.total_cost
      }
      saved.gross_profit = saved.total_amount - saved.total_cost
      sales.push(saved)
      return json(saved)
    }
    if (path.endsWith('/rpc/create_product') && body) {
      const id = `20000000-0000-4000-8000-${String(products.length + 1).padStart(12, '0')}`
      const product = { ...initialProducts[0], id, name: body.p_name, category: body.p_category, sku: body.p_sku, unit_cost: body.p_unit_cost, sale_price: body.p_sale_price, stock_quantity: body.p_initial_stock, min_stock: body.p_min_stock }
      products.push(product)
      if (product.stock_quantity > 0) movements.push({ id: 'opening', product_id: id, movement_type: 'entry', quantity_delta: product.stock_quantity, previous_stock: 0, new_stock: product.stock_quantity, reason: 'Stock inicial', created_at: now })
      return json(product)
    }
    const product = products.find(item => item.id === body?.p_product_id)
    if (!product) return json({ code: 'P0002', message: 'Producto no encontrado' }, 404)
    if (path.endsWith('/rpc/update_product') && body) {
      if (product.unit_cost !== body.p_unit_cost || product.sale_price !== body.p_sale_price) history.push({ id: `h${history.length}`, product_id: product.id, previous_cost: product.unit_cost, new_cost: body.p_unit_cost, previous_price: product.sale_price, new_price: body.p_sale_price, changed_at: now })
      Object.assign(product, { name: body.p_name, category: body.p_category, sku: body.p_sku, unit_cost: body.p_unit_cost, sale_price: body.p_sale_price, min_stock: body.p_min_stock })
      return json(product)
    }
    if (path.endsWith('/rpc/deactivate_product')) { product.is_active = false; return json(product) }
    if (path.endsWith('/rpc/adjust_stock') && body) {
      const next = product.stock_quantity + body.p_quantity_delta
      if (next < 0) return json({ code: '23514', message: 'Stock insuficiente' }, 400)
      movements.push({ id: `m${movements.length}`, product_id: product.id, movement_type: body.p_movement_type, quantity_delta: body.p_quantity_delta, previous_stock: product.stock_quantity, new_stock: next, reason: body.p_reason, created_at: now })
      product.stock_quantity = next
      return json(product)
    }
    if (path.endsWith('/rpc/update_product_prices') && body) {
      if (product.unit_cost !== body.p_unit_cost || product.sale_price !== body.p_sale_price) history.push({ id: `h${history.length}`, product_id: product.id, previous_cost: product.unit_cost, new_cost: body.p_unit_cost, previous_price: product.sale_price, new_price: body.p_sale_price, changed_at: now })
      product.unit_cost = body.p_unit_cost
      product.sale_price = body.p_sale_price
      return json(product)
    }
    return json({ code: 'PGRST202', message: 'Unknown request' }, 404)
  })
  return { products, movements, history, suppliers, purchases, purchaseItems, combos, comboItems, sales, saleItems, saleComponents, expenses, expenseAudit, settings, resetRequests, mockUser, authUpdates }
}

const sections = [
  ['/', 'Dashboard', 'Buen día'], ['/ventas', 'Ventas', 'Nueva venta'],
  ['/stock', 'Control de stock', 'Control de stock'], ['/precios', 'Precios y rentabilidad', 'Precios y rentabilidad'],
  ['/compras', 'Compras', 'Compras'], ['/gastos', 'Gastos', 'Gastos'], ['/combos', 'Combos y promociones', 'Combos y promociones'],
  ['/reportes', 'Reportes', 'Reportes y estadísticas'], ['/historico', 'Histórico de octubre', 'Histórico de octubre'], ['/proveedores', 'Proveedores', 'Proveedores'], ['/configuracion', 'Configuración', 'Configuración'],
]

async function navigate(page: Page, label: string) {
  if (page.viewportSize()!.width <= 820) await page.getByRole('button', { name: 'Abrir menú' }).click()
  await page.locator('.sidebar').getByRole('link', { name: label, exact: true }).click()
}

for (const [path, header, title] of sections) {
  test(`protected page loads and survives reload: ${header}`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await mockApi(page)
    await page.goto(path)
    await expect(page.locator('h1')).toHaveText(header)
    await expect(page.getByRole('heading', { level: 2, name: title, exact: true })).toBeVisible()
    await page.reload()
    await expect(page.locator('h1')).toHaveText(header)
    expect(errors).toEqual([])
  })
}

test('reports fit the viewport and use page scrolling for daily data', async ({ page }) => {
  await mockApi(page, true, false, 31)
  await page.goto('/reportes')
  await expect(page.locator('.finance-group-list').last().locator('.report-line')).toHaveCount(31)

  const initialWidth = page.viewportSize()!.width
  const widths = initialWidth === 390 ? [320, 390] : initialWidth === 1440 ? [1024, 1440] : [initialWidth]
  for (const width of widths) {
    await page.setViewportSize({ width, height: 844 })
    const layout = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      page: document.documentElement.scrollWidth,
      nested: [...document.querySelectorAll('.finance-group-list, .report-grid .finance-chart')].map(element => ({
        client: element.clientHeight,
        scroll: element.scrollHeight,
      })),
    }))
    expect(layout.page, `Reportes desborda horizontalmente a ${width}px`).toBeLessThanOrEqual(layout.viewport)
    expect(layout.nested.length).toBe(5)
    for (const [index, item] of layout.nested.entries())
      expect(item.scroll, `La sección ${index + 1} tiene scroll interno a ${width}px`).toBeLessThanOrEqual(item.client)
  }
})

test('historical ledger feeds dated report amounts while profit remains pending', async ({ page }) => {
  await mockApi(page, true, false, 1, true)
  await page.goto('/historico')
  await expect(page.locator('.mini-stats')).toContainText('1.200')
  await expect(page.locator('.historical-records')).toContainText('Venta de prueba')
  await expect(page.locator('.historical-records')).toContainText('Pago: No informado')
  await page.getByRole('button', { name: 'Gastos (1)' }).click()
  await expect(page.locator('.historical-records')).toContainText('No detallado')
  await expect(page.locator('.historical-records')).toContainText('300')
  await page.getByRole('button', { name: 'Conteo físico (1)' }).click()
  await expect(page.locator('.historical-count')).toContainText('3 unidades')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  await navigate(page, 'Reportes')
  await expect(page.locator('.finance-summary')).toContainText('1.200')
  await expect(page.locator('.finance-summary')).toContainText('300')
  await expect(page.locator('.finance-summary')).toContainText('500')
  await expect(page.locator('.finance-summary')).toContainText('Pendiente')
  await navigate(page, 'Ventas')
  await page.getByRole('button', { name: 'Ver historial' }).click()
  await expect(page.locator('.mini-stats')).toContainText('1.200')
  await expect(page.locator('.mini-stats')).toContainText('Pendiente')
  await navigate(page, 'Compras')
  await expect(page.locator('.mini-stats')).toContainText('500')
})

test('private route requires login, session survives reload, and logout clears it', async ({ page }) => {
  await mockApi(page, false)
  await page.goto('/stock')
  await expect(page).toHaveURL(/\/ingresar$/)
  await page.getByLabel('Correo electrónico').fill('dueno@puntodrinks.com')
  await page.getByLabel('Contraseña', { exact: true }).fill('correct-password')
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await expect(page.locator('h1')).toHaveText('Dashboard')
  await page.reload()
  await expect(page.locator('h1')).toHaveText('Dashboard')
  if (page.viewportSize()!.width <= 820) await page.getByRole('button', { name: 'Abrir menú' }).click()
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/ingresar$/)
})

test('login errors and recovery request appear in the UI', async ({ page }) => {
  await mockApi(page, false)
  await page.goto('/ingresar')
  await page.getByLabel('Correo electrónico').fill('dueno@puntodrinks.com')
  await page.getByLabel('Contraseña', { exact: true }).fill('incorrect')
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Invalid login credentials')
  await page.getByRole('button', { name: 'Olvidé mi contraseña' }).click()
  await page.getByRole('button', { name: 'Enviar enlace' }).click()
  await expect(page.getByRole('status')).toContainText('Si existe una cuenta')
})

test('sidebar and mobile navigation keep the URL and title in sync', async ({ page }) => {
  await mockApi(page)
  await page.goto('/')
  for (const [, label] of sections.slice(1)) {
    await navigate(page, label)
    await expect(page.locator('h1')).toHaveText(label)
  }
  await page.goBack()
  await expect(page.locator('h1')).toHaveText('Proveedores')
})

test('settings persist business details and default minimum stock is used by new products', async ({ page }) => {
  const state = await mockApi(page)
  await page.goto('/configuracion')
  await page.getByLabel('Nombre comercial').fill('Punto Drinks Centro')
  await page.getByLabel('Teléfono').fill('351-555-0101')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByRole('status')).toContainText('Datos del negocio guardados')
  await page.reload()
  await expect(page.getByLabel('Nombre comercial')).toHaveValue('Punto Drinks Centro')
  await expect(page.getByLabel('Teléfono')).toHaveValue('351-555-0101')
  await page.getByRole('button', { name: 'Preferencias' }).click()
  await page.getByLabel('Stock mínimo predeterminado').fill('7')
  await page.getByRole('button', { name: 'Guardar preferencia' }).click()
  await expect(page.getByRole('status')).toContainText('Stock mínimo')
  expect(state.settings.default_min_stock).toBe(7)
  await navigate(page, 'Control de stock')
  await page.getByRole('button', { name: 'Agregar producto' }).click()
  await expect(page.getByLabel('Stock mínimo')).toHaveValue('7')
})

test('profile, password and expired recovery link have working controls', async ({ page }) => {
  const state = await mockApi(page)
  await page.goto('/configuracion')
  await page.getByRole('button', { name: 'Perfil de usuario' }).click()
  await page.getByLabel('Nombre', { exact: true }).fill('Ana Administradora')
  await page.getByRole('button', { name: 'Guardar perfil' }).click()
  await expect(page.locator('.side-user')).toContainText('Ana Administradora')
  expect(state.authUpdates.some(update => update.data?.display_name === 'Ana Administradora')).toBe(true)
  await page.getByRole('button', { name: 'Seguridad' }).click()
  await page.getByLabel('Contraseña actual').fill('correct-password')
  await page.getByLabel('Nueva contraseña').fill('nuevaClaveSegura12')
  await page.getByLabel('Repetir contraseña').fill('nuevaClaveSegura12')
  await page.getByRole('button', { name: 'Cambiar contraseña' }).click()
  await expect(page.getByRole('status')).toContainText('Contraseña actualizada')
  expect(state.authUpdates.some(update => update.current_password === 'correct-password' && update.password === 'nuevaClaveSegura12')).toBe(true)
  await page.goto('/restablecer-clave')
  await expect(page.getByRole('alert')).toContainText('El enlace no es válido o venció')
  await expect(page.getByLabel('Nueva contraseña')).toHaveCount(0)
})

test('expenses persist, update financial totals, audit edits and voids, and export reports', async ({ page }) => {
  const state = await mockApi(page)
  await page.goto('/gastos')
  await page.getByRole('button', { name: 'Registrar gasto' }).first().click()
  await page.getByLabel('Concepto').fill('Combustible reparto')
  await page.getByLabel('Importe').fill('5000')
  await page.getByRole('dialog').getByRole('button', { name: 'Registrar gasto' }).click()
  await expect(page.locator('.expense-table')).toContainText('Combustible reparto')
  expect(state.expenses).toHaveLength(1)
  await page.reload()
  await expect(page.locator('.expense-table')).toContainText('5.000')
  await navigate(page, 'Dashboard')
  await expect(page.locator('.finance-metrics')).toContainText('5.000')
  await navigate(page, 'Gastos')
  await page.getByRole('button', { name: 'Combustible reparto' }).click()
  await expect(page.locator('.history-row')).toHaveCount(1)
  await page.getByRole('button', { name: 'Editar' }).click()
  await page.getByLabel('Importe').fill('6000')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.locator('.expense-table')).toContainText('6.000')
  await navigate(page, 'Reportes')
  await expect(page.locator('.finance-summary')).toContainText('6.000')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar CSV' }).click()
  expect((await download).suggestedFilename()).toMatch(/\.csv$/)
  const pdfDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar PDF' }).click()
  expect((await pdfDownload).suggestedFilename()).toMatch(/\.pdf$/)
  await navigate(page, 'Gastos')
  await page.getByRole('button', { name: 'Combustible reparto' }).click()
  await expect(page.locator('.history-row')).toHaveCount(2)
  await page.getByRole('button', { name: 'Anular' }).click()
  await page.getByLabel('Motivo de anulación').fill('Carga duplicada')
  await page.getByRole('button', { name: 'Confirmar anulación' }).click()
  await expect(page.locator('.expense-table .data-row:not(.data-head)')).toHaveCount(0)
  await page.getByLabel('Filtrar estado').selectOption('voided')
  await expect(page.locator('.expense-table')).toContainText('Anulado')
  expect(state.expenseAudit).toHaveLength(3)
  await navigate(page, 'Reportes')
  await expect(page.locator('.finance-summary')).toContainText('Resultado neto operativo')
  await expect(page.locator('.finance-summary')).not.toContainText('6.000')
})

test('product creation, search, categories, stock movement and deactivation', async ({ page }) => {
  await mockApi(page)
  await page.goto('/stock')
  await expect(page.locator('.data-row:not(.data-head)')).toHaveCount(2)
  await page.getByRole('button', { name: 'Agregar producto' }).click()
  await page.getByLabel('Nombre', { exact: true }).fill('Fernet Branca')
  await page.getByLabel('Categoría', { exact: true }).fill('Aperitivo')
  await page.getByLabel('Costo unitario').fill('8900')
  await page.getByLabel('Precio de venta').fill('14500')
  await page.getByLabel('Stock inicial').fill('10')
  await page.getByRole('button', { name: 'Guardar producto' }).click()
  await expect(page.getByRole('status')).toContainText('Fernet Branca fue creado')
  await page.getByPlaceholder('Buscar productos...').fill('fernet')
  await expect(page.locator('.data-row:not(.data-head)')).toHaveCount(1)
  await page.getByRole('button', { name: 'Fernet Branca', exact: true }).click()
  await page.getByRole('button', { name: 'Ajustar stock' }).click()
  await page.getByLabel('Tipo de movimiento').selectOption('exit')
  await page.getByLabel('Cantidad de unidades').fill('2')
  await page.getByLabel('Motivo').fill('Venta')
  await page.getByRole('button', { name: 'Continuar' }).click()
  await page.getByRole('button', { name: 'Confirmar movimiento' }).click()
  await expect(page.locator('.data-row:not(.data-head)')).toContainText('8 un.')
  await page.getByRole('button', { name: 'Fernet Branca', exact: true }).click()
  await page.getByRole('button', { name: 'Movimientos' }).click()
  await expect(page.locator('.history-row')).toHaveCount(2)
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click()
  await page.getByRole('button', { name: 'Fernet Branca', exact: true }).click()
  await page.getByRole('button', { name: 'Desactivar', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar desactivación' }).click()
  await expect(page.locator('.data-row:not(.data-head)')).toHaveCount(0)
  await page.getByLabel('Filtrar estado').selectOption('inactive')
  await expect(page.locator('.data-row:not(.data-head)')).toContainText('Fernet Branca')
})

test('product editing updates stock and prices from the same data source', async ({ page }) => {
  await mockApi(page)
  await page.goto('/stock')
  await page.getByRole('button', { name: 'Skyy Vodka', exact: true }).click()
  await page.getByRole('button', { name: 'Editar', exact: true }).click()
  await page.getByLabel('Costo unitario').fill('8500')
  await page.getByLabel('Precio de venta').fill('13000')
  await page.getByLabel('Stock mínimo').fill('5')
  await page.getByRole('button', { name: 'Guardar producto' }).click()
  await navigate(page, 'Precios y rentabilidad')
  await expect(page.locator('.price-table')).toContainText('13.000')
  await page.getByRole('button', { name: 'Skyy Vodka', exact: true }).click()
  await page.getByRole('button', { name: 'Historial' }).click()
  await expect(page.locator('.history-row')).toHaveCount(1)
})

test('calculator accepts edited cost and applies a confirmed price', async ({ page }) => {
  await mockApi(page)
  await page.goto('/precios')
  await page.getByLabel('Producto de la calculadora').selectOption(initialProducts[0].id)
  await page.getByLabel('Costo del producto').fill('8000')
  await page.getByRole('spinbutton', { name: 'Porcentaje deseado' }).fill('50')
  await expect(page.locator('.suggestion > strong')).toHaveText(/12\.000/)
  await page.getByRole('button', { name: 'Margen sobre venta' }).click()
  await expect(page.locator('.suggestion > strong')).toHaveText(/16\.000/)
  await page.getByRole('button', { name: 'Aplicar al producto' }).click()
  await page.getByRole('button', { name: 'Confirmar nuevo precio' }).click()
  await expect(page.locator('.price-table')).toContainText('16.000')
  await page.getByRole('button', { name: 'Skyy Vodka', exact: true }).click()
  await page.getByRole('button', { name: 'Historial' }).click()
  await expect(page.locator('.history-row')).toHaveCount(1)
})

test('backend errors are shown without losing the page', async ({ page }) => {
  await mockApi(page, true, true)
  await page.goto('/stock')
  await expect(page.getByRole('alert')).toContainText('Falta aplicar una migración')
  await expect(page.locator('h1')).toHaveText('Control de stock')
})

test('combo creation, mixed sale, stock discount and history survive reload', async ({ page }) => {
  const state = await mockApi(page)
  await page.goto('/combos')
  await page.getByRole('button', { name: 'Crear combo' }).click()
  await page.getByLabel('Nombre del combo').fill('Promo Skyy doble')
  await page.getByLabel('Precio promocional').fill('20000')
  await page.getByLabel('Producto 1').selectOption(state.products[0].id)
  await page.getByLabel('Cantidad').fill('2')
  await expect(page.locator('.combo-calculation')).toContainText('16.000')
  await page.getByRole('button', { name: 'Crear combo', exact: true }).last().click()
  await expect(page.getByRole('status')).toContainText('Combo creado')
  await page.getByRole('button', { name: 'Promo Skyy doble' }).click()
  await page.getByRole('button', { name: 'Editar' }).click()
  await page.getByLabel('Precio promocional').fill('19000')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.locator('.combo-table')).toContainText('19.000')

  await navigate(page, 'Ventas')
  await page.locator('.product-card').filter({ has: page.locator('b').getByText('Skyy Vodka', { exact: true }) }).click()
  await page.locator('.product-card').filter({ hasText: 'Promo Skyy doble' }).click()
  await page.locator('.cart-line').filter({ hasText: 'Promo Skyy doble' }).getByRole('button', { name: 'Aumentar Promo Skyy doble' }).click()
  await expect(page.locator('.totals')).toContainText('50.000')
  await page.getByRole('button', { name: 'Revisar venta' }).click()
  await page.getByRole('button', { name: 'Confirmar venta' }).evaluate(button => {
    const confirmButton = button as HTMLButtonElement
    confirmButton.click()
    confirmButton.click()
  })
  await expect(page.getByRole('status')).toContainText('Venta confirmada')
  expect(state.sales).toHaveLength(1)
  expect(state.sales[0].gross_profit).toBe(10000)
  expect(state.products[0].stock_quantity).toBe(5)
  await page.reload()
  await page.getByRole('button', { name: 'Ver historial' }).click()
  await expect(page.locator('.sales-table .data-row:not(.data-head)')).toHaveCount(1)
  await expect(page.locator('.sales-table')).toContainText('50.000')
  await navigate(page, 'Dashboard')
  await expect(page.locator('.finance-metrics')).toContainText('50.000')
  await expect(page.locator('.finance-metrics')).toContainText('10.000')
  await navigate(page, 'Ventas')
  await page.getByRole('button', { name: 'Ver historial' }).click()
  await page.locator('.sales-table').getByRole('button', { name: /#80000000/ }).click()
  await expect(page.locator('.modal-panel')).toContainText('10.000')
  await page.locator('.modal-header button').click()
  await navigate(page, 'Control de stock')
  await expect(page.locator('.data-row').filter({ hasText: 'Skyy Vodka' })).toContainText('5 un.')
  await navigate(page, 'Combos y promociones')
  await page.getByRole('button', { name: 'Promo Skyy doble' }).click()
  await page.getByRole('button', { name: 'Desactivar' }).click()
  await expect(page.getByRole('status')).toContainText('desactivado')
  await page.reload()
  await page.getByLabel('Filtrar combos').selectOption('all')
  await expect(page.locator('.combo-table')).toContainText('Inactivo')
  await page.getByRole('button', { name: 'Promo Skyy doble' }).click()
  await page.getByRole('button', { name: 'Activar' }).click()
  await expect(page.locator('.combo-table')).toContainText('Activo')
})

test('supplier creation, editing, searching and deactivation persist across reloads', async ({ page }) => {
  const state = await mockApi(page)
  await page.goto('/proveedores')
  await page.getByRole('button', { name: 'Nuevo proveedor' }).click()
  await page.getByLabel('Nombre', { exact: true }).fill('Mayorista A')
  await page.getByLabel('Teléfono').fill('351-555-000')
  await page.getByLabel('Correo electrónico').fill('compras@mayorista.test')
  await page.getByRole('button', { name: 'Guardar proveedor' }).click()
  await expect(page.getByRole('status')).toContainText('Mayorista A fue creado')
  await page.getByPlaceholder('Buscar proveedores...').fill('Mayorista')
  await expect(page.locator('.generic .data-row:not(.data-head)')).toHaveCount(1)
  await page.getByRole('button', { name: 'Mayorista A', exact: true }).click()
  await page.getByRole('button', { name: 'Editar' }).click()
  await page.getByLabel('Teléfono').fill('351-777-000')
  await page.getByRole('button', { name: 'Guardar proveedor' }).click()
  await page.reload()
  await page.getByPlaceholder('Buscar proveedores...').fill('Mayorista')
  await expect(page.locator('.generic')).toContainText('351-777-000')
  await page.getByRole('button', { name: 'Mayorista A', exact: true }).click()
  await page.getByRole('button', { name: 'Desactivar', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar desactivación' }).click()
  await expect(page.locator('.generic .data-row:not(.data-head)')).toHaveCount(0)
  await page.getByLabel('Filtrar proveedores').selectOption('inactive')
  await expect(page.locator('.generic')).toContainText('Mayorista A')
  expect(state.suppliers).toHaveLength(1)
  expect(state.suppliers[0].is_active).toBe(false)
})

test('multi-product purchase updates stock, average cost, history and supplier totals', async ({ page }) => {
  const state = await mockApi(page)
  state.suppliers.push({ id: '40000000-0000-4000-8000-000000000001', owner_id: userId, name: 'Mayorista A', phone: '351-555', address: null, email: null, notes: null, is_active: true, created_at: now, updated_at: now })
  await page.goto('/compras')
  await page.getByRole('button', { name: 'Registrar compra' }).click()
  await page.getByRole('dialog').locator('select').first().selectOption(state.suppliers[0].id)
  await page.getByRole('combobox', { name: 'Producto 1' }).selectOption(initialProducts[0].id)
  await page.getByRole('spinbutton', { name: 'Cantidad' }).fill('6')
  await page.getByRole('spinbutton', { name: 'Costo unitario pagado' }).fill('8500')
  await page.getByRole('button', { name: 'Agregar línea' }).click()
  await page.getByRole('combobox', { name: 'Producto 2' }).selectOption(initialProducts[1].id)
  await page.getByRole('spinbutton', { name: 'Cantidad' }).nth(1).fill('12')
  await page.getByRole('spinbutton', { name: 'Costo unitario pagado' }).nth(1).fill('2300')
  await expect(page.locator('.purchase-total')).toContainText('78.600')
  await page.getByRole('button', { name: 'Revisar compra' }).click()
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page.locator('.status-message.success').filter({ hasText: 'Compra confirmada' })).toBeVisible()
  await expect(page.getByRole('dialog')).toContainText('Skyy Vodka')
  await expect(page.getByRole('dialog')).toContainText('Coca-Cola')
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click()
  await page.reload()
  await expect(page.locator('.generic .data-row:not(.data-head)')).toHaveCount(1)
  await expect(page.locator('.mini-stats')).toContainText('78.600')
  await navigate(page, 'Dashboard')
  await expect(page.locator('.finance-metrics')).toContainText('78.600')
  await navigate(page, 'Compras')
  await page.getByLabel('Filtrar período').selectOption('custom')
  await page.getByLabel('Desde').fill(state.purchases[0].purchase_date)
  await page.getByLabel('Hasta').fill(state.purchases[0].purchase_date)
  await expect(page.locator('.period-fields')).toContainText('78.600')
  await expect(page.locator('.procurement-reports')).toContainText('Skyy Vodka')
  await expect(page.locator('.procurement-reports')).toContainText('8.500')
  await page.getByLabel('Filtrar período').selectOption('all')
  expect(state.purchases).toHaveLength(1)
  expect(state.purchaseItems).toHaveLength(2)
  expect(state.movements.filter(item => item.purchase_id === state.purchases[0].id)).toHaveLength(2)
  expect(state.products.find(product => product.name === 'Skyy Vodka')).toMatchObject({ stock_quantity: 16, unit_cost: 8187.5 })
  expect(state.products.find(product => product.name === 'Coca-Cola')).toMatchObject({ stock_quantity: 12, unit_cost: 2300 })
  await navigate(page, 'Control de stock')
  await page.getByPlaceholder('Buscar productos...').fill('Skyy')
  await expect(page.locator('.data-row:not(.data-head)')).toContainText('16 un.')
  await navigate(page, 'Precios y rentabilidad')
  await expect(page.locator('.price-table')).toContainText('8.187,50')
  await navigate(page, 'Proveedores')
  await page.getByRole('button', { name: 'Mayorista A', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('78.600')
  await expect(page.locator('.history-row')).toHaveCount(1)
})
