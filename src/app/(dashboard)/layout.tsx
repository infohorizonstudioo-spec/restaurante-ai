import { TenantProvider } from '@/contexts/TenantContext'
import Sidebar from '@/components/Sidebar'
import TopBar from '@/components/TopBar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <TenantProvider>
      <div style={{ display:'flex', minHeight:'100vh', background:'var(--rz-bg)', fontFamily:'var(--rz-font)' }}>
        <Sidebar/>
        <main style={{ flex:1, minWidth:0, overflowX:'hidden', display:'flex', flexDirection:'column' }}>
          {children}
        </main>
        <TopBar />
      </div>
    </TenantProvider>
  )
}
