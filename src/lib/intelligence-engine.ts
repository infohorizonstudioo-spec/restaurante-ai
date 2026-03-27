/**
 * RESERVO.AI — Intelligence Engine v2
 * The brain that makes this system BETTER than a human.
 *
 * 3-Layer Architecture:
 *   Layer 1: CLASSIFY — What is this? (intent, priority, risk)
 *   Layer 2: DECIDE  — What should happen? (action, confidence, reason)
 *   Layer 3: LEARN   — What should we remember? (patterns, corrections, insights)
 *
 * This engine is called by agent-tools, post-call, and channel-agent.
 * It NEVER improvises. Every decision is traceable and rule-based.
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type InteractionType = 'reserva' | 'pedido' | 'cancelacion' | 'modificacion' | 'consulta' | 'queja' | 'urgencia' | 'otro'
export type Priority = 'critical' | 'high' | 'normal' | 'low'
export type ActionType = 'confirm' | 'propose_alternative' | 'request_info' | 'mark_pending' | 'escalate' | 'alert' | 'reject'

export interface Classification {
  type: InteractionType
  priority: Priority
  risk_level: number        // 0-100
  flags: string[]
  requires_human: boolean
  recommended_action: ActionType
  reasoning: string
}

export interface InteractionSummary {
  headline: string          // "Reserva confirmada para 4 personas"
  details: string           // Full context
  action_taken: string      // What the system did
  risk_detected: string | null
  next_step: string | null  // What should happen next
  alert_owner: boolean
  alert_reason: string | null
}

export interface ConflictDetection {
  conflicts: Array<{
    type: 'double_booking' | 'overbooking_risk' | 'capacity_exceeded' | 'inconsistent_data' | 'unusual_request' | 'problematic_customer'
    severity: 'critical' | 'warning' | 'info'
    description: string
    suggested_action: string
  }>
}

export interface BusinessRecommendation {
  type: 'optimization' | 'alert' | 'insight' | 'action_needed'
  title: string
  description: string
  priority: number  // 1-5
  data?: Record<string, any>
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 1: CLASSIFY — Understand what's happening
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Classify any interaction with intent, priority, and risk.
 * This replaces ad-hoc intent detection scattered across files.
 */
