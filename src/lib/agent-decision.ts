/**
 * RESERVO.AI — Motor de Decisión del Agente
 * 
 * Implementa lógica de 3 niveles:
 *   1. Caso normal    → confirmar automáticamente
 *   2. Caso especial  → recoger datos, dejar pending_review
 *   3. Caso conflicto → escalar a needs_human_attention
 * 
 * Nunca inventa políticas. Trabaja con reglas del negocio + confianza.
 */

// ── TIPOS ──────────────────────────────────────────────────────────────────

export type InteractionStatus =
  | 'confirmed'
  | 'pending_review'
  | 'modified'
  | 'cancelled'
  | 'rejected'
  | 'needs_human_attention'
  | 'incomplete'

export type SpecialFlag =
  | 'large_group'
  | 'allergy_note'
  | 'specific_table_request'
  | 'low_confidence'
  | 'no_availability'
  | 'modification_request'
  | 'cancellation_request'
  | 'special_occasion'
  | 'accessibility_need'
  | 'late_arrival_notice'
  | 'out_of_policy'
  | 'confused_customer'
  | 'repeat_pattern'

export interface BusinessRules {
  max_auto_party_size:          number   // default 6
  special_requests_require_review: boolean // default true
  allow_auto_cancellations:     boolean  // default true
  offer_alternative_times:      boolean  // default true
  min_confidence_to_confirm:    number   // default 0.72
  patterns: Record<string, InteractionStatus>
}

export interface CallAnalysisInput {
  intent:          string
  customer_name:   string | null
  summary:         string
  action_required: string
  outcome:         string
  details:         Record<string, any>
  transcript:      string
  caller_phone:    string
}

export interface DecisionResult {
  intent:           string
  customer_name:    string | null
  phone_number:     string
  summary:          string
  details:          Record<string, any>
  status:           InteractionStatus
  confidence:       number
  action_required:  string
  special_flags:    SpecialFlag[]
  reasoning_label:  string
  response_hint:    string  // frase sugerida para responder al cliente
  applied_rule:     string  // regla específica que desencadenó la decisión
  knowledge_source: string  // origen del conocimiento usado: "menu.carnes", "faqs", "rules"…
  decision_trace:   DecisionTraceStep[]  // pasos de la decisión (trazabilidad completa)
}

export interface DecisionTraceStep {
  step:    string   // "flag_detection" | "confidence_calc" | "rule_match" | "knowledge_query"
  label:   string   // descripción legible
  result:  string   // lo que se encontró / decidió
  source?: string   // origen si aplica
}

// ── DETECCIÓN DE FLAGS ──────────────────────────────────────────────────────

const ALLERGY_KEYWORDS   = /alerg|intoler|celiaco|gluten|lactosa|vegano|vegetarian|sin mariscos|sin nueces|sin cacahuete/i
const OCCASION_KEYWORDS  = /cumplea|aniversario|boda|pedida|despedida|celebraci|sorpresa|evento especial/i
const TABLE_KEYWORDS     = /mesa \d+|la mesa de la ventana|la mesa del rincón|terraza concreta|mesa específica/i
const CONFUSED_KEYWORDS  = /no sé|no entiendo|qué\?|cómo\?|perdona\?|repita|puede repetir|no le oigo/i
const ACCESS_KEYWORDS    = /silla de ruedas|movilidad reducida|acceso|discapacidad|carrito de bebé|rampa/i
const LATE_KEYWORDS      = /llegaré tarde|llegaremos sobre|con retraso|unos minutos tarde|quizás tarde/i
const POLICY_KEYWORDS    = /descuento|gratis|precio especial|sin pagar|habitación|hotel|servicio no ofrecido/i
const CANCEL_KEYWORDS    = /cancelar|anular|borrar|no voy|no podemos|cancelaci/i
const MODIFY_KEYWORDS    = /cambiar|modificar|mover|adelantar|retrasar|cambio de hora|cambio de día/i

function detectFlags(transcript: string, partySize: number, rules: BusinessRules): SpecialFlag[] {
  const flags: SpecialFlag[] = []
  if (ALLERGY_KEYWORDS.test(transcript))              flags.push('allergy_note')
  if (OCCASION_KEYWORDS.test(transcript))             flags.push('special_occasion')
  if (TABLE_KEYWORDS.test(transcript))                flags.push('specific_table_request')
  if (CONFUSED_KEYWORDS.test(transcript))             flags.push('confused_customer')
  if (ACCESS_KEYWORDS.test(transcript))               flags.push('accessibility_need')
  if (LATE_KEYWORDS.test(transcript))                 flags.push('late_arrival_notice')
  if (POLICY_KEYWORDS.test(transcript))               flags.push('out_of_policy')
  if (CANCEL_KEYWORDS.test(transcript))               flags.push('cancellation_request')
  if (MODIFY_KEYWORDS.test(transcript))               flags.push('modification_request')
  if (partySize > rules.max_auto_party_size)          flags.push('large_group')
  return flags
}

