import { TenantProvider } from '@/contexts/TenantContext'
import Sidebar from '@/components/Sidebar'
import { ToastProvider } from '@/components/NotificationToast'
import DashboardShell from '@/components/DashboardShell'
import AssistantChat from '@/components/AssistantChat'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <TenantProvider>
      <ToastProvider>
        <div style={{ display:'flex', minHeight:'100vh', background:'var(--rz-bg)', fontFamily:'var(--rz-font)' }}>
          <Sidebar/>
          <DashboardShell>
            {children}
          </DashboardShell>
          <AssistantChat/>
        </div>
      </ToastProvider>
    </TenantProvider>
  )
}
