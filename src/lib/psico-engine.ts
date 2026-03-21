/**
 * RESERVO.AI — Motor de Psicología
 * Máxima discreción. Nunca pide motivo. Gestiona sesiones con empatía.
 */

export type PsicoSessionType =
  | 'primera_sesion' | 'seguimiento' | 'pareja' | 'familiar' | 'online' | 'presencial'

export interface PsicoDecision {
  status: 'confirmed' | 'pending_review' | 'incomplete'
  action_required: string
  response_hint: string
  reasoning: string
}

export const PSICO_DURATIONS: Record<string, number> = {
  primera_sesion: 60, seguimiento: 50, pareja: 60, familiar: 60,
  online: 50, presencial: 50, default: 50,
}

// Psicología NO usa keywords de urgencia clínica.
// Solo detecta si alguien menciona crisis para dar el recurso 024.
const CRISIS_KEYWORDS = [
  /no\s+puedo\s+más/i, /quiero\s+hacerme\s+daño/i, /pensamientos\s+de/i,
  /crisis/i, /me\s+quiero\s+morir/i, /suicid/i, /hacerme\s+daño/i,
  /desesperada?/i, /angustia\s+muy/i, /ataque\s+de\s+pánico/i,
]

export function detectPsicoCrisis(text: string): boolean {
  return CRISIS_KEYWORDS.some(re => re.test(text))
}

export function classifyPsicoSession(text: string): { type: PsicoSessionType; duration: number } {
  if (/pareja/i.test(text)) return { type:'pareja', duration: PSICO_DURATIONS.pareja }
  if (/familiar|familia/i.test(text)) return { type:'familiar', duration: PSICO_DURATIONS.familiar }
  if (/primera\s+vez|primera\s+sesión|nunca\s+he\s+ido|nuevo\s+paciente/i.test(text))
    return { type:'primera_sesion', duration: PSICO_DURATIONS.primera_sesion }
  if (/online|videollamada|por\s+internet|telemática/i.test(text))
    return { type:'online', duration: PSICO_DURATIONS.online }
  if (/seguimiento|continuar|próxima\s+sesión|siguiente\s+cita/i.test(text))
    return { type:'seguimiento', duration: PSICO_DURATIONS.seguimiento }
  return { type:'presencial', duration: PSICO_DURATIONS.presencial }
}

export function makePsicoDecision(params: {
  patient_name: string | null
  session_type: PsicoSessionType
  has_availability: boolean
  is_crisis: boolean
}): PsicoDecision {
  const { patient_name, session_type, has_availability, is_crisis } = params
  const nameLabel = patient_name || 'el paciente'

  // Crisis — dar recurso 024 con calma, no escalar (es confidencial)
  if (is_crisis) {
    return {
      status: 'pending_review',
      action_required: 'Contactar al paciente con urgencia y discreción',
      response_hint: 'Entiendo que estás pasando un momento muy difícil. Si necesitas hablar con alguien ahora mismo, el 024 está disponible las 24 horas de forma confidencial. ¿Quieres que te ayude a encontrar un hueco lo antes posible?',
      reasoning: 'Crisis detectada — respuesta empática + recurso 024',
    }
  }
  if (!patient_name) {
    return { status:'incomplete', action_required:'Pedir nombre',
      response_hint:'¿Me dices tu nombre para apuntarlo?',
      reasoning:'Falta nombre del paciente' }
  }
  if (!has_availability) {
    return { status:'pending_review', action_required:'Buscar hueco disponible',
      response_hint:`Ese horario no está disponible, ${patient_name}. Te busco opciones y te confirmo enseguida.`,
      reasoning:'Sin disponibilidad' }
  }
  const isFirst = session_type === 'primera_sesion'
  return {
    status: 'confirmed',
    action_required: `Sesión de ${session_type} confirmada`,
    response_hint: isFirst
      ? `Perfecto ${patient_name}, te quedo apuntado para una primera sesión. Te llegará la confirmación. ¡Hasta pronto!`
      : `Confirmado ${patient_name}. ¡Hasta la próxima sesión!`,
    reasoning: `Sesión ${session_type} confirmada`,
  }
}
