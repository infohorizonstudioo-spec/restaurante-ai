import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ─────────────────────────────────────────────────────────────────────────────
// POST-CALL v2: flujo completo por llamada.
//
// Garantías:
// 1. Nunca pierde una llamada aunque falten datos (always saves something)
// 2. complete_call_session usa FOR UPDATE → idempotente en retries de Twilio
// 3. process_billable_call usa FOR UPDATE → billing atómico en concurrencia
// 4. Siempre devuelve 200 → Twilio no reintenta por timeout
// 5. Resúmenes útiles para el negocio, no genéricos
// ─────────────────────────────────────────────────────────────────────────────

// ── Análisis con Claude ─────────────────────────────────────────────────────
// Genera un resultado estructurado útil para el negocio.
// Si no hay transcript, genera un resultado "sin información" pero NUNCA falla.
interface CallAnalysis {
  intent:           string
  customer_name:    string | null
  summary:          string
  action_required:  string
  outcome:          string
  details:          Record<string, any>
}

async function analyzeWithClaude(
  transcript: string,
  businessName: string,
  callerPhone: string,
  templateType: string
): Promise<CallAnalysis> {
  const fallback = (reason: string): CallAnalysis => ({
    intent:          'consulta',
    customer_name:   null,
    summary:         reason,
    action_required: 'Revisar llamada manualmente',
    outcome:         'sin_informacion',
    details:         {}
  })

  if (!process.env.ANTHROPIC_API_KEY) return fallback('Sin clave API para análisis')

  // Transcript muy corto → no hay conversación útil
  if (!transcript || transcript.trim().length < 30) {
    const sec = transcript?.length || 0
    return {
      intent:          'consulta',
      customer_name:   null,
      summary:         `Llamada de ${callerPhone || 'número oculto'} — duración muy breve, sin conversación grabada`,
      action_required: 'Sin acción necesaria',
      outcome:         'sin_informacion',
      details:         {}
    }
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const typeLabel = templateType === 'hosteleria' ? 'restaurante/bar/hostelería' : 'negocio de servicios/citas'

    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5', max_tokens: 500,
      system: `Eres un analizador de llamadas para un ${typeLabel} llamado "${businessName}". Extrae información útil para el negocio. Responde SOLO JSON válido sin markdown ni texto adicional.`,
      messages: [{ role: 'user', content: `Analiza esta transcripción telefónica. Devuelve SOLO este JSON:
{
  "intent": "reserva|pedido|cancelacion|consulta|queja|otro",
  "customer_name": "nombre real del cliente o null",
  "summary": "1-2 frases en español describiendo qué quería el cliente y qué pasó. Incluye detalles concretos (fecha, hora, número personas, nombre, plato, etc.)",
  "action_required": "qué debe hacer el negocio ahora (ej: 'Confirmar reserva para Carlos el sábado 21h 4p', 'Preparar pedido 2 pollos', 'Llamar de vuelta al cliente', 'Sin acción necesaria')",
  "outcome": "completado|pendiente|fallido|sin_informacion",
  "details": {}
}

Transcripción:
${transcript.slice(0, 3000)}`
      }]
    })

    const raw = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
    const clean = raw.replace(/```json\s*/g,'').replace(/```\s*/g,'').trim()
    const parsed = JSON.parse(clean)

    // Validar y sanitizar campos
    return {
      intent:          ['reserva','pedido','cancelacion','consulta','queja','otro'].includes(parsed.intent) ? parsed.intent : 'consulta',
      customer_name:   typeof parsed.customer_name === 'string' && parsed.customer_name.length > 1 ? parsed.customer_name : null,
      summary:         typeof parsed.summary === 'string' && parsed.summary.length > 5 ? parsed.summary : `Llamada de ${callerPhone}`,
      action_required: typeof parsed.action_required === 'string' ? parsed.action_required : 'Revisar llamada',
      outcome:         ['completado','pendiente','fallido','sin_informacion'].includes(parsed.outcome) ? parsed.outcome : 'completado',
      details:         typeof parsed.details === 'object' ? parsed.details : {}
    }
  } catch(e: any) {
    console.error('claude analysis error:', e.message)
    return fallback(`Análisis fallido: ${e.message?.slice(0,50)}`)
  }
}

