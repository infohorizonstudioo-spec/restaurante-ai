import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { makeDecision, DEFAULT_RULES } from '@/lib/agent-decision'
import { getBusinessRules } from '@/lib/business-memory'
import { getBusinessKnowledge, buildKnowledgeContext, queryKnowledge } from '@/lib/business-knowledge'
import { createNotification } from '@/lib/notifications'

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

interface CallAnalysis {
  intent:           string
  customer_name:    string | null
  summary:          string
  action_required:  string
  outcome:          string
  details:          Record<string, any>
}

// ── Analizador local por regex (fallback sin API externa) ──────────────────// Extrae intent, nombre y resumen directamente del texto de la transcripción.
// Funciona sin ninguna API — garantiza que nunca perdemos análisis por fallos externos.
function analyzeLocally(transcript: string, callerPhone: string): CallAnalysis {
  const t     = transcript.toLowerCase()
  const lines = transcript.split('\n').map(l => l.trim()).filter(Boolean)
  const phone = callerPhone || 'cliente'

  // Líneas del cliente únicamente
  const clientLines = lines
    .filter(l => /^cliente:/i.test(l))
    .map(l => l.replace(/^cliente:\s*/i, '').trim())
  const clientText = clientLines.join('\n')

  // ── Intent — cancelación tiene prioridad sobre reserva ─────────────────
  let intent = 'consulta'
  if (/cancelar|cancela|anular|anulo|no\s+puedo\s+ir|no\s+vamos|no\s+podemos/i.test(t))
    intent = 'cancelacion'
  else if (/pedir|pedido|llevar|domicilio|recoger|pizza|pollo|hamburguesa|bocadillo/i.test(t))
    intent = 'pedido'
  else if (/reserv|mesa|terraza|interior|personas?|cena|comida|almuerzo|comer|cita/i.test(t))
    intent = 'reserva'
  else if (/queja|reclamaci|problema|incidente|horrible|terrible/i.test(t))
    intent = 'queja'

  // ── Nombre — solo en texto del cliente ─────────────────────────────────
  const STOP = new Set([
    'hola','buenas','bien','vale','claro','gracias','favor','perfecto','estupendo',
    'para','con','que','una','uno','dos','tres','hay','esto','eso','mañana','hoy',
    'sofía','sofia','lucía','lucia','carmen','maria','laura','agente','recepcionista',
    'alérgico','alérgica','intolerante','vegetariano','vegetariana','vegano','vegana',
    'celíaco','celíaca','interesado','interesada','disponible','correcto','exacto',
  ])

  let customer_name: string | null = null

  // 1. "a nombre de X" en líneas del cliente — el más fiable
  const nameMatch1 = clientText.match(/\ba\s+nombre\s+de\s+([A-Za-záéíóúñÁÉÍÓÚÑ]{3,}(?:\s+[A-Za-záéíóúñÁÉÍÓÚÑ]{2,})?)/i)
  if (nameMatch1?.[1] && !STOP.has(nameMatch1[1].toLowerCase().trim())) {
    customer_name = nameMatch1[1].trim().split(/\s*\n\s*/)[0].trim()
  }

  // 2. "me llamo X" / "soy X" en líneas del cliente (solo nombres propios)
  if (!customer_name) {
    const nameMatch2 = clientText.match(/\b(?:me\s+llamo)\s+([A-Za-záéíóúñÁÉÍÓÚÑ]{3,})/i)
      || clientText.match(/\bsoy\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,})/i) // solo si empieza mayúscula
    if (nameMatch2?.[1] && !STOP.has(nameMatch2[1].toLowerCase().trim())) {
      customer_name = nameMatch2[1].trim().split(/\s*\n\s*/)[0].trim()
    }
  }

  // 3. Respuesta de una sola palabra a "¿a nombre de quién?" — la línea siguiente del cliente
  if (!customer_name) {
    for (let i = 0; i < lines.length - 1; i++) {
      if (/nombre|quién/i.test(lines[i]) && /^agente:/i.test(lines[i])) {
        const nextClient = lines[i + 1]
        if (/^cliente:/i.test(nextClient)) {
          const answer = nextClient.replace(/^cliente:\s*/i, '').trim()
          const words = answer.split(/\s+/)
          if (words.length <= 2 && words[0].length >= 3 && !STOP.has(words[0].toLowerCase())) {
            customer_name = answer
          }
        }
      }
    }
  }

  // ── Detalles ────────────────────────────────────────────────────────────
  const timeMatch   = transcript.match(/(?:a las?|para las?)\s+(\d{1,2}(?:[:h]\d{0,2})?(?:\s*(?:de la (?:tarde|noche|mañana))?))/i)
  const peopleMatch = transcript.match(/(\d+)\s*(?:personas?|comensales?|adultos?)/i)
  const dateMatch   = transcript.match(/\b(mañana|hoy|pasado mañana|lunes|martes|miércoles|jueves|viernes|sábado|domingo)\b/i)

  // ── Resumen ─────────────────────────────────────────────────────────────
  let summary = ''
  let action_required = 'Sin acción necesaria'

  if (intent === 'reserva') {
    const who  = customer_name ? `a nombre de ${customer_name}` : `de ${phone}`
    const when = [
      dateMatch?.[1] || '',
      timeMatch?.[1] ? `a las ${timeMatch[1]}` : '',
      peopleMatch?.[1] ? `${peopleMatch[1]} personas` : '',
    ].filter(Boolean).join(', ')
    summary = `Reserva ${who}${when ? ' — ' + when : ''}`
    action_required = `Confirmar reserva: ${[customer_name, timeMatch?.[1], peopleMatch?.[1]&&peopleMatch[1]+' personas'].filter(Boolean).join(', ') || 'ver detalles'}`
  } else if (intent === 'pedido') {
    const who   = customer_name ? ` — ${customer_name}` : ''
    const when  = timeMatch?.[1] ? ` en ${timeMatch[1]}` : ''
    // Buscar items en líneas del cliente
    const items = clientLines.join(' ').match(/(?:una?|dos|tres|cuatro|\d+)\s+[a-záéíóúñ]{4,}/gi)
    const itemStr = items?.slice(0, 3).join(', ') || 'pedido'
    summary = `Pedido${who}: ${itemStr}${when}`
    action_required = `Preparar pedido: ${itemStr}`
  } else if (intent === 'cancelacion') {
    const who = customer_name ? ` de ${customer_name}` : ''
    summary = `Cancelación${who}`
    action_required = `Procesar cancelación${who}`
  } else if (intent === 'queja') {
    const q = clientLines.find(l => l.length > 10)
    summary = q ? `Queja de ${phone}: "${q.slice(0, 80)}"` : `Queja de ${phone}`
    action_required = 'Atender queja del cliente'
  } else {
    const q = clientLines.find(l => l.length > 15 && l.length < 120)
    summary = q ? `Consulta de ${phone}: "${q.slice(0, 80)}"` : `Llamada de ${phone} — consulta atendida`
  }

  return { intent, customer_name, summary, action_required, outcome: 'completado', details: {} }
}

