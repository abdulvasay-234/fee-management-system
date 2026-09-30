import { LogOut, Menu } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { navigationItems } from '../../config/navigation'
import { Button } from '../ui/Button'

interface TopBarProps {
  onMenuClick: () => void
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const { email, signOut } = useAuth()
  const { pathname } = useLocation()
  const currentPage =
    navigationItems.find((item) => item.path === pathname) ?? navigationItems[0]

  return (
    <header className="topbar">
      <div className="topbar__left">
        <Button
          className="topbar__menu"
          variant="secondary"
          iconOnly
          aria-label="Open navigation"
          onClick={onMenuClick}
        >
          <Menu aria-hidden="true" size={20} />
        </Button>
        <div className="topbar__identity">
          <span className="topbar__eyebrow">Lords Skill Academy</span>
          <p className="topbar__title">{currentPage.label}</p>
        </div>
      </div>
      <div className="topbar__account">
        <div className="topbar__workspace">
          <span className="topbar__status-dot" aria-hidden="true" />
          <span>{email}</span>
        </div>
        <Button variant="secondary" onClick={signOut}>
          <LogOut aria-hidden="true" size={15} />
          Sign Out
        </Button>
      </div>
    </header>
  )
}