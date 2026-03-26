/**
 * AGENT DECISION ENGINE — Per-type decision logic for Reservo.AI
 *
 * Evaluates reservation/action requests against business-type-specific rules.
 * Returns: auto-confirm, needs-review, or reject — with reason and confidence.
 *
 * Used by agent-tools.ts to decide if a reservation can be auto-confirmed
 * or if the owner needs to review it first.
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Default rules per business type ──────────────────────────
export const DEFAULT_RULES: Record<string, TypeRules> = {
  restaurante: {
    max_auto_party_size: 8,
    max_capacity: 60,
    slot_duration: 90,
    advance_booking_hours: 2,
    advance_booking_max_days: 60,
    large_group_min: 8,
    auto_confirm: true,
    require_review_flags: ['large_group', 'special_occasion', 'allergy_critical'],
    urgency_keywords: ['hoy', 'ahora', 'urgente', 'ya'],
    blocked_keywords: [],
  },
  bar: {
    max_auto_party_size: 10,
    max_capacity: 80,
    slot_duration: 90,
    advance_booking_hours: 1,
    advance_booking_max_days: 30,
    large_group_min: 10,
    auto_confirm: true,
    require_review_flags: ['large_group', 'private_event'],
    urgency_keywords: ['hoy', 'ahora', 'esta noche'],
    blocked_keywords: [],
  },
  hotel: {
    max_auto_party_size: 6,
    max_capacity: 100,
    slot_duration: 1440,
    advance_booking_hours: 0,
    advance_booking_max_days: 365,
    large_group_min: 5,
    auto_confirm: true,
    require_review_flags: ['large_group', 'long_stay', 'special_request'],
    urgency_keywords: ['hoy', 'ahora', 'esta noche', 'urgente'],
    blocked_keywords: [],
  },
  clinica_dental: {
    max_auto_party_size: 1,
    max_capacity: 10,
    slot_duration: 30,
    advance_booking_hours: 0,
    advance_booking_max_days: 90,
    large_group_min: 1,
    auto_confirm: true,
    require_review_flags: ['urgency', 'first_visit_complex'],
    urgency_keywords: ['dolor', 'urgente', 'se me ha roto', 'me duele', 'sangra', 'hinchado'],
    blocked_keywords: [],
  },
  clinica_medica: {
    max_auto_party_size: 1,
    max_capacity: 15,
    slot_duration: 20,
    advance_booking_hours: 0,
    advance_booking_max_days: 90,
    large_group_min: 1,
    auto_confirm: true,
    require_review_flags: ['urgency'],
    urgency_keywords: ['dolor', 'urgente', 'fiebre', 'urgencias', 'muy mal'],
    blocked_keywords: [],
  },
  veterinaria: {
    max_auto_party_size: 1,
    max_capacity: 8,
    slot_duration: 30,
    advance_booking_hours: 0,
    advance_booking_max_days: 60,
    large_group_min: 1,
    auto_confirm: true,
    require_review_flags: ['urgency', 'surgery'],
    urgency_keywords: ['no respira', 'accidente', 'no come', 'muy mal', 'urgente', 'atropello', 'sangre'],
    blocked_keywords: [],
  },
  peluqueria: {
    max_auto_party_size: 1,
    max_capacity: 10,
    slot_duration: 45,
    advance_booking_hours: 1,
    advance_booking_max_days: 30,
    large_group_min: 3,
    auto_confirm: true,
    require_review_flags: ['large_group'],
    urgency_keywords: ['hoy', 'urgente'],
    blocked_keywords: [],
  },
  barberia: {
    max_auto_party_size: 1,
    max_capacity: 8,
    slot_duration: 30,
    advance_booking_hours: 1,
    advance_booking_max_days: 30,
    large_group_min: 3,
    auto_confirm: true,
    require_review_flags: ['large_group'],
    urgency_keywords: ['hoy', 'urgente'],
    blocked_keywords: [],
  },
  fisioterapia: {
    max_auto_party_size: 1,
    max_capacity: 6,
    slot_duration: 45,
    advance_booking_hours: 2,
    advance_booking_max_days: 60,
    large_group_min: 1,
    auto_confirm: true,
    require_review_flags: ['urgency', 'post_surgery'],
    urgency_keywords: ['dolor agudo', 'urgente', 'post-operatorio', 'no puedo moverme'],
    blocked_keywords: [],
  },
  psicologia: {
    max_auto_party_size: 1,
    max_capacity: 4,
    slot_duration: 50,
    advance_booking_hours: 4,
    advance_booking_max_days: 60,
    large_group_min: 1,
    auto_confirm: true,
    require_review_flags: ['crisis'],
    urgency_keywords: [],
    crisis_keywords: ['suicidio', 'hacerme daño', 'no puedo más', 'autolesión', 'crisis'],
    blocked_keywords: [],
  },
  asesoria: {
    max_auto_party_size: 3,
    max_capacity: 8,
    slot_duration: 60,
    advance_booking_hours: 4,
    advance_booking_max_days: 30,
    large_group_min: 3,
    auto_confirm: true,
    require_review_flags: ['complex_case'],
    urgency_keywords: ['urgente', 'juicio', 'inspección', 'plazo', 'multa'],
    blocked_keywords: [],
  },
  seguros: {
    max_auto_party_size: 2,
    max_capacity: 6,
    slot_duration: 30,
    advance_booking_hours: 2,
    advance_booking_max_days: 30,
    large_group_min: 2,
    auto_confirm: true,
    require_review_flags: ['siniestro'],
    urgency_keywords: ['siniestro', 'accidente', 'robo', 'urgente', 'incendio'],
    blocked_keywords: [],
  },
  inmobiliaria: {
    max_auto_party_size: 4,
    max_capacity: 10,
    slot_duration: 60,
    advance_booking_hours: 2,
    advance_booking_max_days: 14,
    large_group_min: 4,
    auto_confirm: true,
    require_review_flags: [],
    urgency_keywords: ['hoy', 'urgente'],
    blocked_keywords: [],
  },
  gimnasio: {
    max_auto_party_size: 1,
    max_capacity: 25,
    slot_duration: 60,
    advance_booking_hours: 0,
    advance_booking_max_days: 7,
    large_group_min: 10,
    auto_confirm: true,
    require_review_flags: ['large_group'],
    urgency_keywords: [],
    blocked_keywords: [],
  },
  academia: {
    max_auto_party_size: 1,
    max_capacity: 20,
    slot_duration: 60,
    advance_booking_hours: 2,
    advance_booking_max_days: 30,
    large_group_min: 5,
    auto_confirm: true,
    require_review_flags: ['large_group'],
    urgency_keywords: [],
    blocked_keywords: [],
  },
  spa: {
    max_auto_party_size: 2,
    max_capacity: 8,
    slot_duration: 60,
    advance_booking_hours: 4,
    advance_booking_max_days: 30,
    large_group_min: 4,
    auto_confirm: true,
    require_review_flags: ['large_group', 'special_package'],
    urgency_keywords: ['hoy'],
    blocked_keywords: [],
  },
  taller: {
    max_auto_party_size: 1,
    max_capacity: 6,
    slot_duration: 120,
    advance_booking_hours: 0,
    advance_booking_max_days: 14,
    large_group_min: 1,
    auto_confirm: true,
    require_review_flags: ['urgency', 'tow_required'],
    urgency_keywords: ['avería', 'no arranca', 'humo', 'ruido raro', 'urgente', 'grúa'],
    blocked_keywords: [],
  },
  ecommerce: {
    max_auto_party_size: 99,
    max_capacity: 9999,
    slot_duration: 30,
    advance_booking_hours: 0,
    advance_booking_max_days: 365,
    large_group_min: 99,
    auto_confirm: true,
    require_review_flags: ['high_value_order'],
    urgency_keywords: [],
    blocked_keywords: [],
  },
  cafeteria: {
    max_auto_party_size: 6,
    max_capacity: 40,
    slot_duration: 60,
    advance_booking_hours: 1,
    advance_booking_max_days: 14,
    large_group_min: 6,
    auto_confirm: true,
    require_review_flags: ['large_group'],
    urgency_keywords: ['hoy', 'ahora'],
    blocked_keywords: [],
  },
}

export interface TypeRules {
  max_auto_party_size: number
  max_capacity: number
  slot_duration: number
  advance_booking_hours: number
  advance_booking_max_days: number
  large_group_min: number
  auto_confirm: boolean
  require_review_flags: string[]
  urgency_keywords: string[]
  crisis_keywords?: string[]
  blocked_keywords: string[]
}

export interface DecisionResult {
  action: 'auto_confirm' | 'needs_review' | 'reject' | 'crisis'
  confidence: number
  reason: string
  flags: string[]
  status: 'confirmed' | 'pending_review' | 'rejected'
}

/**
 * Get rules for a business type. Merges defaults with any overrides
 * stored in the business_rules table.
 */
