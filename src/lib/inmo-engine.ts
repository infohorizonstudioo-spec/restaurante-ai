/**
 * RESERVO.AI — Motor de Inmobiliaria
 * Cualificación de leads, detección de intención, gestión de visitas.
 */

export type InmoLeadStatus = 'nuevo' | 'contactado' | 'visita_agendada' | 'oferta' | 'cerrado' | 'descartado'
export type InmoOperation  = 'compra' | 'alquiler' | 'venta'
export type InmoIntent     = 'busqueda_vivienda' | 'solicitud_visita' | 'venta_propiedad' | 'info_precio' | 'consulta_general'

export interface InmoDecision {
  status: 'lead_created' | 'visit_scheduled' | 'pending_review' | 'incomplete'
  action_required: string
  response_hint: string
  reasoning: string
  intent: InmoIntent
  lead_quality: 'alto' | 'medio' | 'bajo'
}

// Detectar intención desde el texto
export function detectInmoIntent(text: string): InmoIntent {
  if (/visita|ver\s+(el\s+)?piso|ver\s+(el\s+)?inmueble|quiero\s+visitar/i.test(text)) return 'solicitud_visita'
  if (/vender|poner\s+en\s+venta|quiero\s+vender/i.test(text)) return 'venta_propiedad'
  if (/precio|cuánto\s+cuesta|cuánto\s+vale|tasaci/i.test(text)) return 'info_precio'
  if (/comprar|busco|alquiler|arrendar|habita|habitaciones|metros/i.test(text)) return 'busqueda_vivienda'
  return 'consulta_general'
}

// Detectar operación
export function detectOperation(text: string): InmoOperation {
  if (/alquiler|alquilar|arrendar|renta/i.test(text)) return 'alquiler'
  if (/vender|poner\s+en\s+venta/i.test(text)) return 'venta'
  return 'compra'
}

// Calidad del lead según datos recogidos
export function scoreLeadQuality(params: {
  has_name: boolean, has_phone: boolean, has_budget: boolean,
  has_zone: boolean, has_property_type: boolean, intent: InmoIntent
}): 'alto' | 'medio' | 'bajo' {
  let score = 0
  if (params.has_name)          score += 2
  if (params.has_phone)         score += 3
  if (params.has_budget)        score += 2
  if (params.has_zone)          score += 1
  if (params.has_property_type) score += 1
  if (params.intent === 'solicitud_visita' || params.intent === 'venta_propiedad') score += 2
  if (score >= 8) return 'alto'
  if (score >= 4) return 'medio'
  return 'bajo'
}

export function makeInmoDecision(params: {
  intent: InmoIntent
  client_name: string | null
  client_phone: string | null
  operation: InmoOperation
  zone?: string
  budget?: number
  has_availability?: boolean
  property_ref?: string
}): InmoDecision {
  const { intent, client_name, client_phone, operation, zone, budget, has_availability, property_ref } = params
  const nameLabel = client_name || 'el cliente'
  const quality = scoreLeadQuality({
    has_name: !!client_name, has_phone: !!client_phone,
    has_budget: !!budget, has_zone: !!zone,
    has_property_type: true, intent,
  })

  if (!client_phone && !client_name) {
    return { status:'incomplete', intent, lead_quality:'bajo',
      action_required:'Recoger datos de contacto',
      response_hint:'¿Me dices tu nombre y un teléfono de contacto para que un agente te llame?',
      reasoning:'Sin datos de contacto — lead incompleto' }
  }

  if (intent === 'solicitud_visita') {
    if (!has_availability) {
      return { status:'pending_review', intent, lead_quality: quality,
        action_required:'Confirmar disponibilidad del agente y del inmueble',
        response_hint:`Perfecto ${nameLabel}, dejo anotada la solicitud de visita. Un agente te confirma horario hoy mismo.`,
        reasoning:'Visita solicitada — pendiente confirmar disponibilidad' }
    }
    return { status:'visit_scheduled', intent, lead_quality: quality,
      action_required:'Confirmar visita con el agente asignado',
      response_hint:`Estupendo ${nameLabel}, visita anotada. Te llegará la confirmación con todos los detalles.`,
      reasoning:'Visita agendada correctamente' }
  }

  return { status:'lead_created', intent, lead_quality: quality,
    action_required: quality === 'alto'
      ? `Contactar a ${nameLabel} en las próximas 2h — lead de calidad alta`
      : `Añadir a seguimiento — ${quality} calidad`,
    response_hint:`Perfecto ${nameLabel}, hemos tomado nota de lo que buscas. Un agente especializado te contactará en breve.`,
    reasoning:`Lead ${quality} — intención: ${intent}, operación: ${operation}` }
}
