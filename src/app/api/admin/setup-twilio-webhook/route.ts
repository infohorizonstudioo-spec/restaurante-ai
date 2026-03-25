import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'

export async function POST(req: Request) {
  const auth = await requireAuth(req)
  if (!auth.ok) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const SID = process.env.TWILIO_ACCOUNT_SID
  const TOKEN = process.env.TWILIO_AUTH_TOKEN

  if (!SID || !TOKEN) {
    return NextResponse.json({ error: 'TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not set' }, { status: 503 })
  }

  const PHONE_NUMBER = '+12138753573'
  const WEBHOOK_URL = 'https://restaurante-ai.vercel.app/api/voice/inbound'

  try {
    const auth = Buffer.from(`${SID}:${TOKEN}`).toString('base64')
    const listResp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${SID}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(PHONE_NUMBER)}`,
      { headers: { 'Authorization': `Basic ${auth}` } }
    )
    const listData = await listResp.json()

    if (!listData.incoming_phone_numbers?.length) {
      return NextResponse.json({ error: 'Phone number not found', data: listData }, { status: 404 })
    }

    const phoneSid = listData.incoming_phone_numbers[0].sid
    const currentUrl = listData.incoming_phone_numbers[0].voice_url

    const updateResp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${SID}/IncomingPhoneNumbers/${phoneSid}.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          VoiceUrl: WEBHOOK_URL,
          VoiceMethod: 'POST',
        }).toString(),
      }
    )
    const updateData = await updateResp.json()

    return NextResponse.json({
      success: updateResp.ok,
      phone_sid: phoneSid,
      old_voice_url: currentUrl,
      new_voice_url: updateData.voice_url,
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
