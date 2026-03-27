/**
 * GET /api/cron/send-reminders
 * Runs daily. Sends all due reminders using the reminder engine.
 * Also schedules reminders for tomorrow's reservations that don't have them yet.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendDueReminders, scheduleReminders } from '@/lib/reminder-engine'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { timingSafeEqual } from 'crypto'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const rl = rateLimitByIp(req, RATE_LIMITS.cron, 'cron:send-reminders')
  if (rl.blocked) return rl.response

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: 'not configured' }, { status: 503 })
  const authHeader = req.headers.get('authorization') || ''
  const expectedHeader = `Bearer ${cronSecret}`
  const a = Buffer.from(authHeader)
  const b = Buffer.from(expectedHeader)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    logger.security('Cron send-reminders: unauthorized attempt')
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // 1. Send all due reminders
  const result = await sendDueReminders()

  // 2. Auto-schedule reminders for tomorrow's reservations that don't have any yet
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().slice(0, 10)

  const { data: reservations } = await admin.from('reservations')
    .select('id')
    .eq('date', tomorrowStr)
    .in('status', ['confirmada', 'confirmed'])
    .not('customer_phone', 'is', null)

  let scheduled = 0
  if (reservations) {
    for (const r of reservations) {
      // Check if reminder already exists
      const { data: existing } = await admin.from('scheduled_reminders')
        .select('id').eq('reservation_id', r.id).limit(1).maybeSingle()

      if (!existing) {
        await scheduleReminders(r.id)
        scheduled++
      }
    }
  }

  return NextResponse.json({
    ok: true,
    ...result,
    newly_scheduled: scheduled,
    date: tomorrowStr,
  })
}
