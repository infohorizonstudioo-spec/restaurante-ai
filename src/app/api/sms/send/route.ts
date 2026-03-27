import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { sanitizePhone, sanitizeString } from '@/lib/sanitize'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/sms/send
 * Sends an SMS to a customer via Twilio.
 * Used for: reservation confirmations, reminders, order updates.
 */
export async function POST(req: NextRequest) {
  try {
    const rl = rateLimitByIp(req, RATE_LIMITS.messaging, 'sms:send')
    if (rl.blocked) return rl.response

    const auth = await requireAuth(req)
    if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const body = await req.json()
    const to = sanitizePhone(body.to)
    const message = sanitizeString(body.message, 1600)
    const type = body.type
    if (!to || !message) return NextResponse.json({ error: 'to and message required' }, { status: 400 })

    logger.info('SMS send request', { tenantId: auth.tenantId, to, type })

    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const fromNumber = process.env.TWILIO_SMS_NUMBER || process.env.TWILIO_PHONE_NUMBER

    if (!accountSid || !authToken || !fromNumber) {
      // SMS not configured — silently succeed (don't break the flow)
      return NextResponse.json({ ok: true, sent: false, reason: 'SMS not configured' })
    }

    const twilioAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
    const controller = new AbortController()
    const fetchTimeout = setTimeout(() => controller.abort(), 30000)
    let res: Response
    try {
      res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${twilioAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        signal: controller.signal,
        body: new URLSearchParams({
          From: fromNumber,
          To: to,
          Body: message,
        }).toString(),
      })
    } finally {
      clearTimeout(fetchTimeout)
    }

    const data = await res.json()
    if (res.ok) {
      return NextResponse.json({ ok: true, sent: true, sid: data.sid })
    } else {
      return NextResponse.json({ ok: true, sent: false, reason: data.message || 'SMS failed' })
    }
  } catch (err) {
    logger.error('SMS send failed', {}, err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
