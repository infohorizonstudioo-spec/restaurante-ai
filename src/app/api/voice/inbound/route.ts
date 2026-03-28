/**
 * RESERVO.AI — Inbound Voice Handler
 *
 * Twilio llama aquí cuando entra una llamada.
 * Soporta DOS motores de voz:
 * - Retell AI (preferido) → usa retell_agent_id
 * - ElevenLabs (legacy) → usa el_agent_id
 *
 * Descuelga INMEDIATAMENTE sin ring.
 */
import { NextResponse } from 'next/server'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

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

    // Limpiar número para buscar en DB
    const cleanNumber = calledNumber.replace(/\s/g, '')
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id,el_agent_id,retell_agent_id,agent_name,name')
      .or(`agent_phone.eq.${cleanNumber},agent_phone.eq.${cleanNumber.replace('+', '')}`)
      .maybeSingle()

    // Preferir Retell sobre ElevenLabs
    const retellAgentId = tenant?.retell_agent_id || ''
    const elAgentId = tenant?.el_agent_id || process.env.ELEVENLABS_AGENT_ID || ''

    if (!retellAgentId && !elAgentId) {
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="es-ES" voice="Polly.Lucia">Lo sentimos, este número no tiene un agente configurado. Por favor, inténtelo más tarde.</Say>
  <Hangup/>
</Response>`
      return new NextResponse(twiml, {
        headers: { 'Content-Type': 'text/xml' },
      })
    }

    // Registrar la llamada en DB
    if (tenant?.id) {
      void supabase.from('calls').insert({
        tenant_id: tenant.id,
        call_sid: callSid,
        caller_phone: callerPhone,
        status: 'activa',
        intent: 'pendiente',
        started_at: new Date().toISOString(),
        session_state: 'escuchando',
        source: retellAgentId ? 'retell' : 'elevenlabs',
      })
    }

    let twiml: string

    if (retellAgentId) {
      // ── RETELL AI ──
      // Retell maneja inbound calls vía SIP trunking nativo.
      // Twilio debe reenviar la llamada a Retell vía SIP.
      // Retell ya tiene el número importado y sabe qué agente usar.
      const sipUri = `sip:${calledNumber.replace('+', '')}@5t4n6j0wnrl.sip.livekit.cloud`
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${callerPhone}">
    <Sip>${sipUri}</Sip>
  </Dial>
</Response>`
    } else {
      // ── ELEVENLABS (legacy) ──
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <ConversationRelay url="wss://api.elevenlabs.io/v1/convai/twilio/audio" dtmfDetection="true">
      <Parameter name="agent_id" value="${elAgentId}" />
    </ConversationRelay>
  </Connect>
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
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="es-ES">Perdona, ha habido un problemilla técnico. Inténtalo en un momento.</Say>
  <Hangup/>
</Response>`
    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'text/xml' },
    })
  }
}
