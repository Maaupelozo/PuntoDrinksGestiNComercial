# Módulo 03: ventas y combos

## Puesta en marcha

Aplicá una sola vez `supabase/migrations/202610270001_sales_combos.sql` en el SQL Editor de Supabase, **después** de las migraciones 01 y 02. No repitas las anteriores. La aplicación usa las mismas variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` de `.env.local`; no incorpora claves secretas.

La migración agrega `combos`, `combo_items`, `sales`, `sale_items`, `sale_item_components` y referencias de venta en `inventory_movements`. Todas las tablas nuevas tienen RLS de lectura por propietario y no permiten escrituras directas del cliente. Las funciones `save_combo`, `set_combo_active` y `confirm_sale` verifican `auth.uid()` y propiedad. La implementación usa `SECURITY DEFINER` con `search_path` vacío y nombres calificados; las funciones públicas son wrappers `SECURITY INVOKER`.

## Reglas de venta

El carrito acepta productos y combos. La disponibilidad de cada combo es el mínimo de `stock / cantidad` de sus componentes activos. Al confirmar, PostgreSQL bloquea combos y productos en orden de UUID, suma la necesidad de stock de todas las líneas, rechaza cualquier insuficiencia y descuenta cada producto una sola vez. Cada componente vendido genera un movimiento vinculado a la venta. No hay stock separado para combos ni se cambia el costo promedio por una salida.

Los precios y costos se leen de los productos y combos bloqueados dentro de la transacción. `sale_items` guarda nombre, cantidad, precio, costo, subtotal y ganancia de cada artículo; `sale_item_components` conserva composición, cantidad y costo exacto de cada bebida vendida. Los totales de `sales` se calculan exclusivamente en PostgreSQL. La fórmula es `ganancia bruta = ingreso - costo de mercadería vendida`. No incluye gastos operativos. La clave UUID de idempotencia se conserva durante reintentos de la misma venta; la restricción única serializa dos intentos simultáneos antes de comprobar el stock.

Las ventas confirmadas son inmutables desde la aplicación. No hay eliminación ni anulación en este módulo: una anulación futura deberá definir el tratamiento de costos tras compras posteriores y registrar movimientos correctivos auditables. Las ediciones posteriores de combos o precios no modifican los snapshots históricos.

## Comprobación

Con una cuenta aislada, creá un producto, registrá una compra, armá un combo, vendé el combo y una unidad individual, revisá stock, movimientos, costo histórico y ganancia, recargá y comprobá persistencia. Intentá superar el stock, repetir la misma clave de venta y acceder a registros de otro usuario. No uses productos comerciales reales para pruebas; eliminá solamente los registros temporales identificados después de verificarlos.

La suite local usa PostgreSQL embebido y una API simulada en navegador. Ejecutá `npm.cmd run typecheck`, `npm.cmd test`, `npm.cmd run build` y `npm.cmd run test:e2e`. Pasaron 26 pruebas de reglas y SQL y 60 pruebas de navegador en escritorio, tablet y celular.

La migración también se aplicó y verificó en Supabase real con una cuenta temporal inicialmente vacía. Se comprobó compra y costo promedio, creación, edición, desactivación y reactivación de combo, venta mixta e individual, rechazo de stock insuficiente, reintento idéntico y dos confirmaciones simultáneas con una sola venta, rechazo de una clave reutilizada con otro contenido, bloqueo de escritura directa y lectura anónima, snapshots, movimientos y ganancia. La interfaz se recargó en escritorio y celular con datos persistidos. La limpieza se ensayó primero contra una copia local de los registros reales; tras ejecutarla en Supabase, las 11 tablas de la cuenta quedaron en cero. La cuenta temporal fue eliminada y sus credenciales ya no permiten iniciar sesión.

La separación entre dos propietarios se probó en PostgreSQL local; la prueba remota cubrió la cuenta autenticada y el rol anónimo. No se hizo una prueba de carga masiva concurrente. La anulación de ventas sigue pendiente; el resultado operativo con gastos está documentado en [finance-module.md](finance-module.md).
