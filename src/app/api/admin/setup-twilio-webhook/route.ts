import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/api-auth'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

const adminDb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: Request) {
  const rl = rateLimitByIp(req, RATE_LIMITS.admin, 'admin:setup-twilio-webhook')
  if (rl.blocked) return rl.response

  const authResult = await requireAuth(req)
  if (!authResult.ok) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // SEGURIDAD: verificar que es superadmin
  const { data: profile } = await adminDb.from('profiles').select('role').eq('id', authResult.userId!).maybeSingle()
  if ((profile as any)?.role !== 'superadmin') {
    logger.security('Unauthorized setup-twilio-webhook attempt', { userId: authResult.userId })
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const SID = process.env.TWILIO_ACCOUNT_SID
  const TOKEN = process.env.TWILIO_AUTH_TOKEN
  const PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL

  if (!SID || !TOKEN) {
    return NextResponse.json({ error: 'TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not set' }, { status: 503 })
  }
  if (!PHONE_NUMBER) {
    return NextResponse.json({ error: 'TWILIO_PHONE_NUMBER not set' }, { status: 503 })
  }
  if (!APP_URL) {
    return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL not set' }, { status: 503 })
  }

  const WEBHOOK_URL = `${APP_URL}/api/voice/inbound`

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

    logger.info('Admin: Twilio webhook updated', { phoneSid, newUrl: WEBHOOK_URL })
    return NextResponse.json({
      success: updateResp.ok,
      phone_sid: phoneSid,
      old_voice_url: currentUrl,
      new_voice_url: updateData.voice_url,
    })
  } catch (e: any) {
    logger.error('Admin setup-twilio-webhook: error', {}, e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
