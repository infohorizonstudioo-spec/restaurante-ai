'use client'
import { useTenant } from '@/contexts/TenantContext'
import NotificationBell from '@/components/NotificationBell'

/**
 * Campanita lista para pasar como prop `actions` al PageHeader.
 * Uso: <PageHeader title="X" actions={<NotifBell/>}/>
 */
export default function NotifBell() {
  const { tenant } = useTenant()
  if (!tenant?.id) return null
  return <NotificationBell tenantId={tenant.id}/>
}
