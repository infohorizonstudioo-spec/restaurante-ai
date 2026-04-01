/**
 * RESERVO.AI — Customer Memory Engine
 *
 * Memoria VIVA por cliente. No es un historial decorativo.
 * Cada memoria afecta directamente a cómo el agente habla, decide y actúa.
 *
 * - Reconocimiento natural del cliente
 * - Historial completo multicanal
 * - Detección de patrones (no-shows, retrasos, cancellaciones)
 * - Sugerencias inteligentes basadas en comportamiento
 * - Avisos internos al negocio
 * - Confianza ponderada + validez temporal
 */

import { createClient } from '@supabase/supabase-js'
import { logger } from './logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────

export interface CustomerMemoryEntry {
  memory_type: string
  memory_key: string
  memory_value: string
  memory_data?: Record<string, any>
  confidence: number
  weight?: number
  source?: string
  valid_until?: string | null
}

export interface CustomerProfile {
  customerId: string
  name: string
  phone?: string
  isNew: boolean
  isReturning: boolean
  isVIP: boolean
  loyaltyTier: string
  loyaltyScore: number

  // Contadores
  visitCount: number
  noShowCount: number
  lateCount: number
  cancelCount: number
  lifetimeInteractions: number

  // Preferencias
  preferredLanguage: string
  preferredDay?: string
  preferredTime?: string
  avgPartySize?: number
  tags: string[]

  // Riesgo
  riskLevel: string
  sentimentAvg: number

  // Memorias activas (las más relevantes)
  memories: CustomerMemoryEntry[]

  // Alertas activas
  alerts: { type: string; title: string; severity: string }[]

  // Sugerencias para el agente
  suggestions: string[]

  // Prompt fragment para inyectar en la conversación
  promptFragment: string
}

// ─────────────────────────────────────────────────────────────
// 1. OBTENER PERFIL COMPLETO DEL CLIENTE
// ─────────────────────────────────────────────────────────────

export async function getCustomerProfile(
  tenantId: string,
  phone?: string | null,
  email?: string | null
): Promise<CustomerProfile | null> {
  if (!phone && !email) return null

  // Buscar cliente
  let customer: any = null
  if (phone) {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('phone', phone)
      .maybeSingle()
    customer = data
  }
  if (!customer && email) {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('tenant_id', tenantId)
      .ilike('email', email)
      .maybeSingle()
    customer = data
  }

  if (!customer) return null

  // Cargar memorias, eventos recientes y alertas en paralelo
  const [memoriesRes, recentEventsRes, alertsRes, recentReservationsRes] = await Promise.all([
    supabase
      .from('customer_memory')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customer.id)
      .eq('active', true)
      .gte('confidence', 0.4)
      .order('weight', { ascending: false })
      .order('confidence', { ascending: false })
      .limit(20),
    supabase
      .from('customer_events')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('customer_alerts')
      .select('alert_type,title,severity')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customer.id)
      .eq('active', true)
      .limit(5),
    supabase
      .from('reservations')
      .select('date,time,party_size,status,notes')
      .eq('tenant_id', tenantId)
      .or(`customer_id.eq.${customer.id},customer_phone.eq.${phone || ''}`)
      .order('date', { ascending: false })
      .limit(5),
  ])

  const memories = memoriesRes.data || []
  const recentEvents = recentEventsRes.data || []
  const alerts = (alertsRes.data || []).map(a => ({
    type: a.alert_type, title: a.title, severity: a.severity,
  }))
  const recentReservations = recentReservationsRes.data || []

  const isReturning = (customer.lifetime_interactions || 0) > 0
  const isVIP = customer.vip || (customer.loyalty_score || 0) >= 80

  // Generar sugerencias basadas en memoria
  const suggestions = generateSuggestions(customer, memories, recentEvents, recentReservations)

  // Generar prompt fragment para inyectar en la conversación
  const promptFragment = buildCustomerPromptFragment(customer, memories, recentEvents, recentReservations, suggestions)

  return {
    customerId: customer.id,
    name: customer.name || '',
    phone: customer.phone,
    isNew: !isReturning,
    isReturning,
    isVIP,
    loyaltyTier: customer.loyalty_tier || 'normal',
    loyaltyScore: customer.loyalty_score || 50,
    visitCount: customer.visit_count || 0,
    noShowCount: customer.no_show_count || 0,
    lateCount: customer.late_count || 0,
    cancelCount: customer.cancel_count || 0,
    lifetimeInteractions: customer.lifetime_interactions || 0,
    preferredLanguage: customer.preferred_language || 'es',
    preferredDay: customer.preferred_day,
    preferredTime: customer.preferred_time,
    avgPartySize: customer.avg_party_size,
    tags: customer.tags || [],
    riskLevel: customer.risk_level || 'none',
    sentimentAvg: customer.sentiment_avg || 0.5,
    memories: memories.map(m => ({
      memory_type: m.memory_type,
      memory_key: m.memory_key,
      memory_value: m.memory_value,
      memory_data: m.memory_data,
      confidence: m.confidence,
    })),
    alerts,
    suggestions,
    promptFragment,
  }
}

