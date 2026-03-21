/**
 * RESERVO.AI — Motor genérico de citas para servicios
 * Usado por: fisioterapia, asesoría, seguros, academia, barbería, peluquería
 */

export type AppointmentType =
  | 'primera_visita' | 'seguimiento' | 'consulta' | 'tratamiento'
  | 'valoracion' | 'clase' | 'sesion' | 'cita' | 'reunion'

export interface AppointmentDecision {
  status: 'confirmed' | 'pending_review' | 'incomplete'
  action_required: string
  response_hint: string
  reasoning: string
}

export const APPOINTMENT_DURATIONS: Record<string, number> = {
  primera_visita: 60, valoracion: 60, tratamiento: 45,
  sesion: 50, clase: 60, reunion: 60,
  seguimiento: 30, consulta: 30, cita: 30, default: 30,
}

// Clasificar tipo de cita por texto
export function classifyAppointment(text: string, businessType: string): { type: AppointmentType; duration: number } {
  // Fisioterapia
  if (businessType === 'fisioterapia') {
    if (/primera\s+vez|valoración|valoracion|evaluar/i.test(text)) return { type:'valoracion', duration:60 }
    if (/seguimiento|continuar|próxima\s+sesión/i.test(text)) return { type:'seguimiento', duration:30 }
    return { type:'tratamiento', duration:45 }
  }
  // Academia
  if (businessType === 'academia') {
    if (/inscri|apuntar|matricular|empezar/i.test(text)) return { type:'primera_visita', duration:60 }
    return { type:'clase', duration:60 }
  }
  // Asesoría / seguros
  if (businessType === 'asesoria' || businessType === 'seguros') {
    if (/urgente|plazo|inmediato|hoy/i.test(text)) return { type:'consulta', duration:30 }
    if (/primera\s+vez|nuevo\s+cliente/i.test(text)) return { type:'primera_visita', duration:60 }
    return { type:'reunion', duration:60 }
  }
  // Peluquería / barbería
  if (businessType === 'peluqueria' || businessType === 'barberia') {
    return { type:'cita', duration: /tinte|mechas|alisado|keratina/i.test(text) ? 120 : 45 }
  }
  // Genérico
  if (/primera\s+vez/i.test(text)) return { type:'primera_visita', duration:60 }
  if (/seguimiento/i.test(text)) return { type:'seguimiento', duration:30 }
  return { type:'cita', duration:30 }
}

export function makeAppointmentDecision(params: {
  client_name: string | null
  appointment_type: AppointmentType
  has_availability: boolean
  confidence: number
  businessType: string
  extra_context?: string
}): AppointmentDecision {
  const { client_name, appointment_type, has_availability, confidence, businessType, extra_context } = params
  const label = client_name || 'el cliente'

  // Etiquetas específicas por tipo de negocio
  const clientLabel: Record<string, string> = {
    fisioterapia:'paciente', psicologia:'paciente', academia:'alumno',
    asesoria:'cliente', seguros:'cliente', peluqueria:'cliente', barberia:'cliente',
  }
  const entityLabel = clientLabel[businessType] || 'cliente'
  const reservaLabel: Record<string, string> = {
    fisioterapia:'cita', academia:'clase', asesoria:'cita', seguros:'cita',
    peluqueria:'cita', barberia:'cita',
  }
  const citaWord = reservaLabel[businessType] || 'cita'

  if (!client_name) {
    return { status:'incomplete', action_required:`Pedir nombre del ${entityLabel}`,
      response_hint:`¿Me dices tu nombre para apuntarlo?`,
      reasoning:`Falta nombre del ${entityLabel}` }
  }
  if (!has_availability) {
    return { status:'pending_review', action_required:'Buscar hueco disponible y confirmar',
      response_hint:`Ese horario no está disponible, ${label}. Te busco otra opción y te confirmo enseguida.`,
      reasoning:'Sin disponibilidad en la franja solicitada' }
  }
  if (confidence < 0.35) {
    return { status:'pending_review', action_required:`Verificar datos de la ${citaWord}`,
      response_hint:`Te dejo anotado, ${label}. Te confirmamos en breve.`,
      reasoning:`Confianza baja (${(confidence*100).toFixed(0)}%)` }
  }
  return { status:'confirmed', action_required:`${citaWord} confirmada`,
    response_hint:`Perfecto ${label}, queda confirmada tu ${citaWord}. ¡Hasta pronto!`,
    reasoning:`${citaWord} de ${appointment_type} confirmada` }
}
