/**
 * RESERVO.AI — Retell Webhook Handler
 *
 * Recibe eventos de Retell: call_started, call_ended, call_analyzed.
 * Registra llamadas, analiza transcripciones, genera memorias del cliente,
 * crea alertas internas, y actualiza el scoring del cliente.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'
import { resolveCustomer } from '@/lib/customer-resolver'
import { analyzeInteraction, recordCustomerEvent, createCustomerAlert, scheduleCallback } from '@/lib/customer-memory'
import { learnFromCall } from '@/lib/tenant-learning'
import { createNotification } from '@/lib/notifications'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const rl = rateLimitByIp(req, RATE_LIMITS.webhook, 'retell:webhook')
  if (rl.blocked) return rl.response

  try {
    const body = await req.json()
    const event = body.event

    logger.info('Retell webhook received', { event, call_id: body.call?.call_id })

    switch (event) {
      case 'call_started':
        return handleCallStarted(body)
      case 'call_ended':
        return handleCallEnded(body)
      case 'call_analyzed':
        return handleCallAnalyzed(body)
      default:
        logger.info('Retell webhook: unknown event', { event })
        return NextResponse.json({ ok: true })
    }
  } catch (err) {
    logger.error('Retell webhook error', {}, err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────
// CALL STARTED
// ─────────────────────────────────────────────────────────────

async function handleCallStarted(body: any): Promise<NextResponse> {
  const call = body.call || {}
  const callId = call.call_id
  const agentId = call.agent_id
  const callerPhone = call.from_number || call.metadata?.caller_phone || ''
  const calledNumber = call.to_number || ''

  // Buscar tenant por agent_id
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id,name,agent_name')
    .eq('retell_agent_id', agentId)
    .maybeSingle()

  if (!tenant) {
    logger.warn('Retell call_started: no tenant for agent', { agentId })
    return NextResponse.json({ ok: true })
  }

  // Registrar llamada
  await supabase.from('calls').insert({
    tenant_id: tenant.id,
    call_sid: callId,
    caller_phone: callerPhone,
    status: 'activa',
    intent: 'pendiente',
    started_at: new Date().toISOString(),
    session_state: 'escuchando',
    source: 'retell',
  })

  // Resolver cliente si hay teléfono
  if (callerPhone) {
    try {
      await resolveCustomer({
        tenantId: tenant.id,
        phone: callerPhone,
        channel: 'voice',
      })
    } catch {}
  }

  logger.info('Retell call_started processed', { callId, tenantId: tenant.id })
  return NextResponse.json({ ok: true })
}

// ─────────────────────────────────────────────────────────────
// CALL ENDED
// ─────────────────────────────────────────────────────────────

async function handleCallEnded(body: any): Promise<NextResponse> {
  const call = body.call || {}
  const callId = call.call_id
  const agentId = call.agent_id
  const callerPhone = call.from_number || ''
  const durationMs = call.duration_ms || call.call_duration_ms || 0
  const durationSeconds = Math.round(durationMs / 1000)
  const transcript = call.transcript || ''
  const disconnectionReason = call.disconnection_reason || ''

  // Buscar tenant
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id,name,agent_name')
    .eq('retell_agent_id', agentId)
    .maybeSingle()

  if (!tenant) return NextResponse.json({ ok: true })

  // Actualizar estado de la llamada
  await supabase
    .from('calls')
    .update({
      status: 'completada',
      duration_seconds: durationSeconds,
      summary: transcript ? transcript.slice(0, 2000) : 'Sin transcripción',
      session_state: disconnectionReason === 'agent_hangup' ? 'completada' :
                     disconnectionReason === 'user_hangup' ? 'cliente_colgó' :
                     'finalizada',
    })
    .eq('call_sid', callId)
    .eq('tenant_id', tenant.id)

  // Resolver cliente y registrar evento
  if (callerPhone) {
    try {
      const resolved = await resolveCustomer({
        tenantId: tenant.id,
        phone: callerPhone,
        channel: 'voice',
      })

      await recordCustomerEvent(tenant.id, resolved.customerId, {
        event_type: 'call',
        channel: 'voice',
        summary: `Llamada ${durationSeconds > 0 ? `de ${durationSeconds}s` : ''}. ${disconnectionReason === 'user_hangup' ? 'Cliente colgó.' : 'Agente finalizó.'}`,
        event_data: { call_id: callId, duration: durationSeconds, disconnection: disconnectionReason },
        sentiment: durationSeconds < 15 ? 'negative' : 'neutral',
        agent_name: tenant.agent_name,
        duration_seconds: durationSeconds,
      })

      // Si la llamada fue muy corta (< 15s) puede ser problema
      if (durationSeconds < 15 && disconnectionReason === 'user_hangup') {
        await createCustomerAlert(tenant.id, resolved.customerId, {
          alert_type: 'needs_followup',
          severity: 'info',
          title: `Llamada muy corta de ${resolved.customerData.name || callerPhone}`,
          body: `El cliente colgó rápidamente (${durationSeconds}s). Puede necesitar callback.`,
          auto_resolve: true,
          resolve_after: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        })
      }
    } catch (err) {
      logger.error('Retell call_ended: customer processing failed', { callId }, err)
    }
  }

  // Notificación
  try {
    await createNotification({
      tenant_id: tenant.id,
      type: 'call_completed',
      title: `Llamada finalizada${callerPhone ? ' — ' + callerPhone : ''}`,
      body: `Duración: ${durationSeconds}s. ${disconnectionReason === 'user_hangup' ? 'Cliente colgó.' : ''}`,
      call_sid: callId,
    })
  } catch {}

  logger.info('Retell call_ended processed', { callId, duration: durationSeconds })
  return NextResponse.json({ ok: true })
}

// ─────────────────────────────────────────────────────────────
// CALL ANALYZED (Post-call analysis de Retell)
// ─────────────────────────────────────────────────────────────

async function handleCallAnalyzed(body: any): Promise<NextResponse> {
  const call = body.call || {}
  const callId = call.call_id
  const agentId = call.agent_id
  const callerPhone = call.from_number || ''
  const analysis = call.call_analysis || {}

  const callSummary = analysis.call_summary || ''
  const userSentiment = analysis.user_sentiment || 'Neutral'
  const callSuccessful = analysis.call_successful || false
  const customAnalysis = analysis.custom_analysis_data || {}

  // Buscar tenant
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id,name,agent_name')
    .eq('retell_agent_id', agentId)
    .maybeSingle()

  if (!tenant) return NextResponse.json({ ok: true })

  // Mapear sentimiento
  const sentimentMap: Record<string, string> = {
    Positive: 'positive', Negative: 'negative', Neutral: 'neutral',
  }
  const sentiment = sentimentMap[userSentiment] || 'neutral'

  // Actualizar llamada con análisis
  await supabase
    .from('calls')
    .update({
      summary: callSummary || undefined,
      customer_sentiment: sentiment,
      response_quality: callSuccessful ? 'good' : 'needs_improvement',
      decision_status: callSuccessful ? 'confirmed' : 'pending_review',
    })
    .eq('call_sid', callId)
    .eq('tenant_id', tenant.id)

  // Análisis profundo del cliente
  if (callerPhone) {
    try {
      const resolved = await resolveCustomer({
        tenantId: tenant.id,
        phone: callerPhone,
        channel: 'voice',
      })

      // Detectar intent del resumen
      const lowerSummary = (callSummary || '').toLowerCase()
      let intent = 'consulta'
      if (/reserv|book|appoint|cita/.test(lowerSummary)) intent = 'reserva'
      else if (/cancel/.test(lowerSummary)) intent = 'cancelacion'
      else if (/modific|cambiar|change/.test(lowerSummary)) intent = 'modificacion'
      else if (/pedido|order/.test(lowerSummary)) intent = 'pedido'

      // Analizar interacción completa → genera memorias, alertas, sugerencias
      const analysisResult = await analyzeInteraction({
        tenantId: tenant.id,
        customerId: resolved.customerId,
        intent,
        summary: callSummary,
        channel: 'voice',
        sentiment,
        callerPhone,
        agentName: tenant.agent_name,
      })

      // Aprendizaje del negocio
      const intentConfidence: Record<string, number> = {
        reserva: 0.95, pedido: 0.90, cancelacion: 0.85, consulta: 0.70, otro: 0.60,
      }
      await learnFromCall({
        tenantId: tenant.id,
        memoryType: 'pattern',
        content: `${intent} | ${callSuccessful ? 'success' : 'failed'} | ${callSummary.slice(0, 200)}`,
        confidence: intentConfidence[intent] || 0.70,
      })

      // Si sentimiento negativo → callback para fidelización
      if (sentiment === 'negative' && !callSuccessful) {
        await scheduleCallback({
          tenantId: tenant.id,
          customerId: resolved.customerId,
          phone: callerPhone,
          reason: 'Experiencia negativa en llamada — seguimiento de fidelización',
          context: callSummary.slice(0, 500),
          priority: 'high',
          scheduledFor: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 horas después
        })
      }

      logger.info('Retell call_analyzed: customer analysis complete', {
        callId,
        customerId: resolved.customerId,
        memoriesCreated: analysisResult.memoriesCreated.length,
        alertsCreated: analysisResult.alertsCreated.length,
      })
    } catch (err) {
      logger.error('Retell call_analyzed: analysis failed', { callId }, err)
    }
  }

  return NextResponse.json({ ok: true })
}
