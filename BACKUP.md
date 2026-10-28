# Respaldo y restauración de Supabase

El proyecto guardará datos comerciales y financieros. [Supabase recomienda exportaciones periódicas con `supabase db dump` para proyectos Free](https://supabase.com/docs/guides/platform/backups); no supongas que Free tiene backups diarios administrados. No se ejecutó un respaldo de la base remota porque requiere credenciales de base de datos que no deben guardarse en el frontend ni en Git.

## Respaldo manual

1. Instalá la versión actual de Supabase CLI y enlazá el proyecto con `supabase login` y `supabase link --project-ref <PROJECT_REF>`. No publiques el token ni la contraseña de la base. Revisá `supabase db dump --help` para la versión instalada.
2. Creá una carpeta privada **fuera del repositorio**, con fecha y acceso restringido. Usá el enlace al proyecto para exportar roles, esquema y datos por separado:

   ```powershell
   supabase db dump --linked --role-only -f <CARPETA_PRIVADA>/roles.sql
   supabase db dump --linked -f <CARPETA_PRIVADA>/schema.sql
   supabase db dump --linked --data-only --use-copy -f <CARPETA_PRIVADA>/data.sql
   ```

3. Confirmá que los tres archivos no estén vacíos y guardá sus hashes SHA-256 con `Get-FileHash <archivo> -Algorithm SHA256`. Conservá el manifiesto de hashes junto a la copia, protegido del mismo modo.
4. Cifrá la copia y guardala en un lugar separado del equipo de trabajo, con acceso sólo del propietario. Mantené al menos una copia fuera del sitio. Recomendación inicial: respaldo diario tras el cierre y retención de siete diarios más cuatro semanales; ajustá la frecuencia a la pérdida máxima tolerable.
5. Si en el futuro se usa Supabase Storage para archivos, exportá también esos objetos: [el backup de base de datos no incluye el contenido de Storage](https://supabase.com/docs/guides/platform/backups).

No guardes dumps, tokens, URLs con contraseñas ni archivos `.pgpass` dentro del repositorio. Evitá poner la contraseña de PostgreSQL directamente en comandos o historiales de shell.

## Verificación y restauración

Al menos una vez al mes, restaurá una copia **en otro proyecto de prueba**, nunca sobre la base comercial como primera verificación. Seguí la [guía oficial de backup y restauración de Supabase CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) para roles, esquema, datos, claves y particularidades de `auth`/`storage`. Usá la conexión del proyecto de prueba y la contraseña ingresada de forma interactiva. Compará hashes, revisá que no haya errores SQL, contrastá conteos de productos, compras, ventas, gastos y auditorías, y probá inicio de sesión, RLS y un reporte financiero. Registrá fecha, versión de la copia y resultado sin incluir datos personales en logs.

Para un incidente real, identificá el último respaldo íntegro, estimá la pérdida de datos desde esa fecha, restaurá primero en un entorno separado, verificá los conteos y sólo entonces planificá el cambio de tráfico. No automatices restauraciones sobre producción sin un procedimiento ensayado.