export function classifyInteraction(params: {
  text: string
  customer_phone?: string
  party_size?: number
  business_type: string
  customer_history?: { total_reservations: number; no_shows: number; cancels: number; vip: boolean }
  business_rules?: any
}): Classification {
  const { text, party_size, business_type, customer_history, business_rules } = params
  const t = (text || '').toLowerCase()
  const flags: string[] = []

  // ── Intent Detection (priority-ordered) ──
  let type: InteractionType = 'consulta'

  // Crisis (highest priority)
  const crisisKeywords = ['suicid', 'hacerme daño', 'no puedo más', 'autolesión', 'quitarme la vida', 'me quiero morir']
  if (business_type === 'psicologia' && crisisKeywords.some(k => t.includes(k))) {
    type = 'urgencia'
    flags.push('crisis')
  }
  // Complaint
  else if (/queja|reclamaci|problema grave|horrible|inaceptable|denuncia/.test(t)) {
    type = 'queja'
    flags.push('complaint')
  }
  // Cancellation (before reservation — "cancelar reserva" should be cancel not reserve)
  else if (/cancel|anular|no puedo ir|no vamos|quitar|borrar mi/.test(t)) {
    type = 'cancelacion'
  }
  // Modification
  else if (/cambiar|modificar|mover|adelantar|atrasar|otra hora|otro d[ií]a/.test(t)) {
    type = 'modificacion'
  }
  // Order
  else if (/pedir|pedido|llevar|domicilio|recoger|enviar|comprar|delivery/.test(t)) {
    type = 'pedido'
  }
  // Reservation
  else if (/reserv|mesa|terraza|personas|cena|comida|cita|sesi[oó]n|clase|habitaci[oó]n|turno|agendar|hueco/.test(t)) {
    type = 'reserva'
  }
  // Medical urgency
  else if (/urgente|urgencia|dolor|sangr|no respira|accidente|emergencia/.test(t)) {
    type = 'urgencia'
    flags.push('medical_urgency')
  }

  // ── Flag Detection ──
  if (party_size && party_size >= (business_rules?.large_group_min || 8)) flags.push('large_group')
  if (/alergi|celiac|intoleran|anafilax/.test(t)) flags.push('allergy_critical')
  if (/cumplea[ñn]os|aniversario|celebraci|boda|pedida|comuni[oó]n/.test(t)) flags.push('special_occasion')
  if (/silla de ruedas|movilidad reducida|accesibilidad|carrito|minusv/.test(t)) flags.push('accessibility')
  if (/hoy|ahora mismo|ya|lo antes posible|cuanto antes/.test(t)) flags.push('urgent_timing')

  // ── Risk Assessment (0-100) ──
  let risk = 0

  // Customer risk
  if (customer_history) {
    const { no_shows, cancels, total_reservations, vip } = customer_history
    if (no_shows >= 3) { risk += 40; flags.push('chronic_no_show') }
    else if (no_shows >= 1 && total_reservations > 0 && no_shows / total_reservations > 0.2) { risk += 20; flags.push('no_show_risk') }
    if (cancels >= 3 && total_reservations > 0 && cancels / total_reservations > 0.3) { risk += 15; flags.push('frequent_canceller') }
    if (vip) { risk -= 10 } // VIP reduces risk
  }

  // Interaction risk
  if (flags.includes('crisis')) risk = 100
  if (flags.includes('complaint')) risk += 30
  if (flags.includes('medical_urgency')) risk += 35
  if (flags.includes('allergy_critical')) risk += 20
  if (flags.includes('large_group')) risk += 10

  risk = Math.max(0, Math.min(100, risk))

  // ── Priority ──
  let priority: Priority = 'normal'
  if (risk >= 70 || flags.includes('crisis')) priority = 'critical'
  else if (risk >= 40 || type === 'queja' || type === 'urgencia') priority = 'high'
  else if (risk <= 10 && type === 'consulta') priority = 'low'

  // ── Recommended Action ──
  let recommended_action: ActionType = 'confirm'
  let requires_human = false

  if (flags.includes('crisis')) { recommended_action = 'escalate'; requires_human = true }
  else if (type === 'queja') { recommended_action = 'escalate'; requires_human = true }
  else if (flags.includes('chronic_no_show')) { recommended_action = 'mark_pending'; requires_human = true }
  else if (risk >= 50) { recommended_action = 'mark_pending'; requires_human = true }
  else if (type === 'consulta') { recommended_action = 'confirm' }
  else if (flags.includes('large_group') || flags.includes('allergy_critical') || flags.includes('special_occasion')) {
    recommended_action = 'mark_pending'
  }

  const reasoning = buildReasoning(type, priority, flags, risk)

  return { type, priority, risk_level: risk, flags, requires_human, recommended_action, reasoning }
}

