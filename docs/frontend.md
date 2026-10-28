# Frontend de Punto Drinks

El proyecto conserva las pantallas y la identidad visual del prototipo de Figma Make. La navegación usa React Router y las páginas viven en `src/pages/`. `src/components/layout/` contiene el marco de navegación; `src/components/ui/`, `src/components/inventory/`, `src/components/procurement/`, `src/components/sales/` y `src/components/finance/` reúnen los controles compartidos. Los datos operativos se consultan en Supabase.

## Estado de las secciones

| Sección | Datos y acciones |
| --- | --- |
| Inicio de sesión y recuperación | Supabase Auth; las rutas internas requieren una sesión. |
| Control de stock | Productos reales, búsqueda, filtros, paginación, alta, edición, baja lógica, ajustes e historial de movimientos. |
| Precios y rentabilidad | Productos reales, calculadora, actualización confirmada de costo y precio e historial. |
| Compras y proveedores | Registros reales, historial, reportes básicos y actualización transaccional de stock y costo promedio. |
| Ventas y combos | Registros reales, carrito mixto, stock transaccional, costos y ganancias históricas. |
| Dashboard | Indicadores, alertas de stock, ventas recientes y productos vendidos desde un RPC agregado. |
| Gastos | Alta, edición, búsqueda, filtros, detalle, auditoría y anulación lógica con Supabase. |
| Reportes | Agregados reales, comparativas, períodos de Córdoba y exportación CSV/PDF. |
| Configuración | Datos del negocio persistidos con RLS, perfil y seguridad mediante Supabase Auth; stock mínimo usado al crear productos. |

Stock, Precios, Compras, Ventas y Combos comparten la fuente de productos de `src/context/InventoryContext.tsx`. Compras y Proveedores cargan `src/context/ProcurementContext.tsx` sólo en sus rutas. Ventas y Combos cargan `src/context/SalesContext.tsx` sólo en sus rutas. Dashboard y Reportes consultan agregados en PostgreSQL sin descargar historiales completos. Las migraciones están en `supabase/migrations/`. Consultá [supabase-module.md](supabase-module.md), [procurement-module.md](procurement-module.md), [sales-module.md](sales-module.md) y [finance-module.md](finance-module.md).

## Comprobaciones

Usá Node y pnpm según `.mise.toml`. Con las dependencias y Chromium instalados:

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
npm.cmd run test:e2e
```

Las pruebas de navegador usan respuestas simuladas de Supabase y cubren escritorio, tablet y celular. El servidor de desarrollo de Figma Make ya está activo; Playwright usa `vite preview` en el puerto 4173. Vite puede mostrar avisos de compatibilidad futura sobre la configuración generada por Figma Make; esa configuración no se reescribió.

Para desplegar con `BrowserRouter`, el hosting debe servir `index.html` en las rutas internas. Consultá [DEPLOYMENT.md](../DEPLOYMENT.md) para Netlify y Vercel.
