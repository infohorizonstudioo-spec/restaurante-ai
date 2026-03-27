/**
 * RESERVO.AI — Decision Gateway v3
 *
 * PUNTO ÚNICO DE ENTRADA para TODAS las decisiones del sistema.
 * Todos los canales (voz, WhatsApp, email, SMS, dashboard) pasan por aquí.
 *
 * Arquitectura de 3 capas:
 *   1. CLASSIFY → intent, priority, risk
 *   2. DECIDE  → action, payload, confidence, reason
 *   3. LEARN   → update memory, customer profile, patterns
 *
 * Este módulo NUNCA improvisa. Cada decisión es trazable.
 */
import { createClient } from '@supabase/supabase-js'
import { makeDecision } from './agent-decision'
import { checkSlotAvailability, parseReservationConfig, generateSlots } from './scheduling-engine'
import { classifyInteraction, detectConflicts, generateSummary, learnFromInteraction } from './intelligence-engine'
import type { Classification, InteractionSummary, InteractionType, ActionType } from './intelligence-engine'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ═══════════════════════════════════════════════════════════════════════════
// TYPES — Input / Output contracts
// ═══════════════════════════════════════════════════════════════════════════

export interface DecisionInput {
  // WHO
  tenant_id: string
  customer_phone?: string
  customer_name?: string
  // WHAT
  channel: 'voice' | 'whatsapp' | 'email' | 'sms' | 'dashboard' | 'system'
  raw_text?: string              // Transcript, message, or notes
  detected_intent?: InteractionType
  // CONTEXT (for reservations/orders)
  date?: string
  time?: string
  party_size?: number
  zone?: string
  notes?: string
  service_type?: string
  order_items?: any[]
  // OVERRIDE
  force_action?: ActionType     // Dashboard manual override
}

export interface DecisionOutput {
  // DECISION
  action: ActionType
  action_payload: Record<string, any>
  confidence: number
  priority: 'critical' | 'high' | 'normal' | 'low'
  // EXPLANATION
  reason_codes: string[]
  human_summary: string         // One sentence explaining the decision
  // CONTEXT
  classification: Classification
  conflicts: Array<{ type: string; severity: string; description: string; suggested_action: string }>
  customer_context: CustomerMemory | null
  // FOLLOW-UP
  requires_human: boolean
  recommended_followup: string | null
  alert_owner: boolean
  alert_message: string | null
  // TRACE
  decision_trace: Array<{ step: string; result: string; ms: number }>
}

