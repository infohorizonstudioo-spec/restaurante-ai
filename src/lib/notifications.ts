/**
 * Sistema de notificaciones Reservo.AI
 * - 10 tipos de evento
 * - 3 niveles de prioridad (info / warning / critical)
 * - Persistencia en Supabase
 * - Disparado desde cualquier endpoint del backend
 */
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export type NotifType =
  | 'new_call'
  | 'call_active'
  | 'call_finished'
  | 'missed_call'
  | 'new_reservation'
  | 'reservation_pending_review'
  | 'new_order'
  | 'important_alert'
  | 'incident'
  | 'pending_review'
  // legacy
  | 'call_completed'
  | 'call_pending'
  | 'call_attention'
  | 'call_missed'
  | 'reservation_created'

export type NotifPriority = 'info' | 'warning' | 'critical'

export interface CreateNotificationParams {
  tenant_id:          string
  type:               NotifType
  title:              string
  body?:              string
  priority?:          NotifPriority
  related_entity_id?: string
  call_sid?:          string
  action_required?:   boolean
}

/** Reglas automáticas de prioridad por tipo */
function inferPriority(type: NotifType, override?: NotifPriority): NotifPriority {
  if (override) return override
  const critical: NotifType[] = ['incident', 'pending_review', 'reservation_pending_review', 'call_attention', 'important_alert']
  const warning:  NotifType[] = ['missed_call', 'call_missed', 'call_active', 'new_call', 'new_order']
  if (critical.includes(type)) return 'critical'
  if (warning.includes(type))  return 'warning'
  return 'info'
}

export async function createNotification(params: CreateNotificationParams): Promise<void> {
  try {
    const priority = inferPriority(params.type, params.priority)
    const action_required = params.action_required ?? (priority === 'critical')
    await admin.from('notifications').insert({
      tenant_id:          params.tenant_id,
      type:               params.type,
      title:              params.title,
      body:               params.body              || null,
      priority,
      action_required,
      related_entity_id:  params.related_entity_id || params.call_sid || null,
      read:               false,
    })
  } catch (e: any) {
    console.error('createNotification error:', e.message)
  }
}