// ── CÁLCULO DE CONFIANZA ────────────────────────────────────────────────────

function calcConfidence(analysis: CallAnalysisInput, partySize: number, flags: SpecialFlag[]): number {
  let score = 1.0

  // Datos básicos presentes
  if (!analysis.customer_name)    score -= 0.15
  if (!analysis.transcript || analysis.transcript.trim().length < 40) score -= 0.25

  // Flags que reducen confianza
  if (flags.includes('confused_customer'))   score -= 0.25
  if (flags.includes('low_confidence'))      score -= 0.20
  if (flags.includes('out_of_policy'))       score -= 0.15

  // Intención ambigua o desconocida
  if (['otro', 'unknown'].includes(analysis.intent)) score -= 0.20

  // Grupo muy grande
  if (partySize > 10) score -= 0.10

  return Math.max(0, Math.min(1, Math.round(score * 100) / 100))
}

// ── MOTOR DE DECISIÓN PRINCIPAL ─────────────────────────────────────────────

export function decideStatus(
  analysis:  CallAnalysisInput,
  rules:     BusinessRules,
  flags:     SpecialFlag[],
  confidence: number
): { status: InteractionStatus; reasoning: string; response_hint: string } {

  const intent = analysis.intent

  // ── Cancelaciones ────────────────────────────────────────────────────────
  if (flags.includes('cancellation_request') || intent === 'cancelacion') {
    if (rules.allow_auto_cancellations && confidence >= 0.70 && analysis.customer_name) {
      return {
        status: 'cancelled',
        reasoning: 'Cancelación con datos completos y confianza suficiente',
        response_hint: 'Cancelación procesada correctamente. ¡Hasta pronto!'
      }
    }
    return {
      status: 'pending_review',
      reasoning: 'Cancelación solicitada — revisar para localizar la cita',
      response_hint: 'Lo dejo anotado para revisarlo y confirmárselo enseguida.'
    }
  }

  // ── Modificaciones ───────────────────────────────────────────────────────
  if (flags.includes('modification_request') || intent === 'modificacion') {
    return {
      status: 'pending_review',
      reasoning: 'Modificación solicitada — requiere localizar cita original',
      response_hint: 'Perfecto, lo dejo anotado y le confirmamos el cambio.'
    }
  }

  // ── Confianza baja → escalar siempre ────────────────────────────────────
  if (confidence < rules.min_confidence_to_confirm) {
    if (!flags.includes('low_confidence')) flags.push('low_confidence')
    return {
      status: 'needs_human_attention',
      reasoning: 'Confianza baja (' + (confidence * 100).toFixed(0) + '%) — no confirmar automáticamente',
      response_hint: 'Ahora mismo no lo tengo del todo claro, lo dejo anotado para revisarlo.'
    }
  }

  // ── Cliente confuso ──────────────────────────────────────────────────────
  if (flags.includes('confused_customer')) {
    return {
      status: 'needs_human_attention',
      reasoning: 'Cliente con dificultades para comunicarse — requiere atención humana',
      response_hint: 'Déjeme que lo anoto y le llaman en breve para confirmar.'
    }
  }

  // ── Petición fuera de política ───────────────────────────────────────────
  if (flags.includes('out_of_policy')) {
    return {
      status: 'rejected',
      reasoning: 'Petición fuera de las reglas del negocio',
      response_hint: 'Lo siento, eso no está disponible. ¿Puedo ayudarle con otra cosa?'
    }
  }

  // ── Patrones del negocio (aprendidos) ───────────────────────────────────
  for (const [pattern, patternStatus] of Object.entries(rules.patterns)) {
    const matches =
      (pattern === 'large_group'        && flags.includes('large_group')) ||
      (pattern === 'birthday_requests'  && flags.includes('special_occasion')) ||
      (pattern === 'allergy_notes'      && flags.includes('allergy_note')) ||
      (pattern === 'table_specific'     && flags.includes('specific_table_request')) ||
      (pattern === 'accessibility'      && flags.includes('accessibility_need'))
    if (matches) {
      return {
        status: patternStatus,
        reasoning: 'Patrón del negocio aplicado: ' + pattern,
        response_hint: 'Lo dejo anotado y lo revisamos para confirmárselo.'
      }
    }
  }

  // ── Flags que fuerzan revisión ───────────────────────────────────────────
  const reviewFlags: SpecialFlag[] = ['allergy_note','specific_table_request','special_occasion','accessibility_need','large_group']
  const hasReviewFlag = flags.some(f => reviewFlags.includes(f))
  if (hasReviewFlag && rules.special_requests_require_review) {
    return {
      status: 'pending_review',
      reasoning: 'Observación especial detectada: ' + flags.filter(f => reviewFlags.includes(f)).join(', '),
      response_hint: 'Perfecto, le tomo nota y lo revisa el equipo para confirmárselo.'
    }
  }

  // ── Caso normal → confirmar ──────────────────────────────────────────────
  if (['reserva', 'pedido', 'consulta'].includes(intent) && confidence >= rules.min_confidence_to_confirm) {
    return {
      status: 'confirmed',
      reasoning: 'Caso normal con confianza ' + (confidence * 100).toFixed(0) + '%',
      response_hint: 'Perfecto, queda confirmado. ¡Hasta pronto!'
    }
  }

  // ── Fallback seguro ──────────────────────────────────────────────────────
  return {
    status: 'incomplete',
    reasoning: 'Llamada procesada sin acción clara',
    response_hint: 'Lo dejamos anotado por si necesita algo más.'
  }
}

