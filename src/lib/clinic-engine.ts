/**
 * RESERVO.AI — Motor de Clínicas
 * ──────────────────────────────────────────────────────────────────────────
 * Lógica clínica específica: detección de urgencias, duración por tratamiento,
 * decisiones automáticas. NO comparte nada con la lógica de restaurante.
 *
 * Principios:
 *  - Urgencia = NUNCA confirmar automáticamente → siempre pending_review
 *  - Duración exacta por tipo → scheduling sin solapamientos
 *  - Memoria por clínica → patrones aprendidos del propio negocio
 */

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type ConsultationType =
  | 'limpieza' | 'revision' | 'tratamiento' | 'urgencia'
  | 'primera_visita' | 'seguimiento' | 'consulta' | 'otro'

export type UrgencyLevel = 'alta' | 'media' | 'baja'

export interface UrgencyDetection {
  is_urgency:    boolean
  urgency_level: UrgencyLevel | null
  matched_keywords: string[]
  reason: string
}

export interface ConsultationClassification {
  type:             ConsultationType
  duration_minutes: number
  confidence:       number
  reason:           string
}

export interface ClinicDecision {
  status:          'confirmed' | 'pending_review' | 'escalated' | 'incomplete'
  action_required: string
  response_hint:   string   // frase para el agente
  reasoning:       string
  trace:           Array<{ step: string; result: string }>
}

// ── Duraciones por tipo de consulta ──────────────────────────────────────────
// Configurable: la clínica puede sobrescribir con sus datos reales.

export const DEFAULT_DURATIONS: Record<ConsultationType, number> = {
  limpieza:        30,
  revision:        20,
  primera_visita:  30,
  seguimiento:     15,
  consulta:        20,
  tratamiento:     60,
  urgencia:        30,   // reservamos slot mínimo pero es manual
  otro:            20,
}

// Permitir que la clínica ajuste duraciones desde su agent_config
export function getDuration(type: ConsultationType, overrides?: Record<string, number>): number {
  return overrides?.[type] ?? DEFAULT_DURATIONS[type] ?? 20
}

// ── Keywords de urgencia por nivel ────────────────────────────────────────────

const URGENCY_HIGH = [
  // Dolor intenso
  /dolor\s+(muy\s+)?fuerte/i, /dolor\s+insoportable/i, /mucho\s+dolor/i, /me\s+duele\s+mucho/i,
  /dolor\s+intenso/i, /dolor\s+terrible/i,
  // Infección / inflamación grave
  /infección/i, /inflamad[oa]/i, /hinchad[oa]/i, /absceso/i, /pus/i,
  // Sangrado
  /sangr(ando|ado|e)/i, /hemorragia/i, /sangre/i,
  // Trauma / accidente
  /accident[e]?/i, /golpe\s+en/i, /diente\s+roto/i, /muela\s+rota/i,
  /fractura/i, /me\s+caí/i, /me\s+pegué/i,
  // Urgencia explícita
  /urgente/i, /urgencia/i, /emergencia/i, /es\s+urgente/i, /muy\s+urgente/i,
  // Síntomas médicos graves
  /fiebre\s+alta/i, /no\s+puedo\s+abrir\s+la\s+boca/i, /dificultad\s+para\s+tragar/i,
  /inflamación\s+del\s+cuello/i,
]

const URGENCY_MEDIUM = [
  /me\s+duele/i, /dolor/i, /molestia/i, /malestar/i,
  /sensib(le|ilidad)/i, /lo\s+antes\s+posible/i, /hoy\s+si\s+puede\s+ser/i,
  /roto/i, /caído/i, /perdí\s+una\s+corona/i, /corona\s+suelta/i,
  /empaste\s+caído/i, /empaste\s+roto/i, /bracket\s+roto/i,
  /se\s+me\s+ha\s+caído\s+un\s+diente/i,
]

const URGENCY_LOW = [
  /un\s+poco\s+de\s+dolor/i, /leve/i, /no\s+duele\s+mucho/i,
  /puede\s+esperar/i, /cuando\s+haya\s+hueco/i,
]

/**
 * Detecta urgencia desde el texto de la transcripción o síntomas.
 * Se llama en tiempo real durante la llamada, no solo al final.
 */
