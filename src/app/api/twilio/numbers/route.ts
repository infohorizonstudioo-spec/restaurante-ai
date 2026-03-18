import { NextResponse } from 'next/server'

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
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const { phoneNumber, tenantId } = await req.json()
  
  if (!TWILIO_SID || !TWILIO_TOKEN) {
    return NextResponse.json({ error: 'Twilio not configured' }, { status: 503 })
  }

  try {
    const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')
    // VoiceUrl → ElevenLabs gestiona la llamada
    // StatusCallback → nuestro post-call para guardar resultado
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.get('host')}`
    const body = new URLSearchParams({
      PhoneNumber: phoneNumber,
      VoiceUrl: 'https://api.us.elevenlabs.io/twilio/inbound_call',
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
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}