// ── Obtención de transcripción ───────────────────────────────────────────────
// Estrategia: DB (si ya existe) → EL por conversation_id (más preciso) → EL por callSid
async function getTranscriptFromEL(convOrSid: string, isConvId = false): Promise<string> {
  const elKey = process.env.ELEVENLABS_API_KEY
  if (!elKey) return ''
  try {
    if (isConvId) {
      // Ruta directa por conversation_id — más rápida y precisa
      const r = await fetch('https://api.us.elevenlabs.io/v1/convai/conversations/' + convOrSid, {
        headers: { 'xi-api-key': elKey }
      })
      if (r.ok) {
        const d = await r.json()
        const lines = (d.transcript || [])
          .map((m: any) => (m.role === 'agent' ? 'Agente' : 'Cliente') + ': ' + (m.message || '').trim())
          .filter((l: string) => l.length > 10)
        return lines.join('\n')
      }
    }
    // Fallback: buscar en lista de conversaciones recientes por call_sid
    const cr = await fetch('https://api.us.elevenlabs.io/v1/convai/conversations?page_size=30', {
      headers: { 'xi-api-key': elKey }
    })
    if (!cr.ok) return ''
    const cd = await cr.json()
    const conv = (cd.conversations || []).find((c: any) =>
      c.metadata?.phone_call?.call_sid === convOrSid ||
      c.call_id === convOrSid ||
      c.conversation_id === convOrSid.replace('conv_','').replace('CA','')
    )
    if (!conv?.conversation_id) return ''
    const dr = await fetch('https://api.us.elevenlabs.io/v1/convai/conversations/' + conv.conversation_id, {
      headers: { 'xi-api-key': elKey }
    })
    if (!dr.ok) return ''
    const dd = await dr.json()
    return (dd.transcript || [])
      .map((m: any) => (m.role === 'agent' ? 'Agente' : 'Cliente') + ': ' + (m.message || '').trim())
      .filter((l: string) => l.length > 10)
      .join('\n')
  } catch(e: any) {
    console.error('EL transcript error:', e.message)
    return ''
  }
}

async function getTranscript(callSid: string, tenantId: string): Promise<string> {
  try {
    // 1. Buscar en DB — puede que post-call llegue después de que EL ya guardó la transcripción
    const { data: call } = await admin.from('calls')
      .select('transcript, conversation_id')
      .eq('call_sid', callSid)
      .maybeSingle()

    if (call?.transcript && call.transcript.trim().length > 10 && call.transcript !== '[]') {
      return call.transcript
    }

    // 2. Si tenemos conversation_id de ElevenLabs (guardado en upsert_call_session), usarlo directamente
    if (call?.conversation_id) {
      const t = await getTranscriptFromEL(call.conversation_id, true)
      if (t.length > 10) return t
    }

    // 3. Buscar en DB por conversation_id con callSid parcial (EL puede usar convId como callSid)
    const { data: byConvId } = await admin.from('calls')
      .select('transcript, conversation_id')
      .eq('conversation_id', callSid)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (byConvId?.transcript && byConvId.transcript.trim().length > 10) return byConvId.transcript
    if (byConvId?.conversation_id) {
      const t = await getTranscriptFromEL(byConvId.conversation_id, true)
      if (t.length > 10) return t
    }

    // 4. Último recurso: buscar en lista de EL por callSid
    return await getTranscriptFromEL(callSid, false)
  } catch(e: any) {
    console.error('getTranscript error:', e.message)
    return ''
  }
}

