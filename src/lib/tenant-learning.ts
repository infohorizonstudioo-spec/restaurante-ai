/**
 * RESERVO.AI — Motor de Aprendizaje por Tenant
 * ─────────────────────────────────────────────────────────────────────────────
 * Aprende de cada llamada real de cada negocio específico.
 * NO es genérico por tipo — es individual por tenant.
 *
 * Qué aprende:
 *  - Intenciones más frecuentes de ESE negocio
 *  - Sus horas y días pico reales
 *  - Su tasa de urgencias real
 *  - Sus servicios más pedidos
 *  - Umbrales óptimos para ESE negocio (confianza, auto-confirm)
 *  - Patrones de cancelación
 *  - Clientes frecuentes
 */

import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export interface TenantMemory {
  tenant_id: string
  total_calls: number
  total_confirmed: number
  total_pending_review: number
  total_escalated: number
  total_cancelled: number
  intent_distribution: Record<string, number>
  top_services: Record<string, number>
  peak_hours: Record<string, number>
  peak_days: Record<string, number>
  urgency_rate: number
  avg_confidence: number
  avg_call_duration: number
  cancellation_rate: number
  frequent_customers: string[]
  has_urgency_pattern: boolean
  prefers_morning: boolean
  prefers_evening: boolean
  high_cancellation_risk: boolean
  adaptive_confidence_threshold: number
  adaptive_auto_confirm: boolean
  last_call_at: string | null
  updated_at: string
  calls_since_last_update: number
}

const DEFAULT_MEMORY: Omit<TenantMemory, 'tenant_id' | 'last_call_at' | 'updated_at'> = {
  total_calls: 0, total_confirmed: 0, total_pending_review: 0,
  total_escalated: 0, total_cancelled: 0,
  intent_distribution: {}, top_services: {}, peak_hours: {}, peak_days: {},
  urgency_rate: 0, avg_confidence: 0.7, avg_call_duration: 0,
  cancellation_rate: 0, frequent_customers: [],
  has_urgency_pattern: false, prefers_morning: false,
  prefers_evening: false, high_cancellation_risk: false,
  adaptive_confidence_threshold: 0.55, adaptive_auto_confirm: true,
  calls_since_last_update: 0,
}

// ── Cargar memoria del tenant ────────────────────────────────────────────────
export async function getTenantMemory(tenantId: string): Promise<TenantMemory> {
  try {
    const { data } = await admin.from('tenant_memory')
      .select('*').eq('tenant_id', tenantId).maybeSingle()
    if (data) return data as TenantMemory
    return { tenant_id: tenantId, last_call_at: null, updated_at: new Date().toISOString(), ...DEFAULT_MEMORY }
  } catch {
    return { tenant_id: tenantId, last_call_at: null, updated_at: new Date().toISOString(), ...DEFAULT_MEMORY }
  }
}

// ── Aprender de una llamada completada ──────────────────────────────────────
export interface CallLearningData {
  intent:          string
  status:          string   // confirmed, pending_review, escalated, cancelled
  confidence:      number
  duration_seconds:number
  customer_name:   string | null
  is_urgency:      boolean
  consultation_type?: string
  started_at:      string | null
}

