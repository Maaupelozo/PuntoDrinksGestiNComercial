# Módulo 04: gastos, Dashboard y reportes

## Puesta en marcha

Aplicá una sola vez `supabase/migrations/202610270002_expenses_reports.sql` después de las migraciones 01, 02 y 03. Luego aplicá una sola vez `supabase/migrations/202610270003_financial_daily_date.sql`: corrige el tipo de la fecha diaria en el JSON del reporte, sin tocar los registros. El frontend usa las variables públicas de `.env.local`; no necesita una clave secreta. La primera migración crea `expenses`, `expense_audit` y las funciones `save_expense`, `void_expense` y `financial_report`.

## Reglas financieras

Las ventas se toman de operaciones confirmadas. `sales.total_cost` es el costo histórico registrado al vender; los cambios posteriores de precio o costo no alteran los reportes. **Ganancia bruta = ventas − costo vendido. Resultado operativo = ganancia bruta − gastos operativos vigentes.** Las compras de mercadería se muestran aparte y no se descuentan otra vez del resultado. El flujo registrado estimado es ventas − compras − gastos; no es un saldo bancario conciliado. El inventario actual se valúa aproximadamente por cantidad y costo promedio vigente.

Los períodos usan fechas de `America/Argentina/Cordoba`, con inicio incluido y final excluido. En las ventas, `sold_at` se convierte según esa zona; compras y gastos ya guardan una fecha comercial. Los filtros ofrecen hoy, ayer, semana, mes, mes anterior, últimos 30 días y fechas personalizadas. Dashboard también ofrece últimos 7 días. La comparación toma un tramo anterior de igual cantidad de días. El RPC agrega ventas, compras y gastos por separado para evitar multiplicar importes por relaciones uno a muchos. Los productos más vendidos suman las unidades de los componentes de combos; el ingreso individual se muestra sólo para ventas individuales y no se atribuye dos veces a un combo.

## Seguridad y auditoría

Las tablas tienen RLS de lectura por propietario; el rol anónimo no puede acceder. El cliente no puede escribir directamente. Las funciones de gasto validan propietario, fecha, concepto, categoría, importe positivo y medio de pago. Cada creación, edición y anulación deja una fila en `expense_audit`. Una anulación exige motivo, conserva el registro y lo excluye de las sumas; un gasto anulado no admite nuevas modificaciones.

## Exportaciones y comprobaciones

CSV usa UTF-8 con BOM, separador `;`, decimales con coma y protección contra fórmulas introducidas como texto. Contiene resumen, días, categorías y productos. PDF presenta los mismos siete importes del resumen visible. Ambos se generan a partir del mismo reporte filtrado.

Ejecutá `npm.cmd run typecheck`, `npm.cmd test`, `npm.cmd run build` y `npm.cmd run test:e2e`. Las pruebas SQL cubren el caso compra $90.000, venta $100.000, costo vendido $70.000 y gasto $5.000: ganancia bruta $30.000 y resultado operativo $25.000. También cubren límites horarios de Córdoba, anulación, auditoría y RLS. Las pruebas de navegador usan una API simulada y recorren escritorio, tablet y celular. La denegación de lectura anónima se comprobó contra Supabase real durante la verificación del módulo.

Para una verificación remota completa, usá una cuenta temporal aislada. Creá productos, compra, venta y gasto sólo bajo esa identidad; comprobá el reporte, exportaciones, persistencia y anulación. Identificá los UUID de prueba y ensayá la limpieza antes de ejecutarla. Borrá la cuenta temporal al finalizar.

En este proyecto se aplicaron ambas migraciones en Supabase y se verificó el escenario obligatorio con una cuenta temporal inicialmente vacía: venta $100.000, costo histórico $70.000, compra $90.000, gasto $5.000, resultado operativo $25.000 y flujo estimado $5.000. Se comprobaron reporte diario y mensual, productos vendidos y comprados, importe negativo rechazado, edición, anulación, auditoría y escritura directa denegada. Dashboard, Gastos, Reportes y descargas CSV/PDF se probaron contra Supabase real en escritorio y celular. El rol anónimo recibió `401 / 42501` para las dos tablas nuevas y el RPC. La limpieza se ensayó sobre una copia local de las filas reales, luego se ejecutó en Supabase y se confirmó con la cuenta temporal que 13 tablas y el reporte financiero quedaron en cero. La cuenta temporal se eliminó y sus credenciales ya no permiten iniciar sesión.

## Pendientes posteriores

El resultado operativo todavía no incluye impuestos, cargos financieros, devoluciones ni conciliación de pagos. Las ventas confirmadas de Módulo 03 son inmutables; una eventual devolución necesita una regla transaccional y auditable. Configuración continúa como prototipo.
