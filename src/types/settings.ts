export type BusinessSettingsRecord = {
  owner_id: string
  business_name: string
  phone: string | null
  address: string | null
  currency: 'ARS'
  time_zone: 'America/Argentina/Cordoba'
  default_min_stock: number
  logo_url: string | null
  created_at: string
  updated_at: string
}

export type BusinessSettingsInput = Pick<BusinessSettingsRecord,
  'business_name' | 'phone' | 'address' | 'default_min_stock' | 'logo_url'>

export const defaultBusinessSettings = (ownerId: string): BusinessSettingsRecord => ({
  owner_id: ownerId,
  business_name: 'Punto Drinks',
  phone: null,
  address: null,
  currency: 'ARS',
  time_zone: 'America/Argentina/Cordoba',
  default_min_stock: 0,
  logo_url: null,
  created_at: '',
  updated_at: '',
})