function buildReasoning(type: InteractionType, priority: Priority, flags: string[], risk: number): string {
  const parts: string[] = []
  parts.push(`Tipo: ${type}, prioridad: ${priority}, riesgo: ${risk}/100`)
  if (flags.length > 0) parts.push(`Señales: ${flags.join(', ')}`)
  if (flags.includes('crisis')) parts.push('PROTOCOLO DE CRISIS ACTIVADO')
  if (flags.includes('chronic_no_show')) parts.push('Cliente con historial de no-shows — requiere confirmación extra')
  if (flags.includes('allergy_critical')) parts.push('Alergias detectadas — requiere atención especial en cocina')
  return parts.join('. ')
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 2: DETECT CONFLICTS — Catch problems before they happen
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Scan for conflicts and anomalies before executing an action.
 * A human might miss these. The system never does.
 */
export async function detectConflicts(params: {
  tenant_id: string
  customer_phone?: string
  customer_name?: string
  date?: string
  time?: string
  party_size?: number
}): Promise<ConflictDetection> {
  const { tenant_id, customer_phone, customer_name, date, time, party_size } = params
  const conflicts: ConflictDetection['conflicts'] = []

  if (!date) return { conflicts }

  // 1. Double booking — same customer, same day
  if (customer_phone) {
    const { data: existing } = await supabase
      .from('reservations')
      .select('id,time,people,status')
      .eq('tenant_id', tenant_id)
      .eq('customer_phone', customer_phone)
      .eq('date', date)
      .in('status', ['confirmada', 'confirmed', 'pendiente', 'pending'])

    if (existing && existing.length > 0) {
      const sameTime = existing.find(r => r.time?.slice(0, 5) === time?.slice(0, 5))
      if (sameTime) {
        conflicts.push({
          type: 'double_booking', severity: 'critical',
          description: `Este cliente ya tiene reserva a las ${time} el mismo día.`,
          suggested_action: 'Preguntar si quiere modificar la existente en vez de crear otra.'
        })
      } else {
        conflicts.push({
          type: 'double_booking', severity: 'warning',
          description: `Este cliente ya tiene otra reserva el mismo día (${existing[0].time?.slice(0, 5)}).`,
          suggested_action: 'Confirmar que quiere dos reservas distintas.'
        })
      }
    }
  }

  // 2. Overbooking risk — check if day is almost full
  const { count: dayCount } = await supabase
    .from('reservations')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenant_id)
    .eq('date', date)
    .in('status', ['confirmada', 'confirmed', 'pendiente', 'pending'])

  const { data: tenantData } = await supabase
    .from('tenants')
    .select('reservation_config')
    .eq('id', tenant_id)
    .maybeSingle()

  const maxPerSlot = tenantData?.reservation_config?.max_new_reservations_per_slot || 4
  // Estimate total daily slots (assume 8 service hours / interval)
  const interval = tenantData?.reservation_config?.reservation_slot_interval_minutes || 30
  const estimatedTotalSlots = Math.floor(8 * 60 / interval) * maxPerSlot

  if ((dayCount || 0) > estimatedTotalSlots * 0.85) {
    conflicts.push({
      type: 'overbooking_risk', severity: 'warning',
      description: `El día ${date} está al ${Math.round(((dayCount || 0) / estimatedTotalSlots) * 100)}% de capacidad (${dayCount} reservas).`,
      suggested_action: 'Gestionar nuevas reservas con precaución. Sugerir días alternativos.'
    })
  }

  // 3. Unusual request — very large party for the business
  if (party_size && party_size > (tenantData?.reservation_config?.max_capacity || 50) * 0.5) {
    conflicts.push({
      type: 'unusual_request', severity: 'warning',
      description: `Grupo de ${party_size} personas — más de la mitad de la capacidad total.`,
      suggested_action: 'Requiere coordinación especial. Considerar menú fijo o depósito.'
    })
  }

  return { conflicts }
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 2B: GENERATE SUMMARIES — Understand what happened
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate an intelligent summary after any interaction.
 * Not generic "call completed" — real actionable intelligence.
 */
export function generateSummary(params: {
  type: InteractionType
  classification: Classification
  action_result: { success: boolean; details: string }
  customer_name?: string
  party_size?: number
  date?: string
  time?: string
}): InteractionSummary {
  const { type, classification, action_result, customer_name, party_size, date, time } = params
  const name = customer_name || 'cliente desconocido'

  let headline = ''
  let details = ''
  let action_taken = ''
  let risk_detected: string | null = null
  let next_step: string | null = null
  let alert_owner = false
  let alert_reason: string | null = null

  // Build headline based on type + result
  switch (type) {
    case 'reserva':
      if (action_result.success) {
        headline = `Reserva ${classification.recommended_action === 'confirm' ? 'confirmada' : 'pendiente'}: ${name}, ${party_size || '?'}p, ${date} ${time}`
        action_taken = classification.recommended_action === 'confirm' ? 'Auto-confirmada' : 'Marcada para revisión'
      } else {
        headline = `Reserva fallida: ${name} — ${action_result.details}`
        action_taken = 'No se pudo crear'
        next_step = 'Cliente puede necesitar seguimiento'
      }
      break
    case 'cancelacion':
      headline = `Cancelación: ${name} — ${date} ${time}`
      action_taken = action_result.success ? 'Cancelada y mesa liberada' : 'Error al cancelar'
      break
    case 'pedido':
      headline = `Pedido de ${name}`
      action_taken = action_result.success ? 'Pedido registrado' : 'Error al registrar'
      break
    case 'queja':
      headline = `⚠ QUEJA de ${name}`
      action_taken = 'Escalada al responsable'
      alert_owner = true
      alert_reason = 'Cliente ha expresado una queja — requiere atención inmediata'
      next_step = 'Contactar al cliente para resolver'
      break
    case 'urgencia':
      headline = classification.flags.includes('crisis') ? `🚨 CRISIS: ${name}` : `⚠ Urgencia: ${name}`
      action_taken = 'Escalada inmediatamente'
      alert_owner = true
      alert_reason = classification.reasoning
      break
    default:
      headline = `Consulta de ${name}`
      action_taken = 'Resuelta por el agente'
  }

  // Risk detection
  if (classification.risk_level >= 40) {
    risk_detected = `Riesgo ${classification.risk_level}/100: ${classification.flags.join(', ')}`
    if (!alert_owner && classification.risk_level >= 60) {
      alert_owner = true
      alert_reason = risk_detected
    }
  }

  // Smart next steps
  if (classification.flags.includes('chronic_no_show') && type === 'reserva') {
    next_step = 'Enviar recordatorio SMS 24h antes. Considerar pedir depósito.'
  }
  if (classification.flags.includes('allergy_critical') && type === 'reserva') {
    next_step = 'Avisar a cocina de las restricciones alimentarias.'
  }
  if (classification.flags.includes('special_occasion') && type === 'reserva') {
    next_step = 'Preparar detalles especiales (tarta, decoración, etc.)'
  }

  details = classification.reasoning

  return { headline, details, action_taken, risk_detected, next_step, alert_owner, alert_reason }
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 2C: BUSINESS RECOMMENDATIONS — Proactive intelligence
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate proactive recommendations for the business.
 * Called periodically (dashboard load, daily cron, after busy periods).
 */
export async function getBusinessRecommendations(tenantId: string): Promise<BusinessRecommendation[]> {
  const recommendations: BusinessRecommendation[] = []
  const today = new Date().toISOString().slice(0, 10)

  // Parallel data fetch
  const [todayResR, weekResR, noShowsR, pendingR] = await Promise.all([
    supabase.from('reservations').select('time,people,status')
      .eq('tenant_id', tenantId).eq('date', today)
      .in('status', ['confirmada', 'confirmed', 'pendiente', 'pending']),
    supabase.from('reservations').select('date,status')
      .eq('tenant_id', tenantId)
      .gte('date', today)
      .lte('date', new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)),
    supabase.from('reservations').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('status', 'no_show')
      .gte('date', new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)),
    supabase.from('reservations').select('id,customer_name,date,time', { count: 'exact' })
      .eq('tenant_id', tenantId).in('status', ['pendiente', 'pending']).limit(10),
  ])

  const todayRes = todayResR.data || []
  const weekRes = weekResR.data || []
  const pendingRes = pendingR.data || []

  // 1. Pending reservations needing attention
  if (pendingRes.length > 0) {
    recommendations.push({
      type: 'action_needed', priority: 1,
      title: `${pendingRes.length} reservas pendientes de confirmar`,
      description: pendingRes.slice(0, 3).map(r =>
        `${r.customer_name} — ${r.date} ${(r.time || '').slice(0, 5)}`
      ).join(', ') + (pendingRes.length > 3 ? ` y ${pendingRes.length - 3} más` : ''),
      data: { count: pendingRes.length }
    })
  }

  // 2. Today's load analysis
  const totalPeopleToday = todayRes.reduce((s, r) => s + (r.people || 2), 0)
  if (todayRes.length > 0) {
    // Find peak hour
    const hourMap: Record<string, number> = {}
    todayRes.forEach(r => {
      const h = (r.time || '20:00').slice(0, 2)
      hourMap[h] = (hourMap[h] || 0) + 1
    })
    const peakHour = Object.entries(hourMap).sort((a, b) => b[1] - a[1])[0]

    recommendations.push({
      type: 'insight', priority: 3,
      title: `Hoy: ${todayRes.length} reservas, ${totalPeopleToday} personas`,
      description: peakHour ? `Hora punta: ${peakHour[0]}:00 con ${peakHour[1]} reservas. Prepara personal extra.` : '',
      data: { reservations: todayRes.length, people: totalPeopleToday }
    })
  }

  // 3. No-show trend alert
  if ((noShowsR.count || 0) >= 5) {
    recommendations.push({
      type: 'alert', priority: 2,
      title: `${noShowsR.count} no-shows en los últimos 30 días`,
      description: 'Considera activar recordatorios SMS automáticos 24h antes, o pedir confirmación por WhatsApp.',
      data: { count: noShowsR.count }
    })
  }

  // 4. Empty days detection
  const weekDates = new Set(weekRes.map(r => r.date))
  const emptyDays: string[] = []
  for (let i = 1; i <= 7; i++) {
    const d = new Date(Date.now() + i * 86400000).toISOString().slice(0, 10)
    if (!weekDates.has(d)) emptyDays.push(d)
  }
  if (emptyDays.length >= 3) {
    recommendations.push({
      type: 'optimization', priority: 3,
      title: `${emptyDays.length} días sin reservas esta semana`,
      description: `Días vacíos: ${emptyDays.slice(0, 3).map(d => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long' })).join(', ')}. Considera promociones o campañas.`,
      data: { dates: emptyDays }
    })
  }

  recommendations.sort((a, b) => a.priority - b.priority)
  return recommendations
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 3: LEARN — Extract knowledge from every interaction
// ═══════════════════════════════════════════════════════════════════════════

/**
 * After every interaction, extract learnable patterns and store them.
 * This is what makes the system get BETTER over time.
 */
export async function learnFromInteraction(params: {
  tenant_id: string
  type: InteractionType
  classification: Classification
  customer_phone?: string
  outcome: 'success' | 'failure' | 'escalated'
  correction?: { original_status: string; corrected_status: string; reason?: string }
}): Promise<void> {
  const { tenant_id, type, classification, customer_phone, outcome, correction } = params

  const memories: Array<{ memory_type: string; content: string; confidence: number }> = []

  // Learn from corrections (highest value)
  if (correction) {
    memories.push({
      memory_type: 'correction',
      content: `Corregido ${correction.original_status}→${correction.corrected_status} en ${type}. ${correction.reason || ''}. Flags: ${classification.flags.join(',')}`,
      confidence: 0.95,
    })
  }

  // Learn patterns from successful interactions
  if (outcome === 'success' && type === 'reserva') {
    if (classification.flags.includes('large_group')) {
      memories.push({
        memory_type: 'pattern',
        content: `large_group ${classification.recommended_action === 'confirm' ? 'confirmed' : 'reviewed'}`,
        confidence: 0.7,
      })
    }
    if (classification.flags.includes('special_occasion')) {
      memories.push({
        memory_type: 'pattern',
        content: `special_occasion handled: ${type}`,
        confidence: 0.7,
      })
    }
  }

  // Learn from escalations
  if (outcome === 'escalated') {
    memories.push({
      memory_type: 'pattern',
      content: `escalated: ${type} with flags ${classification.flags.join(',')}`,
      confidence: 0.8,
    })
  }

  // Store (with deduplication from tenant-learning.ts)
  for (const m of memories) {
    // Check for duplicates in last 24h
    const { count } = await supabase
      .from('business_memory')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant_id)
      .eq('memory_type', m.memory_type)
      .eq('content', m.content)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    if ((count || 0) === 0) {
      await supabase.from('business_memory').insert({
        tenant_id, memory_type: m.memory_type,
        content: m.content, confidence: m.confidence,
      })
    }
  }
}