export async function getRulesForTenant(
  tenantId: string,
  businessType: string
): Promise<TypeRules> {
  const defaults = DEFAULT_RULES[businessType] || DEFAULT_RULES.restaurante

  // Load owner overrides from DB
  const { data } = await supabase
    .from('business_rules')
    .select('rule_key, rule_value')
    .eq('tenant_id', tenantId)

  if (!data || data.length === 0) return defaults

  const overrides: Record<string, string> = {}
  for (const r of data) overrides[r.rule_key] = r.rule_value

  return {
    ...defaults,
    max_auto_party_size: overrides.max_auto_party_size
      ? parseInt(overrides.max_auto_party_size) : defaults.max_auto_party_size,
    max_capacity: overrides.max_capacity
      ? parseInt(overrides.max_capacity) : defaults.max_capacity,
    large_group_min: overrides.large_group_min
      ? parseInt(overrides.large_group_min) : defaults.large_group_min,
    auto_confirm: overrides.auto_confirm !== undefined
      ? overrides.auto_confirm === 'true' : defaults.auto_confirm,
    advance_booking_max_days: overrides.advance_booking_max_days
      ? parseInt(overrides.advance_booking_max_days) : defaults.advance_booking_max_days,
  }
}

/**
 * Main decision function. Evaluates a reservation request against
 * business-type-specific rules and returns a decision.
 */
