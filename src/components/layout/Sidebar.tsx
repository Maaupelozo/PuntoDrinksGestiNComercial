import { NavLink } from "react-router"
import { navigation } from "../../config/navigation"
import { Icon } from "../ui/Icon"
import { useAuth } from '../../context/AuthContext'
import { useBusinessSettings } from '../../context/BusinessSettingsContext'
import { useState } from 'react'
import { errorMessage } from '../../lib/errors'

interface SidebarProps {
  open: boolean
  close: () => void
}

export function Sidebar({ open, close }: SidebarProps) {
  const { session, signOut } = useAuth()
  const { settings } = useBusinessSettings()
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const email = session?.user.email ?? ''
  const displayName = String(session?.user.user_metadata.display_name || email)
  const initials = displayName.slice(0, 2).toUpperCase()

  async function leave() {
    setSignOutError(null)
    try { await signOut() } catch (failure) { setSignOutError(errorMessage(failure)) }
  }

  return (
    <>
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand">
          <span>{settings.logo_url ? <img src={settings.logo_url} alt="Logo del negocio"/> : 'PD'}</span>
          <div>
            <b>PUNTO</b>
            <small>DRINKS</small>
          </div>
        </div>
        <nav>
          {navigation.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              end
              className={({ isActive }) => (isActive ? "active" : "")}
              onClick={close}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="side-user">
          <div className="avatar">{initials}</div>
          <div>
            <b title={displayName}>{displayName}</b>
            <small title={email}>{email}</small>
          </div>
          <Icon name="chevron" size={15} />
        </div>
        <button type="button" className="side-logout" onClick={() => void leave()}>Cerrar sesión</button>
        {signOutError && <small className="side-error" role="alert">{signOutError}</small>}
      </aside>
      {open && (
        <button className="backdrop" onClick={close} aria-label="Cerrar menú" />
      )}
    </>
  )
}
