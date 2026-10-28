import { Navigate, Route, Routes } from "react-router"
import { AppLayout } from "./components/layout/AppLayout"
import { DashboardPage } from "./pages/DashboardPage"
import { SalesPage } from "./pages/SalesPage"
import { StockPage } from "./pages/StockPage"
import { PricesPage } from "./pages/PricesPage"
import { PurchasesPage } from "./pages/PurchasesPage"
import { ExpensesPage } from "./pages/ExpensesPage"
import { CombosPage } from "./pages/CombosPage"
import { ReportsPage } from "./pages/ReportsPage"
import { SuppliersPage } from "./pages/SuppliersPage"
import { SettingsPage } from "./pages/SettingsPage"
import { LoginPage } from './pages/LoginPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { RequireSession } from './components/layout/RequireSession'
import { InventoryProvider } from './context/InventoryContext'
import { ProcurementProvider } from './context/ProcurementContext'
import { SalesProvider } from './context/SalesContext'
import { useAuth } from './context/AuthContext'
import { BusinessSettingsProvider } from './context/BusinessSettingsContext'
import type { ReactNode } from 'react'

function InventoryRoute({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  return <InventoryProvider key={session!.user.id}>{children}</InventoryProvider>
}

export default function App() {
  return (
    <Routes>
      <Route path="ingresar" element={<LoginPage/>}/>
      <Route path="restablecer-clave" element={<ResetPasswordPage/>}/>
      <Route element={<RequireSession/>}>
      <Route element={<BusinessSettingsProvider><AppLayout /></BusinessSettingsProvider>}>
        <Route index element={<DashboardPage />} />
        <Route path="ventas" element={<InventoryRoute><SalesProvider><SalesPage /></SalesProvider></InventoryRoute>} />
        <Route path="stock" element={<InventoryRoute><StockPage /></InventoryRoute>} />
        <Route path="precios" element={<InventoryRoute><PricesPage /></InventoryRoute>} />
        <Route path="compras" element={<InventoryRoute><ProcurementProvider><PurchasesPage /></ProcurementProvider></InventoryRoute>} />
        <Route path="gastos" element={<ExpensesPage />} />
        <Route path="combos" element={<InventoryRoute><SalesProvider><CombosPage /></SalesProvider></InventoryRoute>} />
        <Route path="reportes" element={<ReportsPage />} />
        <Route path="proveedores" element={<ProcurementProvider><SuppliersPage /></ProcurementProvider>} />
        <Route path="configuracion" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
      </Route>
    </Routes>
  )
}
