/**
 * RESERVO.AI — Smart Context Engine
 * Generates intelligent context for the AI agent, adapted per business type.
 * - Predicting customer behavior
 * - Optimizing slot utilization
 * - Detecting opportunities
 * - Proactive problem prevention
 */
import { createClient } from '@supabase/supabase-js'
import { resolveTemplate } from './templates'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface SmartInsight {
  type: 'upsell' | 'warning' | 'preference' | 'optimization' | 'proactive'
  text: string
  priority: number // 1=highest
}

// ── Business-type aware terminology ──
function getTerms(businessType?: string) {
  const tmpl = resolveTemplate(businessType || 'otro')
  const bookingLabel = tmpl.labels.reserva?.toLowerCase() || 'reserva'
  const clientLabel = tmpl.labels.cliente?.toLowerCase() || 'cliente'

  // Hospitality types where "personas", "mesa", "carta" make sense
  const isHospitality = ['restaurante', 'bar', 'cafeteria'].includes(businessType || '')
  // Health types where extra care/discretion is needed
  const isHealth = ['clinica_dental', 'clinica_medica', 'veterinaria', 'fisioterapia', 'psicologia'].includes(businessType || '')

  return { bookingLabel, clientLabel, isHospitality, isHealth, businessType: businessType || 'otro' }
}

/**
 * Build intelligent context for a specific customer interaction.
 * Adapts language and insights per business type.
 */
