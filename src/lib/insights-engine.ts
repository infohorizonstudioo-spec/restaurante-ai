import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface Insight {
  id: string
  type: 'trend' | 'anomaly' | 'opportunity' | 'warning' | 'learning'
  icon: string
  title: string
  body: string
  priority: 'high' | 'normal' | 'low'
  action?: string
  actionHref?: string
}

export async function generateInsights(tenantId: string): Promise<Insight[]> {
  const insights: Insight[] = []
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const hour = now.getHours()

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [callsRes, reservasRes, customersRes, feedbackRes] = await Promise.all([
    supabase.from('calls')
      .select('id,status,intent,started_at,duration_seconds,caller_phone,customer_name,decision_status,decision_confidence')
      .eq('tenant_id', tenantId).gte('started_at', thirtyDaysAgo).order('started_at', { ascending: false }),
    supabase.from('reservations')
      .select('id,status,date,time,people,source,customer_name,customer_phone,created_at')
      .eq('tenant_id', tenantId).gte('date', thirtyDaysAgo.slice(0, 10)).order('date', { ascending: false }),
    supabase.from('customers')
      .select('id,name,phone,total_reservations,created_at')
      .eq('tenant_id', tenantId),
    supabase.from('agent_feedback')
      .select('id,original_status,corrected_status,created_at')
      .eq('tenant_id', tenantId).gte('created_at', thirtyDaysAgo),
  ])

  const calls = callsRes.data || []
  const reservas = reservasRes.data || []
  const customers = customersRes.data || []
  const feedback = feedbackRes.data || []

  if (calls.length === 0 && reservas.length === 0) return insights

  // ── 1. Conversión semana vs semana ──────────────────────────────────
  const thisWeekCalls = calls.filter(c => c.started_at >= sevenDaysAgo)
  const prevWeekStart = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const prevWeekCalls = calls.filter(c => c.started_at >= prevWeekStart && c.started_at < sevenDaysAgo)

  const thisCompleted = thisWeekCalls.filter(c => c.status === 'completada' || c.status === 'completed').length
  const thisReservas = reservas.filter(r => r.date >= sevenDaysAgo.slice(0, 10) && r.source === 'voice_agent').length
  const prevCompleted = prevWeekCalls.filter(c => c.status === 'completada' || c.status === 'completed').length
  const prevReservas = reservas.filter(r => r.date >= prevWeekStart.slice(0, 10) && r.date < sevenDaysAgo.slice(0, 10) && r.source === 'voice_agent').length

  const thisRate = thisCompleted > 0 ? Math.round((thisReservas / thisCompleted) * 100) : 0
  const prevRate = prevCompleted > 0 ? Math.round((prevReservas / prevCompleted) * 100) : 0

  if (thisRate > 0 && prevRate > 0) {
    const diff = thisRate - prevRate
    if (diff >= 10) {
      insights.push({
        id: 'conv-up', type: 'trend', icon: '📈', priority: 'normal',
        title: `Oye, vas para arriba`,
        body: `La conversión ha subido al ${thisRate}% esta semana — un ${diff}% más que la anterior. Algo estás haciendo bien.`,
      })
    } else if (diff <= -10) {
      insights.push({
        id: 'conv-down', type: 'warning', icon: '📉', priority: 'high',
        title: `Ojo, la conversión ha bajado`,
        body: `Estás en ${thisRate}% esta semana, antes ibas al ${prevRate}%. Échale un ojo a las llamadas recientes, a ver qué pasa.`,
        action: 'Revisar llamadas', actionHref: '/llamadas',
      })
    }
  }

  // ── 2. Hora punta ───────────────────────────────────────────────────
  const hourCounts: Record<number, number> = {}
  calls.forEach(c => {
    if (c.started_at) { const h = new Date(c.started_at).getHours(); hourCounts[h] = (hourCounts[h] || 0) + 1 }
  })
  const peakEntry = Object.entries(hourCounts).sort((a, b) => Number(b[1]) - Number(a[1]))[0]
  if (peakEntry) {
    const peakHour = Number(peakEntry[0])
    const peakCount = Number(peakEntry[1])
    if (Math.abs(hour - peakHour) <= 1 && peakCount > 3) {
      insights.push({
        id: 'peak-now', type: 'warning', icon: '🔥', priority: 'high',
        title: `Ahora es cuando más te llaman`,
        body: `Las ${peakHour}h es tu hora fuerte — ${peakCount} llamadas el último mes a esta hora. Prepárate.`,
      })
    }
  }

  // ── 3. Clientes habituales ──────────────────────────────────────────
  const phoneCounts: Record<string, { count: number; name: string }> = {}
  calls.forEach(c => {
    if (c.caller_phone && c.caller_phone !== 'Número oculto') {
      if (!phoneCounts[c.caller_phone]) phoneCounts[c.caller_phone] = { count: 0, name: c.customer_name || '' }
      phoneCounts[c.caller_phone].count++
      if (c.customer_name) phoneCounts[c.caller_phone].name = c.customer_name
    }
  })
  const topCallers = Object.entries(phoneCounts).filter(([_, v]) => v.count >= 3).sort((a, b) => b[1].count - a[1].count).slice(0, 3)
  if (topCallers.length > 0) {
    const [, data] = topCallers[0]
    insights.push({
      id: 'repeat-customer', type: 'learning', icon: '⭐', priority: 'normal',
      title: `${data.name || 'Alguien'} es de los que siempre vuelve`,
      body: `${data.count} veces en un mes.${topCallers.length > 1 ? ` Y tienes ${topCallers.length - 1} habituales más.` : ''} Estos son oro.`,
      action: 'Ver clientes', actionHref: '/clientes',
    })
  }

  // ── 4. Aprendizaje de correcciones ──────────────────────────────────
  if (feedback.length >= 3) {
    const corrections: Record<string, number> = {}
    feedback.slice(0, 10).forEach(f => {
      const key = `${f.original_status} → ${f.corrected_status}`
      corrections[key] = (corrections[key] || 0) + 1
    })
    const top = Object.entries(corrections).sort((a, b) => b[1] - a[1])[0]
    if (top && top[1] >= 2) {
      insights.push({
        id: 'learning-pattern', type: 'learning', icon: '🧠', priority: 'normal',
        title: `Tu recepcionista está aprendiendo`,
        body: `Has corregido "${top[0]}" ${top[1]} veces. Ya lo tiene en cuenta para las próximas llamadas.`,
        action: 'Ver reglas', actionHref: '/agente',
      })
    }
  }

  // ── 5. Ocupación hoy ───────────────────────────────────────────────
  const todayReservas = reservas.filter(r => r.date === today)
  const todayPeople = todayReservas.reduce((s, r) => s + (r.people || 2), 0)
  if (todayPeople > 30) {
    insights.push({
      id: 'capacity-high', type: 'warning', icon: '⚡', priority: 'high',
      title: `Hoy viene gente, ¿eh?`,
      body: `${todayReservas.length} reservas, ${todayPeople} personas confirmadas. Buen día por delante.`,
      action: 'Ver reservas', actionHref: '/reservas',
    })
  }

  // ── 6. Patrón del día ──────────────────────────────────────────────
  const dayOfWeek = now.getDay()
  const dayNames = ['los domingos', 'los lunes', 'los martes', 'los miércoles', 'los jueves', 'los viernes', 'los sábados']
  const sameDayRes = reservas.filter(r => r.date && new Date(r.date + 'T12:00:00').getDay() === dayOfWeek)
  if (sameDayRes.length > 5) {
    const avg = Math.round(sameDayRes.reduce((s, r) => s + (r.people || 2), 0) / sameDayRes.length)
    insights.push({
      id: 'day-pattern', type: 'trend', icon: '📊', priority: 'low',
      title: `${dayNames[dayOfWeek]} sueles tener unas ${sameDayRes.length} reservas`,
      body: `Media de ${avg} personas por reserva.${dayOfWeek >= 5 ? ' Fin de semana — suele ser más movido.' : ''}`,
    })
  }

  // ── 7. Cancelaciones ───────────────────────────────────────────────
  const cancelled = reservas.filter(r => r.status === 'cancelada').length
  if (reservas.length > 10) {
    const rate = Math.round((cancelled / reservas.length) * 100)
    if (rate > 20) {
      insights.push({
        id: 'cancel-rate', type: 'anomaly', icon: '😬', priority: 'high',
        title: `Muchas cancelaciones últimamente`,
        body: `Un ${rate}% de las reservas acaban cancelándose. Plantéate pedir confirmación por SMS el día antes.`,
      })
    }
  }

  // ── 8. Confianza del agente ─────────────────────────────────────────
  const withConf = calls.filter(c => c.decision_confidence != null && c.decision_confidence > 0)
  if (withConf.length > 5) {
    const avg = withConf.reduce((s, c) => s + (c.decision_confidence || 0), 0) / withConf.length
    if (avg < 0.6) {
      insights.push({
        id: 'low-confidence', type: 'warning', icon: '🤔', priority: 'high',
        title: `Tu recepcionista anda algo perdida`,
        body: `La confianza media está en ${(avg * 100).toFixed(0)}%. Dale más datos sobre el negocio para que responda mejor.`,
        action: 'Mejorar conocimiento', actionHref: '/agente',
      })
    } else if (avg > 0.85) {
      insights.push({
        id: 'high-confidence', type: 'trend', icon: '💪', priority: 'low',
        title: `Tu recepcionista lo clava`,
        body: `Confianza del ${(avg * 100).toFixed(0)}%. Gestiona las llamadas como si llevara años ahí.`,
      })
    }
  }

  // ── 9. Riesgo de no-show ───────────────────────────────────────────
  const todayActive = reservas.filter(r => r.date === today && (r.status === 'confirmada' || r.status === 'confirmed'))
  const noShows = reservas.filter(r => r.status === 'no_show').length
  const noShowRate = reservas.length > 0 ? noShows / reservas.length : 0
  if (todayActive.length > 0 && noShowRate > 0.1) {
    const atRisk = Math.round(todayActive.length * noShowRate)
    if (atRisk >= 1) {
      insights.push({
        id: 'noshow-risk', type: 'warning', icon: '👻', priority: 'high',
        title: `Ojo, ${atRisk} reserva${atRisk > 1 ? 's' : ''} podrían no presentarse`,
        body: `Históricamente un ${(noShowRate * 100).toFixed(0)}% no aparece. Una llamadita rápida para confirmar no viene mal.`,
        action: 'Confirmar reservas', actionHref: '/reservas',
      })
    }
  }

  // ── 10. Clientes nuevos ─────────────────────────────────────────────
  const newCusts = customers.filter(c => c.created_at && (Date.now() - new Date(c.created_at).getTime()) / (24 * 60 * 60 * 1000) <= 7)
  if (newCusts.length > 0) {
    insights.push({
      id: 'new-customers', type: 'opportunity', icon: '🆕', priority: 'normal',
      title: `${newCusts.length} cara${newCusts.length > 1 ? 's' : ''} nueva${newCusts.length > 1 ? 's' : ''} esta semana`,
      body: `${newCusts.length > 1 ? 'Han' : 'Ha'} llamado por primera vez. Si te caen bien, márcalos como VIP.`,
      action: 'Ver clientes', actionHref: '/clientes',
    })
  }

  return insights.slice(0, 8)
}
