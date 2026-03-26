/**
 * GET /api/cron/check-reminders
 * Runs every 15 minutes. Sends all due reminders (30min, custom intervals).
 */
import { NextResponse } from 'next/server'
import { sendDueReminders } from '@/lib/reminder-engine'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: 'not configured' }, { status: 503 })
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const result = await sendDueReminders()
  return NextResponse.json({ ok: true, ...result })
}
