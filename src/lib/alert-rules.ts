/**
 * ALERT RULES ENGINE — Configurable alerts for business owners.
 * Events trigger notifications dispatched to configured channels (in-app, SMS, push, email).
 */
import { createClient } from '@supabase/supabase-js'
import { createNotification, type NotifPriority } from './notifications'
import { sendSms } from './agent-tools'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Types ──────────────────────────────────────────────────────
export type AlertEventType =
  | 'complaint'
  | 'cancellation'
  | 'vip_message'
  | 'sensitive_appointment'
  | 'conflict'
  | 'likely_no_show'
  | 'critical_change'
  | 'escalation'
  | 'large_group'
  | 'crisis'
  | 'new_reservation'
  | 'missed_call'

export interface AlertRule {
  id: string
  tenant_id: string
  event_type: AlertEventType
  enabled: boolean
  priority: NotifPriority
  channels: ('in_app' | 'sms' | 'push' | 'email')[]
}

export interface AlertContext {
  title: string
  body: string
  related_entity_id?: string
  target_url?: string
  customer_name?: string
  customer_phone?: string
}

// ── Default rules per event type ───────────────────────────────
const DEFAULT_RULES: Record<AlertEventType, { enabled: boolean; priority: NotifPriority; channels: string[] }> = {
  complaint:             { enabled: true,  priority: 'critical', channels: ['in_app', 'sms'] },
  cancellation:          { enabled: true,  priority: 'warning',  channels: ['in_app'] },
  vip_message:           { enabled: true,  priority: 'warning',  channels: ['in_app'] },
  sensitive_appointment: { enabled: true,  priority: 'warning',  channels: ['in_app'] },
  conflict:              { enabled: true,  priority: 'warning',  channels: ['in_app'] },
  likely_no_show:        { enabled: true,  priority: 'info',     channels: ['in_app'] },
  critical_change:       { enabled: true,  priority: 'critical', channels: ['in_app', 'sms'] },
  escalation:            { enabled: true,  priority: 'critical', channels: ['in_app', 'sms'] },
  large_group:           { enabled: true,  priority: 'warning',  channels: ['in_app'] },
  crisis:                { enabled: true,  priority: 'critical', channels: ['in_app', 'sms'] },
  new_reservation:       { enabled: false, priority: 'info',     channels: ['in_app'] },
  missed_call:           { enabled: true,  priority: 'warning',  channels: ['in_app'] },
}

// ── Human-readable labels ──────────────────────────────────────
export const EVENT_LABELS: Record<AlertEventType, { label: string; description: string }> = {
  complaint:             { label: 'Queja / Reclamacion', description: 'Un cliente envia una queja o reclamacion' },
  cancellation:          { label: 'Cancelacion', description: 'Un cliente cancela una reserva o cita' },
  vip_message:           { label: 'Mensaje de VIP', description: 'Un cliente VIP envia un mensaje' },
  sensitive_appointment: { label: 'Cita sensible', description: 'Se agenda una cita marcada como sensible' },
  conflict:              { label: 'Conflicto de horario', description: 'Se detecta un conflicto en la agenda' },
  likely_no_show:        { label: 'Probable ausencia', description: 'Se predice que un cliente no acudira' },
  critical_change:       { label: 'Cambio critico', description: 'Un cambio importante en reserva o agenda' },
  escalation:            { label: 'Escalacion', description: 'Una conversacion es escalada a humano' },
  large_group:           { label: 'Grupo grande', description: 'Una reserva de grupo grande' },
  crisis:                { label: 'Crisis', description: 'Deteccion de crisis (psicologia)' },
  new_reservation:       { label: 'Nueva reserva', description: 'Se crea una nueva reserva' },
  missed_call:           { label: 'Llamada perdida', description: 'Se pierde una llamada' },
}

// ── Get tenant's alert rules (merged with defaults) ────────────
export async function getAlertRules(tenantId: string): Promise<AlertRule[]> {
  const { data: customRules } = await supabase.from('alert_rules')
    .select('*')
    .eq('tenant_id', tenantId)

  const customMap = new Map((customRules || []).map(r => [r.event_type, r]))

  return (Object.keys(DEFAULT_RULES) as AlertEventType[]).map(eventType => {
    const custom = customMap.get(eventType)
    const defaults = DEFAULT_RULES[eventType]
    return {
      id: custom?.id || '',
      tenant_id: tenantId,
      event_type: eventType,
      enabled: custom?.enabled ?? defaults.enabled,
      priority: (custom?.priority || defaults.priority) as NotifPriority,
      channels: (custom?.channels || defaults.channels) as AlertRule['channels'],
    }
  })
}

// ── Evaluate event and dispatch alerts ─────────────────────────
export async function evaluateAndNotify(
  tenantId: string,
  eventType: AlertEventType,
  context: AlertContext,
): Promise<boolean> {
  try {
    const rules = await getAlertRules(tenantId)
    const rule = rules.find(r => r.event_type === eventType)

    if (!rule || !rule.enabled) return false

    // Dispatch to each configured channel
    for (const channel of rule.channels) {
      await dispatchAlert(tenantId, channel, rule, context)
    }

    return true
  } catch {
    return false
  }
}

// ── Dispatch alert to a specific channel ───────────────────────
async function dispatchAlert(
  tenantId: string,
  channel: string,
  rule: AlertRule,
  context: AlertContext,
): Promise<void> {
  switch (channel) {
    case 'in_app':
      await createNotification({
        tenant_id: tenantId,
        type: rule.priority === 'critical' ? 'important_alert' : 'incident',
        title: context.title,
        body: context.body,
        priority: rule.priority,
        related_entity_id: context.related_entity_id,
        target_url: context.target_url,
        action_required: rule.priority !== 'info',
      })
      break

    case 'sms': {
      // Get owner phone
      const { data: tenant } = await supabase.from('tenants')
        .select('agent_phone').eq('id', tenantId).maybeSingle()
      // Get profile phone as fallback
      const { data: profile } = await supabase.from('profiles')
        .select('phone').eq('tenant_id', tenantId).limit(1).maybeSingle()

      const ownerPhone = profile?.phone || tenant?.agent_phone
      if (ownerPhone) {
        const smsBody = `[Reservo] ${context.title}\n${context.body}`.slice(0, 160)
        await sendSms(ownerPhone, smsBody)
      }
      break
    }

    case 'push':
      // Use existing push notification infrastructure
      try {
        const { data: subs } = await supabase.from('push_subscriptions')
          .select('*').eq('tenant_id', tenantId)
        if (subs && subs.length > 0) {
          await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/push/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tenant_id: tenantId,
              title: context.title,
              body: context.body,
              priority: rule.priority,
            }),
          })
        }
      } catch { /* push failure is non-critical */ }
      break

    case 'email':
      // Future: send email via Resend
      break
  }
}