export async function makeDecision(params: {
  tenantId: string
  type: string
  input: {
    party_size?: number
    date?: string
    time?: string
    notes?: string
    customer_name?: string
    customer_phone?: string
    is_new_customer?: boolean
  }
  rules?: TypeRules
}): Promise<DecisionResult> {
  const { tenantId, type, input } = params
  const rules = params.rules || await getRulesForTenant(tenantId, type)
  const flags: string[] = []
  const partySize = input.party_size || 1
  const notes = (input.notes || '').toLowerCase()
  const today = new Date()

  // ── 1. Crisis detection (psicologia) ─────────────────────
  if (rules.crisis_keywords && rules.crisis_keywords.length > 0) {
    const allText = `${notes} ${input.customer_name || ''}`.toLowerCase()
    const isCrisis = rules.crisis_keywords.some(kw => allText.includes(kw))
    if (isCrisis) {
      return {
        action: 'crisis',
        confidence: 1.0,
        reason: 'Detectadas palabras clave de crisis. Ofrecer teléfono 024 y cita urgente.',
        flags: ['crisis'],
        status: 'pending_review',
      }
    }
  }

  // ── 2. Blocked keywords ──────────────────────────────────
  if (rules.blocked_keywords.length > 0) {
    const blocked = rules.blocked_keywords.some(kw => notes.includes(kw))
    if (blocked) {
      return {
        action: 'reject',
        confidence: 0.95,
        reason: 'Solicitud contiene contenido bloqueado por las reglas del negocio.',
        flags: ['blocked_content'],
        status: 'rejected',
      }
    }
  }

  // ── 3. Date validation ───────────────────────────────────
  if (input.date) {
    const requestDate = new Date(input.date + 'T12:00:00')
    const diffDays = Math.ceil((requestDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    // Too far in advance
    if (diffDays > rules.advance_booking_max_days) {
      return {
        action: 'reject',
        confidence: 0.9,
        reason: `No aceptamos reservas con más de ${rules.advance_booking_max_days} días de antelación.`,
        flags: ['too_far_advance'],
        status: 'rejected',
      }
    }

    // Past date
    if (diffDays < 0) {
      return {
        action: 'reject',
        confidence: 1.0,
        reason: 'La fecha solicitada ya ha pasado.',
        flags: ['past_date'],
        status: 'rejected',
      }
    }
  }

  // ── 4. Urgency detection ─────────────────────────────────
  const allText = `${notes} ${input.date || ''} ${input.time || ''}`.toLowerCase()
  const isUrgent = rules.urgency_keywords.some(kw => allText.includes(kw))
  if (isUrgent) flags.push('urgency')

  // ── 5. Large group detection ─────────────────────────────
  if (partySize >= rules.large_group_min) {
    flags.push('large_group')
  }

  // ── 6. Special occasion / allergy detection ──────────────
  const specialOccasionKw = ['cumpleaños', 'aniversario', 'celebración', 'boda', 'pedida', 'comunión']
  if (specialOccasionKw.some(kw => notes.includes(kw))) {
    flags.push('special_occasion')
  }

  const allergyKw = ['alergia', 'alérgico', 'celiaco', 'celíaco', 'intolerante', 'intolerancia', 'anafilaxia', 'epinefrina']
  if (allergyKw.some(kw => notes.includes(kw))) {
    flags.push('allergy_critical')
  }

  // Hotel-specific: long stays
  if (type === 'hotel' && input.date && input.notes) {
    const checkoutMatch = input.notes.match(/checkout[:\s]*(\d{4}-\d{2}-\d{2})/)
    if (checkoutMatch) {
      const checkin = new Date(input.date + 'T12:00:00')
      const checkout = new Date(checkoutMatch[1] + 'T12:00:00')
      const nights = Math.ceil((checkout.getTime() - checkin.getTime()) / (1000 * 60 * 60 * 24))
      if (nights > 14) flags.push('long_stay')
    }
  }

  // Taller-specific: tow required
  if (type === 'taller') {
    const towKw = ['grúa', 'remolque', 'no arranca', 'no se mueve']
    if (towKw.some(kw => notes.includes(kw))) flags.push('tow_required')
  }

  // Ecommerce-specific: high value
  if (type === 'ecommerce') {
    const priceMatch = notes.match(/(\d+(?:\.\d+)?)\s*€/)
    if (priceMatch && parseFloat(priceMatch[1]) > 500) flags.push('high_value_order')
  }

  // ── 7. Decision based on flags ───────────────────────────
  const needsReview = flags.some(f => rules.require_review_flags.includes(f))

  // Auto-confirm disabled by owner
  if (!rules.auto_confirm) {
    return {
      action: 'needs_review',
      confidence: 0.8,
      reason: 'El propietario tiene la auto-confirmación desactivada. Todas las reservas requieren revisión.',
      flags,
      status: 'pending_review',
    }
  }

  // Party size exceeds auto-confirm threshold
  if (partySize > rules.max_auto_party_size) {
    return {
      action: 'needs_review',
      confidence: 0.85,
      reason: `Grupo de ${partySize} personas supera el máximo auto-confirmable (${rules.max_auto_party_size}). Requiere revisión del propietario.`,
      flags: [...flags, 'exceeds_auto_limit'],
      status: 'pending_review',
    }
  }

  // Flags trigger review
  if (needsReview) {
    return {
      action: 'needs_review',
      confidence: 0.8,
      reason: `Reserva marcada para revisión: ${flags.join(', ')}`,
      flags,
      status: 'pending_review',
    }
  }

  // ── 8. Auto-confirm ──────────────────────────────────────
  let confidence = 0.95
  if (isUrgent) confidence -= 0.05
  if (input.is_new_customer) confidence -= 0.05

  return {
    action: 'auto_confirm',
    confidence,
    reason: `Reserva auto-confirmada para ${partySize} persona${partySize !== 1 ? 's' : ''}.`,
    flags,
    status: 'confirmed',
  }
}
