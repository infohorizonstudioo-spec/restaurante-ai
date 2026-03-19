/**
 * Crea una notificación en la tabla notifications.
 * Llamada desde post-call y otros eventos del sistema.
 */
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export type NotifType =
  | 'call_completed'
  | 'call_pending'
  | 'call_attention'
  | 'call_missed'
  | 'reservation_created'

export async function createNotification(params: {
  tenant_id:  string
  type:       NotifType
  title:      string
  body?:      string
  call_sid?:  string
}): Promise<void> {
  try {
    await admin.from('notifications').insert({
      tenant_id:  params.tenant_id,
      type:       params.type,
      title:      params.title,
      body:       params.body  || null,
      call_sid:   params.call_sid || null,
      read:       false,
    })
  } catch (e: any) {
    console.error('createNotification error:', e.message)
  }
}
