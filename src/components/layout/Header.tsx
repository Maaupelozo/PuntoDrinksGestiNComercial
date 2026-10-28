import type { Page } from "../../types/navigation"
import { Icon } from "../ui/Icon"
import { useAuth } from '../../context/AuthContext'

export function Header({
  page,
  openMenu,
}: {
  page: Page
  openMenu: () => void
}) {
  const { session } = useAuth()
  const displayName = String(session?.user.user_metadata.display_name || session?.user.email || '')
  const initials = displayName.slice(0, 2).toUpperCase()
  return (
    <header className="header">
      <button className="menu-btn" onClick={openMenu} aria-label="Abrir menú">
        <Icon name="menu" />
      </button>
      <div>
        <small>Gestión comercial</small>
        <h1>{page}</h1>
      </div>
      <div className="header-actions">
        <div className="avatar">{initials}</div>
      </div>
    </header>
  )
}
