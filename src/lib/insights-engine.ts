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
  action?: string       // suggested action text
  actionHref?: string   // link to relevant page
}

export async function generateInsights(tenantId: string): Promise<Insight[]> {
  const insights: Insight[] = []
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const hour = now.getHours()

  // Fetch last 30 days of data in parallel
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [callsRes, reservasRes, customersRes, feedbackRes] = await Promise.all([
    supabase.from('calls')
      .select('id,status,intent,started_at,duration_seconds,caller_phone,customer_name,decision_status,decision_confidence')
      .eq('tenant_id', tenantId)
      .gte('started_at', thirtyDaysAgo)
      .order('started_at', { ascending: false }),
    supabase.from('reservations')
      .select('id,status,date,time,people,source,customer_name,customer_phone')
      .eq('tenant_id', tenantId)
      .gte('date', thirtyDaysAgo.slice(0, 10))
      .order('date', { ascending: false }),
    supabase.from('customers')
      .select('id,name,phone,total_reservations,created_at')
      .eq('tenant_id', tenantId),
    supabase.from('agent_feedback')
      .select('id,original_status,corrected_status,created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', thirtyDaysAgo)
  ])

  const calls = callsRes.data || []
  const reservas = reservasRes.data || []
  const customers = customersRes.data || []
  const feedback = feedbackRes.data || []

  if (calls.length === 0 && reservas.length === 0) return insights

  // ── 1. Conversion Rate Trend ────────────────────────────────────────
  const thisWeekCalls = calls.filter(c => c.started_at >= sevenDaysAgo)
  const prevWeekCalls = calls.filter(c => c.started_at >= new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString() && c.started_at < sevenDaysAgo)

  const thisWeekCompleted = thisWeekCalls.filter(c => c.status === 'completada' || c.status === 'completed').length
  const thisWeekReservas = reservas.filter(r => r.date >= sevenDaysAgo.slice(0, 10) && r.source === 'voice_agent').length
  const prevWeekCompleted = prevWeekCalls.filter(c => c.status === 'completada' || c.status === 'completed').length
  const prevWeekReservas = reservas.filter(r => {
    const d = r.date
    return d >= new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) && d < sevenDaysAgo.slice(0, 10) && r.source === 'voice_agent'
  }).length

  const thisRate = thisWeekCompleted > 0 ? Math.round((thisWeekReservas / thisWeekCompleted) * 100) : 0
  const prevRate = prevWeekCompleted > 0 ? Math.round((prevWeekReservas / prevWeekCompleted) * 100) : 0

  if (thisRate > 0 && prevRate > 0) {
    const diff = thisRate - prevRate
    if (diff >= 10) {
      insights.push({
        id: 'conv-up', type: 'trend', icon: '📈', priority: 'normal',
        title: `Conversión subiendo: ${thisRate}%`,
        body: `+${diff}% vs semana anterior. Tu agente está mejorando con la experiencia.`,
      })
    } else if (diff <= -10) {
      insights.push({
        id: 'conv-down', type: 'warning', icon: '📉', priority: 'high',
        title: `Conversión bajando: ${thisRate}%`,
        body: `${diff}% vs semana anterior. Revisa las llamadas recientes para detectar el patrón.`,
        action: 'Revisar llamadas', actionHref: '/llamadas',
      })
    }
  }

  // ── 2. Peak Hour Intelligence ───────────────────────────────────────
  const hourCounts: Record<number, number> = {}
  calls.forEach(c => {
    if (c.started_at) {
      const h = new Date(c.started_at).getHours()
      hourCounts[h] = (hourCounts[h] || 0) + 1
    }
  })
  const peakEntry = Object.entries(hourCounts).sort((a, b) => Number(b[1]) - Number(a[1]))[0]
  if (peakEntry) {
    const peakHour = Number(peakEntry[0])
    const peakCount = Number(peakEntry[1])
    const isNearPeak = Math.abs(hour - peakHour) <= 1
    if (isNearPeak && peakCount > 3) {
      insights.push({
        id: 'peak-now', type: 'warning', icon: '🔥', priority: 'high',
        title: 'Hora punta activa',
        body: `Las ${peakHour}h es tu hora con más llamadas (${peakCount} en 30 días). Sofía está preparada.`,
      })
    }
  }

  // ── 3. Repeat Customers ─────────────────────────────────────────────
  const phoneCounts: Record<string, { count: number; name: string }> = {}
  calls.forEach(c => {
    if (c.caller_phone && c.caller_phone !== 'Número oculto') {
      if (!phoneCounts[c.caller_phone]) phoneCounts[c.caller_phone] = { count: 0, name: c.customer_name || '' }
      phoneCounts[c.caller_phone].count++
      if (c.customer_name) phoneCounts[c.caller_phone].name = c.customer_name
    }
  })
  const topCallers = Object.entries(phoneCounts)
    .filter(([_, v]) => v.count >= 3)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3)

  if (topCallers.length > 0) {
    const [phone, data] = topCallers[0]
    insights.push({
      id: 'repeat-customer', type: 'learning', icon: '⭐', priority: 'normal',
      title: `Cliente habitual: ${data.name || phone.slice(-4)}`,
      body: `${data.count} llamadas en 30 días. ${topCallers.length > 1 ? `Y ${topCallers.length - 1} más habituales.` : 'Considéralo VIP.'}`,
      action: 'Ver clientes', actionHref: '/clientes',
    })
  }

  // ── 4. Correction Learning ──────────────────────────────────────────
  if (feedback.length >= 3) {
    const recentFeedback = feedback.slice(0, 10)
    const corrections: Record<string, number> = {}
    recentFeedback.forEach(f => {
      const key = `${f.original_status}→${f.corrected_status}`
      corrections[key] = (corrections[key] || 0) + 1
    })
    const topCorrection = Object.entries(corrections).sort((a, b) => b[1] - a[1])[0]
    if (topCorrection && topCorrection[1] >= 2) {
      insights.push({
        id: 'learning-pattern', type: 'learning', icon: '🧠', priority: 'normal',
        title: `Sofía está aprendiendo`,
        body: `Has corregido "${topCorrection[0].replace('→', ' → ')}" ${topCorrection[1]} veces. Sofía ajustará este patrón automáticamente.`,
        action: 'Ver reglas', actionHref: '/agente',
      })
    }
  }

  // ── 5. Capacity Warning ─────────────────────────────────────────────
  const todayReservas = reservas.filter(r => r.date === today)
  const todayPeople = todayReservas.reduce((s, r) => s + (r.people || 2), 0)
  if (todayPeople > 30) {
    insights.push({
      id: 'capacity-high', type: 'warning', icon: '⚡', priority: 'high',
      title: `Alta ocupación hoy: ${todayPeople} personas`,
      body: `${todayReservas.length} reservas confirmadas. Sofía priorizará confirmaciones rápidas.`,
      action: 'Ver reservas', actionHref: '/reservas',
    })
  }

  // ── 6. Day Pattern ──────────────────────────────────────────────────
  const dayOfWeek = now.getDay()
  const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
  const sameDayReservas = reservas.filter(r => {
    const d = new Date(r.date + 'T12:00:00')
    return d.getDay() === dayOfWeek
  })
  if (sameDayReservas.length > 5) {
    const avgPeople = Math.round(sameDayReservas.reduce((s, r) => s + (r.people || 2), 0) / sameDayReservas.length)
    insights.push({
      id: 'day-pattern', type: 'trend', icon: '📊', priority: 'low',
      title: `Los ${dayNames[dayOfWeek]} sueles tener ${sameDayReservas.length} reservas`,
      body: `Media de ${avgPeople} personas por reserva. ${dayOfWeek === 5 || dayOfWeek === 6 ? 'Es fin de semana — prepárate para más volumen.' : ''}`,
    })
  }

  // ── 7. No-Show / Cancellation Rate ─────────────────────────────────
  const cancelledCount = reservas.filter(r => r.status === 'cancelada').length
  const totalReservas = reservas.length
  if (totalReservas > 10) {
    const cancelRate = Math.round((cancelledCount / totalReservas) * 100)
    if (cancelRate > 20) {
      insights.push({
        id: 'cancel-rate', type: 'anomaly', icon: '⚠️', priority: 'high',
        title: `Tasa de cancelación alta: ${cancelRate}%`,
        body: `${cancelledCount} de ${totalReservas} reservas canceladas en 30 días. Considera pedir confirmación previa por SMS.`,
      })
    }
  }

  // ── 8. Agent Confidence Average ─────────────────────────────────────
  const withConfidence = calls.filter(c => c.decision_confidence != null && c.decision_confidence > 0)
  if (withConfidence.length > 5) {
    const avgConf = withConfidence.reduce((s, c) => s + (c.decision_confidence || 0), 0) / withConfidence.length
    if (avgConf < 0.6) {
      insights.push({
        id: 'low-confidence', type: 'warning', icon: '🤔', priority: 'high',
        title: `Confianza media baja: ${(avgConf * 100).toFixed(0)}%`,
        body: 'Sofía tiene dudas frecuentes. Revisa la base de conocimiento para darle más contexto.',
        action: 'Mejorar conocimiento', actionHref: '/agente',
      })
    } else if (avgConf > 0.85) {
      insights.push({
        id: 'high-confidence', type: 'trend', icon: '💪', priority: 'low',
        title: `Confianza alta: ${(avgConf * 100).toFixed(0)}%`,
        body: 'Sofía maneja las llamadas con seguridad. El negocio está bien configurado.',
      })
    }
  }

  // ── 9. No-Show Risk Warning ──────────────────────────────────────
  const todayReservasActive = reservas.filter(r => r.date === today && (r.status === 'confirmada' || r.status === 'confirmed'))
  if (todayReservasActive.length > 0) {
    // Simple no-show risk based on historical data
    const historicalNoShows = reservas.filter(r => r.status === 'no_show').length
    const totalHistorical = reservas.length || 1
    const noShowRate = historicalNoShows / totalHistorical
    if (noShowRate > 0.1) {
      const atRisk = Math.round(todayReservasActive.length * noShowRate)
      if (atRisk >= 1) {
        insights.push({
          id: 'noshow-risk', type: 'warning', icon: '⚠️', priority: 'high',
          title: `${atRisk} reserva${atRisk > 1 ? 's' : ''} con riesgo de no-show`,
          body: `Tu tasa de no-show es del ${(noShowRate * 100).toFixed(0)}%. Confirma por teléfono las reservas de hoy.`,
          action: 'Ver predicciones', actionHref: '/reservas',
        })
      }
    }
  }

  // ── 10. Customer Score Alert ───────────────────────────────────────
  const newCustomers = customers.filter(c => {
    if (!c.created_at) return false
    const daysAgo = (Date.now() - new Date(c.created_at).getTime()) / (24 * 60 * 60 * 1000)
    return daysAgo <= 7
  })
  if (newCustomers.length > 0) {
    insights.push({
      id: 'new-customers', type: 'opportunity', icon: '👤', priority: 'normal',
      title: `${newCustomers.length} cliente${newCustomers.length > 1 ? 's' : ''} nuevo${newCustomers.length > 1 ? 's' : ''} esta semana`,
      body: 'Revisa sus datos y márcalos como VIP si son importantes.',
      action: 'Ver clientes', actionHref: '/clientes',
    })
  }

  return insights.slice(0, 8) // Max 8 insights
}
