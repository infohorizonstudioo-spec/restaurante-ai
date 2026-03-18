import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function analyzeWithClaude(transcript: string): Promise<any> {
  try {
    if (!process.env.ANTHROPIC_API_KEY || transcript.length < 20) {
      return { intent: 'consulta', customer_name: null, summary: 'Llamada breve', outcome: 'completado' }
    }
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5', max_tokens: 300,
      system: 'Eres un analizador de llamadas. Responde SOLO JSON sin markdown.',
      messages: [{ role: 'user', content:
        'Analiza y responde solo JSON:\n{"intent":"reserva|pedido|consulta|cancelacion|otro","customer_name":"nombre o null","summary":"1-2 frases español","outcome":"completado|pendiente|fallido"}\n\nTranscripcion:\n'+transcript
      }]
    })
    const txt = msg.content[0].type === 'text' ? msg.content[0].text.replace(/```json|```/g,'').trim() : '{}'
    return JSON.parse(txt)
  } catch(e) {
    return { intent: 'otro', customer_name: null, summary: 'Llamada procesada', outcome: 'completado' }
  }
}

// Obtener transcripción de ElevenLabs usando el CallSid
async function getTranscript(callSid: string, tenantId: string): Promise<string> {
  try {
    // Buscar en calls por call_sid para obtener conversation_id
    const { data: call } = await admin.from('calls')
      .select('transcript,conversation_id').eq('call_sid', callSid).maybeSingle()
    if (call?.transcript) return call.transcript

    // Si hay conversation_id, pedir a ElevenLabs
    if (call?.conversation_id) {
      const r = await fetch('https://api.us.elevenlabs.io/v1/convai/conversations/'+call.conversation_id, {
        headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY || 'sk_0e8a74a121e33004d59cf4695d4abdd637d787ad9fabf21c' }
      })
      if (r.ok) {
        const d = await r.json()
        const lines = (d.transcript || []).map((m: any) =>
          (m.role === 'agent' ? 'Sofia' : 'Cliente') + ': ' + m.message
        ).join('\n')
        return lines
      }
    }

    // Intentar buscar por conversation en ElevenLabs via phone call_sid
    const cr = await fetch('https://api.us.elevenlabs.io/v1/convai/conversations?page_size=20', {
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY || 'sk_0e8a74a121e33004d59cf4695d4abdd637d787ad9fabf21c' }
    })
    if (cr.ok) {
      const cd = await cr.json()
      const conv = (cd.conversations || []).find((c: any) =>
        c.metadata?.phone_call?.call_sid === callSid
      )
      if (conv) {
        const dr = await fetch('https://api.us.elevenlabs.io/v1/convai/conversations/'+conv.conversation_id, {
          headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY || 'sk_0e8a74a121e33004d59cf4695d4abdd637d787ad9fabf21c' }
        })
        if (dr.ok) {
          const dd = await dr.json()
          return (dd.transcript || []).map((m: any) =>
            (m.role === 'agent' ? 'Sofia' : 'Cliente') + ': ' + m.message
          ).join('\n')
        }
      }
    }
    return ''
  } catch(e) { return '' }
}

// Handler Twilio status_callback
export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || ''
    let body: any = {}

    if (contentType.includes('application/json')) {
      body = await req.json().catch(() => ({}))
    } else {
      // Twilio manda application/x-www-form-urlencoded
      const text = await req.text()
      const params = new URLSearchParams(text)
      params.forEach((v, k) => { body[k] = v })
    }

    // Extraer campos — soporta tanto Twilio como ElevenLabs post-call
    const callSid     = body.CallSid     || body.call_sid     || body.conversation_id || ''
    const callStatus  = body.CallStatus  || body.status       || 'completed'
    const duration    = parseInt(body.CallDuration || body.duration_seconds || body.Duration || '0')
    const callerPhone = body.From        || body.caller_phone || body.phone_call?.external_number || ''
    const agentPhone  = body.To          || body.agent_phone  || body.phone_call?.agent_number    || ''
    const convId      = body.conversation_id || ''

    console.log('post-call:', callSid, '|', callStatus, '|', duration+'s', '|', callerPhone, '->', agentPhone)

    // Solo procesar llamadas completadas
    if (!['completed','done','ended'].includes(callStatus.toLowerCase())) {
      return NextResponse.json({ ok: true, skipped: 'status:'+callStatus })
    }
    if (!callSid && !callerPhone) {
      return NextResponse.json({ ok: true, skipped: 'no identifiers' })
    }

    // Buscar tenant
    let tenantId = ''
    if (agentPhone) {
      const { data: t } = await admin.from('tenants').select('id').eq('agent_phone', agentPhone).maybeSingle()
      tenantId = t?.id || ''
    }
    if (!tenantId && callSid) {
      const { data: c } = await admin.from('calls').select('tenant_id').eq('call_sid', callSid).maybeSingle()
      tenantId = c?.tenant_id || ''
    }
    // Fallback tenant demo
    if (!tenantId) tenantId = '7be3fb2c-6da4-4129-a49d-3af1c2c45b77'

    // Obtener transcripción
    const transcript = await getTranscript(callSid, tenantId)

    // Analizar con Claude
    const analysis = await analyzeWithClaude(transcript)

    const now = new Date().toISOString()
    const key = callSid || ('call_'+Date.now())

    // Upsert llamada
    const { data: existing } = await admin.from('calls')
      .select('id,counted_for_billing').eq('call_sid', key).maybeSingle()

    if (existing) {
      await admin.from('calls').update({
        status:           'completada',
        duration_seconds: duration || null,
        transcript:       transcript || null,
        summary:          analysis.summary,
        intent:           analysis.intent,
        customer_name:    analysis.customer_name || existing.customer_name,
        ended_at:         now,
        action_suggested: analysis.intent === 'reserva' ? 'Reserva gestionada' : analysis.intent,
      }).eq('id', existing.id)
    } else {
      await admin.from('calls').insert({
        tenant_id:          tenantId,
        call_sid:           key,
        conversation_id:    convId || null,
        caller_phone:       callerPhone,
        from_number:        callerPhone,
        to_number:          agentPhone,
        direction:          'inbound',
        status:             'completada',
        duration_seconds:   duration || null,
        transcript:         transcript || null,
        summary:            analysis.summary,
        intent:             analysis.intent,
        customer_name:      analysis.customer_name || null,
        started_at:         now,
        ended_at:           now,
        source:             'twilio',
        counted_for_billing: false,
        action_suggested:   analysis.intent === 'reserva' ? 'Reserva gestionada' : analysis.intent,
      })
    }

    // Billing — llamadas >= 15s
    const shouldBill = (duration >= 15) && !(existing?.counted_for_billing)
    if (shouldBill) {
      try {
        await admin.rpc('process_billable_call', {
          p_tenant_id:        tenantId,
          p_call_sid:         key,
          p_duration_seconds: duration
        })
      } catch(e) { console.error('billing error:', e) }
    }

    console.log('post-call done | intent:', analysis.intent, '| billed:', shouldBill)
    return NextResponse.json({ ok: true, intent: analysis.intent, summary: analysis.summary, billed: shouldBill })
  } catch(e: any) {
    console.error('post-call error:', e.message)
    return NextResponse.json({ ok: true, error: e.message }) // siempre 200
  }
}