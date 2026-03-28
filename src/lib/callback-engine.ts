/**
 * RESERVO.AI — Callback Engine
 *
 * Sistema de callbacks inteligentes. Acciones que haría un humano real:
 * - Volver a llamar al cliente si no pudo completar algo
 * - Llamar para confirmar reserva (recordatorio)
 * - Llamar para seguimiento post-visita
 * - Llamar para fidelización (cliente habitual que no vuelve)
 * - Llamar cuando hay hueco en la lista de espera
 *
 * Se ejecuta vía cron o API endpoint.
 */

import { createClient } from '@supabase/supabase-js'
import { createOutboundCall } from './retell'
import { logger } from './logger'
import { createNotification } from './notifications'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─────────────────────────────────────────────────────────────
// 1. PROCESAR CALLBACKS PENDIENTES
// ─────────────────────────────────────────────────────────────

export async function processCallbacks(): Promise<{
  processed: number
  succeeded: number
  failed: number
}> {
  const now = new Date().toISOString()

  // Buscar callbacks pendientes que ya toca ejecutar
  const { data: callbacks } = await supabase
    .from('scheduled_callbacks')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_for', now)
    .lt('attempt_count', 3) // máximo 3 intentos
    .order('priority', { ascending: true }) // urgent primero
    .order('scheduled_for', { ascending: true })
    .limit(10)

  if (!callbacks || callbacks.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0 }
  }

  let succeeded = 0
  let failed = 0

  for (const cb of callbacks) {
    try {
      // Marcar como in_progress
      await supabase.from('scheduled_callbacks')
        .update({ status: 'in_progress', last_attempt: now, attempt_count: cb.attempt_count + 1 })
        .eq('id', cb.id)

      // Buscar el agente Retell del tenant
      const { data: tenant } = await supabase
        .from('tenants')
        .select('retell_agent_id,agent_phone,name')
        .eq('id', cb.tenant_id)
        .maybeSingle()

      if (!tenant?.retell_agent_id) {
        await supabase.from('scheduled_callbacks')
          .update({ status: 'failed', result: 'No Retell agent configured' })
          .eq('id', cb.id)
        failed++
        continue
      }

      // Preparar contexto para la llamada saliente
      const dynamicVars: Record<string, string> = {
        current_date: new Date().toLocaleDateString('es-ES', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        }),
        caller_phone: cb.phone,
        callback_reason: cb.reason,
        callback_context: cb.context || '',
        customer_context: cb.context || 'Callback programado: ' + cb.reason,
        business_personality: '',
      }

      // Hacer la llamada saliente via Retell
      const result = await createOutboundCall({
        agent_id: tenant.retell_agent_id,
        customer_number: cb.phone,
        from_number: tenant.agent_phone || undefined,
        metadata: {
          tenant_id: cb.tenant_id,
          callback_id: cb.id,
          customer_id: cb.customer_id,
          reason: cb.reason,
        },
        retell_llm_dynamic_variables: dynamicVars,
      })

      // Marcar como completado
      await supabase.from('scheduled_callbacks')
        .update({
          status: 'completed',
          result: 'Call initiated: ' + result.call_id,
          call_id: result.call_id,
          updated_at: now,
        })
        .eq('id', cb.id)

      // Limpiar flag en customer
      if (cb.customer_id) {
        await supabase.from('customers')
          .update({ needs_callback: false, callback_reason: null })
          .eq('id', cb.customer_id)
      }

      // Notificar al negocio
      await createNotification({
        tenant_id: cb.tenant_id,
        type: 'call_completed',
        title: `Callback realizado — ${cb.phone}`,
        body: `Motivo: ${cb.reason}`,
      }).catch(() => {})

      succeeded++
      logger.info('Callback executed', { callbackId: cb.id, callId: result.call_id })
    } catch (err) {
      logger.error('Callback failed', { callbackId: cb.id }, err)

      const newAttempt = cb.attempt_count + 1
      if (newAttempt >= 3) {
        await supabase.from('scheduled_callbacks')
          .update({ status: 'failed', result: 'Max attempts reached', updated_at: now })
          .eq('id', cb.id)
      } else {
        // Reintentar en 30 minutos
        await supabase.from('scheduled_callbacks')
          .update({
            status: 'pending',
            scheduled_for: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            updated_at: now,
          })
          .eq('id', cb.id)
      }
      failed++
    }
  }

  return { processed: callbacks.length, succeeded, failed }
}

// ─────────────────────────────────────────────────────────────
// 2. GENERAR CALLBACKS AUTOMÁTICOS
//    (Se ejecuta como cron diario)
// ─────────────────────────────────────────────────────────────

