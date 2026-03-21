/**
 * RESERVO.AI — Motor de Fisioterapia
 * ──────────────────────────────────────────────────────────────────────────
 * Lógica específica para clínicas de fisioterapia: clasificación de sesiones,
 * detección de urgencias, duración por tipo de sesión.
 * Sigue el patrón de clinic-engine.ts.
 */

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type FisioSessionType =
  | 'primera_visita' | 'seguimiento' | 'urgente' | 'valoracion' | 'sesion' | 'otro'

export type UrgencyLevel = 'alta' | 'media' | 'baja'

export interface FisioUrgencyDetection {
  is_urgency:    boolean
  urgency_level: UrgencyLevel | null
  matched_keywords: string[]
  reason: string
}

export interface FisioSessionClassification {
  type:             FisioSessionType
  duration_minutes: number
  confidence:       number
  reason:           string
}

// ── Duraciones por tipo ───────────────────────────────────────────────────────

export const FISIO_DURATIONS: Record<FisioSessionType, number> = {
  valoracion:     60,
  primera_visita: 60,
  seguimiento:    45,
  urgente:        30,
  sesion:         45,
  otro:           30,
}

export function getFisioDuration(type: FisioSessionType, overrides?: Record<string, number>): number {
  return overrides?.[type] ?? FISIO_DURATIONS[type] ?? 30
}

// ── Keywords de urgencia fisio ────────────────────────────────────────────────

const URGENCY_HIGH = [
  /dolor\s+(muy\s+)?fuerte/i, /dolor\s+insoportable/i, /mucho\s+dolor/i,
  /dolor\s+intenso/i, /no\s+puedo\s+mover/i, /no\s+me\s+puedo\s+mover/i,
  /bloqueo/i, /bloqueado/i, /contractura\s+severa/i,
  /fractura/i, /rotura/i, /esguince\s+grave/i,
  /accidente/i, /golpe\s+fuerte/i, /caída/i,
  /urgente/i, /urgencia/i, /emergencia/i,
  /hernia\s+discal/i, /ciática\s+aguda/i,
  /no\s+puedo\s+caminar/i, /no\s+puedo\s+andar/i,
]

const URGENCY_MEDIUM = [
  /me\s+duele/i, /dolor/i, /molestia/i,
  /contractura/i, /pinzamiento/i, /ciática/i,
  /lo\s+antes\s+posible/i, /hoy\s+si\s+puede\s+ser/i,
  /esguince/i, /tendinitis/i, /inflamación/i,
  /rigidez/i, /entumecimiento/i, /hormigueo/i,
]

const URGENCY_LOW = [
  /un\s+poco\s+de\s+dolor/i, /leve/i, /no\s+duele\s+mucho/i,
  /puede\s+esperar/i, /cuando\s+haya\s+hueco/i, /mantenimiento/i,
]

/**
 * Detecta urgencia desde el texto de la transcripción.
 */
export function detectFisioUrgency(text: string): FisioUrgencyDetection {
  const matched: string[] = []

  for (const re of URGENCY_HIGH) {
    const m = text.match(re)
    if (m) matched.push(m[0])
  }
  if (matched.length > 0) {
    return {
      is_urgency: true, urgency_level: 'alta',
      matched_keywords: matched,
      reason: `Urgencia alta fisio: ${matched.slice(0,3).join(', ')}`
    }
  }

  const mediumMatched: string[] = []
  for (const re of URGENCY_MEDIUM) {
    const m = text.match(re)
    if (m) mediumMatched.push(m[0])
  }
  if (mediumMatched.length >= 2) {
    return {
      is_urgency: true, urgency_level: 'media',
      matched_keywords: mediumMatched,
      reason: `Posible urgencia media: ${mediumMatched.slice(0,3).join(', ')}`
    }
  }

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

// ── Clasificación del tipo de sesión ──────────────────────────────────────────

const SESSION_PATTERNS: Array<{ type: FisioSessionType; patterns: RegExp[]; weight: number }> = [
  { type:'urgente',       weight:10, patterns:[/urgencia/i,/urgente/i,/emergencia/i,/dolor\s+fuerte/i,/no\s+puedo\s+mover/i] },
  { type:'seguimiento',   weight:9,  patterns:[/seguimiento/i,/próxima\s+sesión/i,/siguiente\s+sesión/i,/continuar\s+(el\s+)?tratamiento/i,/volver\s+para/i,/me\s+toca\s+volver/i,/vengo\s+a\s+continuar/i] },
  { type:'primera_visita', weight:9, patterns:[/primera\s+vez/i,/primera\s+visita/i,/nunca\s+he\s+venido/i,/nuevo\s+paciente/i] },
  { type:'valoracion',    weight:8,  patterns:[/valoración/i,/valoracion/i,/evaluación/i,/evaluacion/i,/diagnóstico/i,/diagnostico/i,/evaluar/i,/valorar/i] },
  { type:'sesion',        weight:6,  patterns:[
    /sesión/i,/rehabilitación/i,/rehabilitacion/i,/ejercicios/i,/terapia\s+manual/i,
    /masaje/i,/electroterapia/i,/punción\s+seca/i,/vendaje/i,/kinesiotaping/i,
    /ultrasonido/i,/tens/i,/magnetoterapia/i,/ondas\s+de\s+choque/i,
    /estiramientos/i,/fortalecimiento/i,/movilización/i,
  ]},
]

export function classifyFisioSession(text: string, urgency: FisioUrgencyDetection): FisioSessionClassification {
  if (urgency.is_urgency && urgency.urgency_level === 'alta') {
    return { type:'urgente', duration_minutes:30, confidence:0.95, reason:'Urgencia alta detectada' }
  }

  // Override semántico: continuación → seguimiento
  if (/\b(vengo\s+a\s+continuar|continuar\s+(el\s+|con\s+el\s+)?tratamiento|seguir\s+(con\s+)?el\s+tratamiento|próxima\s+sesión|siguiente\s+sesión|me\s+toca\s+volver)\b/i.test(text)) {
    return { type:'seguimiento', duration_minutes:FISIO_DURATIONS.seguimiento, confidence:0.88, reason:'Override: texto de continuación detectado' }
  }

  const scores: Record<string, number> = {}
  for (const entry of SESSION_PATTERNS) {
    let score = 0
    for (const re of entry.patterns) {
      if (re.test(text)) score += entry.weight
    }
    if (score > 0) scores[entry.type] = score
  }

  const best = Object.entries(scores).sort((a,b)=>b[1]-a[1])[0]
  if (!best || best[1] < 6) {
    return { type:'sesion', duration_minutes:FISIO_DURATIONS.sesion, confidence:0.4, reason:'Sin clasificación clara — sesión genérica' }
  }

  const type = best[0] as FisioSessionType
  return {
    type,
    duration_minutes: FISIO_DURATIONS[type],
    confidence: Math.min(0.95, best[1] / 20),
    reason: `Clasificado como ${type} por keywords (score: ${best[1]})`
  }
}
