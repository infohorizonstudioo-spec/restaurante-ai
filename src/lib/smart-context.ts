/**
 * RESERVO.AI — Smart Context Engine
 * Generates hyper-intelligent context for the AI agent.
 * Makes the agent smarter than a human receptionist by:
 * - Predicting customer behavior
 * - Optimizing table/slot utilization
 * - Detecting revenue opportunities
 * - Proactive problem prevention
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface SmartInsight {
  type: 'upsell' | 'warning' | 'preference' | 'optimization' | 'proactive'
  text: string
  priority: number // 1=highest
}

/**
 * Build intelligent context for a specific customer call.
 * This goes beyond simple history — it provides actionable intelligence.
 */
export async function buildSmartCustomerContext(
  tenantId: string,
  customerPhone: string,
  requestedDate?: string,
  requestedTime?: string,
  partySize?: number
): Promise<{ insights: SmartInsight[]; contextText: string }> {
  const insights: SmartInsight[] = []
  const cleanPhone = customerPhone.replace(/[^0-9+]/g, '')
  if (cleanPhone.length < 7) return { insights, contextText: '' }

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
    // New customer — provide onboarding intelligence
    insights.push({
      type: 'proactive', priority: 2,
      text: 'Es un cliente nuevo. Sé especialmente atenta y asegúrate de que se lleve buena impresión. Pregunta nombre con naturalidad.'
    })
    return { insights, contextText: buildContextText(insights) }
  }

  // ═══ PATTERN DETECTION ═══

  // 1. Party size consistency
  const sizes = reservations.map(r => r.people).filter(Boolean)
  const mostCommonSize = mode(sizes)
  if (sizes.length >= 2 && mostCommonSize) {
    insights.push({
      type: 'preference', priority: 3,
      text: `Siempre viene para ${mostCommonSize} personas. Si pide reserva, ofrécele directamente: "¿para ${mostCommonSize} como siempre?"`
    })
  }

  // 2. Time preference
  const hours = reservations.map(r => r.time?.slice(0, 5)).filter(Boolean)
  const mostCommonHour = mode(hours)
  if (hours.length >= 2 && mostCommonHour) {
    insights.push({
      type: 'preference', priority: 3,
      text: `Suele venir a las ${mostCommonHour}. Si pregunta por hora, sugiérele esa primero.`
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
      text: `Suele venir los ${mostCommonDay}s.`
    })
  }

  // ═══ RELIABILITY ANALYSIS ═══

  // 4. No-show risk assessment
  if (noShowCount >= 3) {
    insights.push({
      type: 'warning', priority: 1,
      text: `⚠ ALTO RIESGO: Este cliente NO se ha presentado ${noShowCount} veces. Pídele confirmación por teléfono el día anterior. Si es para grupo grande, considera pedir señal.`
    })
  } else if (noShowCount >= 1) {
    const rate = totalRes > 0 ? noShowCount / totalRes : 0
    if (rate > 0.2) {
      insights.push({
        type: 'warning', priority: 2,
        text: `Ojo: no se presentó ${noShowCount} de ${totalRes} veces (${Math.round(rate * 100)}%). Envía recordatorio SMS el día antes.`
      })
    }
  }

  // 5. Cancellation pattern
  const cancels = reservations.filter(r => r.status === 'cancelada' || r.status === 'cancelled')
  const lastMinuteCancels = cancels.filter(r => {
    const resDate = new Date(r.date + 'T12:00:00')
    // We don't have cancel timestamp, but if last reservation was cancelled, flag it
    return true
  })
  if (cancels.length >= 2 && totalRes > 0 && cancels.length / totalRes > 0.3) {
    insights.push({
      type: 'warning', priority: 3,
      text: `Cancela con frecuencia (${cancels.length} de ${totalRes}). Confirma que está seguro antes de crear la reserva.`
    })
  }

  // ═══ VIP & LOYALTY ═══

  // 6. VIP treatment
  if (customer?.vip) {
    insights.push({
      type: 'proactive', priority: 1,
      text: 'Es cliente VIP — dale prioridad absoluta. Si hay poca disponibilidad, búscale hueco como sea. Trátalo con especial cariño.'
    })
  }

  // 7. Loyalty recognition
  if (totalRes >= 10) {
    insights.push({
      type: 'proactive', priority: 2,
      text: `Es uno de los clientes más fieles (${totalRes} visitas). Hazle sentir especial. Si vuelve después de tiempo, dile algo como "cuánto tiempo sin verte, ¿eh?"`
    })
  } else if (totalRes >= 5) {
    insights.push({
      type: 'proactive', priority: 4,
      text: `Ya lleva ${totalRes} visitas. Es un habitual — trátalo como tal.`
    })
  }

  // ═══ REVENUE OPTIMIZATION ═══

  // 8. Upsell opportunity: small party in big slot
  if (partySize && partySize <= 2 && requestedTime) {
    const hour = parseInt(requestedTime.split(':')[0])
    if (hour >= 20 && hour <= 22) {
      insights.push({
        type: 'optimization', priority: 5,
        text: 'Reserva pequeña en hora punta. Si hay mesa en barra o zona rápida, ofrécela para liberar mesas grandes.'
      })
    }
  }

  // 9. Large group opportunity
  if (partySize && partySize >= 6) {
    insights.push({
      type: 'upsell', priority: 3,
      text: `Grupo de ${partySize} — ofrece menú de grupo si existe. Pregunta si es celebración especial para preparar algo.`
    })
  }

  // ═══ PROACTIVE INTELLIGENCE ═══

  // 10. Recent bad experience detection
  const lastCall = calls[0]
  if (lastCall && lastCall.decision_status === 'needs_human_attention') {
    insights.push({
      type: 'warning', priority: 1,
      text: 'La última vez que llamó hubo un problema que requirió atención especial. Sé extra cuidadosa y pregunta si todo bien.'
    })
  }

  // 11. Returning after long absence
  if (customer?.last_visit) {
    const daysSince = (Date.now() - new Date(customer.last_visit).getTime()) / (1000 * 60 * 60 * 24)
    if (daysSince > 60 && totalRes >= 3) {
      insights.push({
        type: 'proactive', priority: 2,
        text: `Vuelve después de ${Math.round(daysSince)} días sin venir. Dale la bienvenida cálidamente: "cuánto tiempo, ¿eh? me alegro de que vuelvas".`
      })
    }
  }

  // 12. Dietary/allergy persistence
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
      text: `🚨 RESTRICCIONES ALIMENTARIAS: ${dietaryFlags.join(', ')}. Menciónalo siempre: "te pongo nota de ${dietaryFlags[0]} como siempre, ¿vale?"`
    })
  }

  // 13. Weekend demand prediction
  if (requestedDate) {
    const dayOfWeek = new Date(requestedDate + 'T12:00:00').getDay()
    if (dayOfWeek === 5 || dayOfWeek === 6) { // Friday/Saturday
      const { count: weekendCount } = await supabase
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('date', requestedDate)
        .in('status', ['confirmada', 'confirmed', 'pendiente', 'pending'])

      if ((weekendCount || 0) > 5) {
        insights.push({
          type: 'optimization', priority: 2,
          text: `Día de alta demanda (${weekendCount} reservas ya). Si pide hora punta, avísale de que va a estar lleno y sugiere llegar puntual.`
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
  date: string
): Promise<string> {
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
  const avgPeople = Math.round(historical.reduce((s, r) => s + (r.people || 2), 0) / historical.length)

  // Find peak hours
  const hourCounts: Record<string, number> = {}
  historical.forEach(r => {
    const h = (r.time || '20:00').slice(0, 2)
    hourCounts[h] = (hourCounts[h] || 0) + 1
  })
  const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0]

  const dayNames = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados']

  return `PREVISIÓN PARA HOY: Los ${dayNames[dayOfWeek]} suele haber unas ${avgReservations} reservas de media ${avgPeople} personas. La hora más demandada es las ${peakHour}:00. Gestiona las horas punta con cuidado.`
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
  return '\nINTELIGENCIA SOBRE ESTE CLIENTE:\n' +
    insights.map(i => `• ${i.text}`).join('\n')
}