export async function generateAutoCallbacks(tenantId: string): Promise<number> {
  let generated = 0

  // ── Recordatorios de reserva (mañana) ──
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().slice(0, 10)

  const { data: tomorrowReservations } = await supabase
    .from('reservations')
    .select('id,customer_name,customer_phone,date,time,party_size')
    .eq('tenant_id', tenantId)
    .eq('date', tomorrowStr)
    .in('status', ['confirmed', 'pendiente'])

  // Cargar config del tenant
  const { data: tenant } = await supabase
    .from('tenants')
    .select('memory_config')
    .eq('id', tenantId)
    .maybeSingle()

  const config = tenant?.memory_config || {}

  if (config.callback_enabled !== false) {
    for (const res of (tomorrowReservations || [])) {
      if (!res.customer_phone) continue

      // Verificar si ya hay un callback programado
      const { data: existing } = await supabase
        .from('scheduled_callbacks')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('phone', res.customer_phone)
        .eq('status', 'pending')
        .gte('scheduled_for', new Date().toISOString())
        .maybeSingle()

      if (existing) continue

      // Verificar si el cliente tiene historial de no-show
      const { data: customer } = await supabase
        .from('customers')
        .select('no_show_count')
        .eq('tenant_id', tenantId)
        .eq('phone', res.customer_phone)
        .maybeSingle()

      const noShows = customer?.no_show_count || 0

      // Solo generar callback de recordatorio si tiene no-shows previos
      if (noShows >= 1) {
        // Programar llamada de recordatorio para hoy a las 18:00
        const callTime = new Date()
        callTime.setHours(18, 0, 0, 0)
        if (callTime.getTime() < Date.now()) {
          callTime.setDate(callTime.getDate() + 1)
          callTime.setHours(10, 0, 0, 0)
        }

        await supabase.from('scheduled_callbacks').insert({
          tenant_id: tenantId,
          phone: res.customer_phone,
          reason: `Recordatorio de reserva para mañana ${res.date} a las ${res.time}`,
          context: `Reserva para ${res.customer_name}, ${res.party_size} personas. El cliente tiene ${noShows} no-show(s) previo(s). Confirma que viene de forma natural, sin acusar.`,
          priority: noShows >= 3 ? 'high' : 'normal',
          scheduled_for: callTime.toISOString(),
        })
        generated++
      }
    }
  }

  // ── Lista de espera: verificar si hay huecos ──
  const { data: waitlist } = await supabase
    .from('reservations')
    .select('id,customer_name,customer_phone,date,time,party_size')
    .eq('tenant_id', tenantId)
    .eq('status', 'waitlist')
    .gte('date', new Date().toISOString().slice(0, 10))
    .order('created_at', { ascending: true })
    .limit(5)

  // Por cada entrada en waitlist, verificar si hay hueco
  for (const wl of (waitlist || [])) {
    if (!wl.customer_phone) continue

    // Contar reservas activas para esa fecha/hora
    const { count } = await supabase
      .from('reservations')
      .select('id', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .eq('date', wl.date)
      .in('status', ['confirmed', 'pendiente'])

    // Si hay menos de X reservas (simplificado), hay hueco
    const { data: rules } = await supabase
      .from('business_rules')
      .select('rule_value')
      .eq('tenant_id', tenantId)
      .eq('rule_key', 'max_capacity')
      .maybeSingle()

    const maxCap = parseInt(rules?.rule_value || '20')
    if ((count || 0) < maxCap) {
      await supabase.from('scheduled_callbacks').insert({
        tenant_id: tenantId,
        phone: wl.customer_phone,
        reason: `¡Hay hueco! Lista de espera para ${wl.date} a las ${wl.time}`,
        context: `${wl.customer_name} estaba en lista de espera para ${wl.party_size} personas el ${wl.date} a las ${wl.time}. Ahora hay disponibilidad. Ofrécele la reserva.`,
        priority: 'high',
        scheduled_for: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // En 5 min
      })
      generated++
    }
  }

  return generated
}

// ─────────────────────────────────────────────────────────────
// 3. API: Ejecutar callbacks (para cron endpoint)
// ─────────────────────────────────────────────────────────────

export async function runCallbackCycle(): Promise<{
  generated: number
  processed: number
  succeeded: number
  failed: number
}> {
  // Obtener todos los tenants activos
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id')
    .not('retell_agent_id', 'is', null)

  let totalGenerated = 0
  for (const t of (tenants || [])) {
    try {
      const gen = await generateAutoCallbacks(t.id)
      totalGenerated += gen
    } catch (err) {
      logger.error('Auto callbacks failed for tenant', { tenantId: t.id }, err)
    }
  }

  // Procesar callbacks pendientes
  const result = await processCallbacks()

  return {
    generated: totalGenerated,
    ...result,
  }
}
