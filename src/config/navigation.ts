import type { NavigationItem } from "../types/navigation"

export const navigation: NavigationItem[] = [
  { label: "Dashboard", icon: "grid", to: "/" },
  { label: "Ventas", icon: "sale", to: "/ventas" },
  { label: "Control de stock", icon: "box", to: "/stock" },
  { label: "Precios y rentabilidad", icon: "chart", to: "/precios" },
  { label: "Compras", icon: "cart", to: "/compras" },
  { label: "Gastos", icon: "wallet", to: "/gastos" },
  { label: "Combos y promociones", icon: "gift", to: "/combos" },
  { label: "Reportes", icon: "report", to: "/reportes" },
  { label: "Proveedores", icon: "truck", to: "/proveedores" },
  { label: "Configuración", icon: "settings", to: "/configuracion" },
]

interface MobileNavigationItem {
  to: string
  icon: NavigationItem["icon"]
  label: string
}

export const mobileNavigation = [
  { to: "/", icon: "grid", label: "Inicio" },
  { to: "/ventas", icon: "sale", label: "Ventas" },
  { to: "/stock", icon: "box", label: "Stock" },
  { to: "/reportes", icon: "report", label: "Reportes" },
] satisfies MobileNavigationItem[]
