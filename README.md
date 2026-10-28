# Punto Drinks

Aplicación web de gestión comercial para un negocio de bebidas. Permite administrar productos, stock, precios, proveedores, compras, combos, ventas, gastos, Dashboard financiero y reportes. Los datos operativos se guardan en Supabase; la interfaz conserva la identidad visual de Figma Make.

## Stack

React 19, TypeScript, Vite 8, Tailwind CSS 4, React Router, Supabase Auth/PostgreSQL y jsPDF. Las pruebas usan Vitest, PGlite y Playwright.

## Instalación local

1. Instalá Node.js y pnpm según `.mise.toml` o usá npm con `package-lock.json`.
2. Ejecutá `npm ci`.
3. Copiá `.env.example` a `.env.local` y completá la URL y la clave **publicable** de tu proyecto:

   ```text
   VITE_SUPABASE_URL=https://TU_PROYECTO.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

4. Aplicá las migraciones de `supabase/migrations/` en orden, una sola vez cada una, si preparás una base nueva. En el proyecto actual, todas las migraciones hasta `202610270004_business_settings.sql` fueron aplicadas manualmente.
5. Ejecutá `npm run dev`. El servidor de Figma Make puede estar ya activo en el puerto 8443.

Las variables `VITE_` terminan incluidas en el navegador: no coloques allí claves secretas, `service_role`, contraseñas de base de datos ni credenciales SMTP. `.env.local` está ignorado por Git.

## Comandos

| Comando | Propósito |
| --- | --- |
| `npm run dev` | Servidor local Vite |
| `npm run typecheck` | Comprobación TypeScript |
| `npm test` | Pruebas unitarias y SQL |
| `npm run build` | Compilación de producción en `dist/` |
| `npm run preview` | Vista previa de `dist/` |
| `npm run test:e2e` | Pruebas de navegador en escritorio, tablet y celular |

## Estructura

- `src/pages/`: pantallas y rutas.
- `src/components/`: navegación, controles y formularios por módulo.
- `src/context/`: sesión, configuración e inventario compartido.
- `src/services/`: acceso a Supabase.
- `src/lib/` y `src/types/`: reglas, exportaciones y modelos.
- `supabase/migrations/`: esquema y políticas RLS incrementales.
- `tests/`: pruebas de reglas, PostgreSQL y navegador.

Antes de operar con datos comerciales, seguí [DEPLOYMENT.md](DEPLOYMENT.md), [BACKUP.md](BACKUP.md) y [LIMITATIONS.md](LIMITATIONS.md). El alcance probado y los pasos externos pendientes están en [docs/production-verification.md](docs/production-verification.md).
