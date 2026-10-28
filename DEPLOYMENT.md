# Publicación de Punto Drinks

Esta guía prepara el despliegue; **no se ha hecho un despliegue definitivo**. Usá la URL HTTPS real que entregue el proveedor: no hay un dominio de producción definido en el repositorio.

## Comprobaciones previas

1. Usá una rama aprobada para publicación. No conectes automáticamente `feat/production-ready` como rama productiva.
2. En una instalación limpia, ejecutá `npm ci`, `npm run typecheck`, `npm test`, `npm run build` y `npm run test:e2e`.
3. Confirmá que las migraciones de `supabase/migrations/` están aplicadas en orden y que Authentication → Providers mantiene deshabilitado **Allow new users to sign up**.
4. Configurá un [SMTP propio en Supabase](https://supabase.com/docs/guides/auth/auth-smtp) y probá la recuperación en una casilla real antes de depender de ella. El SMTP predeterminado de Supabase está pensado para pruebas y tiene restricciones de destinatarios y envío.
5. Prepará y verificá un respaldo según [BACKUP.md](BACKUP.md).

## Netlify

El repositorio incluye `netlify.toml`: compila con `npm run build`, publica `dist/` y reescribe las rutas internas a `/index.html`. En Netlify creá un sitio desde el repositorio o un despliegue de prueba, elegí la rama aprobada y comprobá los ajustes de build. En **Site configuration → Environment variables**, agregá para Build:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Usá la URL y la clave publicable existentes; no guardes sus valores en Git ni agregues `service_role`. Volvé a desplegar si cambiás una variable `VITE_`, porque Vite la incorpora durante la compilación. Netlify Free admite proyectos comerciales, sujeto a sus [límites y condiciones vigentes](https://www.netlify.com/blog/introducing-netlify-free-plan/); revisá el consumo antes de operar diariamente.

## Vercel como alternativa

El repositorio incluye `vercel.json` con la [reescritura SPA recomendada por Vercel para Vite](https://vercel.com/docs/frameworks/frontend/vite), instalación `npm ci`, build `npm run build` y salida `dist/`. En Vercel, elegí **Add New → Project**, conectá GitHub e importá `Maaupelozo/PuntoDrinksGestiNComercial`. Verificá que Root Directory sea la raíz y que las dos variables `VITE_` estén configuradas **antes del primer despliegue**. La rama `feat/production-ready` contiene la aplicación completa; `main` todavía contiene el prototipo. Configurá conscientemente qué rama será Production en **Settings → Environments → Production → Branch Tracking** antes de publicar. Para uso comercial necesitás un plan adecuado: [Vercel Hobby está restringido a uso personal no comercial](https://vercel.com/docs/plans/hobby).

## Supabase Auth y URLs

Una vez asignada la URL HTTPS real, abrí **Authentication → URL Configuration**:

- **Site URL:** `https://<DOMINIO_HTTPS_ASIGNADO>/`.
- **Redirect URLs:** `https://<DOMINIO_HTTPS_ASIGNADO>/restablecer-clave` y sólo las URL de previews que vayas a probar.
- Para desarrollo local, conservá `http://127.0.0.1:8443/restablecer-clave` y, si lo usás, `http://localhost:8443/restablecer-clave`.

La aplicación construye `redirectTo` a partir del origen desde el que se abre. Evitá comodines amplios en producción. Los usuarios autorizados se crean desde Supabase Authentication → Users; no existe registro público en el frontend. Cada cuenta es propietaria de sus datos mediante RLS. Para agregar usuarios con acceso compartido al mismo negocio hará falta un modelo de permisos nuevo; crear otra cuenta por sí sola produce otro conjunto de datos.

## Prueba de un despliegue de prueba

Con una URL HTTPS de preview, verificá: carga y refresco directo de `/stock`, `/reportes` y `/restablecer-clave`; inicio y cierre de sesión; lectura y escritura con datos temporales; Dashboard y reportes; descargas CSV/PDF; navegación celular; correo de recuperación recibido, enlace abierto y contraseña nueva usada para iniciar sesión. Limpiá sólo los UUID temporales identificados y comprobá las tablas antes de publicar la URL definitiva. Estas pruebas externas quedan pendientes hasta disponer de un despliegue de prueba.

Si una ruta interna devuelve 404, revisá `netlify.toml` o `vercel.json`. Si Supabase rechaza la recuperación, revisá la Redirect URL exacta, el Site URL y SMTP. Si aparece un error de tabla o función inexistente, revisá las migraciones y sus permisos. Si una página queda sin datos, comprobá sesión y RLS antes de modificar políticas.
