/**
 * RESERVO.AI — Motor de Veterinaria
 * Detección de urgencias para mascotas, clasificación de citas, decisiones.
 */

export type VetConsultationType =
  | 'consulta' | 'vacuna' | 'revision' | 'urgencia'
  | 'cirugia' | 'desparasitacion' | 'peluqueria' | 'primera_visita' | 'seguimiento'

export type VetUrgencyLevel = 'alta' | 'media' | 'baja'

export interface VetUrgencyDetection {
  is_urgency: boolean
  urgency_level: VetUrgencyLevel | null
  matched_keywords: string[]
  reason: string
}

export interface VetDecision {
  status: 'confirmed' | 'pending_review' | 'escalated' | 'incomplete'
  action_required: string
  response_hint: string
  reasoning: string
  trace: Array<{ step: string; result: string }>
}

export const VET_DURATIONS: Record<VetConsultationType, number> = {
  primera_visita: 30, consulta: 20, revision: 20,
  vacuna: 15, desparasitacion: 15, seguimiento: 15,
  cirugia: 60, urgencia: 30, peluqueria: 60,
}

const URGENCY_HIGH_VET = [
  /accidente/i, /atropell/i, /fractura/i, /sangr/i, /hemorragia/i,
  /no\s+respira/i, /dificultad\s+para\s+respirar/i, /convulsi/i,
  /veneno/i, /t[oó]xico/i, /se\s+ha\s+tragado/i, /inconsciente/i,
  /crisis/i, /no\s+se\s+mueve/i, /muy\s+grave/i, /urgente/i, /emergencia/i,
  /vomitando\s+sangre/i, /orina\s+sangre/i, /parálisis/i, /parali[sz]/i,
]

const URGENCY_MEDIUM_VET = [
  /vomitando/i, /diarrea/i, /no\s+come/i, /no\s+bebe/i, /cojea/i,
  /se\s+rasca\s+mucho/i, /herida/i, /infección/i, /fiebre/i,
  /dolor/i, /lleva\s+días/i, /empeorand/i, /le\s+duele/i,
]

export function detectVetUrgency(text: string): VetUrgencyDetection {
  const matched: string[] = []
  for (const re of URGENCY_HIGH_VET) {
    const m = text.match(re)
    if (m) matched.push(m[0])
  }
  if (matched.length > 0) {
    return { is_urgency: true, urgency_level: 'alta', matched_keywords: matched,
      reason: `Urgencia veterinaria alta: ${matched.slice(0,3).join(', ')}` }
  }
  const med: string[] = []
  for (const re of URGENCY_MEDIUM_VET) {
    const m = text.match(re)
    if (m) med.push(m[0])
  }
  if (med.length >= 2) {
    return { is_urgency: true, urgency_level: 'media', matched_keywords: med,
      reason: `Posible problema veterinario: ${med.slice(0,3).join(', ')}` }
  }
  return { is_urgency: false, urgency_level: null, matched_keywords: [], reason: 'Sin urgencia' }
}

const VET_TYPE_PATTERNS: Array<{ type: VetConsultationType; patterns: RegExp[]; weight: number }> = [
  { type:'urgencia',        weight:10, patterns:[/urgencia/i,/urgente/i,/emergencia/i,/accidente/i,/atropell/i] },
  { type:'primera_visita',  weight:9,  patterns:[/primera\s+vez/i,/nunca\s+ha\s+venido/i,/nueva\s+mascota/i,/acabo\s+de\s+adoptar/i] },
  { type:'vacuna',          weight:8,  patterns:[/vacuna/i,/vacunar/i,/cartilla\s+vacunal/i,/rabia/i,/moquillo/i,/parvovirus/i] },
  { type:'desparasitacion', weight:8,  patterns:[/desparasitar/i,/parásitos/i,/pulgas/i,/garrapatas/i,/lombrices/i,/antiparasitario/i] },
  { type:'peluqueria',      weight:8,  patterns:[/peluquería/i,/bañar/i,/cortar\s+pelo/i,/esquilar/i,/grooming/i,/asear/i] },
  { type:'cirugia',         weight:8,  patterns:[/cirugía/i,/operar/i,/esterilizar/i,/castrar/i,/operación/i,/extirpar/i] },
  { type:'seguimiento',     weight:7,  patterns:[/seguimiento/i,/revisión\s+post/i,/volver\s+para/i,/continuar\s+tratamiento/i] },
  { type:'revision',        weight:6,  patterns:[/revisión/i,/chequeo/i,/control/i,/revisar/i] },
  { type:'consulta',        weight:5,  patterns:[/consulta/i,/ver\s+(al\s+)?veterinario/i,/cita/i] },
]