export async function learnFromCall(tenantId: string, call: CallLearningData): Promise<void> {
  try {
    const current = await getTenantMemory(tenantId)

    // ── Actualizar contadores ──────────────────────────────────────────────
    const newTotal    = current.total_calls + 1
    const newConfirmed  = current.total_confirmed + (call.status === 'confirmed' ? 1 : 0)
    const newPending    = current.total_pending_review + (call.status === 'pending_review' ? 1 : 0)
    const newEscalated  = current.total_escalated + (call.status === 'escalated' ? 1 : 0)
    const newCancelled  = current.total_cancelled + (call.status === 'cancelled' ? 1 : 0)

    // ── Actualizar distribución de intenciones ────────────────────────────
    const intentDist = { ...current.intent_distribution }
    intentDist[call.intent] = (intentDist[call.intent] || 0) + 1

    // ── Actualizar servicios más pedidos ──────────────────────────────────
    const topServices = { ...current.top_services }
    if (call.consultation_type) {
      topServices[call.consultation_type] = (topServices[call.consultation_type] || 0) + 1
    }

    // ── Actualizar horas y días pico ──────────────────────────────────────
    const peakHours = { ...current.peak_hours }
    const peakDays  = { ...current.peak_days }
    if (call.started_at) {
      const date = new Date(call.started_at)
      const hour = date.getHours().toString()
      const day  = date.getDay().toString() // 0=domingo
      peakHours[hour] = (peakHours[hour] || 0) + 1
      peakDays[day]   = (peakDays[day]   || 0) + 1
    }

    // ── Métricas evolutivas (media ponderada) ─────────────────────────────
    const w = 1 / newTotal  // peso de la nueva llamada
    const newUrgencyRate = current.urgency_rate * (1 - w) + (call.is_urgency ? 1 : 0) * w
    const newAvgConfidence = current.avg_confidence * (1 - w) + call.confidence * w
    const newAvgDuration = call.duration_seconds > 0
      ? current.avg_call_duration * (1 - w) + call.duration_seconds * w
      : current.avg_call_duration
    const newCancellationRate = current.cancellation_rate * (1 - w) + (call.status === 'cancelled' ? 1 : 0) * w

    // ── Clientes frecuentes (top 20) ──────────────────────────────────────
    let frequentCustomers = [...current.frequent_customers]
    if (call.customer_name && !frequentCustomers.includes(call.customer_name)) {
      frequentCustomers = [call.customer_name, ...frequentCustomers].slice(0, 20)
    }

    // ── Calcular flags de comportamiento ─────────────────────────────────
    const morningCalls = Object.entries(peakHours)
      .filter(([h]) => parseInt(h) >= 8 && parseInt(h) < 14)
      .reduce((s, [, v]) => s + v, 0)
    const eveningCalls = Object.entries(peakHours)
      .filter(([h]) => parseInt(h) >= 17)
      .reduce((s, [, v]) => s + v, 0)
    const prefersMorning = morningCalls > eveningCalls
    const prefersEvening = eveningCalls > morningCalls

    // ── Calcular umbrales adaptativos ─────────────────────────────────────
    // Si el negocio tiene alta tasa de confirmación → bajar umbral (confiar más)
    // Si tiene alta tasa de urgencias → subir umbral (ser más conservador)
    const confirmRate = newConfirmed / Math.max(newTotal, 1)
    let adaptiveThreshold = 0.55 // base
    if (confirmRate > 0.8 && newTotal > 20)      adaptiveThreshold = 0.40 // negocio con muy buena señal
    else if (confirmRate > 0.6 && newTotal > 10) adaptiveThreshold = 0.50
    else if (newUrgencyRate > 0.15)              adaptiveThreshold = 0.65 // negocio con muchas urgencias
    else if (newCancellationRate > 0.20)         adaptiveThreshold = 0.60 // muchas cancelaciones

    // Auto-confirm: desactivar si muchos pending o escalados
    const problemRate = (newPending + newEscalated) / Math.max(newTotal, 1)
    const adaptiveAutoConfirm = problemRate < 0.3

    // ── Guardar en DB ──────────────────────────────────────────────────────
    await admin.from('tenant_memory').upsert({
      tenant_id:                   tenantId,
      total_calls:                 newTotal,
      total_confirmed:             newConfirmed,
      total_pending_review:        newPending,
      total_escalated:             newEscalated,
      total_cancelled:             newCancelled,
      intent_distribution:         intentDist,
      top_services:                topServices,
      peak_hours:                  peakHours,
      peak_days:                   peakDays,
      urgency_rate:                Math.round(newUrgencyRate * 1000) / 1000,
      avg_confidence:              Math.round(newAvgConfidence * 1000) / 1000,
      avg_call_duration:           Math.round(newAvgDuration),
      cancellation_rate:           Math.round(newCancellationRate * 1000) / 1000,
      frequent_customers:          frequentCustomers,
      has_urgency_pattern:         newUrgencyRate > 0.10,
      prefers_morning:             prefersMorning,
      prefers_evening:             prefersEvening,
      high_cancellation_risk:      newCancellationRate > 0.20,
      adaptive_confidence_threshold: adaptiveThreshold,
      adaptive_auto_confirm:       adaptiveAutoConfirm,
      last_call_at:                call.started_at || new Date().toISOString(),
      updated_at:                  new Date().toISOString(),
      calls_since_last_update:     (current.calls_since_last_update || 0) + 1,
    }, { onConflict: 'tenant_id' })
  } catch (e: any) {
    console.error('learnFromCall error:', e.message)
    // No relanzar — el aprendizaje es no-crítico
  }
}

// ── Obtener contexto de memoria para inyectar en el agente ──────────────────
export function buildMemoryContext(memory: TenantMemory): string {
  if (memory.total_calls < 5) return '' // sin suficiente datos

  const topIntents = Object.entries(memory.intent_distribution)
    .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k)

  const topServices = Object.entries(memory.top_services)
    .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k)

  const peakHoursList = Object.entries(memory.peak_hours)
    .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([h]) => h + ':00')

  const lines: string[] = [
    `Datos reales de este negocio (${memory.total_calls} llamadas):`,
  ]
  if (topIntents.length)    lines.push(`- Llamadas más frecuentes: ${topIntents.join(', ')}`)
  if (topServices.length)   lines.push(`- Servicios más pedidos: ${topServices.join(', ')}`)
  if (peakHoursList.length) lines.push(`- Horas con más actividad: ${peakHoursList.join(', ')}`)
  if (memory.has_urgency_pattern) lines.push(`- Este negocio recibe urgencias frecuentes (${(memory.urgency_rate * 100).toFixed(0)}% de llamadas)`)
  if (memory.high_cancellation_risk) lines.push(`- Tasa de cancelación elevada — verificar datos antes de confirmar`)
  if (memory.prefers_morning) lines.push(`- Clientela mayoritariamente matutina`)
  if (memory.prefers_evening) lines.push(`- Clientela mayoritariamente vespertina`)
  if (memory.frequent_customers.length > 0) {
    lines.push(`- Clientes habituales conocidos: ${memory.frequent_customers.slice(0, 5).join(', ')}`)
  }

  return lines.join('\n')
}

// ── Obtener umbrales adaptativos para los motores de decisión ───────────────
export function getAdaptiveThresholds(memory: TenantMemory): {
  confidenceThreshold: number
  autoConfirm: boolean
  urgencyAware: boolean
} {
  return {
    confidenceThreshold: memory.total_calls >= 10
      ? memory.adaptive_confidence_threshold
      : 0.55, // umbral por defecto hasta tener suficientes datos
    autoConfirm: memory.total_calls >= 5
      ? memory.adaptive_auto_confirm
      : true,
    urgencyAware: memory.has_urgency_pattern,
  }
}
