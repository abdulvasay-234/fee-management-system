import { NavLink } from 'react-router-dom'
import { navigationItems } from '../../config/navigation'

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
        <div className="brand__logo">
          <img className="brand__logo-img" src={`${import.meta.env.BASE_URL}imgs/logos/LSA-Transperent-%20WHite.png`} alt="LSA" width={64} height={64} />
        </div>
        <div className="brand__header">
          <h2 className="brand__title">LSA Connect</h2>
          <p className="brand__subtitle">Academy Management Workspace</p>
        </div>
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