import { TenantProvider } from '@/contexts/TenantContext'
import Sidebar from '@/components/Sidebar'
import { ToastProvider } from '@/components/NotificationToast'
import DashboardShell from '@/components/DashboardShell'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <TenantProvider>
      <ToastProvider>
        <div style={{ display:'flex', minHeight:'100vh', background:'var(--rz-bg)', fontFamily:'var(--rz-font)' }}>
          <Sidebar/>
          <DashboardShell>
            {children}
          </DashboardShell>
        </div>
      </ToastProvider>
    </TenantProvider>
  )
}