// ── Análisis con Claude (cuando API key está disponible) ────────────────────
async function analyzeWithClaude(
  transcript: string,
  businessName: string,
  callerPhone: string,
  templateType: string,
  knowledgeContext: string
): Promise<CallAnalysis> {
  const local = analyzeLocally(transcript, callerPhone)
  if (!process.env.ANTHROPIC_API_KEY) return local
  if (!transcript || transcript.trim().length < 30) return local

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const typeLabel = templateType === 'hosteleria' ? 'restaurante/bar/hostelería' : 'negocio de servicios/citas'
    const knowledgeBlock = knowledgeContext
      ? `\n\nCONOCIMIENTO DEL NEGOCIO (usa esto para responder — no inventes):\n${knowledgeContext}`
      : ''

    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5', max_tokens: 500,
      system: `Eres un analizador de llamadas para un ${typeLabel} llamado "${businessName}".${knowledgeBlock}\nResponde SOLO JSON válido. Nunca inventes información no presente en el conocimiento del negocio.`,
      messages: [{ role: 'user', content: `Analiza esta transcripción. Devuelve SOLO este JSON (sin markdown):
{"intent":"reserva|pedido|cancelacion|consulta|queja|otro","customer_name":"nombre real o null","summary":"1-2 frases con detalles concretos","action_required":"qué hacer ahora","outcome":"completado|pendiente|fallido","details":{}}

Transcripción:
${transcript.slice(0, 2500)}` }]
    })

    const raw = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
    const clean = raw.replace(/```json\s*/g,'').replace(/```\s*/g,'').trim()
    const parsed = JSON.parse(clean)

    return {
      intent:          ['reserva','pedido','cancelacion','consulta','queja','otro'].includes(parsed.intent) ? parsed.intent : local.intent,
      customer_name:   typeof parsed.customer_name === 'string' && parsed.customer_name.length > 1 && parsed.customer_name !== 'null' ? parsed.customer_name : local.customer_name,
      summary:         typeof parsed.summary === 'string' && parsed.summary.length > 10 ? parsed.summary : local.summary,
      action_required: typeof parsed.action_required === 'string' && parsed.action_required.length > 5 ? parsed.action_required : local.action_required,
      outcome:         ['completado','pendiente','fallido','sin_informacion'].includes(parsed.outcome) ? parsed.outcome : 'completado',
      details:         typeof parsed.details === 'object' ? parsed.details : {}
    }
  } catch(e: any) {
    console.error('claude analysis fallback to local:', e.message?.slice(0,60))
    return local
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

    callSid     = body.CallSid     || body.call_sid     || body.conversation_id
                  || body.data?.conversation_id || body.data?.call_sid || ''

    const callStatus  = body.CallStatus  || body.status || body.data?.status || 'completed'
    const duration    = parseInt(
      body.CallDuration || body.duration_seconds || body.Duration
      || body.data?.metadata?.call_duration_secs || '0'
    ) || 0

    // ElevenLabs envía el caller en data.metadata o en phone_call
    callerPhone = body.From
      || body.caller_phone
      || body.phone_call?.external_number
      || body.data?.metadata?.caller_id
      || body.data?.metadata?.phone_number_used
      || body.data?.phone_call?.external_number
      || ''

    const agentPhone = body.To
      || body.agent_phone
      || body.phone_call?.agent_number
      || body.data?.phone_call?.agent_number
      || ''

    const convId = body.conversation_id || body.data?.conversation_id || ''

    // Transcripción: directa en body, o en data.transcript (formato EL webhook)
    let bodyTranscript = body.transcript || ''
    if (!bodyTranscript && body.data?.transcript) {
      // EL envía array de mensajes [{role, message}]
      const msgs = body.data.transcript
      if (Array.isArray(msgs)) {
        bodyTranscript = msgs.map((m: any) => {
          const role = m.role === 'agent' ? 'Agente' : 'Cliente'
          return `${role}: ${m.message || m.content || ''}`
        }).join('\n')
      } else if (typeof msgs === 'string') {
        bodyTranscript = msgs
      }
    }

    console.log('post-call recv:', callSid.slice(0,20), '|', callStatus, '| dur:', duration+'s', '| caller:', callerPhone || 'oculto')
    // Log estructura EL para depuración (solo primeras llamadas reales)
    if (body.data || body.type) {
      console.log('EL webhook body keys:', Object.keys(body).join(','), '| data keys:', Object.keys(body.data||{}).join(','))
    }

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

    // Cargar knowledge y rules en paralelo
    const [businessKnowledge, businessRules] = await Promise.all([
      getBusinessKnowledge(tenantId).catch(() => null),
      getBusinessRules(tenantId).catch(() => DEFAULT_RULES),
    ])
    const knowledgeContext = businessKnowledge ? buildKnowledgeContext(businessKnowledge) : ''

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
    // Prioridad: body directo > DB > ElevenLabs
    const transcript = bodyTranscript || await getTranscript(key, tenantId)

    // ── Análisis con Claude ─────────────────────────────────────────────────
    const analysis = await analyzeWithClaude(transcript, businessName, callerPhone, templateType, knowledgeContext)

    // ── Consultar knowledge para enriquecer el trace ────────────────────────
    let knowledgeSource = 'none'
    if (businessKnowledge && transcript) {
      const clientText = transcript.split('\n')
        .filter(l => /^(cliente|client):/i.test(l))
        .map(l => l.replace(/^(cliente|client):\s*/i, ''))
        .join(' ')
      if (clientText.length > 5) {
        const kResult = queryKnowledge(businessKnowledge, clientText)
        if (kResult.found) knowledgeSource = kResult.source
      }
    }

    // ── Motor de decisión inteligente ───────────────────────────────────────
    const decision = makeDecision(
      { ...analysis, transcript, caller_phone: callerPhone },
      businessRules,
      knowledgeSource
    )

    console.log(
      'decision |', decision.status,
      '| confidence:', (decision.confidence * 100).toFixed(0) + '%',
      '| flags:', decision.special_flags.join(',') || 'none',
      '| reasoning:', decision.reasoning_label
    )

    // ── Guardar en DB (atómico, idempotente) ────────────────────────────────
    const { data: sessionResult, error: sessionError } = await admin.rpc('complete_call_session', {
      p_call_sid:        key,
      p_tenant_id:       tenantId,
      p_duration:        duration || 0,
      p_status:          decision.status === 'confirmed' ? 'completada' : 'pendiente',
      p_transcript:      transcript || null,
      p_summary:         decision.summary,
      p_intent:          decision.intent,
      p_customer_name:   decision.customer_name || null,
      p_action:          decision.action_required,
      p_source:          'twilio',
      p_action_required: decision.action_required,
      p_caller_phone:    callerPhone || null,
    })

    if (sessionError) {
      console.error('complete_call_session error:', sessionError.message)
    }

    // ── Guardar decisión estructurada (flags, estado, confianza, trace) ────
    ;(async () => {
      try {
        await admin.from('calls')
          .update({
            decision_status:     decision.status,
            decision_flags:      decision.special_flags,
            decision_confidence: decision.confidence,
            reasoning_label:     decision.reasoning_label,
            applied_rule:        decision.applied_rule,
            knowledge_source:    decision.knowledge_source,
            decision_trace:      decision.decision_trace,
          })
          .eq('call_sid', key)
          .eq('tenant_id', tenantId)
      } catch(e: any) { /* columnas pueden no existir aún — no crítico */ }
    })()

    // ── Notificación en el panel ─────────────────────────────────────────────
    ;(async () => {
      try {
        const phone = callerPhone || 'Número oculto'
        const name  = decision.customer_name ? decision.customer_name : phone

        if (decision.status === 'needs_human_attention') {
          await createNotification({
            tenant_id: tenantId,
            type:      'call_attention',
            title:     '⚠ Llamada requiere tu atención',
            body:      `${name} — ${decision.summary || 'Revisa esta llamada'}`,
            call_sid:  key,
          })
        } else if (decision.status === 'pending_review') {
          await createNotification({
            tenant_id: tenantId,
            type:      'call_pending',
            title:     `Llamada pendiente de revisar`,
            body:      `${name} — ${decision.reasoning_label || decision.summary}`,
            call_sid:  key,
          })
        } else if (decision.status === 'confirmed' && decision.intent === 'reserva') {
          await createNotification({
            tenant_id: tenantId,
            type:      'reservation_created',
            title:     `Nueva reserva confirmada`,
            body:      decision.summary || `${name}`,
            call_sid:  key,
          })
        } else if (duration < 10 && callerPhone) {
          await createNotification({
            tenant_id: tenantId,
            type:      'call_missed',
            title:     `Llamada muy corta`,
            body:      `${phone} — ${duration}s. Puede que necesite rellamar.`,
            call_sid:  key,
          })
        } else if (decision.status === 'confirmed') {
          await createNotification({
            tenant_id: tenantId,
            type:      'call_completed',
            title:     `Llamada atendida`,
            body:      `${name} — ${decision.summary}`,
            call_sid:  key,
          })
        }
      } catch(e: any) { console.error('notification error:', e.message) }
    })()

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

    console.log('post-call done | sid:', key.slice(0,20), '| intent:', decision.intent, '| status:', decision.status, '| confidence:', (decision.confidence*100).toFixed(0)+'%', '| billed:', shouldBill, '| ms:', Date.now()-t0)

    // Objeto estructurado según spec del agente
    return NextResponse.json({
      ok:               true,
      call_sid:         key,
      business_id:      tenantId,
      customer_name:    decision.customer_name,
      phone_number:     decision.phone_number,
      intent:           decision.intent,
      summary:          decision.summary,
      details:          decision.details,
      status:           decision.status,
      confidence:       decision.confidence,
      action_required:  decision.action_required,
      special_flags:    decision.special_flags,
      reasoning_label:  decision.reasoning_label,
      response_hint:    decision.response_hint,
      applied_rule:     decision.applied_rule,
      knowledge_source: decision.knowledge_source,
      decision_trace:   decision.decision_trace,
      duration,
      billed:           shouldBill,
      ms:               Date.now() - t0,
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
