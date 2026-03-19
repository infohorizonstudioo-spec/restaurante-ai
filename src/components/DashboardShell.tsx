'use client'

// Wrapper simple — la campanita va en el header de cada página via NotifBell
export default function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column' }}>
      <main style={{ flex:1, minWidth:0, overflowX:'hidden', display:'flex', flexDirection:'column' }}>
        {children}
      </main>
    </div>
  )
}
