import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const country = searchParams.get('country') || 'ES'
  
  if (!TWILIO_SID || !TWILIO_TOKEN) {
    return NextResponse.json({ error: 'Twilio not configured' }, { status: 503 })
  }

  try {
    const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')
    const r = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/AvailablePhoneNumbers/${country}/Local.json?VoiceEnabled=true&SmsEnabled=true&Limit=5`,
      { headers: { 'Authorization': `Basic ${auth}` } }
    )
    const d = await r.json()
    return NextResponse.json({ numbers: d.available_phone_numbers || [] })
  } catch(e: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const auth = await requireAuth(req)
  if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { phoneNumber, tenantId } = await req.json()

  if (!TWILIO_SID || !TWILIO_TOKEN) {
    return NextResponse.json({ error: 'Twilio not configured' }, { status: 503 })
  }

  try {
    const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')
    // VoiceUrl → nuestro endpoint contesta sin ring y conecta a ElevenLabs
    // StatusCallback → nuestro post-call para guardar resultado
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.get('host')}`
    const body = new URLSearchParams({
      PhoneNumber: phoneNumber,
      VoiceUrl: `${appUrl}/api/voice/inbound`,
      VoiceMethod: 'POST',
      StatusCallback: `${appUrl}/api/voice/post-call`,
      StatusCallbackMethod: 'POST',
      StatusCallbackEvent: 'completed',
      FriendlyName: `Reservo.AI - ${tenantId}`
    })
    
    const r = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/IncomingPhoneNumbers.json`,
      { method: 'POST', headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body }
    )
    const d = await r.json()
    return NextResponse.json({ success: true, number: d.phone_number, sid: d.sid })
  } catch(e: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}