export function classifyVetConsultation(text: string, urgency: VetUrgencyDetection): { type: VetConsultationType; duration: number; confidence: number } {
  if (urgency.is_urgency && urgency.urgency_level === 'alta') {
    return { type:'urgencia', duration: VET_DURATIONS.urgencia, confidence: 0.95 }
  }
  const scores: Record<string, number> = {}
  for (const entry of VET_TYPE_PATTERNS) {
    let score = 0
    for (const re of entry.patterns) { if (re.test(text)) score += entry.weight }
    if (score > 0) scores[entry.type] = score
  }
  const best = Object.entries(scores).sort((a,b) => b[1]-a[1])[0]
  if (!best) return { type:'consulta', duration: VET_DURATIONS.consulta, confidence: 0.4 }
  const type = best[0] as VetConsultationType
  return { type, duration: VET_DURATIONS[type], confidence: Math.min(0.95, best[1]/20) }
}

export function makeVetDecision(params: {
  urgency: VetUrgencyDetection
  type: VetConsultationType
  owner_name: string | null
  pet_name: string | null
  has_availability: boolean
  confidence: number
}): VetDecision {
  const { urgency, type, owner_name, pet_name, has_availability, confidence } = params
  const trace: VetDecision['trace'] = []
  const petLabel = pet_name ? pet_name : 'la mascota'
  const ownerLabel = owner_name || 'el dueño'

  trace.push({ step:'urgency', result: urgency.is_urgency ? `URGENCIA ${urgency.urgency_level}` : 'Sin urgencia' })

  if (urgency.is_urgency && urgency.urgency_level === 'alta') {
    return { status:'escalated', action_required:'Atender urgencia veterinaria inmediatamente',
      response_hint:`Entiendo que ${petLabel} necesita atención urgente. Venid directamente a la clínica, os atendemos ahora mismo.`,
      reasoning:'Urgencia veterinaria alta — atención inmediata', trace }
  }
  if (urgency.is_urgency) {
    return { status:'pending_review', action_required:'Revisar y agendar cita preferente',
      response_hint:`Entiendo que ${petLabel} no está bien. Os anoto como preferentes y os confirmamos cita hoy.`,
      reasoning:'Urgencia media — revisión prioritaria', trace }
  }
  if (!owner_name) {
    return { status:'pending_review', action_required:'Pedir nombre del dueño',
      response_hint:'¿Me dices tu nombre para apuntarlo?',
      reasoning:'Falta nombre del dueño', trace }
  }
  if (!pet_name) {
    return { status:'pending_review', action_required:'Pedir nombre de la mascota',
      response_hint:`¿Y cómo se llama la mascota, ${ownerLabel}?`,
      reasoning:'Falta nombre de la mascota', trace }
  }
  if (!has_availability) {
    return { status:'pending_review', action_required:'Buscar hueco y confirmar',
      response_hint:`Ese hueco no está disponible. Te busco otra opción y te confirmo enseguida, ${ownerLabel}.`,
      reasoning:'Sin disponibilidad en la franja solicitada', trace }
  }
  if (confidence < 0.35) {
    return { status:'pending_review', action_required:'Verificar datos antes de confirmar',
      response_hint:`Te dejo anotado y te confirmamos en breve, ${ownerLabel}.`,
      reasoning:`Confianza baja (${(confidence*100).toFixed(0)}%)`, trace }
  }
  return { status:'confirmed', action_required:'Cita veterinaria confirmada',
    response_hint:`Perfecto ${ownerLabel}, queda apuntado ${petLabel} para ${type}. ¡Hasta pronto!`,
    reasoning:`Cita normal confirmada — ${type}`, trace }
}
