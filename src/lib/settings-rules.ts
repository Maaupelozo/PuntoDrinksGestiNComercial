import type { BusinessSettingsInput } from '../types/settings'

export function validateBusinessSettings(input: BusinessSettingsInput): BusinessSettingsInput {
  const business_name = input.business_name.trim()
  const phone = input.phone?.trim() || null
  const address = input.address?.trim() || null
  const logo_url = input.logo_url?.trim() || null
  if (!business_name || business_name.length > 160) throw new Error('Ingresá un nombre comercial de hasta 160 caracteres.')
  if (phone && phone.length > 50) throw new Error('El teléfono debe tener hasta 50 caracteres.')
  if (address && address.length > 300) throw new Error('La dirección debe tener hasta 300 caracteres.')
  if (!Number.isInteger(input.default_min_stock) || input.default_min_stock < 0 || input.default_min_stock > 1000000)
    throw new Error('El stock mínimo debe ser un entero entre 0 y 1.000.000.')
  if (logo_url && (logo_url.length > 2048 || !/^https:\/\/[^\s]+$/i.test(logo_url)))
    throw new Error('La URL del logo debe comenzar con https://.')
  return { business_name, phone, address, default_min_stock: input.default_min_stock, logo_url }
}

export function validatePassword(password: string) {
  if (password.length < 8 || password.length > 72) throw new Error('La contraseña debe tener entre 8 y 72 caracteres.')
  return password
}
