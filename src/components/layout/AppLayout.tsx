import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

export function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <div className="app-shell">
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
      </div>
    </div>
  )
}