export interface CustomerMemory {
  id: string | null
  name: string
  phone: string
  total_visits: number
  no_shows: number
  cancels: number
  vip: boolean
  risk_score: number            // 0-100
  preferences: string[]         // Detected from history
  dietary_restrictions: string[]
  last_visit: string | null
  typical_party_size: number | null
  typical_time: string | null
  typical_day: string | null
  notes: string
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN ENTRY POINT — Every channel calls this
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The single decision function that ALL channels use.
 * Returns a structured, explainable decision.
 */
export async function decide(input: DecisionInput): Promise<DecisionOutput> {
  const trace: DecisionOutput['decision_trace'] = []
  const t0 = Date.now()

  // ── Step 1: Load customer memory ──
  const customerMemory = await loadCustomerMemory(input.tenant_id, input.customer_phone, input.customer_name)
  trace.push({ step: 'load_customer', result: customerMemory ? `${customerMemory.name} (${customerMemory.total_visits} visitas)` : 'nuevo', ms: Date.now() - t0 })

  // ── Step 2: Load business context ──
  const t1 = Date.now()
  const { data: tenant } = await supabase.from('tenants')
    .select('type,name,reservation_config')
    .eq('id', input.tenant_id).maybeSingle()
  const businessType = tenant?.type || 'otro'
  trace.push({ step: 'load_business', result: businessType, ms: Date.now() - t1 })

  // ── Step 3: Classify the interaction ──
  const t2 = Date.now()
  const classification = classifyInteraction({
    text: input.raw_text || input.notes || '',
    customer_phone: input.customer_phone,
    party_size: input.party_size,
    business_type: businessType,
    customer_history: customerMemory ? {
      total_reservations: customerMemory.total_visits,
      no_shows: customerMemory.no_shows,
      cancels: customerMemory.cancels,
      vip: customerMemory.vip,
    } : undefined,
  })
  trace.push({ step: 'classify', result: `${classification.type} p:${classification.priority} r:${classification.risk_level}`, ms: Date.now() - t2 })

  // ── Step 4: Detect conflicts (for reservation actions) ──
  const t3 = Date.now()
  const conflictsResult = (classification.type === 'reserva' || classification.type === 'modificacion')
    ? await detectConflicts({
        tenant_id: input.tenant_id,
        customer_phone: input.customer_phone,
        customer_name: input.customer_name,
        date: input.date,
        time: input.time,
        party_size: input.party_size,
      })
    : { conflicts: [] }
  trace.push({ step: 'detect_conflicts', result: `${conflictsResult.conflicts.length} found`, ms: Date.now() - t3 })

  // ── Step 5: Dashboard override ──
  if (input.force_action) {
    return buildOutput({
      action: input.force_action,
      confidence: 1.0,
      reason_codes: ['manual_override'],
      human_summary: `Acción manual: ${input.force_action}`,
      classification,
      conflicts: conflictsResult.conflicts,
      customerMemory,
      requires_human: false,
      trace,
    })
  }

  // ── Step 6: Critical conflict blocks action ──
  const criticalConflict = conflictsResult.conflicts.find(c => c.severity === 'critical')
  if (criticalConflict) {
    return buildOutput({
      action: 'reject',
      confidence: 0.95,
      reason_codes: ['critical_conflict', criticalConflict.type],
      human_summary: criticalConflict.description,
      classification,
      conflicts: conflictsResult.conflicts,
      customerMemory,
      requires_human: false,
      recommended_followup: criticalConflict.suggested_action,
      trace,
    })
  }

  // ── Step 7: Intelligence override for high-risk ──
  if (classification.requires_human && classification.risk_level >= 70) {
    return buildOutput({
      action: 'escalate',
      confidence: 0.9,
      reason_codes: ['high_risk', ...classification.flags],
      human_summary: classification.reasoning,
      classification,
      conflicts: conflictsResult.conflicts,
      customerMemory,
      requires_human: true,
      alert_owner: true,
      alert_message: `⚠ ${classification.type.toUpperCase()}: ${classification.reasoning}`,
      trace,
    })
  }

  // ── Step 8: Route to appropriate decision path ──
  const t4 = Date.now()
  let action: ActionType = classification.recommended_action
  let confidence = 0.8
  let reason_codes: string[] = []
  let human_summary = ''
  let requires_human = classification.requires_human
  let recommended_followup: string | null = null
  let alert_owner = false
  let alert_message: string | null = null

  switch (classification.type) {
    case 'reserva':
    case 'modificacion': {
      // Use the full decision engine for reservation decisions
      if (input.date && input.time) {
        const cfg = parseReservationConfig(tenant?.reservation_config, businessType)
        const decision = await makeDecision({
          tenantId: input.tenant_id,
          type: businessType,
          input: {
            party_size: input.party_size || 1,
            date: input.date,
            time: input.time,
            notes: input.notes || '',
            customer_name: input.customer_name,
            customer_phone: input.customer_phone,
          },
        })

        action = decision.action === 'auto_confirm' ? 'confirm'
          : decision.action === 'needs_review' ? 'mark_pending'
          : decision.action === 'reject' ? 'reject'
          : decision.action === 'crisis' ? 'escalate'
          : 'mark_pending'

        confidence = decision.confidence
        reason_codes = decision.flags || []
        human_summary = decision.reason || `${classification.type} procesada`
        requires_human = action === 'mark_pending' || action === 'escalate'

        // Chronic no-show override: even if decision says confirm, require review
        if (customerMemory && customerMemory.no_shows >= 3 && action === 'confirm') {
          action = 'mark_pending'
          reason_codes.push('chronic_no_show_override')
          human_summary += '. Cliente con historial de no-shows — requiere confirmación.'
          requires_human = true
          recommended_followup = 'Enviar recordatorio 24h antes. Considerar depósito.'
        }
      } else {
        action = 'request_info'
        human_summary = 'Faltan datos para procesar la reserva (fecha/hora).'
        reason_codes.push('incomplete_data')
      }
      break
    }

    case 'cancelacion': {
      action = 'confirm'
      confidence = 0.95
      human_summary = 'Cancelación procesada.'
      break
    }

    case 'pedido': {
      action = 'confirm'
      confidence = 0.9
      human_summary = 'Pedido registrado.'
      break
    }

    case 'queja': {
      action = 'escalate'
      confidence = 0.95
      requires_human = true
      alert_owner = true
      alert_message = `⚠ Queja recibida${input.customer_name ? ' de ' + input.customer_name : ''}`
      human_summary = 'Queja escalada al responsable.'
      recommended_followup = 'Contactar al cliente para resolver.'
      break
    }

    case 'urgencia': {
      action = 'escalate'
      confidence = 1.0
      requires_human = true
      alert_owner = true
      alert_message = classification.flags.includes('crisis')
        ? `🚨 CRISIS: ${input.customer_name || 'cliente'}`
        : `⚠ Urgencia: ${input.customer_name || 'cliente'}`
      human_summary = classification.reasoning
      break
    }

    default: {
      action = 'confirm'
      confidence = 0.85
      human_summary = 'Consulta atendida.'
    }
  }

  // Apply allergy/special occasion follow-ups
  if (classification.flags.includes('allergy_critical') && !recommended_followup) {
    recommended_followup = 'Avisar a cocina de restricciones alimentarias.'
  }
  if (classification.flags.includes('special_occasion') && !recommended_followup) {
    recommended_followup = 'Preparar detalles especiales (decoración, tarta, etc.)'
  }

  trace.push({ step: 'decide', result: `${action} (${confidence})`, ms: Date.now() - t4 })

  // ── Step 9: Learn from this interaction ──
  learnFromInteraction({
    tenant_id: input.tenant_id,
    type: classification.type,
    classification,
    customer_phone: input.customer_phone,
    outcome: action === 'reject' ? 'failure' : action === 'escalate' ? 'escalated' : 'success',
  }).catch(() => {}) // Non-blocking

  // ── Step 10: Update customer memory ──
  if (input.customer_phone && customerMemory) {
    updateCustomerMemory(input.tenant_id, input.customer_phone, classification.type).catch(() => {})
  }

  return buildOutput({
    action, confidence, reason_codes, human_summary,
    classification, conflicts: conflictsResult.conflicts,
    customerMemory, requires_human, recommended_followup,
    alert_owner, alert_message, trace,
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOMER MEMORY — Build rich profile from all data sources
// ═══════════════════════════════════════════════════════════════════════════

async function loadCustomerMemory(
  tenantId: string, phone?: string, name?: string
): Promise<CustomerMemory | null> {
  if (!phone && !name) return null
  const cleanPhone = (phone || '').replace(/[^0-9+]/g, '')

  // Find customer
  let customer: any = null
  if (cleanPhone.length >= 7) {
    const { data } = await supabase.from('customers')
      .select('id,name,phone,total_reservations,last_visit,vip,notes')
      .eq('tenant_id', tenantId)
      .or(`phone.eq.${cleanPhone},phone.eq.+${cleanPhone.replace(/^\+/, '')}`)
      .limit(1)
    customer = data?.[0]
  }
  if (!customer && name) {
    const { data } = await supabase.from('customers')
      .select('id,name,phone,total_reservations,last_visit,vip,notes')
      .eq('tenant_id', tenantId)
      .ilike('name', `%${name}%`)
      .limit(1)
    customer = data?.[0]
  }
  if (!customer) return null

  // Load reservation history
  const { data: reservations } = await supabase.from('reservations')
    .select('date,time,people,status,notes')
    .eq('tenant_id', tenantId)
    .eq('customer_phone', cleanPhone || customer.phone)
    .order('date', { ascending: false })
    .limit(15)

  const res = reservations || []
  const noShows = res.filter(r => r.status === 'no_show').length
  const cancels = res.filter(r => r.status === 'cancelada' || r.status === 'cancelled').length

  // Detect patterns
  const sizes = res.map(r => r.people).filter(Boolean)
  const times = res.map(r => r.time?.slice(0, 5)).filter(Boolean)
  const days = res.map(r => new Date(r.date + 'T12:00:00').getDay())
  const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

  // Dietary from notes
  const allNotes = res.map(r => r.notes || '').join(' ').toLowerCase()
  const dietary: string[] = []
  if (allNotes.includes('alergi') || allNotes.includes('intoler')) dietary.push('alergias')
  if (allNotes.includes('celiac') || allNotes.includes('sin gluten')) dietary.push('sin gluten')
  if (allNotes.includes('vegeta')) dietary.push('vegetariano')
  if (allNotes.includes('vegan')) dietary.push('vegano')
  if (allNotes.includes('sin lactosa')) dietary.push('sin lactosa')
  if (allNotes.includes('halal')) dietary.push('halal')
  if (allNotes.includes('kosher')) dietary.push('kosher')

  // Preferences from memory table
  const { data: memories } = await supabase.from('business_memory')
    .select('content')
    .eq('tenant_id', tenantId)
    .eq('memory_type', 'preference')
    .ilike('content', `%${customer.name || ''}%`)
    .limit(5)

  const preferences = (memories || []).map(m => m.content)

  // Risk score
  const totalRes = customer.total_reservations || res.length
  let risk = 0
  if (noShows >= 3) risk += 40
  else if (noShows >= 1 && totalRes > 0) risk += Math.round((noShows / totalRes) * 100)
  if (cancels >= 3 && totalRes > 0 && cancels / totalRes > 0.3) risk += 15
  risk = Math.max(0, Math.min(100, risk))

  return {
    id: customer.id,
    name: customer.name || 'desconocido',
    phone: customer.phone || cleanPhone,
    total_visits: totalRes,
    no_shows: noShows,
    cancels,
    vip: customer.vip || false,
    risk_score: risk,
    preferences,
    dietary_restrictions: dietary,
    last_visit: customer.last_visit,
    typical_party_size: mode(sizes),
    typical_time: mode(times),
    typical_day: mode(days) !== null ? dayNames[mode(days)!] : null,
    notes: customer.notes || '',
  }
}

async function updateCustomerMemory(tenantId: string, phone: string, interactionType: InteractionType): Promise<void> {
  const cleanPhone = phone.replace(/[^0-9+]/g, '')
  if (cleanPhone.length < 7) return

  // Update last interaction timestamp
  await supabase.from('customers')
    .update({ last_visit: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .or(`phone.eq.${cleanPhone},phone.eq.+${cleanPhone.replace(/^\+/, '')}`)
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function mode<T>(arr: T[]): T | null {
  if (arr.length === 0) return null
  const counts = new Map<T, number>()
  let maxCount = 0; let maxVal: T = arr[0]
  for (const v of arr) {
    const c = (counts.get(v) || 0) + 1
    counts.set(v, c)
    if (c > maxCount) { maxCount = c; maxVal = v }
  }
  return maxCount >= 2 ? maxVal : null
}

function buildOutput(params: {
  action: ActionType; confidence: number; reason_codes: string[]
  human_summary: string; classification: Classification
  conflicts: DecisionOutput['conflicts']; customerMemory: CustomerMemory | null
  requires_human: boolean; recommended_followup?: string | null
  alert_owner?: boolean; alert_message?: string | null
  trace: DecisionOutput['decision_trace']
}): DecisionOutput {
  return {
    action: params.action,
    action_payload: {},
    confidence: params.confidence,
    priority: params.classification.priority,
    reason_codes: params.reason_codes,
    human_summary: params.human_summary,
    classification: params.classification,
    conflicts: params.conflicts,
    customer_context: params.customerMemory,
    requires_human: params.requires_human,
    recommended_followup: params.recommended_followup || null,
    alert_owner: params.alert_owner || false,
    alert_message: params.alert_message || null,
    decision_trace: params.trace,
  }
}
