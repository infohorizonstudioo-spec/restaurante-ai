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

    const retellAgentId = tenant?.retell_agent_id || ''
    const elAgentId = tenant?.el_agent_id || process.env.ELEVENLABS_AGENT_ID || ''

    if (!retellAgentId && !elAgentId) {
      return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="es-ES" voice="Polly.Lucia">Lo sentimos, este número no tiene un agente configurado.</Say>
  <Hangup/>
</Response>`, { headers: { 'Content-Type': 'text/xml' } })
    }

    // Register call in DB
    if (tenant?.id) {
      void supabase.from('calls').insert({
        tenant_id: tenant.id,
        call_sid: callSid,
        caller_phone: callerPhone,
        status: 'activa',
        intent: 'pendiente',
        started_at: new Date().toISOString(),
        source: retellAgentId ? 'retell' : 'elevenlabs',
      })
    }

    let twiml: string

    if (retellAgentId) {
      // ── RETELL AI ──
      // Register a web call to get the WebSocket access
      const retellRes = await fetch('https://api.retellai.com/v2/create-web-call', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RETELL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agent_id: retellAgentId,
          metadata: {
            tenant_id: tenant?.id || '',
            caller_phone: callerPhone,
            call_sid: callSid,
            twilio_call: true,
          },
        }),
      })

      if (!retellRes.ok) {
        logger.error('Retell create-web-call failed', { status: retellRes.status })
        // Fallback to ElevenLabs if available
        if (elAgentId) {
          twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <ConversationRelay url="wss://api.elevenlabs.io/v1/convai/twilio/audio" dtmfDetection="true">
      <Parameter name="agent_id" value="${elAgentId}" />
    </ConversationRelay>
  </Connect>
</Response>`
        } else {
          twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="es-ES">Perdona, hay un problemilla técnico. Llama en un momento.</Say>
  <Hangup/>
</Response>`
        }
      } else {
        const retellData = await retellRes.json()
        const wsUrl = `wss://api.retellai.com/audio-websocket/${retellData.call_id}`

        twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}">
      <Parameter name="caller_phone" value="${callerPhone}" />
      <Parameter name="call_sid" value="${callSid}" />
    </Stream>
  </Connect>
</Response>`
      }
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
    return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="es-ES">Perdona, ha habido un problemilla técnico. Inténtalo en un momento.</Say>
  <Hangup/>
</Response>`, { headers: { 'Content-Type': 'text/xml' } })
  }
}
