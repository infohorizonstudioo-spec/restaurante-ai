'use client'
import { useTenant } from '@/contexts/TenantContext'
import NotificationBell from '@/components/NotificationBell'

// Campanita fija en la esquina superior derecha, dentro del header (56px)
// No añade barra extra ni tapa contenido
export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const { tenant } = useTenant()
  return (
    <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column' }}>
      {tenant?.id && (
        <div style={{
          position:'fixed',
          top:9,
          right:20,
          zIndex:100,
          pointerEvents:'all',
        }}>
          <NotificationBell tenantId={tenant.id}/>
        </div>
      )}
      <main style={{ flex:1, minWidth:0, overflowX:'hidden', display:'flex', flexDirection:'column' }}>
        {children}
      </main>
    </div>
  )
}
