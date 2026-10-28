import type { InventoryMovement, PriceHistory, ProductRecord } from '../types/inventory'
import type { PurchaseItemRecord, PurchaseRecord, SupplierRecord } from '../types/procurement'
import type { ComboItemRecord, ComboRecord, SaleComponentRecord, SaleItemRecord, SaleRecord } from '../types/sales'
import type { ExpenseAuditRecord, ExpenseRecord, FinancialReport } from '../types/finance'
import type { BusinessSettingsRecord } from '../types/settings'

// Mirrors the columns and RPC signatures in supabase/migrations.
// Regenerate from Supabase after applying the migration if the schema changes.
export interface Database {
  public: {
    Tables: {
      products: {
        Row: ProductRecord
        Insert: never
        Update: never
        Relationships: []
      }
      inventory_movements: {
        Row: InventoryMovement
        Insert: never
        Update: never
        Relationships: []
      }
      price_history: {
        Row: PriceHistory
        Insert: never
        Update: never
        Relationships: []
      }
      suppliers: {
        Row: SupplierRecord
        Insert: never
        Update: never
        Relationships: []
      }
      purchases: {
        Row: PurchaseRecord
        Insert: never
        Update: never
        Relationships: []
      }
      purchase_items: {
        Row: PurchaseItemRecord
        Insert: never
        Update: never
        Relationships: []
      }
      combos: { Row: ComboRecord; Insert: never; Update: never; Relationships: [] }
      combo_items: { Row: ComboItemRecord; Insert: never; Update: never; Relationships: [] }
      sales: { Row: SaleRecord; Insert: never; Update: never; Relationships: [] }
      sale_items: { Row: SaleItemRecord; Insert: never; Update: never; Relationships: [] }
      sale_item_components: { Row: SaleComponentRecord; Insert: never; Update: never; Relationships: [] }
      expenses: { Row: ExpenseRecord; Insert: never; Update: never; Relationships: [] }
      expense_audit: { Row: ExpenseAuditRecord; Insert: never; Update: never; Relationships: [] }
      business_settings: {
        Row: BusinessSettingsRecord
        Insert: { owner_id: string; business_name: string; phone: string | null
          address: string | null; currency?: 'ARS'; time_zone?: 'America/Argentina/Cordoba'
          default_min_stock: number; logo_url: string | null }
        Update: Partial<Pick<BusinessSettingsRecord, 'business_name' | 'phone' |
          'address' | 'default_min_stock' | 'logo_url'>>
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      create_product: {
        Args: {
          p_name: string
          p_category: string
          p_sku: string | null
          p_unit_cost: number
          p_sale_price: number
          p_initial_stock: number
          p_min_stock: number
        }
        Returns: ProductRecord
      }
      update_product: {
        Args: {
          p_product_id: string
          p_name: string
          p_category: string
          p_sku: string | null
          p_unit_cost: number
          p_sale_price: number
          p_min_stock: number
        }
        Returns: ProductRecord
      }
      deactivate_product: {
        Args: { p_product_id: string }
        Returns: ProductRecord
      }
      update_product_prices: {
        Args: { p_product_id: string; p_unit_cost: number; p_sale_price: number }
        Returns: ProductRecord
      }
      adjust_stock: {
        Args: {
          p_product_id: string
          p_movement_type: string
          p_quantity_delta: number
          p_reason: string
        }
        Returns: ProductRecord
      }
      create_supplier: {
        Args: {
          p_name: string
          p_phone: string
          p_address: string | null
          p_email: string | null
          p_notes: string | null
        }
        Returns: SupplierRecord
      }
      update_supplier: {
        Args: {
          p_supplier_id: string
          p_name: string
          p_phone: string
          p_address: string | null
          p_email: string | null
          p_notes: string | null
        }
        Returns: SupplierRecord
      }
      deactivate_supplier: {
        Args: { p_supplier_id: string }
        Returns: SupplierRecord
      }
      register_purchase: {
        Args: {
          p_idempotency_key: string
          p_purchase_date: string
          p_supplier_id: string | null
          p_payment_method: string | null
          p_notes: string | null
          p_items: { product_id: string; quantity: number; unit_cost: number }[]
        }
        Returns: PurchaseRecord
      }
      save_combo: {
        Args: { p_combo_id: string | null; p_name: string; p_description: string | null
          p_sale_price: number; p_items: { product_id: string; quantity: number }[] }
        Returns: ComboRecord
      }
      set_combo_active: { Args: { p_combo_id: string; p_active: boolean }; Returns: ComboRecord }
      confirm_sale: {
        Args: { p_idempotency_key: string; p_payment_method: string
          p_items: { product_id?: string; combo_id?: string; quantity: number }[] }
        Returns: SaleRecord
      }
      save_expense: {
        Args: { p_expense_id: string | null; p_expense_date: string
          p_description: string; p_category: string; p_amount: number
          p_payment_method: string; p_notes: string | null }
        Returns: ExpenseRecord
      }
      void_expense: { Args: { p_expense_id: string; p_reason: string }; Returns: ExpenseRecord }
      financial_report: { Args: { p_start_date: string; p_end_date: string }; Returns: FinancialReport }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
