'use client'
import { useTenant } from '@/contexts/TenantContext'
import NotificationBell from '@/components/NotificationBell'

export default function TopBar() {
  const { tenant } = useTenant()
  if (!tenant?.id) return null
  return (
    <div style={{
      position:'fixed', top:0, right:0, zIndex:50,
      padding:'12px 20px',
      pointerEvents:'none',
    }}>
      <div style={{ pointerEvents:'all' }}>
        <NotificationBell tenantId={tenant.id} />
      </div>
    </div>
  )
}
