import { useState } from "react"
import { Outlet, useLocation } from "react-router"
import { navigation } from "../../config/navigation"
import { Sidebar } from "./Sidebar"
import { Header } from "./Header"
import { MobileNav } from "./MobileNav"

export function AppLayout() {
  const [menu, setMenu] = useState(false)
  const { pathname } = useLocation()
  const path = pathname.replace(/\/+$/, "") || "/"
  const page = navigation.find((item) => item.to === path)?.label ?? "Dashboard"

  return (
    <div className="app">
      <Sidebar open={menu} close={() => setMenu(false)} />
      <main>
        <Header page={page} openMenu={() => setMenu(true)} />
        <div className="content">
          <Outlet />
        </div>
      </main>
      <MobileNav openMenu={() => setMenu(true)} />
    </div>
  )
}