// ── FUNCIÓN PRINCIPAL EXPORTABLE ────────────────────────────────────────────

export function makeDecision(
  analysis: CallAnalysisInput,
  rules:    BusinessRules,
  knowledgeSource = 'none'
): DecisionResult {

  const trace: DecisionTraceStep[] = []

  // Extraer tamaño del grupo del transcript
  const partySizeMatch = analysis.transcript.match(/(\d+)\s*(?:personas?|comensales?|adultos?|de grupo)/i)
  const partySize = partySizeMatch ? parseInt(partySizeMatch[1]) : 1

  // Detectar flags
  const flags = detectFlags(analysis.transcript, partySize, rules)
  trace.push({
    step: 'flag_detection',
    label: 'Flags detectados',
    result: flags.length > 0 ? flags.join(', ') : 'ninguno',
  })

  // Calcular confianza
  const confidence = calcConfidence(analysis, partySize, flags)
  trace.push({
    step: 'confidence_calc',
    label: 'Confianza calculada',
    result: (confidence * 100).toFixed(0) + '%',
  })

  // Decidir estado
  const { status, reasoning, response_hint } = decideStatus(analysis, rules, flags, confidence)

  // Determinar applied_rule
  let appliedRule = 'default'
  if (flags.includes('cancellation_request') || analysis.intent === 'cancelacion')
    appliedRule = 'allow_auto_cancellations'
  else if (flags.includes('modification_request'))
    appliedRule = 'modification_requires_review'
  else if (confidence < rules.min_confidence_to_confirm)
    appliedRule = `min_confidence_to_confirm (${rules.min_confidence_to_confirm})`
  else if (flags.includes('confused_customer'))
    appliedRule = 'confused_customer_escalate'
  else if (flags.includes('out_of_policy'))
    appliedRule = 'out_of_policy_reject'
  else if (flags.includes('large_group'))
    appliedRule = `max_auto_party_size (${rules.max_auto_party_size})`
  else if (flags.includes('allergy_note') || flags.includes('special_occasion') || flags.includes('specific_table_request'))
    appliedRule = 'special_requests_require_review'
  else if (['reserva','pedido','consulta'].includes(analysis.intent))
    appliedRule = 'auto_confirm_normal_case'

  trace.push({
    step: 'rule_match',
    label: 'Regla aplicada',
    result: appliedRule,
    source: 'business_rules',
  })

  trace.push({
    step: 'decision',
    label: 'Decisión final',
    result: status,
    source: reasoning,
  })

  return {
    intent:           analysis.intent,
    customer_name:    analysis.customer_name,
    phone_number:     analysis.caller_phone,
    summary:          analysis.summary,
    details:          { ...analysis.details, party_size: partySize },
    status,
    confidence,
    action_required:  analysis.action_required,
    special_flags:    flags,
    reasoning_label:  reasoning,
    response_hint,
    applied_rule:     appliedRule,
    knowledge_source: knowledgeSource,
    decision_trace:   trace,
  }
}

// ── REGLAS POR DEFECTO ──────────────────────────────────────────────────────

export const DEFAULT_RULES: BusinessRules = {
  max_auto_party_size:             6,
  special_requests_require_review: true,
  allow_auto_cancellations:        true,
  offer_alternative_times:         true,
  min_confidence_to_confirm:       0.72,
  patterns: {
    large_group:       'pending_review',
    birthday_requests: 'pending_review',
    allergy_notes:     'pending_review',
    table_specific:    'pending_review',
    accessibility:     'pending_review',
  },
}
