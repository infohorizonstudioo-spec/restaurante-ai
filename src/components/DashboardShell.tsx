'use client'

import { useState, useEffect, useCallback } from 'react'

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches)
      if (!e.matches) setSidebarOpen(false)
    }
    handler(mq)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev)
    // Toggle class on parent .rz-dashboard
    const dashboard = document.querySelector('.rz-dashboard')
    if (dashboard) {
      dashboard.classList.toggle('rz-sidebar-open')
    }
  }, [])

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false)
    const dashboard = document.querySelector('.rz-dashboard')
    if (dashboard) {
      dashboard.classList.remove('rz-sidebar-open')
    }
  }, [])

  // Close sidebar on route change (listen for popstate)
  useEffect(() => {
    const handleRouteChange = () => closeSidebar()
    window.addEventListener('popstate', handleRouteChange)
    return () => window.removeEventListener('popstate', handleRouteChange)
  }, [closeSidebar])

  // Close sidebar on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sidebarOpen) closeSidebar()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [sidebarOpen, closeSidebar])

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Hamburger button — visible only on mobile via CSS */}
      <button
        className="rz-hamburger"
        onClick={toggleSidebar}
        aria-label={sidebarOpen ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={sidebarOpen}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {sidebarOpen ? (
            <path d="M18 6L6 18M6 6l12 12" />
          ) : (
            <path d="M3 6h18M3 12h18M3 18h18" />
          )}
        </svg>
      </button>

      {/* Overlay behind sidebar — visible only when open on mobile */}
      <div
        className="rz-sidebar-overlay"
        onClick={closeSidebar}
        style={isMobile && sidebarOpen ? { display: 'block', opacity: 1, pointerEvents: 'auto' } : undefined}
      />

      <main
        className={isMobile ? 'rz-main-mobile-pad' : ''}
        style={{ flex: 1, minWidth: 0, overflowX: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
        {children}
      </main>
    </div>
  )
}