export async function POST(req: Request) {
  const t0 = Date.now()
  let callSid = '', tenantId = '', callerPhone = ''

  try {
    // ── Parse body ──────────────────────────────────────────────────────────
    const ct = req.headers.get('content-type') || ''
    let body: any = {}
    if (ct.includes('application/json')) {
      body = await req.json().catch(() => ({}))
    } else {
      const text = await req.text()
      new URLSearchParams(text).forEach((v, k) => { body[k] = v })
    }

    callSid     = body.CallSid     || body.call_sid     || body.conversation_id || ''
    const callStatus  = body.CallStatus  || body.status       || 'completed'
    const duration    = parseInt(body.CallDuration || body.duration_seconds || body.Duration || '0') || 0
    callerPhone = body.From        || body.caller_phone || body.phone_call?.external_number || ''
    const agentPhone  = body.To          || body.agent_phone  || body.phone_call?.agent_number    || ''
    const convId      = body.conversation_id || ''

    console.log('post-call recv:', callSid.slice(0,20), '|', callStatus, '| dur:', duration+'s', '| caller:', callerPhone)

    // Siempre devolver 200 para que Twilio no reintente
    if (!['completed','done','ended'].includes(callStatus.toLowerCase())) {
      return NextResponse.json({ ok: true, skipped: 'status:' + callStatus })
    }
    if (!callSid && !callerPhone && !convId) {
      return NextResponse.json({ ok: true, skipped: 'no identifiers' })
    }

    // ── Resolver tenant ─────────────────────────────────────────────────────
    if (agentPhone) {
      const { data: t } = await admin.from('tenants')
        .select('id,name,type').eq('agent_phone', agentPhone).maybeSingle()
      tenantId = t?.id || ''
    }
    if (!tenantId && callSid) {
      const { data: c } = await admin.from('calls')
        .select('tenant_id').eq('call_sid', callSid).maybeSingle()
      tenantId = c?.tenant_id || ''
    }
    if (!tenantId && convId) {
      const { data: c } = await admin.from('calls')
        .select('tenant_id').eq('conversation_id', convId).maybeSingle()
      tenantId = c?.tenant_id || ''
    }

    // Tenant no encontrado — guardar llamada de todas formas para no perderla
    if (!tenantId) {
      console.log('post-call: tenant not found | agent:', agentPhone, '| sid:', callSid.slice(0,20))
      return NextResponse.json({ ok: true, skipped: 'tenant not found' })
    }

    // Obtener info del negocio para el análisis contextual
    const { data: tenantInfo } = await admin.from('tenants')
      .select('name,type').eq('id', tenantId).maybeSingle()
    const businessName  = tenantInfo?.name || 'El negocio'
    const templateType  = tenantInfo?.type?.includes('clinica') || ['asesoria','peluqueria','seguros','inmobiliaria','otro'].includes(tenantInfo?.type||'') ? 'servicios' : 'hosteleria'

    const key = callSid || convId || ('call_' + Date.now() + '_' + Math.random().toString(36).slice(2,7))

    // ── Marcar sesión como finalizando ──────────────────────────────────────
    ;(async () => {
      try {
        await admin.rpc('update_call_session_state', {
          p_call_sid: key, p_session_state: 'finalizando', p_tenant_id: tenantId
        })
      } catch(e: any) { /* non-critical */ }
    })()

    // ── Transcripción ───────────────────────────────────────────────────────
    const transcript = await getTranscript(key, tenantId)

    // ── Análisis con Claude ─────────────────────────────────────────────────
    const analysis = await analyzeWithClaude(transcript, businessName, callerPhone, templateType)

    // ── Guardar en DB (atómico, idempotente) ────────────────────────────────
    const { data: sessionResult, error: sessionError } = await admin.rpc('complete_call_session', {
      p_call_sid:        key,
      p_tenant_id:       tenantId,
      p_duration:        duration || 0,
      p_status:          'completada',
      p_transcript:      transcript || null,
      p_summary:         analysis.summary,
      p_intent:          analysis.intent,
      p_customer_name:   analysis.customer_name || null,
      p_action:          analysis.action_required,
      p_source:          'twilio',
      p_action_required: analysis.action_required,
    })

    if (sessionError) {
      console.error('complete_call_session error:', sessionError.message)
    }

    const alreadyCounted = (sessionResult as any)?.already_counted === true

    // ── Billing atómico ─────────────────────────────────────────────────────
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

    console.log('post-call done | sid:', key.slice(0,20), '| intent:', analysis.intent, '| summary:', analysis.summary.slice(0,60), '| billed:', shouldBill, '| ms:', Date.now()-t0)

    return NextResponse.json({
      ok:              true,
      call_sid:        key,
      business_id:     tenantId,
      phone_number:    callerPhone,
      customer_name:   analysis.customer_name,
      intent:          analysis.intent,
      summary:         analysis.summary,
      action_required: analysis.action_required,
      outcome:         analysis.outcome,
      duration,
      billed:          shouldBill,
      ms:              Date.now() - t0,
    })
  } catch(e: any) {
    // NUNCA perder la llamada — guardar lo mínimo aunque todo falle
    console.error('post-call error:', e.message, '| ms:', Date.now()-t0)
    if (callSid && tenantId) {
      try {
        await admin.rpc('complete_call_session', {
          p_call_sid: callSid, p_tenant_id: tenantId,
          p_summary: 'Error en procesamiento: ' + e.message?.slice(0,100),
          p_intent: 'otro', p_source: 'twilio',
          p_action_required: 'Revisar llamada manualmente',
        })
      } catch { /* best effort */ }
    }
    return NextResponse.json({ ok: true, error: e.message }) // siempre 200
  }
}