export async function buildSmartCustomerContext(
  tenantId: string,
  customerPhone: string,
  requestedDate?: string,
  requestedTime?: string,
  partySize?: number,
  businessType?: string
): Promise<{ insights: SmartInsight[]; contextText: string }> {
  const insights: SmartInsight[] = []
  const cleanPhone = customerPhone.replace(/[^0-9+]/g, '')
  if (cleanPhone.length < 7) return { insights, contextText: '' }

  const terms = getTerms(businessType)

  // Parallel data fetch for speed
  const [customerRes, allResRes, callsRes, noShowsRes] = await Promise.all([
    supabase.from('customers')
      .select('id,name,phone,total_reservations,last_visit,vip,notes')
      .eq('tenant_id', tenantId)
      .or(`phone.eq.${cleanPhone},phone.eq.+${cleanPhone.replace(/^\+/, '')}`)
      .limit(1),
    supabase.from('reservations')
      .select('date,time,people,status,notes,table_id,zone_id,source')
      .eq('tenant_id', tenantId)
      .eq('customer_phone', cleanPhone)
      .order('date', { ascending: false })
      .limit(10),
    supabase.from('calls')
      .select('started_at,intent,summary,decision_status')
      .eq('tenant_id', tenantId)
      .or(`caller_phone.eq.${cleanPhone},from_number.eq.${cleanPhone}`)
      .order('started_at', { ascending: false })
      .limit(5),
    supabase.from('reservations')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('customer_phone', cleanPhone)
      .eq('status', 'no_show'),
  ])

  const customer = customerRes.data?.[0]
  const reservations = allResRes.data || []
  const calls = callsRes.data || []
  const noShowCount = noShowsRes.count || 0
  const totalRes = customer?.total_reservations || reservations.length

  if (!customer && reservations.length === 0) {
    insights.push({
      type: 'proactive', priority: 2,
      text: `Es la primera vez que contacta. Trátalo bien, pregúntale el nombre de forma natural y haz que se sienta bienvenido.`
    })
    return { insights, contextText: buildContextText(insights) }
  }

  // ═══ PATTERN DETECTION ═══

  // 1. Party size consistency (mainly relevant for hospitality, but also groups in other types)
  const sizes = reservations.map(r => r.people).filter(Boolean)
  const mostCommonSize = mode(sizes)
  if (sizes.length >= 2 && mostCommonSize && mostCommonSize > 1) {
    if (terms.isHospitality) {
      insights.push({
        type: 'preference', priority: 3,
        text: `Siempre viene para ${mostCommonSize} personas. Si pide ${terms.bookingLabel}, ofrécele directamente: "¿para ${mostCommonSize} como siempre?"`
      })
    } else {
      insights.push({
        type: 'preference', priority: 3,
        text: `Suele pedir ${terms.bookingLabel} para ${mostCommonSize} personas.`
      })
    }
  }

  // 2. Time preference
  const hours = reservations.map(r => r.time?.slice(0, 5)).filter(Boolean)
  const mostCommonHour = mode(hours)
  if (hours.length >= 2 && mostCommonHour) {
    insights.push({
      type: 'preference', priority: 3,
      text: `Suele ${terms.isHospitality ? 'venir' : 'tener ' + terms.bookingLabel} a las ${mostCommonHour}. Si pregunta por hora, sugiérele esa primero.`
    })
  }

  // 3. Day preference
  const days = reservations.map(r => {
    const d = new Date(r.date + 'T12:00:00').getDay()
    return ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][d]
  })
  const mostCommonDay = mode(days)
  if (days.length >= 3 && mostCommonDay) {
    insights.push({
      type: 'preference', priority: 4,
      text: `Suele ${terms.isHospitality ? 'venir' : 'pedir ' + terms.bookingLabel} los ${mostCommonDay}s.`
    })
  }

  // ═══ RELIABILITY ANALYSIS ═══

  // 4. No-show risk assessment
  if (noShowCount >= 3) {
    insights.push({
      type: 'warning', priority: 1,
      text: `Ojo, este ${terms.clientLabel} no se ha presentado ${noShowCount} veces. Pídele confirmación el día antes.${terms.isHospitality && (partySize && partySize >= 4) ? ' Si es grupo grande, plantea pedir señal.' : ''}`
    })
  } else if (noShowCount >= 1) {
    const rate = totalRes > 0 ? noShowCount / totalRes : 0
    if (rate > 0.2) {
      insights.push({
        type: 'warning', priority: 2,
        text: `Ojo: no se presentó ${noShowCount} de ${totalRes} veces (${Math.round(rate * 100)}%). Envía recordatorio el día antes.`
      })
    }
  }

  // 5. Cancellation pattern
  const cancels = reservations.filter(r => r.status === 'cancelada' || r.status === 'cancelled')
  if (cancels.length >= 2 && totalRes > 0 && cancels.length / totalRes > 0.3) {
    insights.push({
      type: 'warning', priority: 3,
      text: `Cancela con frecuencia (${cancels.length} de ${totalRes}). Confirma que está seguro antes de crear la ${terms.bookingLabel}.`
    })
  }

  // ═══ VIP & LOYALTY ═══

  // 6. VIP treatment
  if (customer?.vip) {
    insights.push({
      type: 'proactive', priority: 1,
      text: `Es VIP — dale prioridad. Si hay poca disponibilidad, búscale hueco como sea. Trátalo especialmente bien.`
    })
  }

  // 7. Loyalty recognition
  if (totalRes >= 10) {
    insights.push({
      type: 'proactive', priority: 2,
      text: `Lleva ${totalRes} ${terms.bookingLabel}s — es de los fieles. Trátalo como tal, con confianza.`
    })
  } else if (totalRes >= 5) {
    insights.push({
      type: 'proactive', priority: 4,
      text: `Ya lleva ${totalRes} ${terms.bookingLabel}s. Es habitual — trátalo como tal.`
    })
  }

  // ═══ OPTIMIZATION (business-type specific) ═══

  // 8. Upsell opportunity: small party in peak hour (hospitality only)
  if (terms.isHospitality && partySize && partySize <= 2 && requestedTime) {
    const hour = parseInt(requestedTime.split(':')[0])
    if (hour >= 20 && hour <= 22) {
      insights.push({
        type: 'optimization', priority: 5,
        text: `${terms.bookingLabel} pequeña en hora punta. Si hay sitio en barra o zona rápida, ofrécela para liberar mesas grandes.`
      })
    }
  }

  // 9. Large group opportunity (hospitality only)
  if (terms.isHospitality && partySize && partySize >= 6) {
    insights.push({
      type: 'upsell', priority: 3,
      text: `Grupo de ${partySize} — ofrece menú de grupo si existe. Pregunta si es celebración especial.`
    })
  }

  // ═══ PROACTIVE INTELLIGENCE ═══

  // 10. Recent bad experience detection
  const lastCall = calls[0]
  if (lastCall && lastCall.decision_status === 'needs_human_attention') {
    insights.push({
      type: 'warning', priority: 1,
      text: `La última vez que contactó hubo un problema. Sé especialmente atento y pregunta si se resolvió bien.`
    })
  }

  // 11. Returning after long absence
  if (customer?.last_visit) {
    const daysSince = (Date.now() - new Date(customer.last_visit).getTime()) / (1000 * 60 * 60 * 24)
    if (daysSince > 60 && totalRes >= 3) {
      insights.push({
        type: 'proactive', priority: 2,
        text: `Vuelve después de ${Math.round(daysSince)} días. Dale la bienvenida con naturalidad — que note que te alegras de que vuelva.`
      })
    }
  }

  // 12. Dietary/allergy persistence (hospitality only — doesn't apply to clinics/gyms)
  if (terms.isHospitality) {
    const allNotes = reservations.map(r => r.notes || '').join(' ').toLowerCase()
    const dietaryFlags: string[] = []
    if (allNotes.includes('alergi') || allNotes.includes('intoler')) dietaryFlags.push('alergias/intolerancias')
    if (allNotes.includes('celiac') || allNotes.includes('sin gluten')) dietaryFlags.push('celíaco/sin gluten')
    if (allNotes.includes('vegeta')) dietaryFlags.push('vegetariano')
    if (allNotes.includes('vegan')) dietaryFlags.push('vegano')
    if (allNotes.includes('sin lactosa')) dietaryFlags.push('sin lactosa')
    if (allNotes.includes('halal')) dietaryFlags.push('halal')
    if (allNotes.includes('kosher')) dietaryFlags.push('kosher')

    if (dietaryFlags.length > 0) {
      insights.push({
        type: 'warning', priority: 1,
        text: `IMPORTANTE — tiene ${dietaryFlags.join(', ')}. Apúntalo en la ${terms.bookingLabel}. Si es habitual, menciónalo con naturalidad.`
      })
    }
  }

  // 13. Special notes persistence (non-hospitality — check for relevant patterns)
  if (!terms.isHospitality) {
    const allNotes = reservations.map(r => r.notes || '').join(' ').toLowerCase()
    if (allNotes.length > 10) {
      insights.push({
        type: 'preference', priority: 4,
        text: `Tiene notas en ${terms.bookingLabel}s anteriores. Revísalas por si hay algo relevante.`
      })
    }
  }

  // 14. Weekend/peak demand prediction
  if (requestedDate) {
    const dayOfWeek = new Date(requestedDate + 'T12:00:00').getDay()
    if (dayOfWeek === 5 || dayOfWeek === 6) {
      const { count: weekendCount } = await supabase
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('date', requestedDate)
        .in('status', ['confirmada', 'confirmed', 'pendiente', 'pending'])

      if ((weekendCount || 0) > 5) {
        insights.push({
          type: 'optimization', priority: 2,
          text: `Día con mucha demanda (${weekendCount} ${terms.bookingLabel}s ya). Gestiona bien los huecos disponibles.`
        })
      }
    }
  }

  // Sort by priority (1 = highest)
  insights.sort((a, b) => a.priority - b.priority)

  return { insights, contextText: buildContextText(insights) }
}

