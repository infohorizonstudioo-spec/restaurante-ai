import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Analizar la transcripción con Claude y extraer datos estructurados
async function analyzeCall(transcript: string, callerPhone: string, tenantId: string) {
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 400,
      system: 'Eres un analizador de llamadas de negocio. Extrae datos en JSON puro, sin markdown.',
      messages: [{
        role: 'user',
        content: `Analiza esta transcripción de llamada y responde SOLO con JSON:
{
  "intent": "reserva|pedido|consulta|cancelacion|otro",
  "customer_name": "nombre o null",
  "summary": "resumen en 1-2 frases en español",
  "outcome": "completado|pendiente|fallido",
  "reservation_date": "YYYY-MM-DD o null",
  "reservation_time": "HH:MM o null",
  "party_size": number_or_null
}

Transcripción:
${transcript}`
      }]
    })
    const text = msg.content[0].type === 'text' ? msg.content[0].text : '{}'
    return JSON.parse(text.replace(/```json|```/g, '').trim())
  } catch(e) {
    return { intent: 'otro', customer_name: null, summary: 'Llamada procesada', outcome: 'completado' }
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    
    // ElevenLabs post-call webhook payload
    const convId      = body.conversation_id || body.data?.conversation_id || ''
    const agentId     = body.agent_id        || body.data?.agent_id        || ''
    const callSid     = body.metadata?.phone_call?.call_sid  || body.call_sid || ''
    const agentPhone  = body.metadata?.phone_call?.agent_number  || body.agent_number  || ''
    const callerPhone = body.metadata?.phone_call?.external_number || body.caller_phone || ''
    const durationSec = body.metadata?.call_duration_secs || body.duration_seconds || 0
    const transcript  = (body.transcript || body.data?.transcript || [])
      .map((m: any) => (m.role === 'agent' ? 'Sofia' : 'Cliente') + ': ' + m.message)
      .join('\n')
    const status = body.status || body.data?.status || 'done'

    console.log('post-call:', convId, 'caller:', callerPhone, 'dur:', durationSec, 'status:', status)

    // Buscar tenant por numero del agente
    if (!agentPhone && !callerPhone && !callSid) {
      return NextResponse.json({ ok: true, skipped: 'no identifiers' })
    }

    let tenantId = ''
    if (agentPhone) {
      const { data: tenant } = await admin.from('tenants')
        .select('id').eq('agent_phone', agentPhone).maybeSingle()
      tenantId = tenant?.id || ''
    }
    // Fallback: buscar por call_sid en calls existentes
    if (!tenantId && callSid) {
      const { data: call } = await admin.from('calls')
        .select('tenant_id').eq('call_sid', callSid).maybeSingle()
      tenantId = call?.tenant_id || ''
    }
    if (!tenantId) {
      console.log('post-call: tenant not found, skipping')
      return NextResponse.json({ ok: true, skipped: 'tenant not found' })
    }

    // Analizar llamada con Claude
    const analysis = transcript.length > 10
      ? await analyzeCall(transcript, callerPhone, tenantId)
      : { intent: 'otro', customer_name: null, summary: 'Llamada sin transcripción', outcome: 'completado' }

    const now = new Date().toISOString()

    // Upsert en calls — deduplicar por call_sid o conversation_id
    const callKey = callSid || ('conv_' + convId)
    const { data: existingCall } = await admin.from('calls')
      .select('id,counted_for_billing').eq('call_sid', callKey).maybeSingle()

    if (existingCall) {
      // Actualizar llamada existente con resumen
      await admin.from('calls').update({
        status:           'completada',
        duration_seconds: durationSec,
        transcript:       transcript || null,
        summary:          analysis.summary,
        intent:           analysis.intent,
        customer_name:    analysis.customer_name,
        ended_at:         now,
        action_suggested: analysis.intent === 'reserva' ? 'Reserva gestionada' : analysis.intent,
      }).eq('id', existingCall.id)
    } else {
      // Crear nueva llamada
      await admin.from('calls').insert({
        tenant_id:          tenantId,
        call_sid:           callKey,
        conversation_id:    convId || null,
        caller_phone:       callerPhone,
        from_number:        callerPhone,
        to_number:          agentPhone,
        direction:          'inbound',
        status:             'completada',
        duration_seconds:   durationSec,
        transcript:         transcript || null,
        summary:            analysis.summary,
        intent:             analysis.intent,
        customer_name:      analysis.customer_name,
        started_at:         now,
        ended_at:           now,
        source:             'elevenlabs',
        counted_for_billing: false,
        action_suggested:   analysis.intent === 'reserva' ? 'Reserva gestionada' : analysis.intent,
      })
    }

    // Billing — solo contar llamadas >= 15s no duplicadas
    const shouldBill = durationSec >= 15 && !(existingCall?.counted_for_billing)
    if (shouldBill) {
      await admin.rpc('process_billable_call', {
        p_tenant_id:        tenantId,
        p_call_sid:         callKey,
        p_duration_seconds: durationSec
      })
    }

    console.log('post-call processed:', convId, '| intent:', analysis.intent, '| billed:', shouldBill)
    return NextResponse.json({
      ok: true,
      conversation_id: convId,
      intent:   analysis.intent,
      summary:  analysis.summary,
      billed:   shouldBill,
      duration: durationSec
    })
  } catch(e: any) {
    console.error('post-call error:', e.message)
    // Siempre 200 para que ElevenLabs no reintente
    return NextResponse.json({ ok: true, error: e.message })
  }
}