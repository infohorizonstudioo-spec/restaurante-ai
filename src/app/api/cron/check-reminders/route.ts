/**
 * GET /api/cron/check-reminders
 * Runs every 15 minutes. Sends all due reminders (30min, custom intervals).
 */
import { NextResponse } from 'next/server'
import { sendDueReminders } from '@/lib/reminder-engine'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { timingSafeEqual } from 'crypto'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const rl = rateLimitByIp(req, RATE_LIMITS.cron, 'cron:check-reminders')
  if (rl.blocked) return rl.response

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: 'not configured' }, { status: 503 })
  const authHeader = req.headers.get('authorization') || ''
  const expectedHeader = `Bearer ${cronSecret}`
  const a = Buffer.from(authHeader)
  const b = Buffer.from(expectedHeader)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    logger.security('Cron check-reminders: unauthorized attempt')
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const result = await sendDueReminders()
  return NextResponse.json({ ok: true, ...result })
}
