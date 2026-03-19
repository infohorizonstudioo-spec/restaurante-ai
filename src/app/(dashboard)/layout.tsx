import { TenantProvider } from '@/contexts/TenantContext'
import Sidebar from '@/components/Sidebar'
import TopBar from '@/components/TopBar'
import { ToastProvider } from '@/components/NotificationToast'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <TenantProvider>
      <ToastProvider>
        <div style={{ display:'flex', minHeight:'100vh', background:'var(--rz-bg)', fontFamily:'var(--rz-font)' }}>
          <Sidebar/>
          <main style={{ flex:1, minWidth:0, overflowX:'hidden', display:'flex', flexDirection:'column' }}>
            {children}
          </main>
          <TopBar />
        </div>
      </ToastProvider>
    </TenantProvider>
  )
}
