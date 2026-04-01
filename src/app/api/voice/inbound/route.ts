/**
 * RESERVO.AI — Inbound Voice Handler
 *
 * Twilio llama aquí cuando entra una llamada.
 * Registra la llamada en Retell via create-web-call, obtiene el access_token,
 * y conecta Twilio al WebSocket de Retell via <Connect><Stream>.
 */
import { NextResponse } from 'next/server'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

const RETELL_API_KEY = process.env.RETELL_API_KEY || ''

export async function POST(req: Request) {
  const rl = rateLimitByIp(req, RATE_LIMITS.webhook, 'voice:inbound')
  if (rl.blocked) return rl.response

  try {
    const body = await req.text()
    const params = new URLSearchParams(body)
    const callerPhone = params.get('From') || ''
    const calledNumber = params.get('To') || ''
    const callSid = params.get('CallSid') || ''

    logger.info('Inbound call received', { callSid, from: callerPhone, to: calledNumber })

    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const cleanNumber = calledNumber.replace(/\s/g, '')
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id,el_agent_id,retell_agent_id,agent_name,name')
      .or(`agent_phone.eq.${cleanNumber},agent_phone.eq.${cleanNumber.replace('+', '')}`)
      .maybeSingle()

    // ElevenLabs tiene soporte nativo Twilio via ConversationRelay.
    // Retell requiere SIP trunking (plan Twilio de pago).
    // Priorizamos ElevenLabs para compatibilidad con Twilio free/standard.
    const elAgentId = tenant?.el_agent_id || process.env.ELEVENLABS_AGENT_ID || ''
    const retellAgentId = tenant?.retell_agent_id || ''

    if (!elAgentId && !retellAgentId) {
      return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="es-ES" voice="Polly.Lucia">Lo sentimos, este número no tiene un agente configurado.</Say>
  <Hangup/>
</Response>`, { headers: { 'Content-Type': 'text/xml' } })
    }

    // Register call in DB (idempotent — skip if call_sid already exists from Twilio retry)
    if (tenant?.id && callSid) {
      const { data: existing } = await supabase.from('calls')
        .select('id').eq('call_sid', callSid).maybeSingle()
      if (!existing) {
        await supabase.from('calls').insert({
          tenant_id: tenant.id,
          call_sid: callSid,
          caller_phone: callerPhone,
          status: 'activa',
          intent: 'pendiente',
          started_at: new Date().toISOString(),
          source: retellAgentId ? 'retell' : 'elevenlabs',
        })
      }
    }

    let twiml: string

    if (elAgentId) {
      // ── ELEVENLABS — soporte nativo Twilio via ConversationRelay ──
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <ConversationRelay url="wss://api.elevenlabs.io/v1/convai/twilio/audio" dtmfDetection="true">
      <Parameter name="agent_id" value="${elAgentId}" />
    </ConversationRelay>
  </Connect>
</Response>`
    } else if (retellAgentId) {
      // ── RETELL AI — requiere SIP trunking en Twilio ──
      const sipUri = `sip:${calledNumber.replace('+', '')}@sip.retellai.com`
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${callerPhone}" timeout="30">
    <Sip>${sipUri}</Sip>
  </Dial>
</Response>`
    } else {
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="es-ES">Lo sentimos, no hay agente configurado.</Say>
  <Hangup/>
</Response>`
    }

    logger.info('Inbound call routed', {
      callSid,
      engine: retellAgentId ? 'retell' : 'elevenlabs',
      tenantId: tenant?.id,
    })

    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    })
  } catch (err) {
    logger.error('Inbound voice error', {}, err)
    return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="es-ES">Perdona, ha habido un problemilla técnico. Inténtalo en un momento.</Say>
  <Hangup/>
</Response>`, { headers: { 'Content-Type': 'text/xml' } })
  }
}