/**
 * Build demand forecast for a specific date/time.
 * Helps the agent make smarter scheduling decisions.
 */
export async function getDemandForecast(
  tenantId: string,
  date: string,
  businessType?: string
): Promise<string> {
  const terms = getTerms(businessType)
  const dayOfWeek = new Date(date + 'T12:00:00').getDay()

  // Get historical data for same day of week (last 8 weeks)
  const historicalDates: string[] = []
  for (let w = 1; w <= 8; w++) {
    const d = new Date(date + 'T12:00:00')
    d.setDate(d.getDate() - w * 7)
    historicalDates.push(d.toISOString().slice(0, 10))
  }

  const { data: historical } = await supabase
    .from('reservations')
    .select('date,time,people,status')
    .eq('tenant_id', tenantId)
    .in('date', historicalDates)
    .in('status', ['confirmada', 'confirmed', 'completada', 'completed'])

  if (!historical || historical.length < 3) return ''

  const avgReservations = Math.round(historical.length / historicalDates.length)

  // Find peak hours
  const hourCounts: Record<string, number> = {}
  historical.forEach(r => {
    const h = (r.time || '20:00').slice(0, 2)
    hourCounts[h] = (hourCounts[h] || 0) + 1
  })
  const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0]

  const dayNames = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados']

  return `PREVISIÓN: Los ${dayNames[dayOfWeek]} suele haber unas ${avgReservations} ${terms.bookingLabel}s. La hora más demandada es las ${peakHour}:00. Gestiona bien los huecos.`
}

// ── Utility ──
function mode<T>(arr: T[]): T | null {
  if (arr.length === 0) return null
  const counts = new Map<T, number>()
  let maxCount = 0
  let maxVal: T = arr[0]
  for (const v of arr) {
    const c = (counts.get(v) || 0) + 1
    counts.set(v, c)
    if (c > maxCount) { maxCount = c; maxVal = v }
  }
  return maxCount >= 2 ? maxVal : null // Only return if appears 2+ times
}

function buildContextText(insights: SmartInsight[]): string {
  if (insights.length === 0) return ''
  return '\nLO QUE SABES DE ESTE CLIENTE:\n' +
    insights.map(i => `• ${i.text}`).join('\n')
}
