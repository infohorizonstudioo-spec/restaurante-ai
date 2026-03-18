import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ─────────────────────────────────────────────────────────────────────────────
// POST-CALL: procesamiento independiente por llamada.
//
// Garantías de concurrencia:
// 1. complete_call_session usa SELECT FOR UPDATE → evita doble procesamiento
//    si Twilio reintenta el webhook mientras el primero aún procesa.
// 2. process_billable_call usa SELECT ... FOR UPDATE en tenants →
//    conteo atómico aunque 10 llamadas terminen simultáneamente.
// 3. Siempre devuelve 200 → Twilio no reintenta por timeout.
// ─────────────────────────────────────────────────────────────────────────────

async function analyzeWithClaude(transcript: string): Promise<any> {
  try {
    if (!process.env.ANTHROPIC_API_KEY || transcript.length < 20) {
      return { intent: 'consulta', customer_name: null, summary: 'Llamada breve', outcome: 'completado' }
    }
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5', max_tokens: 300,
      system: 'Eres un analizador de llamadas telefónicas de negocio. Responde SOLO JSON sin markdown.',
      messages: [{ role: 'user', content:
        'Analiza esta transcripción y responde solo JSON:\n' +
        '{"intent":"reserva|pedido|consulta|cancelacion|otro","customer_name":"nombre o null","summary":"1-2 frases español","outcome":"completado|pendiente|fallido"}\n\n' +
        'Transcripcion:\n' + transcript.slice(0, 2000) // límite para haiku
      }]
    })
    const txt = msg.content[0].type === 'text'
      ? msg.content[0].text.replace(/```json|```/g,'').trim()
      : '{}'
    return JSON.parse(txt)
  } catch(e) {
    return { intent: 'otro', customer_name: null, summary: 'Llamada procesada', outcome: 'completado' }
  }
}

async function getTranscriptFromEL(callSid: string): Promise<string> {
  const elKey = process.env.ELEVENLABS_API_KEY
  if (!elKey) return ''
  try {
    const cr = await fetch('https://api.us.elevenlabs.io/v1/convai/conversations?page_size=20', {
      headers: { 'xi-api-key': elKey }
    })
    if (!cr.ok) return ''
    const cd = await cr.json()
    const conv = (cd.conversations || []).find((c: any) =>
      c.metadata?.phone_call?.call_sid === callSid ||
      c.conversation_id === callSid.replace('conv_','')
    )
    if (!conv) return ''
    const dr = await fetch('https://api.us.elevenlabs.io/v1/convai/conversations/'+conv.conversation_id, {
      headers: { 'xi-api-key': elKey }
    })
    if (!dr.ok) return ''
    const dd = await dr.json()
    return (dd.transcript || [])
      .map((m: any) => (m.role === 'agent' ? 'Sofia' : 'Cliente') + ': ' + m.message)
      .join('\n')
  } catch(e) { return '' }
}

async function getTranscript(callSid: string): Promise<string> {
  try {
    const { data: call } = await admin.from('calls')
      .select('transcript,conversation_id').eq('call_sid', callSid).maybeSingle()
    if (call?.transcript) return call.transcript
    if (call?.conversation_id) {
      const elKey = process.env.ELEVENLABS_API_KEY
      if (elKey) {
        const r = await fetch('https://api.us.elevenlabs.io/v1/convai/conversations/'+call.conversation_id, {
          headers: { 'xi-api-key': elKey }
        })
        if (r.ok) {
          const d = await r.json()
          return (d.transcript || [])
            .map((m: any) => (m.role === 'agent' ? 'Sofia' : 'Cliente') + ': ' + m.message)
            .join('\n')
        }
      }
    }
    return await getTranscriptFromEL(callSid)
  } catch(e) { return '' }
}

