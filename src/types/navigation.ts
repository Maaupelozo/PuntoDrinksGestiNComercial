export type Page = "Dashboard" | "Ventas" | "Control de stock" | "Precios y rentabilidad" | "Compras" | "Gastos" | "Combos y promociones" | "Reportes" | "Histórico de octubre" | "Proveedores" | "Configuración"

export interface NavigationItem {
  label: Page
  icon: import("./icons").IconName
  to: string
}
