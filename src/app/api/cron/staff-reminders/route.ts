/**
 * GET /api/cron/staff-reminders
 * Runs every hour. For each tenant:
 * 1. Check if current time is within business hours (tenant.business_hours)
 * 2. If YES: send shift start/end reminders, Monday weekly schedule, low-stock alerts
 * 3. If NO: do nothing — never bother employees outside work hours
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { timingSafeEqual } from 'crypto'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

// ── Helpers ──

function isWithinBusinessHours(
  businessHours: Record<string, { open: string; close: string; closed: boolean }> | undefined,
  now: Date,
  tz: string
): boolean {
  if (!businessHours) return true // Default: assume open if no hours configured

  const dayNames = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false })
  const parts = formatter.formatToParts(now)
  const hourStr = parts.find(p => p.type === 'hour')?.value || '00'
  const minuteStr = parts.find(p => p.type === 'minute')?.value || '00'
  const currentTime = `${hourStr}:${minuteStr}`
  const dayOfWeek = now.toLocaleDateString('es-ES', { timeZone: tz, weekday: 'long' }).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents

  // Try matching day name in business_hours keys
  const dayKey = Object.keys(businessHours).find(k => {
    const normalized = k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    return normalized === dayOfWeek || dayNames.indexOf(normalized) === now.getDay()
  })

  if (!dayKey) return true // Day not configured — assume open
  const dayConfig = businessHours[dayKey]
  if (dayConfig.closed) return false

  return currentTime >= dayConfig.open && currentTime <= dayConfig.close
}

function getCurrentTimeInTz(tz: string): { hour: number; minute: number; dayOfWeek: number } {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: 'numeric', minute: 'numeric', hour12: false,
  })
  const parts = formatter.formatToParts(now)
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10)
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10)
  const dayOfWeek = parseInt(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' })
      .format(now)
      .replace(/[^0-6]/, ''),
    10
  )
  // Get actual day of week in timezone
  const dayStr = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(now)
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return { hour, minute, dayOfWeek: dayMap[dayStr] ?? now.getDay() }
}

async function sendSms(to: string, message: string): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_SMS_NUMBER || process.env.TWILIO_PHONE_NUMBER

  if (!accountSid || !authToken || !fromNumber) return false

  try {
    const twilioAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
    const controller = new AbortController()
    const fetchTimeout = setTimeout(() => controller.abort(), 15000)
    try {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${twilioAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        signal: controller.signal,
        body: new URLSearchParams({ From: fromNumber, To: to, Body: message }).toString(),
      })
      return res.ok
    } finally {
      clearTimeout(fetchTimeout)
    }
  } catch {
    return false
  }
}

// ── Shift time mapping (matches horarios-equipo shifts) ──
const SHIFT_TIMES: Record<string, { start: string; end: string }> = {
  morning:   { start: '08:00', end: '15:00' },
  afternoon: { start: '15:00', end: '22:00' },
  night:     { start: '22:00', end: '06:00' },
}

const DAYS_FULL = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo']

export async function GET(req: Request) {
  const rl = rateLimitByIp(req, RATE_LIMITS.cron, 'cron:staff-reminders')
  if (rl.blocked) return rl.response

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: 'not configured' }, { status: 503 })
  const authHeader = req.headers.get('authorization') || ''
  const expectedHeader = `Bearer ${cronSecret}`
  const a = Buffer.from(authHeader)
  const b = Buffer.from(expectedHeader)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    logger.security('Cron staff-reminders: unauthorized attempt')
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let totalSmsSent = 0
  let tenantsProcessed = 0

  try {
    // Get all tenants with staff schedules
    const { data: tenants } = await admin.from('tenants')
      .select('id, name, business_hours, language, staff_schedule')
      .not('staff_schedule', 'is', null)

    if (!tenants || tenants.length === 0) {
      return NextResponse.json({ ok: true, message: 'No tenants with staff schedules', sent: 0 })
    }

    for (const tenant of tenants) {
      const tz = 'Europe/Madrid' // Default timezone
      const { hour, minute, dayOfWeek } = getCurrentTimeInTz(tz)

      // Check if within business hours — NEVER send outside work hours
      if (!isWithinBusinessHours(tenant.business_hours, new Date(), tz)) {
        continue
      }

      tenantsProcessed++
      const staffData = tenant.staff_schedule || {}
      const employees: { id: string; name: string; role: string; phone: string }[] = staffData.employees || []
      const schedules: Record<string, Record<string, Record<number, string | null>>> = staffData.schedules || {}

      // Get current week key (Monday)
      const now = new Date()
      const weekStart = new Date(now)
      weekStart.setDate(weekStart.getDate() - ((now.getDay() + 6) % 7))
      const weekKey = weekStart.toISOString().slice(0, 10)
      const weekSchedule = schedules[weekKey] || {}

      // Map JS dayOfWeek (0=Sun) to schedule day index (0=Mon)
      const scheduleDayIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1

      // ── 1. Shift starting in ~1 hour ──
      for (const emp of employees) {
        if (!emp.phone) continue
        const shift = weekSchedule[emp.id]?.[scheduleDayIdx]
        if (!shift || !SHIFT_TIMES[shift]) continue

        const shiftStart = SHIFT_TIMES[shift].start
        const [startH, startM] = shiftStart.split(':').map(Number)

        // Check if shift starts in next hour (within 45-75 min window)
        const diffMinutes = (startH * 60 + startM) - (hour * 60 + minute)
        if (diffMinutes >= 45 && diffMinutes <= 75) {
          const msg = `Entras en 1 hora en ${tenant.name} (${shiftStart}). Hasta luego!`
          const sent = await sendSms(emp.phone, msg)
          if (sent) totalSmsSent++
        }

        // ── 2. Shift ending in ~30 min ──
        const shiftEnd = SHIFT_TIMES[shift].end
        const [endH, endM] = shiftEnd.split(':').map(Number)
        const endDiff = (endH * 60 + endM) - (hour * 60 + minute)
        if (endDiff >= 20 && endDiff <= 40) {
          const msg = `Tu turno termina en 30 min. Buen trabajo!`
          const sent = await sendSms(emp.phone, msg)
          if (sent) totalSmsSent++
        }
      }

      // ── 3. Monday morning — send weekly schedule to all employees ──
      if (dayOfWeek === 1 && hour >= 8 && hour < 9) {
        for (const emp of employees) {
          if (!emp.phone) continue
          const empSched = weekSchedule[emp.id] || {}
          const lines: string[] = []
          for (let d = 0; d < 7; d++) {
            const shift = empSched[d]
            if (shift && SHIFT_TIMES[shift]) {
              lines.push(`${DAYS_FULL[d]}: ${SHIFT_TIMES[shift].start}-${SHIFT_TIMES[shift].end}`)
            } else {
              lines.push(`${DAYS_FULL[d]}: Libre`)
            }
          }
          const msg = `${tenant.name} - Tu horario esta semana:\n${lines.join('\n')}`
          const sent = await sendSms(emp.phone, msg)
          if (sent) totalSmsSent++
        }
      }

      // ── 4. Inventory low-stock alert to owner (only during business hours) ──
      const { data: lowStockItems } = await admin.from('inventory_items')
        .select('name, current_stock, min_stock')
        .eq('tenant_id', tenant.id)
        .eq('active', true)

      const lowItems = (lowStockItems || []).filter(
        (i: any) => i.current_stock <= i.min_stock
      )

      if (lowItems.length > 0) {
        // Get owner profile phone
        const { data: ownerProfile } = await admin.from('profiles')
          .select('phone')
          .eq('tenant_id', tenant.id)
          .eq('role', 'owner')
          .maybeSingle()

        if (ownerProfile?.phone) {
          // Only send once a day (check hour = business open hour or 9am)
          if (hour >= 9 && hour < 10) {
            const itemNames = lowItems.slice(0, 5).map((i: any) => i.name).join(', ')
            const msg = `Revisar inventario: ${itemNames}${lowItems.length > 5 ? ` (+${lowItems.length - 5} mas)` : ''} stock bajo`
            const sent = await sendSms(ownerProfile.phone, msg)
            if (sent) totalSmsSent++
          }
        }
      }
    }

    logger.info('cron:staff-reminders completed', { tenantsProcessed, totalSmsSent })
    return NextResponse.json({
      ok: true,
      tenants_processed: tenantsProcessed,
      sms_sent: totalSmsSent,
    })
  } catch (e: any) {
    logger.error('cron:staff-reminders failed', {}, e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