export function detectUrgency(text: string): UrgencyDetection {
  const matched: string[] = []

  // Nivel ALTA — siempre escala
  for (const re of URGENCY_HIGH) {
    const m = text.match(re)
    if (m) matched.push(m[0])
  }
  if (matched.length > 0) {
    return {
      is_urgency: true, urgency_level: 'alta',
      matched_keywords: matched,
      reason: `Síntomas de urgencia alta detectados: ${matched.slice(0,3).join(', ')}`
    }
  }

  // Nivel MEDIA — pending_review
  const mediumMatched: string[] = []
  for (const re of URGENCY_MEDIUM) {
    const m = text.match(re)
    if (m) mediumMatched.push(m[0])
  }
  if (mediumMatched.length >= 2) {   // 2+ señales medias = urgencia media
    return {
      is_urgency: true, urgency_level: 'media',
      matched_keywords: mediumMatched,
      reason: `Posible urgencia media: ${mediumMatched.slice(0,3).join(', ')}`
    }
  }

  // Nivel BAJA — no urgencia real
  for (const re of URGENCY_LOW) {
    const m = text.match(re)
    if (m) matched.push(m[0])
  }

  return {
    is_urgency: false, urgency_level: null,
    matched_keywords: matched,
    reason: matched.length ? `Sin urgencia — señales leves: ${matched.join(', ')}` : 'Sin señales de urgencia'
  }
}

// ── Clasificación del tipo de consulta ───────────────────────────────────────

const TYPE_PATTERNS: Array<{ type: ConsultationType; patterns: RegExp[]; weight: number }> = [
  { type:'urgencia', weight:10, patterns:[/urgencia/i,/urgente/i,/emergencia/i,/dolor\s+fuerte/i] },
  { type:'limpieza', weight:8, patterns:[/limpieza/i,/higiene\s+dental/i,/limpiar\s+(los\s+)?dientes/i,/sarro/i,/placa/i] },
  { type:'revision', weight:7, patterns:[/revisión/i,/revision/i,/chequeo/i,/ver\s+cómo\s+está/i,/control/i,/revisarme/i] },
  { type:'primera_visita', weight:9, patterns:[/primera\s+vez/i,/primera\s+visita/i,/nunca\s+he\s+venido/i,/nuevo\s+paciente/i,/nunca\s+he\s+ido/i] },
  { type:'seguimiento', weight:9, patterns:[/seguimiento/i,/próxima\s+cita/i,/siguiente\s+sesión/i,/continuar\s+el\s+tratamiento/i,/continuar\s+con/i,/volver\s+para/i,/me\s+toca\s+volver/i] },
  { type:'tratamiento', weight:7, patterns:[
    /ortodoncia/i,/brackets/i,/implante/i,/endodoncia/i,/empaste/i,/obturación/i,
    /extracción/i,/blanqueamiento/i,/carilla/i,/corona/i,/puente/i,/prótesis/i,
    /tratamiento/i,/operación/i,/intervención/i,
  ]},
]

export function classifyConsultation(text: string, urgency: UrgencyDetection): ConsultationClassification {
  if (urgency.is_urgency && urgency.urgency_level === 'alta') {
    return { type:'urgencia', duration_minutes:30, confidence:0.95, reason:'Urgencia alta detectada' }
  }

  const scores: Record<string, number> = {}
  for (const entry of TYPE_PATTERNS) {
    let score = 0
    for (const re of entry.patterns) {
      if (re.test(text)) score += entry.weight
    }
    if (score > 0) scores[entry.type] = score
  }

  const best = Object.entries(scores).sort((a,b)=>b[1]-a[1])[0]
  if (!best || best[1] < 6) {
    return { type:'consulta', duration_minutes:DEFAULT_DURATIONS.consulta, confidence:0.4, reason:'Sin clasificación clara — consulta genérica' }
  }

  const type = best[0] as ConsultationType
  return {
    type,
    duration_minutes: DEFAULT_DURATIONS[type],
    confidence: Math.min(0.95, best[1] / 20),
    reason: `Clasificado como ${type} por keywords (score: ${best[1]})`
  }
}

// ── Motor de decisión clínico ─────────────────────────────────────────────────

