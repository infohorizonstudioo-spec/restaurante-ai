import { TenantProvider } from '@/contexts/TenantContext'
import Sidebar from '@/components/Sidebar'
import { ToastProvider } from '@/components/NotificationToast'
import DashboardShell from '@/components/DashboardShell'
import HelpButton from '@/components/HelpButton'
import AssistantChat from '@/components/AssistantChat'
import ThemeToggle from '@/components/ThemeToggle'
import PushPermission from '@/components/PushPermission'
import ServiceStatus from '@/components/ServiceStatus'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <TenantProvider>
      <ToastProvider>
        <div className="rz-dashboard" style={{ display:'flex', minHeight:'100vh', background:'var(--rz-bg)', fontFamily:'var(--rz-font)' }}>
          <Sidebar/>
          <DashboardShell>
            <PushPermission/>
            {children}
          </DashboardShell>
          <AssistantChat/>
          <div style={{ position:'fixed', bottom:72, right:24, zIndex:499 }}>
            <ThemeToggle/>
          </div>
          <ServiceStatus/>
        </div>
      </ToastProvider>
    </TenantProvider>
  )
}