// ─────────────────────────────────────────────────────────────
// 2. GENERAR SUGERENCIAS INTELIGENTES
// ─────────────────────────────────────────────────────────────

function generateSuggestions(
  customer: any,
  memories: any[],
  recentEvents: any[],
  recentReservations: any[]
): string[] {
  const suggestions: string[] = []

  // No-show previo → sugerir con tacto
  if ((customer.no_show_count || 0) >= 1) {
    if (customer.no_show_count >= 3) {
      suggestions.push('AVISO INTERNO: Este cliente tiene múltiples no-shows. Confirma bien la reserva y recuérdala.')
    } else {
      suggestions.push('La última vez no pudo venir. Si reserva de nuevo, confirma con naturalidad.')
    }
  }

  // Llega tarde frecuentemente → sugerir margen
  if ((customer.late_count || 0) >= 2) {
    suggestions.push('Suele llegar con poco margen. Si es posible, sugiere una hora con algo de margen.')
  }

  // Cancela frecuentemente → no juzgar pero anotar
  if ((customer.cancel_count || 0) >= 3) {
    suggestions.push('Cambia o cancela citas con frecuencia. Trátalo con normalidad pero confirma bien.')
  }

  // Cliente frecuente → trato especial
  if ((customer.visit_count || 0) >= 5) {
    suggestions.push('Cliente habitual. Reconócelo con naturalidad, ofrece lo de siempre si tiene patrón.')
  }

  // VIP → prioridad
  if (customer.vip) {
    suggestions.push('Cliente VIP. Trato prioritario, ofrece las mejores opciones.')
  }

  // Preferencias conocidas
  const prefs = memories.filter(m => m.memory_type === 'preference')
  for (const p of prefs.slice(0, 3)) {
    suggestions.push(`Preferencia: ${p.memory_value}`)
  }

  // Contexto personal
  const contexts = memories.filter(m => m.memory_type === 'context')
  for (const c of contexts.slice(0, 2)) {
    suggestions.push(`Dato: ${c.memory_value}`)
  }

  // Última reserva → ofrecer lo mismo
  if (recentReservations.length > 0) {
    const last = recentReservations[0]
    if (last.status === 'completada' || last.status === 'confirmed') {
      suggestions.push(`Última reserva: ${last.date} a las ${last.time} para ${last.party_size} personas.`)
    }
  }

  // Sentimiento negativo reciente → cuidado extra
  const recentNegative = recentEvents.filter(e => e.sentiment === 'negative')
  if (recentNegative.length > 0) {
    suggestions.push('La última interacción no fue del todo positiva. Sé especialmente atenta.')
  }

  return suggestions
}

// ─────────────────────────────────────────────────────────────
// 3. CONSTRUIR PROMPT FRAGMENT PARA EL AGENTE
// ─────────────────────────────────────────────────────────────

