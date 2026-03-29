import { TenantProvider } from '@/contexts/TenantContext'
import Sidebar from '@/components/Sidebar'
import { ToastProvider } from '@/components/NotificationToast'
import DashboardShell from '@/components/DashboardShell'
import HelpButton from '@/components/HelpButton'
import ThemeToggle from '@/components/ThemeToggle'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <TenantProvider>
      <ToastProvider>
        <div style={{ display:'flex', minHeight:'100vh', background:'var(--rz-bg)', fontFamily:'var(--rz-font)' }}>
          <Sidebar/>
          <DashboardShell>
            {children}
          </DashboardShell>
          <HelpButton/>
          <div style={{ position:'fixed', bottom:72, right:24, zIndex:499 }}>
            <ThemeToggle/>
          </div>
        </div>
      </ToastProvider>
    </TenantProvider>
  )
}
