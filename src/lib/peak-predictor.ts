import { createClient } from '@supabase/supabase-js'
import { parseReservationConfig, generateSlots } from '@/lib/scheduling-engine'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface HourForecast {
  hour: string
  predicted: number
  actual: number
  level: 'tranquilo' | 'normal' | 'ocupado' | 'lleno'
  color: string
}

export async function predictDayDemand(tenantId: string, date: string): Promise<{
  forecast: HourForecast[]
  peakHour: string
  peakDemand: number
  summary: string
}> {
  const targetDay = new Date(date + 'T12:00:00').getDay()

  const [tenantRes, todayRes, historyRes] = await Promise.all([
    supabase.from('tenants').select('reservation_config').eq('id', tenantId).maybeSingle(),
    supabase.from('reservations')
      .select('time,people,status')
      .eq('tenant_id', tenantId).eq('date', date)
      .in('status', ['confirmada', 'confirmed', 'pendiente', 'pending']),
    supabase.from('reservations')
      .select('date,time,people')
      .eq('tenant_id', tenantId)
      .in('status', ['confirmada', 'confirmed', 'completada', 'completed'])
      .gte('date', new Date(Date.now() - 56 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)),
  ])

  const cfg = parseReservationConfig(tenantRes.data?.reservation_config)
  const slots = generateSlots(cfg)
  const todayData = todayRes.data || []
  const histData = historyRes.data || []

  // Count same day-of-week historical averages per hour
  const sameDayHistory = histData.filter(r => {
    const d = new Date(r.date + 'T12:00:00').getDay()
    return d === targetDay
  })
  const weeksOfData = Math.max(1, Math.ceil(
    (Date.now() - new Date(Date.now() - 56 * 24 * 60 * 60 * 1000).getTime()) / (7 * 24 * 60 * 60 * 1000)
  ))

  // Group by hour
  const hourBuckets: Record<string, { historical: number; actual: number }> = {}
  for (const slot of slots) {
    const hour = slot.slice(0, 2)
    if (!hourBuckets[hour]) hourBuckets[hour] = { historical: 0, actual: 0 }
  }

  for (const r of sameDayHistory) {
    const hour = (r.time || '').slice(0, 2)
    if (hourBuckets[hour] !== undefined) {
      hourBuckets[hour].historical += (r.people || 1)
    }
  }

  for (const r of todayData) {
    const hour = (r.time || '').slice(0, 2)
    if (hourBuckets[hour] !== undefined) {
      hourBuckets[hour].actual += (r.people || 1)
    }
  }

  const maxCapacity = cfg.max_new_people_per_slot || 16
  let peakHour = ''
  let peakDemand = 0

  const forecast: HourForecast[] = Object.entries(hourBuckets).map(([hour, data]) => {
    const avg = Math.round(data.historical / weeksOfData)
    const predicted = Math.max(avg, data.actual)
    const pct = predicted / maxCapacity

    const level: 'tranquilo' | 'normal' | 'ocupado' | 'lleno' = pct < 0.3 ? 'tranquilo' : pct < 0.7 ? 'normal' : pct < 0.9 ? 'ocupado' : 'lleno'
    const color = level === 'tranquilo' ? '#34D399' : level === 'normal' ? '#F0A84E' : level === 'ocupado' ? '#FB923C' : '#F87171'

    if (predicted > peakDemand) { peakDemand = predicted; peakHour = hour + ':00' }

    return { hour: hour + ':00', predicted, actual: data.actual, level, color }
  }).sort((a, b) => parseInt(a.hour) - parseInt(b.hour))

  const summary = peakDemand > 0
    ? `Pico esperado a las ${peakHour} con ~${Math.round(peakDemand / maxCapacity * 100)}% de ocupación.`
    : 'Sin datos suficientes para predecir.'

  return { forecast, peakHour, peakDemand, summary }
}
