import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/daily-summary
 * Sends a daily activity summary SMS to each business owner at 9:00 AM.
 */
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: 'not configured' }, { status: 503 })
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_SMS_NUMBER || process.env.TWILIO_PHONE_NUMBER
  if (!accountSid || !authToken || !fromNumber) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'SMS not configured' })
  }

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yStr = yesterday.toISOString().slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)

  // Get all active tenants with phone numbers
  const { data: tenants } = await admin.from('tenants')
    .select('id, name, phone, agent_phone')
    .eq('active', true)

  if (!tenants || tenants.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 })
  }

  const twilioAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
  let sent = 0

  for (const t of tenants) {
    const ownerPhone = t.phone || t.agent_phone
    if (!ownerPhone) continue

    // Get yesterday's stats
    const [callsRes, reservasRes, ordersRes] = await Promise.all([
      admin.from('calls').select('id', { count: 'exact', head: true })
        .eq('tenant_id', t.id).gte('started_at', yStr + 'T00:00:00').lt('started_at', today + 'T00:00:00'),
      admin.from('reservations').select('id,people', { count: 'exact' })
        .eq('tenant_id', t.id).eq('date', yStr).in('status', ['confirmada', 'confirmed']),
      admin.from('order_events').select('id,total_estimate', { count: 'exact' })
        .eq('tenant_id', t.id).eq('status', 'confirmed')
        .gte('created_at', yStr + 'T00:00:00').lt('created_at', today + 'T00:00:00'),
    ])

    const calls = callsRes.count || 0
    const reservas = reservasRes.count || 0
    const personas = (reservasRes.data || []).reduce((s: number, r: any) => s + (r.people || 1), 0)
    const pedidos = ordersRes.count || 0
    const ingresos = (ordersRes.data || []).reduce((s: number, o: any) => s + (o.total_estimate || 0), 0)

    // Only send if there was activity
    if (calls === 0 && reservas === 0 && pedidos === 0) continue

    const dateStr = yesterday.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
    let msg = `📊 ${t.name} — Resumen del ${dateStr}:\n`
    if (calls > 0) msg += `📞 ${calls} llamada${calls !== 1 ? 's' : ''}\n`
    if (reservas > 0) msg += `📅 ${reservas} reserva${reservas !== 1 ? 's' : ''} (${personas} personas)\n`
    if (pedidos > 0) msg += `🛍️ ${pedidos} pedido${pedidos !== 1 ? 's' : ''} (${ingresos.toFixed(0)}€)\n`
    msg += `\nVe al panel: https://restaurante-ai.vercel.app/panel`

    try {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: 'POST',
        headers: { 'Authorization': `Basic ${twilioAuth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ From: fromNumber, To: ownerPhone, Body: msg }).toString(),
      })
      if (res.ok) sent++
    } catch {}
  }

  return NextResponse.json({ ok: true, sent, tenants: tenants.length })
}