function buildCustomerPromptFragment(
  customer: any,
  memories: any[],
  recentEvents: any[],
  recentReservations: any[],
  suggestions: string[]
): string {
  const parts: string[] = []
  const name = customer.name || ''
  const visits = customer.visit_count || 0
  const noShows = customer.no_show_count || 0

  // ── Reconocimiento ──
  if (visits === 0) {
    parts.push('CLIENTE NUEVO. No lo conoces. Trátalo bien pero no fuerces presentaciones.')
  } else if (visits >= 10) {
    parts.push(`CLIENTE MUY HABITUAL. ${name} lleva viniendo bastante tiempo. Conócelo: trátalo como a alguien de confianza.`)
  } else if (visits >= 3) {
    parts.push(`CLIENTE RECURRENTE. ${name} ya ha venido varias veces. Reconócelo con naturalidad.`)
  } else {
    parts.push(`CLIENTE QUE HA VENIDO ANTES. ${name} ya te suena. Trátalo con cercanía.`)
  }

  // ── Preferencias activas ──
  const prefs = memories.filter(m => m.memory_type === 'preference' && m.confidence >= 0.6)
  if (prefs.length > 0) {
    parts.push('PREFERENCIAS QUE CONOCES:')
    for (const p of prefs.slice(0, 5)) {
      parts.push(`- ${p.memory_value}`)
    }
    parts.push('Usa estas preferencias con naturalidad. NO digas "según nuestros registros". Simplemente actúa como si lo supieras de memoria.')
  }

  // ── Contexto personal ──
  const contexts = memories.filter(m => m.memory_type === 'context' && m.confidence >= 0.6)
  if (contexts.length > 0) {
    parts.push('COSAS QUE SABES DE ESTE CLIENTE:')
    for (const c of contexts.slice(0, 3)) {
      parts.push(`- ${c.memory_value}`)
    }
  }

  // ── Historial de comportamiento ──
  if (noShows >= 2) {
    parts.push(`ATENCIÓN: ${name} no se presentó ${noShows} veces antes. No lo menciones directamente, pero confirma la reserva con más énfasis: "te esperamos el [día] a las [hora], ¿vale?"`)
  } else if (noShows === 1) {
    parts.push(`NOTA: La última vez ${name} no pudo venir. No lo menciones a menos que surja naturalmente. Simplemente confirma bien.`)
  }

  if ((customer.late_count || 0) >= 2) {
    parts.push(`NOTA: ${name} suele llegar un poco justo de tiempo. Si es relevante, sugiere un margen con naturalidad: "si quieres te pongo 10 minutitos antes por si acaso."`)
  }

  if ((customer.cancel_count || 0) >= 3) {
    parts.push(`NOTA: ${name} ha cambiado citas varias veces. No juzgues. Si reserva, confirma bien y ofrece recordatorio.`)
  }

  // ── Última reserva ──
  if (recentReservations.length > 0) {
    const last = recentReservations[0]
    if (last.party_size) {
      parts.push(`ÚLTIMA VEZ: Reservó para ${last.party_size} personas el ${last.date} a las ${last.time}.`)
      parts.push(`Si pide lo mismo, ofrécelo directamente: "¿lo de siempre? ¿Para ${last.party_size} personas?"`)
    }
  }

  // ── VIP ──
  if (customer.vip) {
    parts.push('CLIENTE VIP. Dale prioridad absoluta. Las mejores opciones, el mejor trato.')
  }

  // ── Sentimiento reciente ──
  if ((customer.sentiment_avg || 0.5) < 0.3) {
    parts.push('CUIDADO: Las últimas interacciones no fueron positivas. Sé especialmente amable y atenta. Haz que esta experiencia sea buena.')
  }

  // ── Sugerencias del sistema ──
  const agentSuggestions = suggestions.filter(s => !s.startsWith('AVISO INTERNO'))
  if (agentSuggestions.length > 0) {
    parts.push('SUGERENCIAS PARA ESTA INTERACCIÓN:')
    for (const s of agentSuggestions) {
      parts.push(`- ${s}`)
    }
  }

  if (parts.length === 0) return 'Sin información previa del cliente.'
  return parts.join('\n')
}

