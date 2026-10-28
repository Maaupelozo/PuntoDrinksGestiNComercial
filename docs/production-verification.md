# Verificación del Módulo 05

Fecha: 2026-10-27. Rama: `feat/production-ready`. No hubo commit ni despliegue.

## Comprobado

- `npm ci` en un directorio aislado: instalación completa, sin vulnerabilidades informadas por npm. Una copia del proyecto compiló allí sin archivos `.env` locales. El servidor Vite activo bloqueó binarios nativos al intentar reinstalar en el mismo `node_modules`; se restauraron las dependencias con `npm install` y las comprobaciones siguientes pasaron.
- `npm run typecheck`, `npm test` (37 pruebas) y `npm run build`: correctos. La suite `npm run test:e2e` pasó 69 pruebas en escritorio, tableta y celular.
- Recuperación real por correo en `http://127.0.0.1:8443/restablecer-clave`: correo recibido y enlace abierto por el propietario, nueva contraseña aceptada, anterior rechazada, ingreso y cierre de sesión correctos. La cuenta temporal se eliminó y dejó de permitir ingreso.
- Supabase real: registro público deshabilitado; una sesión anónima no leyó registros de 14 tablas. La migración de configuración fue aplicada por el propietario y sus políticas RLS pasaron las pruebas SQL locales.
- Cuenta comercial temporal nueva y vacía: se creó configuración y perfil, dos productos, proveedor, compra, combo, dos ventas y gasto. Se comprobaron stock, costo promedio, movimientos, históricos, resumen financiero, bloqueo de escritura directa de venta, cierre, nuevo ingreso y persistencia.
- Navegador de escritorio con los datos reales: Dashboard, Configuración, reporte diario y mensual, exportación CSV y PDF. La suite móvil automatizada probó el flujo con respuestas simuladas; la lectura móvil contra datos reales no terminó antes de la limpieza.
- `cleanup_module05_verification.sql` se ensayó sobre una copia local de los registros reales y dejó 14 tablas en cero. El propietario lo ejecutó en Supabase. Una comprobación posterior desde la cuenta temporal confirmó las 14 tablas y el reporte financiero en cero.
- El propietario eliminó después la cuenta comercial temporal y se confirmó que sus credenciales ya no permiten iniciar sesión.

## Antes de publicar

- Asignar una URL HTTPS de preview, configurar Site URL y Redirect URLs exactas y probar allí las rutas, el inicio/cierre, los datos temporales y la recuperación por correo.
- Configurar SMTP propio en Supabase y repetir la prueba de recepción y cambio de contraseña desde el dominio HTTPS.
- Ejecutar y comprobar una copia de seguridad y una restauración en un proyecto separado conforme a [BACKUP.md](../BACKUP.md).

La compilación advierte sobre la futura carga nativa de `vite.config.ts` de Figma Make y un paquete de más de 500 kB; son advertencias, no fallos de compilación.