export async function POST(req: Request) {
  const t0 = Date.now()
  try {
    const contentType = req.headers.get('content-type') || ''
    let body: any = {}
    if (contentType.includes('application/json')) {
      body = await req.json().catch(() => ({}))
    } else {
      const text = await req.text()
      new URLSearchParams(text).forEach((v, k) => { body[k] = v })
    }

    const callSid     = body.CallSid     || body.call_sid     || body.conversation_id || ''
    const callStatus  = body.CallStatus  || body.status       || 'completed'
    const duration    = parseInt(body.CallDuration || body.duration_seconds || body.Duration || '0') || 0
    const callerPhone = body.From        || body.caller_phone || body.phone_call?.external_number || ''
    const agentPhone  = body.To          || body.agent_phone  || body.phone_call?.agent_number    || ''
    const convId      = body.conversation_id || ''

    console.log('post-call recv:', callSid.slice(0,20), '|', callStatus, '|', duration+'s')

    // Solo procesar llamadas completadas
    if (!['completed','done','ended'].includes(callStatus.toLowerCase())) {
      return NextResponse.json({ ok: true, skipped: 'status:'+callStatus })
    }
    if (!callSid && !callerPhone) {
      return NextResponse.json({ ok: true, skipped: 'no identifiers' })
    }

    // Resolver tenant — independiente por llamada
    let tenantId = ''
    if (agentPhone) {
      const { data: t } = await admin.from('tenants').select('id').eq('agent_phone', agentPhone).maybeSingle()
      tenantId = t?.id || ''
    }
    if (!tenantId && callSid) {
      const { data: c } = await admin.from('calls').select('tenant_id').eq('call_sid', callSid).maybeSingle()
      tenantId = c?.tenant_id || ''
    }
    if (!tenantId) {
      console.log('post-call: tenant not found | agent:', agentPhone, '| sid:', callSid.slice(0,20))
      return NextResponse.json({ ok: true, skipped: 'tenant not found' })
    }

    const key = callSid || ('call_'+Date.now()+'_'+Math.random().toString(36).slice(2,7))

    // Obtener transcripción (independiente por llamada — no hay estado compartido)
    const transcript = await getTranscript(key)

    // Analizar con Claude — contexto aislado de esta llamada
    const analysis = await analyzeWithClaude(transcript)

    // complete_call_session usa SELECT FOR UPDATE internamente:
    // si Twilio reintenta este webhook, el segundo intento ve que ya
    // está procesado y no duplica datos.
    const { data: sessionResult } = await admin.rpc('complete_call_session', {
      p_call_sid:      key,
      p_tenant_id:     tenantId,
      p_duration:      duration || 0,
      p_status:        'completada',
      p_transcript:    transcript || null,
      p_summary:       analysis.summary,
      p_intent:        analysis.intent,
      p_customer_name: analysis.customer_name || null,
      p_action:        analysis.intent === 'reserva' ? 'Reserva gestionada' : analysis.intent,
      p_source:        'twilio',
    })

    const alreadyCounted = (sessionResult as any)?.already_counted === true

    // Billing atómico — process_billable_call usa FOR UPDATE en tenants
    // → 10 llamadas simultáneas incrementan +10 sin race condition
    const shouldBill = duration >= 15 && !alreadyCounted
    if (shouldBill) {
      try {
        await admin.rpc('process_billable_call', {
          p_tenant_id:        tenantId,
          p_call_sid:         key,
          p_duration_seconds: duration
        })
      } catch(e: any) { console.error('billing error:', e.message) }
    }

    console.log('post-call done | sid:', key.slice(0,20), '| intent:', analysis.intent, '| billed:', shouldBill, '| ms:', Date.now()-t0)
    return NextResponse.json({
      ok:       true,
      call_sid: key,
      intent:   analysis.intent,
      summary:  analysis.summary,
      billed:   shouldBill,
      ms:       Date.now()-t0,
    })
  } catch(e: any) {
    console.error('post-call error:', e.message, '| ms:', Date.now()-t0)
    return NextResponse.json({ ok: true, error: e.message }) // siempre 200
  }
}
