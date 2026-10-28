# Supabase: autenticación, productos, stock y precios

## Configuración

1. Copiá `.env.example` a `.env.local` y completá `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` con la URL y la clave publicable de tu proyecto. `.env.local` está ignorado por Git. La clave `service_role` o una secret key nunca debe ir en variables `VITE_`.
2. Aplicá `supabase/migrations/202610260001_inventory_pricing.sql` en el SQL Editor de Supabase. El script crea las tablas, índices, políticas RLS, historial de precios y funciones RPC. Se ejecuta una sola vez en una base nueva.
3. En Authentication, desactivá **Allow new users to sign up** y creá los usuarios desde el panel de administración. La aplicación ofrece inicio de sesión y recuperación de contraseña; no ofrece registro público. Ocultar el formulario de registro no desactiva el endpoint de alta en Supabase.
4. Para la recuperación, configurá en Authentication → URL Configuration el Site URL y permití como Redirect URL la ruta `/restablecer-clave` del entorno que uses. Si usás una base de Vite personalizada, incluí esa base.

Los productos pertenecen al usuario autenticado. Una cuenta nueva empieza con el inventario vacío; el frontend no carga productos de demostración en Supabase. Las políticas RLS sólo permiten leer registros propios. Las escrituras se hacen mediante RPC con validación de propietario. El ajuste de stock bloquea el producto y graba el movimiento en la misma transacción. El historial de precios se registra al cambiar costo o precio.

## Verificación

Iniciá sesión con una cuenta creada en Supabase y comprobá este recorrido:

1. Creá un producto con stock inicial. Aparecerá en Stock, Precios y el historial de movimientos.
2. Registrá una entrada y una salida. El saldo y el historial deben actualizarse; una salida mayor que el stock debe rechazarse.
3. Editá costo o precio y verificá la tabla de Precios y el historial.
4. Calculá un precio, confirmá la aplicación y recargá la página. El valor debe persistir.
5. Desactivá el producto y filtrá por inactivos. No se borra el historial.
6. Cerrá sesión y comprobá que `/stock` y `/precios` redirigen a `/ingresar`.

Las pruebas automatizadas locales usan PostgreSQL embebido para reglas SQL y mocks de la API para navegador. Además, se verificó este proyecto remoto con una cuenta temporal: creación, lectura, edición, entrada, salida y ajuste de stock, rechazo de stock negativo, aplicación de la calculadora, cambios e historial de precios, persistencia tras volver a iniciar sesión y desactivación. La interfaz también se comprobó contra Supabase real en escritorio y celular. Los tres productos temporales se retiraron tras comprobar RLS con otra identidad simulada: antes de eliminar la cuenta de prueba se verificaron cero productos, movimientos e historiales; luego se comprobó que la cuenta ya no puede iniciar sesión. Para ejecutar la suite local: `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run build` y `npm.cmd run test:e2e`.

## Módulos siguientes

Compras y Proveedores se documentan en [procurement-module.md](procurement-module.md), Ventas y Combos en [sales-module.md](sales-module.md), y Dashboard, Gastos y Reportes en [finance-module.md](finance-module.md). Configuración utiliza `business_settings` y Supabase Auth. La calculadora conserva las fórmulas del prototipo; los valores monetarios de productos se almacenan como `numeric(12,2)`.
