/**
 * RESERVO.AI — Llamada saliente via Twilio → Retell SIP
 *
 * Twilio llama al cliente. Cuando contesta, conecta via SIP
 * con Retell para que el agente IA real maneje la conversación.
 */
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || ''
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN || ''

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: Request) {
  const rl = rateLimitByIp(req, RATE_LIMITS.api, 'voice:outbound')
  if (rl.blocked) return rl.response

  try {
    const body = await req.json()
    const phone = body.phone || body.phone_number
    const tenantId = body.tenant_id
    const callType = body.call_type || 'callback'
    const customerName = body.customer_name || ''

    if (!tenantId || !phone) {
      return NextResponse.json({ error: 'tenant_id y phone requeridos' }, { status: 400 })
    }

    // Auth
    const apiKey = req.headers.get('x-agent-key') || req.headers.get('x_agent_key')
    if (apiKey !== process.env.AGENT_API_KEY) {
      const auth = await requireAuth(req)
      if (!auth.ok || auth.tenantId !== tenantId) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
    }

    const { data: tenant } = await supabase.from('tenants')
      .select('id,name,agent_phone,retell_agent_id')
      .eq('id', tenantId).single()

    if (!tenant?.agent_phone) {
      return NextResponse.json({ error: 'Sin numero configurado' }, { status: 400 })
    }

    // Build TwiML: Twilio calls customer, then connects to Retell via SIP
    const sipUri = `sip:${tenant.agent_phone.replace('+', '')}@sip.retellai.com`
    const twiml = `<Response><Dial callerId="${tenant.agent_phone}" timeout="30"><Sip>${sipUri}</Sip></Dial></Response>`

    // Create outbound call via Twilio
    const auth64 = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')
    const params = new URLSearchParams({
      To: phone,
      From: tenant.agent_phone,
      Twiml: twiml,
    })

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Calls.json`, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth64}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
    const data = await res.json()

    if (!data.sid) {
      logger.error('Outbound call failed', { error: data.message })
      return NextResponse.json({ error: data.message || 'Error al llamar' }, { status: 500 })
    }

    await supabase.from('calls').insert({
      tenant_id: tenantId,
      call_sid: data.sid,
      caller_phone: phone,
      status: 'activa',
      intent: callType === 'callback' ? 'devuelta' : 'saliente',
      summary: callType === 'callback' ? `Devolviendo llamada a ${customerName || phone}` : `Llamada a ${customerName || phone}`,
      started_at: new Date().toISOString(),
      source: 'retell',
    })

    return NextResponse.json({ success: true, call_sid: data.sid })
  } catch (err: any) {
    logger.error('Outbound error', {}, err)
    return NextResponse.json({ error: 'Error al iniciar llamada' }, { status: 500 })
  }
}
