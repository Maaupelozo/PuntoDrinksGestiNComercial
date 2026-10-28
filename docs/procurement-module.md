# Módulo 02: compras y proveedores

## Puesta en marcha

Aplicá una sola vez `supabase/migrations/202610260002_purchases_suppliers.sql` en el SQL Editor de Supabase, **después** de `202610260001_inventory_pricing.sql`. La migración anterior no se repite. El frontend utiliza las mismas variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` del Módulo 01.

La migración agrega `suppliers`, `purchases`, `purchase_items` y referencias opcionales a la compra en `inventory_movements`. Las políticas RLS limitan las lecturas al propietario. El navegador sólo tiene permisos de lectura sobre las tablas: altas, cambios de proveedor y confirmación de compras pasan por funciones RPC que comprueban la identidad. Las compras confirmadas no tienen edición, eliminación ni anulación desde la aplicación.

## Política de costo e inventario

Cada línea conserva `unit_cost` y `subtotal` pagados, además del nombre y SKU que tenía el producto. El costo actual se calcula dentro de la transacción como promedio ponderado móvil:

`nuevo costo = redondear a centavos((stock anterior × costo actual + cantidad comprada × costo pagado) / stock nuevo)`

Cuando el stock anterior es cero, el nuevo costo es el costo pagado. El precio de venta no cambia. El trigger del Módulo 01 registra en `price_history` cualquier cambio efectivo del costo actual. La función bloquea las filas de producto en orden estable, inserta la compra y sus líneas, actualiza stock y costo, y crea los movimientos con referencia a la compra. Si falla una línea, PostgreSQL revierte todo.

El formulario conserva una clave UUID de idempotencia durante los reintentos. La base devuelve la misma compra si recibe exactamente el mismo pedido con esa clave; rechaza reutilizarla con contenido diferente. Esto evita duplicados por doble clic o un reintento de red.

Los ingresos manuales de stock del Módulo 01 mantienen el costo actual porque no registran un costo pagado. Las ventas del Módulo 03 guardan una instantánea del costo aplicable al vender. Una compra incorpora mercadería al inventario y no debe descontarse otra vez como gasto operativo al calcular ganancia neta; el costo de la mercadería vendida se reconoce con la venta.

## Vistas y reportes

Compras muestra importes y operaciones de hoy y del mes, historial, filtro por fecha y proveedor, totales por proveedor, productos más comprados y evolución de los costos unitarios pagados. Proveedores muestra sus datos, estado, operaciones y total comprado. Los días y meses se agrupan con `America/Argentina/Cordoba`; `purchase_date` guarda el día comercial y `created_at` conserva el instante de registro con zona horaria.

Para reproducir las comprobaciones locales: `npm.cmd run typecheck`, `npm.cmd run build`, `npm.cmd test` y `npm.cmd run test:e2e`. Las pruebas SQL usan PostgreSQL embebido y las de navegador simulan la API. Este proyecto también se verificó contra Supabase real con una cuenta aislada: proveedores, compras de varias líneas, idempotencia, rollback, stock, costos, historial, RLS y recarga en escritorio y celular. Los registros temporales fueron retirados mediante SQL restringido a sus identificadores; se comprobaron cero filas en las seis tablas de la cuenta y se eliminó el usuario de prueba.