export function makeClinicDecision(params: {
  urgency:          UrgencyDetection
  classification:   ConsultationClassification
  patient_name:     string | null
  has_availability: boolean
  is_new_patient:   boolean
  confidence:       number
  rules?:           { auto_confirm_threshold?: number; always_review_urgency?: boolean }
}): ClinicDecision {
  const { urgency, classification, patient_name, has_availability, confidence, rules } = params
  const trace: ClinicDecision['trace'] = []
  const alwaysReviewUrgency = rules?.always_review_urgency ?? true
  const autoThreshold       = rules?.auto_confirm_threshold ?? 0.65

  trace.push({ step:'urgency_check', result: urgency.is_urgency
    ? `URGENCIA ${urgency.urgency_level?.toUpperCase()} — ${urgency.reason}`
    : 'Sin urgencia' })

  // REGLA 1: Urgencia alta → SIEMPRE escalar, nunca confirmar automáticamente
  if (urgency.is_urgency && urgency.urgency_level === 'alta') {
    trace.push({ step:'decision', result:'ESCALADO — urgencia alta' })
    return {
      status: 'escalated',
      action_required: 'Llamar al paciente inmediatamente',
      response_hint: 'Entiendo que tienes dolor. Voy a avisar al equipo ahora mismo para que te atiendan lo antes posible. ¿Puedes darnos tu número de teléfono?',
      reasoning: 'Urgencia alta — requiere atención inmediata, no confirmar automáticamente',
      trace,
    }
  }

  // REGLA 2: Urgencia media o con revisión explícita → pending_review
  if (urgency.is_urgency && alwaysReviewUrgency) {
    trace.push({ step:'decision', result:'PENDING_REVIEW — urgencia media' })
    return {
      status: 'pending_review',
      action_required: 'Revisar disponibilidad urgente y confirmar manualmente',
      response_hint: 'Entiendo, te anoto como preferente. El equipo te confirmará cita hoy mismo. ¿A qué número llamamos?',
      reasoning: 'Urgencia media — requiere revisión manual antes de confirmar',
      trace,
    }
  }

  trace.push({ step:'classification', result: `${classification.type} · ${classification.duration_minutes}min · confidence:${(confidence*100).toFixed(0)}%` })

  // REGLA 3: Sin disponibilidad → pending_review con sugerencia
  if (!has_availability) {
    trace.push({ step:'decision', result:'PENDING_REVIEW — sin hueco disponible' })
    return {
      status: 'pending_review',
      action_required: 'Buscar hueco disponible y proponer alternativa al paciente',
      response_hint: 'En este momento no tengo ese hueco disponible. Te busco opciones y te confirmo enseguida. ¿Qué días te vienen bien?',
      reasoning: 'Sin disponibilidad confirmada — no confirmar sin hueco real',
      trace,
    }
  }

  // REGLA 4: Sin nombre → no confirmar automáticamente
  if (!patient_name) {
    trace.push({ step:'decision', result:'PENDING_REVIEW — falta nombre del paciente' })
    return {
      status: 'pending_review',
      action_required: 'Pedir nombre del paciente antes de confirmar',
      response_hint: '¿Me dices tu nombre completo para apuntarlo?',
      reasoning: 'Falta dato obligatorio: nombre del paciente',
      trace,
    }
  }

  // REGLA 5: Confianza baja → pending_review
  // Para citas estándar con nombre y fecha la confianza baja es normal (paciente nuevo)
  const effectiveThreshold = (patient_name && params.has_availability) ? 0.35 : autoThreshold
  if (confidence < effectiveThreshold) {
    trace.push({ step:'decision', result:`PENDING_REVIEW — confianza baja (${(confidence*100).toFixed(0)}%)` })
    return {
      status: 'pending_review',
      action_required: 'Verificar datos de la cita antes de confirmar',
      response_hint: 'Te dejo anotado y te confirmamos en breve.',
      reasoning: `Confianza ${(confidence*100).toFixed(0)}% — por debajo del umbral (${(effectiveThreshold*100).toFixed(0)}%)`,
      trace,
    }
  }

  // CASO NORMAL: confirmar
  trace.push({ step:'decision', result:`CONFIRMED — ${classification.type} · ${classification.duration_minutes}min` })
  return {
    status: 'confirmed',
    action_required: 'Cita confirmada en el sistema',
    response_hint: `Perfecto ${patient_name}, te quedo apuntado/a. Te llegará la confirmación. ¡Hasta pronto!`,
    reasoning: `Cita normal confirmada — ${classification.type} · confianza ${(confidence*100).toFixed(0)}%`,
    trace,
  }
}
