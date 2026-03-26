/**
 * REMINDER ENGINE — Configurable customer reminders with dedup, fallback, and traceability.
 * Supports multiple intervals (24h, 30min, custom), SMS + WhatsApp fallback.
 */
import { createClient } from '@supabase/supabase-js'
import { sendSms, sendWhatsApp } from './agent-tools'
import { resolveTemplate } from './templates'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Types ──────────────────────────────────────────────────────
export interface ReminderConfig {
  intervals: string[]           // ['24h', '30min', '2h', etc.]
  channel: 'sms' | 'whatsapp'
  template_override?: string
  enabled: boolean
}

interface ScheduledReminder {
  id: string
  tenant_id: string
  reservation_id: string
  interval_key: string
  send_at: string
  status: 'pending' | 'sent' | 'cancelled' | 'failed'
  channel: string
  attempts: any[]
  sent_at?: string
}

// ── Default config ─────────────────────────────────────────────
const DEFAULT_CONFIG: ReminderConfig = {
  intervals: ['24h'],
  channel: 'sms',
  enabled: true,
}

// ── Interval to milliseconds ───────────────────────────────────
function intervalToMs(interval: string): number {
  const match = interval.match(/^(\d+)(h|min|m|d)$/)
  if (!match) return 24 * 60 * 60 * 1000 // default 24h
  const [, num, unit] = match
  const n = parseInt(num)
  switch (unit) {
    case 'h': return n * 60 * 60 * 1000
    case 'min': case 'm': return n * 60 * 1000
    case 'd': return n * 24 * 60 * 60 * 1000
    default: return 24 * 60 * 60 * 1000
  }
}

// ── Get tenant's reminder config ───────────────────────────────
export async function getRemindersConfig(tenantId: string): Promise<ReminderConfig> {
  const { data } = await supabase.from('reminder_configs')
    .select('*').eq('tenant_id', tenantId).maybeSingle()

  if (!data) return DEFAULT_CONFIG

  return {
    intervals: data.intervals || DEFAULT_CONFIG.intervals,
    channel: data.channel || DEFAULT_CONFIG.channel,
    template_override: data.template_override,
    enabled: data.enabled !== false,
  }
}

// ── Schedule reminders for a reservation ───────────────────────
export async function scheduleReminders(reservationId: string): Promise<void> {
  try {
    // Load reservation
    const { data: res } = await supabase.from('reservations')
      .select('id, tenant_id, customer_phone, date, time, reservation_time')
      .eq('id', reservationId).maybeSingle()

    if (!res || !res.tenant_id) return

    // Check if reminders are enabled
    const config = await getRemindersConfig(res.tenant_id)
    if (!config.enabled) return

    // Calculate reservation datetime
    const time = res.time || res.reservation_time || '12:00'
    const resDate = new Date(`${res.date}T${time}:00`)
    if (isNaN(resDate.getTime())) return

    // Skip if reservation is in the past
    if (resDate.getTime() < Date.now()) return

    // Schedule each interval
    for (const interval of config.intervals) {
      const ms = intervalToMs(interval)
      const sendAt = new Date(resDate.getTime() - ms)

      // Skip if send time is in the past
      if (sendAt.getTime() < Date.now()) continue

      // Insert with UNIQUE constraint (reservation_id + interval_key) — dedup
      await supabase.from('scheduled_reminders').upsert({
        tenant_id: res.tenant_id,
        reservation_id: reservationId,
        interval_key: interval,
        send_at: sendAt.toISOString(),
        status: 'pending',
        channel: config.channel,
        attempts: [],
      }, { onConflict: 'reservation_id,interval_key' })
    }
  } catch {
    // Non-critical: don't fail reservation creation
  }
}

// ── Cancel reminders for a reservation ─────────────────────────
export async function cancelReminders(reservationId: string): Promise<void> {
  await supabase.from('scheduled_reminders')
    .update({ status: 'cancelled' })
    .eq('reservation_id', reservationId)
    .eq('status', 'pending')
}

// ── Send all due reminders ─────────────────────────────────────
export async function sendDueReminders(): Promise<{ sent: number; failed: number }> {
  const now = new Date().toISOString()

  // Get all pending reminders due now
  const { data: due } = await supabase.from('scheduled_reminders')
    .select('*')
    .eq('status', 'pending')
    .lte('send_at', now)
    .order('send_at')
    .limit(100)

  if (!due || due.length === 0) return { sent: 0, failed: 0 }

  let sent = 0, failed = 0

  for (const reminder of due as ScheduledReminder[]) {
    try {
      // Load reservation details
      const { data: res } = await supabase.from('reservations')
        .select('customer_name, customer_phone, date, time, reservation_time, people, party_size, status, tenant_id')
        .eq('id', reminder.reservation_id).maybeSingle()

      // Skip if reservation was cancelled
      if (!res || res.status === 'cancelada' || res.status === 'cancelled') {
        await supabase.from('scheduled_reminders')
          .update({ status: 'cancelled' }).eq('id', reminder.id)
        continue
      }

      const phone = res.customer_phone
      if (!phone) {
        await markFailed(reminder.id, 'No phone number')
        failed++
        continue
      }

      // Get tenant for template
      const { data: tenant } = await supabase.from('tenants')
        .select('name, type').eq('id', res.tenant_id).maybeSingle()

      // Build message using dynamic labels
      const template = resolveTemplate(tenant?.type || 'otro')
      const label = template.labels.reserva.toLowerCase()
      const time = res.time || res.reservation_time || ''
      const people = res.people || res.party_size || 1

      const intervalLabel = reminder.interval_key === '24h' ? 'manana'
        : reminder.interval_key === '30min' ? 'en 30 minutos'
        : `pronto`

      const message = `Te recordamos tu ${label} ${intervalLabel} a las ${time}${people > 1 ? `, ${people} personas` : ''} en ${tenant?.name || 'nuestro negocio'}. Te esperamos.`

      // Try primary channel (SMS)
      let success = false
      const attempts: any[] = [...(reminder.attempts || [])]

      if (reminder.channel === 'sms' || !reminder.channel) {
        success = await sendSms(phone, message)
        attempts.push({ channel: 'sms', at: now, success })
      }

      // Fallback to WhatsApp if SMS fails
      if (!success) {
        success = await sendWhatsApp(phone, message)
        attempts.push({ channel: 'whatsapp', at: now, success })
      }

      // Update reminder status
      if (success) {
        await supabase.from('scheduled_reminders').update({
          status: 'sent',
          sent_at: now,
          attempts,
        }).eq('id', reminder.id)
        sent++
      } else {
        await supabase.from('scheduled_reminders').update({
          status: 'failed',
          attempts,
        }).eq('id', reminder.id)
        failed++
      }
    } catch {
      await markFailed(reminder.id, 'Exception')
      failed++
    }
  }

  return { sent, failed }
}

async function markFailed(id: string, reason: string) {
  await supabase.from('scheduled_reminders').update({
    status: 'failed',
    attempts: [{ reason, at: new Date().toISOString() }],
  }).eq('id', id)
}
