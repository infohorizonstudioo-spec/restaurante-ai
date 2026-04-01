import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { summarizeDay } from '@/lib/summary-engine'
import { getBusinessRecommendations } from '@/lib/intelligence-engine'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { timingSafeEqual } from 'crypto'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/daily-summary
 * Generates structured daily summaries and sends SMS to each business owner.
 */
export async function GET(req: Request) {
  const rl = rateLimitByIp(req, RATE_LIMITS.cron, 'cron:daily-summary')
  if (rl.blocked) return rl.response

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: 'not configured' }, { status: 503 })
  const authHeader = req.headers.get('authorization') || ''
  const expectedHeader = `Bearer ${cronSecret}`
  const a = Buffer.from(authHeader)
  const b = Buffer.from(expectedHeader)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    logger.security('Cron daily-summary: unauthorized attempt')
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_SMS_NUMBER || process.env.TWILIO_PHONE_NUMBER

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yStr = yesterday.toISOString().slice(0, 10)

  // Get all active tenants
  const { data: tenants } = await admin.from('tenants')
    .select('id, name, phone, agent_phone')
    .eq('active', true)

  if (!tenants || tenants.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 })
  }

  let sent = 0
  const summaries: string[] = []

  for (const t of tenants) {
    // Generate structured summary
    const summary = await summarizeDay(t.id, yStr)
    if (!summary || summary.total_conversations === 0) {
      summaries.push(`${t.name}: no activity`)
      continue
    }

    summaries.push(`${t.name}: ${summary.total_conversations} interactions`)

    // Send SMS if configured
    const ownerPhone = t.phone || t.agent_phone
    if (!ownerPhone || !accountSid || !authToken || !fromNumber) continue

    const dateStr = yesterday.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

    // Build rich SMS from structured summary
    let msg = `${t.name} — ${dateStr}:\n`

    // Channel breakdown
    const channels = Object.entries(summary.channel_breakdown)
    for (const [ch, data] of channels) {
      const chName = ch === 'voice' ? 'Llamadas' : ch === 'whatsapp' ? 'WhatsApp' : ch === 'email' ? 'Email' : 'SMS'
      msg += `${chName}: ${data.count}`
      if (data.escalated > 0) msg += ` (${data.escalated} escaladas)`
      msg += '\n'
    }

    // Highlights
    for (const h of summary.highlights.slice(0, 2)) {
      const icon = h.type === 'positive' ? '+' : h.type === 'warning' ? '!' : '-'
      msg += `${icon} ${h.title}\n`
    }

    // Pending actions
    if (summary.pending_actions.length > 0) {
      msg += `Pendiente: ${summary.pending_actions[0]}\n`
    }

    // Business recommendations from intelligence engine
    try {
      const recommendations = await getBusinessRecommendations(t.id)
      const topRec = (recommendations || []).filter(r => r.priority >= 4).slice(0, 1)
      for (const rec of topRec) {
        msg += `💡 ${rec.title}\n`
      }
    } catch {} // non-blocking

    msg = msg.slice(0, 320) // SMS limit with concatenation
    msg += `\nPanel: ${process.env.NEXT_PUBLIC_APP_URL || 'https://reservo.ai'}/panel`

    try {
      const twilioAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: 'POST',
        headers: { 'Authorization': `Basic ${twilioAuth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ From: fromNumber, To: ownerPhone, Body: msg }).toString(),
      })
      if (res.ok) sent++
    } catch {}
  }

  return NextResponse.json({ ok: true, sent, tenants: tenants.length, summaries })
}
