export function errorMessage(error: unknown): string {
  if (!(error instanceof Error) && (typeof error !== 'object' || error === null)) {
    return 'No se pudo completar la operación. Intentá nuevamente.'
  }
  const code = 'code' in error ? String(error.code) : ''
  const message = 'message' in error ? String(error.message) : ''
  if (code === '23505') return /sku/i.test(message) ? 'El SKU ya existe entre tus productos.' : 'Ya existe un registro con esos datos.'
  if (/Stock insuficiente/i.test(message)) return message
  if (code === '23514') return 'Los datos no cumplen las reglas de inventario.'
  if (code === 'P0002') return /proveedor/i.test(message) ? 'El proveedor no existe o está inactivo.' : /combo/i.test(message) ? 'El combo no existe o está inactivo.' : 'El producto no existe o no está disponible.'
  if (code === '42501') return 'No tenés permiso para realizar esta operación.'
  if (code === 'PGRST205' || code === '42883') return 'Falta aplicar una migración de la base de datos en Supabase.'
  if (/failed to fetch|network|fetch failed/i.test(message)) return 'No se pudo conectar con Supabase. Revisá tu conexión e intentá de nuevo.'
  return message || 'No se pudo completar la operación. Intentá nuevamente.'
}
