import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/sms/send
 * Sends an SMS to a customer via Twilio.
 * Used for: reservation confirmations, reminders, order updates.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const { to, message, type } = await req.json()
    if (!to || !message) return NextResponse.json({ error: 'to and message required' }, { status: 400 })

    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const fromNumber = process.env.TWILIO_SMS_NUMBER || process.env.TWILIO_PHONE_NUMBER

    if (!accountSid || !authToken || !fromNumber) {
      // SMS not configured — silently succeed (don't break the flow)
      return NextResponse.json({ ok: true, sent: false, reason: 'SMS not configured' })
    }

    const twilioAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${twilioAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: fromNumber,
        To: to,
        Body: message,
      }).toString(),
    })

    const data = await res.json()
    if (res.ok) {
      return NextResponse.json({ ok: true, sent: true, sid: data.sid })
    } else {
      return NextResponse.json({ ok: true, sent: false, reason: data.message || 'SMS failed' })
    }
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
