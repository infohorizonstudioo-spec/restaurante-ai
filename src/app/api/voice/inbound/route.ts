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
      // 1. Registrar la llamada en Retell para obtener call_id
      // 2. Usar call_id en el WebSocket Stream de Twilio
      const { registerInboundCall } = await import('@/lib/retell')
      const retellCall = await registerInboundCall({
        agent_id: retellAgentId,
        from_number: callerPhone,
        to_number: calledNumber,
        metadata: { tenant_id: tenant?.id || '', call_sid: callSid },
      })

      const retellWsUrl = `wss://api.retellai.com/audio-websocket/${retellCall.call_id}`
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${retellWsUrl}">
      <Parameter name="caller_phone" value="${callerPhone}" />
      <Parameter name="call_sid" value="${callSid}" />
    </Stream>
  </Connect>
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
