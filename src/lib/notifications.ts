/**
 * Sistema de notificaciones Reservo.AI
 * - Prioridades correctas: solo lo crítico es crítico
 * - target_url para navegación directa desde la campanita
 */
import { createClient } from '@supabase/supabase-js'
import { logger } from './logger'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export type NotifType =
  | 'new_call' | 'call_active' | 'call_finished' | 'missed_call'
  | 'new_reservation' | 'reservation_pending_review'
  | 'new_order' | 'important_alert' | 'incident' | 'pending_review'
  | 'call_completed' | 'call_pending' | 'call_attention'
  | 'call_missed' | 'reservation_created'

export type NotifPriority = 'info' | 'warning' | 'critical'

export interface CreateNotificationParams {
  tenant_id:          string
  type:               NotifType
  title:              string
  body?:              string
  priority?:          NotifPriority
  related_entity_id?: string
  call_sid?:          string
  reservation_id?:    string
  target_url?:        string
  action_required?:   boolean
}

/** Prioridades correctas — solo lo urgente es crítico */
function inferPriority(type: NotifType, override?: NotifPriority): NotifPriority {
  if (override) return override
  const critical: NotifType[] = ['incident', 'important_alert']
  const warning:  NotifType[] = [
    'reservation_pending_review', 'call_attention', 'call_pending',
    'pending_review', 'missed_call', 'call_missed',
  ]
  if (critical.includes(type)) return 'critical'
  if (warning.includes(type))  return 'warning'
  return 'info'
}

/** Genera URL de destino automáticamente si no se pasa */
function inferTargetUrl(type: NotifType, params: CreateNotificationParams): string | null {
  if (params.target_url) return params.target_url
  const sid = params.call_sid || params.related_entity_id
  const rid = params.reservation_id
  switch (type) {
    case 'new_call':
    case 'call_active':
    case 'call_finished':
    case 'call_completed':
    case 'call_attention':
    case 'call_pending':
    case 'call_missed':
    case 'missed_call':
      return sid ? `/llamadas?sid=${sid}` : '/llamadas'
    case 'new_reservation':
    case 'reservation_created':
      return rid ? `/reservas?id=${rid}` : '/reservas'
    case 'reservation_pending_review':
    case 'pending_review':
      return '/llamadas?filter=pending'
    case 'new_order':
      return '/pedidos'
    case 'incident':
    case 'important_alert':
      return sid ? `/llamadas?sid=${sid}` : '/panel'
    default:
      return '/panel'
  }
}

/**
 * Send push notification to all devices of a tenant.
 * Non-blocking — errors are silently logged.
 */
export async function sendPush(params: {
  tenant_id: string
  title: string
  body?: string
  url?: string
  priority?: NotifPriority
  tag?: string
}): Promise<void> {
  try {
    const internalKey = process.env.INTERNAL_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-40)
    if (!internalKey) return
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'
    await fetch(`${baseUrl}/api/push/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': internalKey,
      },
      body: JSON.stringify({
        tenant_id: params.tenant_id,
        title: params.title,
        body: params.body || '',
        url: params.url || '/panel',
        priority: params.priority || 'info',
        tag: params.tag || 'reservo',
      }),
    }).catch(() => {})
  } catch {
    // Non-blocking — never fail the parent operation
  }
}

export async function createNotification(params: CreateNotificationParams): Promise<void> {
  try {
    const priority       = inferPriority(params.type, params.priority)
    const target_url     = inferTargetUrl(params.type, params)
    const action_required = params.action_required ?? (priority === 'warning' || priority === 'critical')
    await admin.from('notifications').insert({
      tenant_id:          params.tenant_id,
      type:               params.type,
      title:              params.title,
      body:               params.body              || null,
      priority,
      action_required,
      related_entity_id:  params.related_entity_id || params.call_sid || params.reservation_id || null,
      target_url,
      read:               false,
    })

    // Auto-push to all devices (non-blocking)
    sendPush({
      tenant_id: params.tenant_id,
      title: params.title,
      body: params.body || '',
      url: target_url || '/panel',
      priority,
      tag: params.type,
    }).catch(() => {})
  } catch (e: any) {
    logger.error('createNotification error', {}, e)
  }
}
