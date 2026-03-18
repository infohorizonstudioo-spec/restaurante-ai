import { TenantProvider } from '@/contexts/TenantContext'
import Sidebar from '@/components/Sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <TenantProvider>
      <div style={{ display:'flex', minHeight:'100vh', background:'#f8fafc', fontFamily:"'DM Sans',-apple-system,sans-serif" }}>
        <Sidebar/>
        <main style={{ flex:1, minWidth:0, overflowX:'hidden' }}>
          {children}
        </main>
      </div>
    </TenantProvider>
  )
}
