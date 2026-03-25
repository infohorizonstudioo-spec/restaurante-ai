import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: 'not configured' }, { status: 503 })
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_SMS_NUMBER || process.env.TWILIO_PHONE_NUMBER
  if (!accountSid || !authToken || !fromNumber) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'SMS not configured' })
  }

  // Get tomorrow's date
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().slice(0, 10)

  // Get all confirmed reservations for tomorrow with phone numbers
  const { data: reservations } = await admin.from('reservations')
    .select('id, customer_name, customer_phone, date, time, people, tenant_id')
    .eq('date', tomorrowStr)
    .in('status', ['confirmada', 'confirmed'])
    .not('customer_phone', 'is', null)

  if (!reservations || reservations.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, date: tomorrowStr })
  }

  // Get tenant names for all unique tenant_ids
  const tenantIds = [...new Set(reservations.map(r => r.tenant_id))]
  const { data: tenants } = await admin.from('tenants')
    .select('id, name')
    .in('id', tenantIds)
  const tenantMap = new Map((tenants || []).map(t => [t.id, t.name]))

  let sent = 0
  const twilioAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

  for (const r of reservations) {
    const bizName = tenantMap.get(r.tenant_id) || 'Tu negocio'
    const time = (r.time || '').slice(0, 5)
    const message = `📅 ${bizName}: Hola ${r.customer_name || 'cliente'}, te recordamos tu reserva para mañana a las ${time}, ${r.people || 1} persona${(r.people || 1) !== 1 ? 's' : ''}. ¡Te esperamos!`

    try {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: 'POST',
        headers: { 'Authorization': `Basic ${twilioAuth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ From: fromNumber, To: r.customer_phone, Body: message }).toString(),
      })
      if (res.ok) sent++
    } catch {}
  }

  return NextResponse.json({ ok: true, sent, total: reservations.length, date: tomorrowStr })
}
