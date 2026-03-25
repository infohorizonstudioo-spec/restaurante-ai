import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface NoShowPrediction {
  reservationId: string
  customerName: string
  time: string
  people: number
  riskScore: number
  riskTier: 'low' | 'medium' | 'high'
  factors: string[]
}

export async function predictNoShows(tenantId: string, date: string): Promise<NoShowPrediction[]> {
  const [todayRes, historyRes] = await Promise.all([
    supabase.from('reservations')
      .select('id,customer_name,customer_phone,customer_id,time,people,status,source,created_at')
      .eq('tenant_id', tenantId).eq('date', date)
      .in('status', ['confirmada', 'confirmed', 'pendiente', 'pending']),
    supabase.from('reservations')
      .select('customer_id,customer_phone,status')
      .eq('tenant_id', tenantId)
      .gte('date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)),
  ])

  const today = todayRes.data || []
  const history = historyRes.data || []

  // Global no-show rate
  const totalHist = history.length || 1
  const globalNoShows = history.filter(r => r.status === 'no_show').length
  const globalRate = globalNoShows / totalHist
  const dayOfWeek = new Date(date + 'T12:00:00').getDay()
  const isWeekend = dayOfWeek === 5 || dayOfWeek === 6

  return today.map(r => {
    const factors: string[] = []
    let risk = Math.round(globalRate * 100 * 0.3) // base risk (30% weight of global rate)

    // Customer history
    const custHistory = history.filter(h =>
      (r.customer_id && h.customer_id === r.customer_id) ||
      (r.customer_phone && h.customer_phone === r.customer_phone)
    )
    if (custHistory.length > 0) {
      const custNoShows = custHistory.filter(h => h.status === 'no_show').length
      const custCancels = custHistory.filter(h => h.status === 'cancelada' || h.status === 'cancelled').length
      const custRate = (custNoShows + custCancels * 0.3) / custHistory.length
      risk += Math.round(custRate * 50)
      if (custNoShows > 0) factors.push(`${custNoShows} no-show previo${custNoShows > 1 ? 's' : ''}`)
      if (custCancels > 1) factors.push(`${custCancels} cancelaciones previas`)
    } else {
      risk += 15
      factors.push('Cliente sin historial')
    }

    // Contextual
    if ((r.people || 1) >= 6) { risk += 8; factors.push('Grupo grande') }
    if (isWeekend) { risk += 3; factors.push('Fin de semana') }
    if (r.source !== 'voice_agent' && r.source !== 'phone_agent') { risk += 5; factors.push('Reserva no telefónica') }

    // Recency of booking
    if (r.created_at) {
      const daysAgo = (Date.now() - new Date(r.created_at).getTime()) / (24 * 60 * 60 * 1000)
      if (daysAgo > 3) { risk += 8; factors.push('Reserva hace más de 3 días') }
    }

    risk = Math.min(100, Math.max(0, risk))
    const riskTier: 'low' | 'medium' | 'high' = risk <= 20 ? 'low' : risk <= 40 ? 'medium' : 'high'

    return {
      reservationId: r.id,
      customerName: r.customer_name || 'Sin nombre',
      time: (r.time || '').slice(0, 5),
      people: r.people || 1,
      riskScore: risk,
      riskTier,
      factors,
    }
  }).sort((a, b) => b.riskScore - a.riskScore)
}
