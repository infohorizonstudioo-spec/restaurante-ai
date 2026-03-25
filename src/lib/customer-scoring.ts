import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface CustomerScore {
  score: number
  tier: 'excelente' | 'bueno' | 'normal' | 'atencion'
  color: string
  frequency: number
  reliability: number
  recency: number
  engagement: number
}

export async function computeAllScores(tenantId: string): Promise<Record<string, CustomerScore>> {
  const [customersRes, reservationsRes, callsRes] = await Promise.all([
    supabase.from('customers').select('id,name,phone,total_reservations,last_visit,vip')
      .eq('tenant_id', tenantId),
    supabase.from('reservations').select('customer_id,customer_phone,status,date')
      .eq('tenant_id', tenantId)
      .gte('date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)),
    supabase.from('calls').select('caller_phone,started_at')
      .eq('tenant_id', tenantId)
      .gte('started_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
  ])

  const customers = customersRes.data || []
  const reservations = reservationsRes.data || []
  const calls = callsRes.data || []
  const now = Date.now()
  const scores: Record<string, CustomerScore> = {}

  for (const c of customers) {
    // Frequency (0-30)
    const totalRes = c.total_reservations || 0
    const frequency = totalRes === 0 ? 0 : totalRes <= 2 ? 10 : totalRes <= 5 ? 20 : 30

    // Reliability (0-30) — based on no-show/cancel rate
    const custRes = reservations.filter(r => r.customer_id === c.id || r.customer_phone === c.phone)
    const noShows = custRes.filter(r => r.status === 'no_show').length
    const cancels = custRes.filter(r => r.status === 'cancelada' || r.status === 'cancelled').length
    const total = custRes.length || 1
    const badRate = (noShows + cancels * 0.5) / total
    const reliability = badRate === 0 ? 30 : badRate < 0.1 ? 20 : badRate < 0.25 ? 10 : 0

    // Recency (0-20)
    const lastVisit = c.last_visit ? new Date(c.last_visit).getTime() : 0
    const daysSince = lastVisit ? (now - lastVisit) / (24 * 60 * 60 * 1000) : 999
    const recency = daysSince <= 7 ? 20 : daysSince <= 30 ? 15 : daysSince <= 90 ? 10 : 0

    // Engagement (0-10)
    const recentCalls = calls.filter(cl => cl.caller_phone === c.phone).length
    const engagement = recentCalls >= 3 ? 10 : recentCalls >= 1 ? 5 : 0

    // VIP bonus
    const vipBonus = c.vip ? 10 : 0

    const score = Math.min(100, frequency + reliability + recency + engagement + vipBonus)
    const tier = score >= 90 ? 'excelente' : score >= 70 ? 'bueno' : score >= 40 ? 'normal' : 'atencion'
    const color = tier === 'excelente' ? '#4ADE80' : tier === 'bueno' ? '#2DD4BF' : tier === 'normal' ? '#8895A7' : '#F87171'

    scores[c.id] = { score, tier, color, frequency, reliability, recency, engagement }
  }

  return scores
}
