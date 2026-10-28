import { NavLink } from "react-router"
import { mobileNavigation } from "../../config/navigation"
import { Icon } from "../ui/Icon"

export function MobileNav({ openMenu }: { openMenu: () => void }) {
  return (
    <nav className="mobile-nav">
      {mobileNavigation.map((item) => (
        <NavLink
          to={item.to}
          end
          className={({ isActive }) => (isActive ? "active" : "")}
          key={item.to}
        >
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </NavLink>
      ))}
      <button onClick={openMenu}>
        <Icon name="menu" />
        <span>Más</span>
      </button>
    </nav>
  )
}
