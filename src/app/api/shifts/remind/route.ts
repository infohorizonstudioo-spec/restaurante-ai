/**
 * GET /api/shifts/remind
 * Cron job — runs every hour.
 * 1) Sends SMS to employees whose shift starts in ~1 hour.
 * 2) Sends SMS to employees whose shift ends in ~15 minutes.
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

export async function GET(req: Request) {
  const rl = rateLimitByIp(req, RATE_LIMITS.cron, 'cron:shift-remind')
  if (rl.blocked) return rl.response

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: 'not configured' }, { status: 503 })
  const authHeader = req.headers.get('authorization') || ''
  const expectedHeader = `Bearer ${cronSecret}`
  const a = Buffer.from(authHeader)
  const b = Buffer.from(expectedHeader)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    logger.security('Cron shift-remind: unauthorized attempt')
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()

  // Build time strings to match shifts starting in ~1 hour window
  // e.g., if it's 8:00, look for shifts starting between 8:45 and 9:15
  const inOneHourMin = `${String(currentHour + 1).padStart(2, '0')}:00`
  const inOneHourMax = `${String(currentHour + 1).padStart(2, '0')}:15`

  // For ending shifts: look for shifts ending in ~15 minutes
  const endingSoonMin = `${String(currentHour).padStart(2, '0')}:${String(currentMinute + 10).padStart(2, '0')}`
  const endingSoonMax = `${String(currentHour).padStart(2, '0')}:${String(currentMinute + 25).padStart(2, '0')}`

  let startReminders = 0
  let endReminders = 0

  try {
    // 1) Find shifts starting in ~1 hour that haven't been reminded yet
    const { data: upcomingShifts } = await admin.from('employee_shifts')
      .select('id, tenant_id, employee_id, start_time, employees!inner(name, phone)')
      .eq('date', todayStr)
      .in('status', ['scheduled', 'confirmed'])
      .gte('start_time', inOneHourMin)
      .lte('start_time', inOneHourMax)

    if (upcomingShifts && upcomingShifts.length > 0) {
      // Get tenant names in bulk
      const tenantIds = [...new Set(upcomingShifts.map((s: any) => s.tenant_id))]
      const { data: tenants } = await admin.from('tenants')
        .select('id, name').in('id', tenantIds)
      const tenantMap: Record<string, string> = {}
      for (const t of tenants || []) tenantMap[t.id] = t.name

      for (const shift of upcomingShifts) {
        const emp = shift.employees as any
        if (!emp?.phone) continue

        const businessName = tenantMap[shift.tenant_id] || 'tu negocio'
        const message = `Recuerda que entras a las ${shift.start_time} en ${businessName}. Hasta luego!`

        await sendSms(emp.phone, message)
        startReminders++
      }
    }

    // 2) Find shifts ending in ~15 minutes
    const { data: endingShifts } = await admin.from('employee_shifts')
      .select('id, tenant_id, employee_id, end_time, employees!inner(name, phone)')
      .eq('date', todayStr)
      .eq('status', 'started')
      .gte('end_time', endingSoonMin)
      .lte('end_time', endingSoonMax)

    if (endingShifts && endingShifts.length > 0) {
      const tenantIds = [...new Set(endingShifts.map((s: any) => s.tenant_id))]
      const { data: tenants } = await admin.from('tenants')
        .select('id, name').in('id', tenantIds)
      const tenantMap: Record<string, string> = {}
      for (const t of tenants || []) tenantMap[t.id] = t.name

      for (const shift of endingShifts) {
        const emp = shift.employees as any
        if (!emp?.phone) continue

        const businessName = tenantMap[shift.tenant_id] || 'tu negocio'
        const message = `Tu turno termina a las ${shift.end_time}. Buen trabajo!`

        await sendSms(emp.phone, message)
        endReminders++
      }
    }

    logger.info('cron:shift-remind completed', { startReminders, endReminders, date: todayStr })
    return NextResponse.json({
      ok: true,
      date: todayStr,
      start_reminders: startReminders,
      end_reminders: endReminders,
    })
  } catch (e: any) {
    logger.error('cron:shift-remind failed', {}, e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Send SMS directly via Twilio (same pattern as /api/sms/send).
 * We call Twilio directly here since cron doesn't have a user auth token.
 */
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
