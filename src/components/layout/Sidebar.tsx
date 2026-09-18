import { NavLink } from 'react-router-dom'
import { navigationItems } from '../../config/navigation'

const lsaWhiteLogo = `${import.meta.env.BASE_URL}imgs/logos/LSA-Transperent-%20WHite.png`

interface SidebarProps {
  isOpen: boolean
  onNavigate: () => void
}

export function Sidebar({ isOpen, onNavigate }: SidebarProps) {
  return (
    <aside
      className={`sidebar${isOpen ? ' sidebar--open' : ''}`}
      aria-label="Main navigation"
    >
      <div className="brand">
        <div className="brand__logo" aria-hidden="true">
          <img src={lsaWhiteLogo} alt="" />
        </div>
        <p className="brand__name">
          Lords Skill Academy
          <span className="brand__short-name">LSA</span>
        </p>
      </div>

      <p className="sidebar__section-label">Workspace</p>
      <nav className="sidebar__nav">
        {navigationItems.map(({ icon: Icon, label, path }) => (
          <NavLink
            className={({ isActive }) =>
              `sidebar__link${isActive ? ' sidebar__link--active' : ''}`
            }
            end={path === '/'}
            key={path}
            onClick={onNavigate}
            to={path}
          >
            <Icon aria-hidden="true" size={19} strokeWidth={1.9} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <p className="sidebar__footer">LSA Fee Management</p>
    </aside>
  )
}