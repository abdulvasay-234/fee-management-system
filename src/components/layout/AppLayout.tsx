import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { hasPendingSave, useIsSaving } from '../../hooks/useSaveProtection'

export function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const isSaving = useIsSaving()

  return (
    <div
      className="app-shell"
      aria-busy={isSaving}
      onClickCapture={(event) => {
        if (hasPendingSave()) {
          event.preventDefault()
          event.stopPropagation()
        }
      }}
    >
      <Sidebar
        isOpen={isSidebarOpen}
        onNavigate={() => setIsSidebarOpen(false)}
      />
      <button
        className={`sidebar-backdrop${isSidebarOpen ? ' sidebar-backdrop--visible' : ''}`}
        type="button"
        aria-label="Close navigation"
        onClick={() => setIsSidebarOpen(false)}
      />
      <div className="app-main">
        <TopBar onMenuClick={() => setIsSidebarOpen(true)} />
        <main>
          <Outlet />
        </main>
        <footer className="app-footer">
          <div className="app-footer__content">
            <p className="app-footer__credits">
              Designed & Developed by{' '}
              <a href="https://abdulvasay.com" target="_blank" rel="noopener noreferrer">
                Abdul Vasay
              </a>
            </p>
            <p className="app-footer__copyright">
              © {new Date().getFullYear()} LSA Connect. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}