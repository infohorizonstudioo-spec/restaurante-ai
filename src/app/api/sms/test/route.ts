import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/sms/test — Test endpoint to verify Twilio SMS works.
 * TEMPORARY — remove after testing.
 */
export async function GET() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_SMS_NUMBER || process.env.TWILIO_PHONE_NUMBER

  if (!accountSid || !authToken) {
    return NextResponse.json({ error: 'TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not set', configured: false })
  }
  if (!fromNumber) {
    return NextResponse.json({ error: 'TWILIO_SMS_NUMBER not set', sid: accountSid.slice(0, 8) + '...', configured: false })
  }

  // Send test SMS
  const twilioAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${twilioAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: fromNumber,
        To: '+34619781190',
        Body: '✅ Test SMS desde Reservo.AI — Si recibes esto, los SMS de confirmación de reservas funcionan correctamente.',
      }).toString(),
    })

    const data = await res.json()
    if (res.ok) {
      return NextResponse.json({ ok: true, sent: true, sid: data.sid, from: fromNumber })
    } else {
      return NextResponse.json({ ok: false, sent: false, error: data.message, code: data.code, from: fromNumber })
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message })
  }
}