// ─────────────────────────────────────────────────────────────
// 4. GUARDAR MEMORIA DEL CLIENTE
// ─────────────────────────────────────────────────────────────

export async function saveCustomerMemory(
  tenantId: string,
  customerId: string,
  entry: CustomerMemoryEntry
): Promise<void> {
  // Deduplicar: si ya existe una memoria con el mismo key, actualizar
  const { data: existing } = await supabase
    .from('customer_memory')
    .select('id,reinforced_count,confidence')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .eq('memory_key', entry.memory_key)
    .eq('active', true)
    .maybeSingle()

  if (existing) {
    // Reforzar memoria existente (aumentar confianza y contador)
    const newConfidence = Math.min(1, existing.confidence + 0.05)
    await supabase
      .from('customer_memory')
      .update({
        memory_value: entry.memory_value,
        memory_data: entry.memory_data || {},
        confidence: newConfidence,
        weight: entry.weight || 1.0,
        reinforced_count: (existing.reinforced_count || 1) + 1,
        last_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
  } else {
    await supabase.from('customer_memory').insert({
      tenant_id: tenantId,
      customer_id: customerId,
      memory_type: entry.memory_type,
      memory_key: entry.memory_key,
      memory_value: entry.memory_value,
      memory_data: entry.memory_data || {},
      confidence: entry.confidence,
      weight: entry.weight || 1.0,
      source: entry.source || 'system',
      valid_until: entry.valid_until || null,
    })
  }
}

// ─────────────────────────────────────────────────────────────
// 5. REGISTRAR EVENTO DEL CLIENTE
// ─────────────────────────────────────────────────────────────

export async function recordCustomerEvent(
  tenantId: string,
  customerId: string,
  event: {
    event_type: string
    channel?: string
    summary?: string
    event_data?: Record<string, any>
    sentiment?: string
    reservation_id?: string
    call_id?: string
    conversation_id?: string
    agent_name?: string
    duration_seconds?: number
  }
): Promise<void> {
  await supabase.from('customer_events').insert({
    tenant_id: tenantId,
    customer_id: customerId,
    ...event,
  })

  // Incrementar contadores específicos
  const { data: currentCustomer } = await supabase
    .from('customers')
    .select('no_show_count,late_count,visit_count,cancel_count,lifetime_interactions')
    .eq('id', customerId)
    .maybeSingle()

  if (currentCustomer) {
    const counterUpdates: Record<string, any> = {
      last_contact_at: new Date().toISOString(),
      lifetime_interactions: (currentCustomer.lifetime_interactions || 0) + 1,
    }

    if (event.event_type === 'no_show') {
      counterUpdates.no_show_count = (currentCustomer.no_show_count || 0) + 1
    } else if (event.event_type === 'late_arrival') {
      counterUpdates.late_count = (currentCustomer.late_count || 0) + 1
    } else if (event.event_type === 'visit') {
      counterUpdates.visit_count = (currentCustomer.visit_count || 0) + 1
      counterUpdates.last_visit = new Date().toISOString()
    } else if (event.event_type === 'reservation_cancelled') {
      counterUpdates.cancel_count = (currentCustomer.cancel_count || 0) + 1
    }

    await supabase.from('customers').update(counterUpdates).eq('id', customerId)
  }
}

// ─────────────────────────────────────────────────────────────
// 6. CREAR ALERTA INTERNA
// ─────────────────────────────────────────────────────────────

export async function createCustomerAlert(
  tenantId: string,
  customerId: string,
  alert: {
    alert_type: string
    severity: string
    title: string
    body: string
    auto_resolve?: boolean
    resolve_after?: string
  }
): Promise<void> {
  // No duplicar alertas del mismo tipo activas
  const { data: existing } = await supabase
    .from('customer_alerts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .eq('alert_type', alert.alert_type)
    .eq('active', true)
    .maybeSingle()

  if (existing) return // Ya existe una alerta activa

  await supabase.from('customer_alerts').insert({
    tenant_id: tenantId,
    customer_id: customerId,
    ...alert,
  })
}

// ─────────────────────────────────────────────────────────────
// 7. ANÁLISIS POST-INTERACCIÓN
//    Analiza una interacción y genera memorias/alertas automáticas
// ─────────────────────────────────────────────────────────────

export async function analyzeInteraction(params: {
  tenantId: string
  customerId: string
  intent: string
  summary: string
  channel: string
  sentiment?: string
  callerPhone?: string
  agentName?: string
}): Promise<{
  memoriesCreated: string[]
  alertsCreated: string[]
  suggestionsGenerated: string[]
}> {
  const { tenantId, customerId, intent, summary, channel, sentiment, callerPhone } = params
  const memoriesCreated: string[] = []
  const alertsCreated: string[] = []
  const suggestionsGenerated: string[] = []

  const lowerSummary = summary.toLowerCase()

  // Cargar datos del cliente
  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .maybeSingle()

  if (!customer) return { memoriesCreated, alertsCreated, suggestionsGenerated }

  // ── Detectar preferencias ──
  // Alergias / dieta
  const allergyMatch = lowerSummary.match(/alergi[ao]?\s+(?:a[l]?\s+)?(\w+)|intoleranci[ao]?\s+(?:a[l]?\s+)?(\w+)|celiac[ao]|vegetarian[ao]|vegan[ao]/i)
  if (allergyMatch) {
    const allergyValue = allergyMatch[0]
    await saveCustomerMemory(tenantId, customerId, {
      memory_type: 'context',
      memory_key: 'dietary_restriction',
      memory_value: `Tiene restricción alimentaria: ${allergyValue}`,
      confidence: 0.9,
      weight: 2.0,
      source: 'post_call',
    })
    memoriesCreated.push('dietary_restriction')
  }

  // Mesa/zona preferida
  const tableMatch = lowerSummary.match(/terraza|interior|reservado|ventana|rincón|barra|jardín|patio/)
  if (tableMatch) {
    await saveCustomerMemory(tenantId, customerId, {
      memory_type: 'preference',
      memory_key: 'preferred_zone',
      memory_value: `Prefiere ${tableMatch[0]}`,
      confidence: 0.7,
      weight: 1.5,
      source: 'post_call',
    })
    memoriesCreated.push('preferred_zone')
  }

  // Ocasión especial
  if (/cumpleaños|aniversario|celebraci|boda|despedida|bautizo|comunión/i.test(lowerSummary)) {
    const occasion = lowerSummary.match(/cumpleaños|aniversario|celebraci\w*|boda|despedida|bautizo|comunión/i)?.[0]
    await saveCustomerMemory(tenantId, customerId, {
      memory_type: 'context',
      memory_key: 'special_occasion',
      memory_value: `Mencionó ${occasion}`,
      confidence: 0.85,
      weight: 1.5,
      source: 'post_call',
      valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 días
    })
    memoriesCreated.push('special_occasion')
  }

  // Mascota (veterinaria)
  const petMatch = lowerSummary.match(/(?:perr[oa]|gat[oa]|mascota|animal)\s+(?:se llama\s+)?(\w+)/i)
  if (petMatch) {
    await saveCustomerMemory(tenantId, customerId, {
      memory_type: 'context',
      memory_key: 'pet_name',
      memory_value: `Mascota: ${petMatch[0]}`,
      confidence: 0.8,
      weight: 1.0,
      source: 'post_call',
    })
    memoriesCreated.push('pet_name')
  }

  // Número habitual de personas
  const partyMatch = lowerSummary.match(/(\d+)\s*persona/i)
  if (partyMatch) {
    const size = parseInt(partyMatch[1])
    if (size > 0 && size <= 50) {
      await saveCustomerMemory(tenantId, customerId, {
        memory_type: 'preference',
        memory_key: 'usual_party_size',
        memory_value: `Suele venir con ${size} personas`,
        memory_data: { party_size: size },
        confidence: 0.6,
        weight: 1.0,
        source: 'post_call',
      })
      memoriesCreated.push('usual_party_size')
    }
  }

  // ── Detectar problemas ──
  // Queja
  if (/queja|reclam|molest[oa]|enfadad[oa]|disgustad[oa]|mal servicio|mala experiencia/i.test(lowerSummary)) {
    await saveCustomerMemory(tenantId, customerId, {
      memory_type: 'interaction',
      memory_key: 'complaint_recent',
      memory_value: `Tuvo una queja: ${summary.slice(0, 200)}`,
      confidence: 0.9,
      weight: 2.0,
      source: 'post_call',
      valid_until: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    })
    memoriesCreated.push('complaint_recent')

    await createCustomerAlert(tenantId, customerId, {
      alert_type: 'complaint_history',
      severity: 'warning',
      title: `Queja de ${customer.name || 'cliente'}`,
      body: summary.slice(0, 300),
    })
    alertsCreated.push('complaint_history')
  }

  // ── Generar alertas basadas en contadores ──
  const noShows = customer.no_show_count || 0
  if (noShows >= 2) {
    await createCustomerAlert(tenantId, customerId, {
      alert_type: 'no_show_risk',
      severity: noShows >= 4 ? 'critical' : 'warning',
      title: `${customer.name || 'Cliente'} tiene ${noShows} no-shows`,
      body: `Este cliente no se ha presentado ${noShows} veces. Considerar confirmación adicional o política de no-show.`,
    })
    alertsCreated.push('no_show_risk')
  }

  // Cliente en riesgo de perderse (no contacta hace mucho siendo habitual)
  if ((customer.visit_count || 0) >= 5) {
    const lastContact = customer.last_contact_at ? new Date(customer.last_contact_at) : null
    if (lastContact) {
      const daysSince = (Date.now() - lastContact.getTime()) / (24 * 60 * 60 * 1000)
      if (daysSince > 60) {
        await createCustomerAlert(tenantId, customerId, {
          alert_type: 'at_risk',
          severity: 'info',
          title: `${customer.name || 'Cliente habitual'} lleva ${Math.floor(daysSince)} días sin venir`,
          body: `Cliente habitual que no contacta hace ${Math.floor(daysSince)} días. Considerar callback de fidelización.`,
          auto_resolve: true,
          resolve_after: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
        alertsCreated.push('at_risk')
      }
    }
  }

  // ── Actualizar scoring del cliente ──
  await updateCustomerScoring(tenantId, customerId)

  // ── Registrar evento ──
  await recordCustomerEvent(tenantId, customerId, {
    event_type: intent === 'reserva' ? 'reservation' :
                intent === 'cancelacion' ? 'reservation_cancelled' :
                intent === 'pedido' ? 'order' :
                'call',
    channel,
    summary: summary.slice(0, 500),
    sentiment,
    agent_name: params.agentName,
  })

  // ── Guardar resumen de interacción ──
  await saveCustomerMemory(tenantId, customerId, {
    memory_type: 'interaction',
    memory_key: `last_interaction_${channel}`,
    memory_value: `${intent}: ${summary.slice(0, 300)}`,
    memory_data: { intent, channel, sentiment, timestamp: new Date().toISOString() },
    confidence: 0.8,
    weight: 1.0,
    source: 'post_call',
    valid_until: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
  })
  memoriesCreated.push('last_interaction')

  // ── Idioma del cliente ──
  const langMatch = lowerSummary.match(/\[(ES|EN|FR|DE|PT|IT)\]/i)
  if (langMatch) {
    const lang = langMatch[1].toLowerCase()
    if (customer.preferred_language !== lang) {
      await supabase.from('customers')
        .update({ preferred_language: lang })
        .eq('id', customerId)
    }
  }

  return { memoriesCreated, alertsCreated, suggestionsGenerated }
}

// ─────────────────────────────────────────────────────────────
// 8. ACTUALIZAR SCORING DEL CLIENTE
// ─────────────────────────────────────────────────────────────

export async function updateCustomerScoring(tenantId: string, customerId: string): Promise<void> {
  const { data: customer } = await supabase
    .from('customers')
    .select('visit_count,no_show_count,cancel_count,late_count,vip,last_visit,lifetime_interactions')
    .eq('id', customerId)
    .maybeSingle()

  if (!customer) return

  const visits = customer.visit_count || 0
  const noShows = customer.no_show_count || 0
  const cancels = customer.cancel_count || 0
  const lateCount = customer.late_count || 0

  // Frequency (0-30)
  const frequency = visits === 0 ? 0 : visits <= 2 ? 10 : visits <= 5 ? 20 : 30

  // Reliability (0-30)
  const total = visits + noShows + cancels || 1
  const badRate = (noShows * 2 + cancels + lateCount * 0.3) / total
  const reliability = badRate === 0 ? 30 : badRate < 0.15 ? 20 : badRate < 0.3 ? 10 : 0

  // Recency (0-20)
  const lastVisit = customer.last_visit ? new Date(customer.last_visit).getTime() : 0
  const daysSince = lastVisit ? (Date.now() - lastVisit) / (24 * 60 * 60 * 1000) : 999
  const recency = daysSince <= 7 ? 20 : daysSince <= 30 ? 15 : daysSince <= 90 ? 10 : 0

  // Engagement (0-10)
  const interactions = customer.lifetime_interactions || 0
  const engagement = interactions >= 10 ? 10 : interactions >= 3 ? 5 : 0

  // VIP bonus
  const vipBonus = customer.vip ? 10 : 0

  const score = Math.min(100, frequency + reliability + recency + engagement + vipBonus)
  const tier = score >= 90 ? 'excelente' : score >= 70 ? 'bueno' : score >= 40 ? 'normal' : 'atencion'
  const riskLevel = noShows >= 4 ? 'high' : noShows >= 2 || cancels >= 5 ? 'medium' : 'none'

  await supabase.from('customers').update({
    loyalty_score: score,
    loyalty_tier: tier,
    risk_level: riskLevel,
  }).eq('id', customerId)
}

// ─────────────────────────────────────────────────────────────
// 9. PROGRAMAR CALLBACK
// ─────────────────────────────────────────────────────────────

export async function scheduleCallback(params: {
  tenantId: string
  customerId?: string
  phone: string
  reason: string
  context?: string
  priority?: string
  scheduledFor?: Date
}): Promise<string | null> {
  const scheduledFor = params.scheduledFor || new Date(Date.now() + 2 * 60 * 60 * 1000) // 2h por defecto

  const { data } = await supabase.from('scheduled_callbacks').insert({
    tenant_id: params.tenantId,
    customer_id: params.customerId || null,
    phone: params.phone,
    reason: params.reason,
    context: params.context || '',
    priority: params.priority || 'normal',
    scheduled_for: scheduledFor.toISOString(),
  }).select('id').maybeSingle()

  if (data?.id && params.customerId) {
    await supabase.from('customers').update({
      needs_callback: true,
      callback_reason: params.reason,
    }).eq('id', params.customerId)
  }

  return data?.id || null
}

// ─────────────────────────────────────────────────────────────
// 10. DECAY TEMPORAL — Reducir confianza de memorias antiguas
// ─────────────────────────────────────────────────────────────

export async function decayOldMemories(tenantId: string): Promise<number> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  // Desactivar memorias expiradas
  await supabase
    .from('customer_memory')
    .update({ active: false })
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .not('valid_until', 'is', null)
    .lt('valid_until', new Date().toISOString())

  // Reducir confianza de memorias de interacción antiguas
  const { data: old } = await supabase
    .from('customer_memory')
    .select('id,confidence')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .eq('memory_type', 'interaction')
    .lt('updated_at', thirtyDaysAgo)

  let decayed = 0
  for (const m of (old || [])) {
    const newConf = Math.max(0.3, m.confidence - 0.1)
    if (newConf <= 0.3) {
      await supabase.from('customer_memory').update({ active: false }).eq('id', m.id)
    } else {
      await supabase.from('customer_memory').update({ confidence: newConf }).eq('id', m.id)
    }
    decayed++
  }

  // Desactivar memorias muy antiguas de baja confianza
  await supabase
    .from('customer_memory')
    .update({ active: false })
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .lt('confidence', 0.4)
    .lt('updated_at', ninetyDaysAgo)

  return decayed
}
