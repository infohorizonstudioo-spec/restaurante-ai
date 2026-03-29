// TPV Intelligence Engine — real pattern learning on top of tpv-engine.ts
// Server-side only (uses Supabase service role key)

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TrendingData {
  trendingUp: { name: string; currentQty: number; avgQty: number; pctChange: number }[]
  trendingDown: { name: string; currentQty: number; avgQty: number; pctChange: number }[]
  peakHour: number | null
  paceVsLastWeek: number
}

export interface Combo {
  itemA: string
  itemB: string
  frequency: number
  confidence: number
}

export interface DayPrediction {
  estimatedRevenue: number
  estimatedOrders: number
  paceLabel: string
  pacePercent: number
  comparedTo: string
}

export interface ServiceAlert {
  type: 'high_volume' | 'low_stock' | 'big_reservation' | 'unusual_item' | 'pace_warning'
  icon: string
  message: string
  priority: 'info' | 'warning' | 'critical'
}

export interface SmartLayout {
  categories: { name: string; priority: number; items: any[] }[]
  popularNow: { id: string; name: string; price: number; trend: 'up' | 'stable' }[]
  suggestedCombos: { itemA: string; itemB: string }[]
  alerts: ServiceAlert[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────

interface OrderItem {
  name: string
  price?: number
  quantity?: number
}

function getDayOfWeek(): number {
  return new Date().getDay()
}

function getCurrentHour(): number {
  return new Date().getHours()
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Aggregate item quantities from a list of order rows */
function countItems(orders: { items: OrderItem[] }[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const order of orders) {
    if (!Array.isArray(order.items)) continue
    for (const item of order.items) {
      const name = item.name?.trim()
      if (!name) continue
      counts.set(name, (counts.get(name) ?? 0) + (item.quantity ?? 1))
    }
  }
  return counts
}

// ─── 1. analyzeTrending ─────────────────────────────────────────────────────

export async function analyzeTrending(tenantId: string): Promise<TrendingData> {
  const now = new Date()
  const currentHour = getCurrentHour()
  const hourStart = currentHour - 4 < 0 ? 0 : currentHour - 4
  const today = toISODate(now)
  const dow = getDayOfWeek()

  // Today's orders in the last 4 hours
  const fromHour = new Date(now)
  fromHour.setHours(hourStart, 0, 0, 0)

  const { data: todayOrders } = await supabase
    .from('order_events')
    .select('items, total_estimate, created_at')
    .eq('tenant_id', tenantId)
    .gte('created_at', fromHour.toISOString())
    .lte('created_at', now.toISOString())
    .neq('status', 'cancelled')

  // Same day-of-week from last 4 weeks, same hour range
  const historicalOrders: { items: OrderItem[] }[] = []
  let totalHistRevenue = 0
  let totalHistOrders = 0
  let totalHistFullDayRevenue = 0
  let totalHistFullDayOrders = 0
  const weeksFound: string[] = []

  for (let w = 1; w <= 4; w++) {
    const pastDate = new Date(now)
    pastDate.setDate(pastDate.getDate() - w * 7)
    const pastDay = toISODate(pastDate)

    const pastFrom = new Date(pastDate)
    pastFrom.setHours(hourStart, 0, 0, 0)
    const pastTo = new Date(pastDate)
    pastTo.setHours(currentHour, 59, 59, 999)

    const { data: pastOrders } = await supabase
      .from('order_events')
      .select('items, total_estimate, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', pastFrom.toISOString())
      .lte('created_at', pastTo.toISOString())
      .neq('status', 'cancelled')

    if (pastOrders && pastOrders.length > 0) {
      historicalOrders.push(...pastOrders)
      weeksFound.push(pastDay)
      totalHistRevenue += pastOrders.reduce((s, o) => s + (o.total_estimate ?? 0), 0)
      totalHistOrders += pastOrders.length
    }

    // Full day data for peak hour prediction
    const fullDayFrom = new Date(pastDate)
    fullDayFrom.setHours(0, 0, 0, 0)
    const fullDayTo = new Date(pastDate)
    fullDayTo.setHours(23, 59, 59, 999)

    const { data: fullDay } = await supabase
      .from('order_events')
      .select('created_at, total_estimate')
      .eq('tenant_id', tenantId)
      .gte('created_at', fullDayFrom.toISOString())
      .lte('created_at', fullDayTo.toISOString())
      .neq('status', 'cancelled')

    if (fullDay) {
      totalHistFullDayRevenue += fullDay.reduce((s, o) => s + (o.total_estimate ?? 0), 0)
      totalHistFullDayOrders += fullDay.length
    }
  }

  const safe = todayOrders ?? []
  const todayCounts = countItems(safe)
  const numWeeks = weeksFound.length || 1
  const avgCounts = new Map<string, number>()
  const histCounts = countItems(historicalOrders)
  for (const [name, qty] of histCounts) {
    avgCounts.set(name, qty / numWeeks)
  }

  // All item names from both today and history
  const allNames = new Set([...todayCounts.keys(), ...avgCounts.keys()])

  const trendingUp: TrendingData['trendingUp'] = []
  const trendingDown: TrendingData['trendingDown'] = []

  for (const name of allNames) {
    const current = todayCounts.get(name) ?? 0
    const avg = avgCounts.get(name) ?? 0
    if (avg === 0 && current === 0) continue

    if (avg === 0 && current > 0) {
      // New item selling today with no history — treat as trending up
      trendingUp.push({ name, currentQty: current, avgQty: 0, pctChange: 100 })
      continue
    }

    const pctChange = ((current - avg) / avg) * 100

    if (pctChange >= 50) {
      trendingUp.push({ name, currentQty: current, avgQty: Math.round(avg * 10) / 10, pctChange: Math.round(pctChange) })
    } else if (pctChange <= -50 && avg >= 2) {
      trendingDown.push({ name, currentQty: current, avgQty: Math.round(avg * 10) / 10, pctChange: Math.round(pctChange) })
    }
  }

  // Sort: trending up by pctChange desc, trending down by pctChange asc
  trendingUp.sort((a, b) => b.pctChange - a.pctChange)
  trendingDown.sort((a, b) => a.pctChange - b.pctChange)

  // Peak hour prediction from historical full-day data
  let peakHour: number | null = null
  if (totalHistFullDayOrders > 0) {
    const hourBuckets = new Map<number, number>()
    // Re-fetch full-day orders from last 4 same-day-of-week for hour distribution
    for (let w = 1; w <= 4; w++) {
      const pastDate = new Date(now)
      pastDate.setDate(pastDate.getDate() - w * 7)
      const fullDayFrom = new Date(pastDate)
      fullDayFrom.setHours(0, 0, 0, 0)
      const fullDayTo = new Date(pastDate)
      fullDayTo.setHours(23, 59, 59, 999)

      const { data: fullDay } = await supabase
        .from('order_events')
        .select('created_at')
        .eq('tenant_id', tenantId)
        .gte('created_at', fullDayFrom.toISOString())
        .lte('created_at', fullDayTo.toISOString())
        .neq('status', 'cancelled')

      if (fullDay) {
        for (const o of fullDay) {
          const h = new Date(o.created_at).getHours()
          hourBuckets.set(h, (hourBuckets.get(h) ?? 0) + 1)
        }
      }
    }

    let maxCount = 0
    for (const [h, count] of hourBuckets) {
      if (count > maxCount) {
        maxCount = count
        peakHour = h
      }
    }
  }

  // Pace vs last week
  const todayRevenue = safe.reduce((s, o) => s + ((o as any).total_estimate ?? 0), 0)
  const avgRevenue = numWeeks > 0 ? totalHistRevenue / numWeeks : 0
  const paceVsLastWeek = avgRevenue > 0 ? Math.round(((todayRevenue - avgRevenue) / avgRevenue) * 100) : 0

  return {
    trendingUp: trendingUp.slice(0, 5),
    trendingDown: trendingDown.slice(0, 3),
    peakHour,
    paceVsLastWeek,
  }
}

// ─── 2. detectCombos ────────────────────────────────────────────────────────

export async function detectCombos(tenantId: string): Promise<Combo[]> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: orders } = await supabase
    .from('order_events')
    .select('items')
    .eq('tenant_id', tenantId)
    .gte('created_at', thirtyDaysAgo.toISOString())
    .neq('status', 'cancelled')

  if (!orders || orders.length === 0) return []

  // Count how many orders each item appears in
  const itemOrderCount = new Map<string, number>()
  // Count co-occurrences of pairs
  const pairCount = new Map<string, number>()

  for (const order of orders) {
    if (!Array.isArray(order.items)) continue
    const names = [...new Set(order.items.map((i: OrderItem) => i.name?.trim()).filter(Boolean))] as string[]

    for (const name of names) {
      itemOrderCount.set(name, (itemOrderCount.get(name) ?? 0) + 1)
    }

    // All pairs (sorted to avoid duplicates)
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const pair = [names[i], names[j]].sort().join('|||')
        pairCount.set(pair, (pairCount.get(pair) ?? 0) + 1)
      }
    }
  }

  const combos: Combo[] = []

  for (const [pairKey, count] of pairCount) {
    const [itemA, itemB] = pairKey.split('|||')
    if (!itemA || !itemB) continue

    const countA = itemOrderCount.get(itemA) ?? 0
    const countB = itemOrderCount.get(itemB) ?? 0
    if (countA === 0 || countB === 0) continue

    // Confidence: proportion of orders containing A that also contain B (and vice versa, take max)
    const confAB = count / countA
    const confBA = count / countB
    const confidence = Math.max(confAB, confBA)

    // If pair appears in 20%+ of orders containing either item
    if (confidence >= 0.2 && count >= 3) {
      combos.push({
        itemA,
        itemB,
        frequency: count,
        confidence: Math.round(confidence * 100) / 100,
      })
    }
  }

  // Sort by frequency desc, take top 8
  combos.sort((a, b) => b.frequency - a.frequency)
  return combos.slice(0, 8)
}

// ─── 3. predictDayEnd ───────────────────────────────────────────────────────

export async function predictDayEnd(
  tenantId: string,
  currentRevenue: number,
  currentOrders: number,
): Promise<DayPrediction> {
  const now = new Date()
  const currentHour = getCurrentHour()
  const dow = getDayOfWeek()
  const dayNames = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados']

  // Get same day-of-week from last 4 weeks — full day totals + partial (up to current hour)
  let totalFullDayRevenue = 0
  let totalFullDayOrders = 0
  let totalPartialRevenue = 0
  let totalPartialOrders = 0
  let weeksWithData = 0

  for (let w = 1; w <= 4; w++) {
    const pastDate = new Date(now)
    pastDate.setDate(pastDate.getDate() - w * 7)

    const dayStart = new Date(pastDate)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(pastDate)
    dayEnd.setHours(23, 59, 59, 999)
    const partialEnd = new Date(pastDate)
    partialEnd.setHours(currentHour, 59, 59, 999)

    const [fullRes, partialRes] = await Promise.all([
      supabase
        .from('order_events')
        .select('total_estimate')
        .eq('tenant_id', tenantId)
        .gte('created_at', dayStart.toISOString())
        .lte('created_at', dayEnd.toISOString())
        .neq('status', 'cancelled'),
      supabase
        .from('order_events')
        .select('total_estimate')
        .eq('tenant_id', tenantId)
        .gte('created_at', dayStart.toISOString())
        .lte('created_at', partialEnd.toISOString())
        .neq('status', 'cancelled'),
    ])

    const fullOrders = fullRes.data ?? []
    const partialOrders = partialRes.data ?? []

    if (fullOrders.length > 0) {
      weeksWithData++
      totalFullDayRevenue += fullOrders.reduce((s, o) => s + (o.total_estimate ?? 0), 0)
      totalFullDayOrders += fullOrders.length
      totalPartialRevenue += partialOrders.reduce((s, o) => s + (o.total_estimate ?? 0), 0)
      totalPartialOrders += partialOrders.length
    }
  }

  if (weeksWithData === 0) {
    return {
      estimatedRevenue: currentRevenue,
      estimatedOrders: currentOrders,
      paceLabel: 'Sin datos históricos',
      pacePercent: 0,
      comparedTo: 'sin histórico disponible',
    }
  }

  const avgFullRevenue = totalFullDayRevenue / weeksWithData
  const avgFullOrders = totalFullDayOrders / weeksWithData
  const avgPartialRevenue = totalPartialRevenue / weeksWithData
  const avgPartialOrders = totalPartialOrders / weeksWithData

  // Extrapolation ratio: how much of the day is left based on historical pattern
  const ratioRevenue = avgPartialRevenue > 0 ? avgFullRevenue / avgPartialRevenue : 1
  const ratioOrders = avgPartialOrders > 0 ? avgFullOrders / avgPartialOrders : 1

  const estimatedRevenue = Math.round(currentRevenue * ratioRevenue)
  const estimatedOrders = Math.round(currentOrders * ratioOrders)

  // Pace comparison
  const pacePercent = avgPartialRevenue > 0
    ? Math.round(((currentRevenue - avgPartialRevenue) / avgPartialRevenue) * 100)
    : 0

  let paceLabel: string
  if (pacePercent > 10) paceLabel = 'Por encima de lo normal'
  else if (pacePercent < -10) paceLabel = 'Por debajo de lo normal'
  else paceLabel = 'Normal'

  return {
    estimatedRevenue,
    estimatedOrders,
    paceLabel,
    pacePercent,
    comparedTo: `media de los últimos ${weeksWithData} ${dayNames[dow]}`,
  }
}

// ─── 4. generateServiceAlerts ───────────────────────────────────────────────

export async function generateServiceAlerts(tenantId: string): Promise<ServiceAlert[]> {
  const alerts: ServiceAlert[] = []
  const now = new Date()
  const currentHour = getCurrentHour()

  // --- High volume check ---
  const oneHourAgo = new Date(now)
  oneHourAgo.setHours(oneHourAgo.getHours() - 1)

  const { data: recentOrders } = await supabase
    .from('order_events')
    .select('id')
    .eq('tenant_id', tenantId)
    .gte('created_at', oneHourAgo.toISOString())
    .neq('status', 'cancelled')

  const recentCount = recentOrders?.length ?? 0

  // Get average orders for this hour from last 4 same-day-of-week
  let historicalHourTotal = 0
  let historicalWeeks = 0
  for (let w = 1; w <= 4; w++) {
    const pastDate = new Date(now)
    pastDate.setDate(pastDate.getDate() - w * 7)
    const hourFrom = new Date(pastDate)
    hourFrom.setHours(currentHour - 1, 0, 0, 0)
    const hourTo = new Date(pastDate)
    hourTo.setHours(currentHour, 0, 0, 0)

    const { data: hourOrders, count } = await supabase
      .from('order_events')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('created_at', hourFrom.toISOString())
      .lte('created_at', hourTo.toISOString())
      .neq('status', 'cancelled')

    if (count !== null) {
      historicalHourTotal += count
      historicalWeeks++
    }
  }

  const avgHourOrders = historicalWeeks > 0 ? historicalHourTotal / historicalWeeks : 0
  if (avgHourOrders > 0 && recentCount > avgHourOrders * 1.5) {
    alerts.push({
      type: 'high_volume',
      icon: '🔥',
      message: `Ritmo alto: ${recentCount} pedidos en la última hora (media: ${Math.round(avgHourOrders)})`,
      priority: recentCount > avgHourOrders * 2 ? 'critical' : 'warning',
    })
  }

  // --- Low stock check ---
  const { data: lowStock } = await supabase
    .from('inventory_items')
    .select('name, current_stock')
    .eq('tenant_id', tenantId)
    .lte('current_stock', 2)

  if (lowStock) {
    for (const item of lowStock) {
      alerts.push({
        type: 'low_stock',
        icon: '📦',
        message: item.current_stock === 0
          ? `Sin stock de ${item.name}`
          : `Casi sin ${item.name} (quedan ${item.current_stock})`,
        priority: item.current_stock === 0 ? 'critical' : 'warning',
      })
    }
  }

  // --- Big reservation coming ---
  const today = toISODate(now)
  const twoHoursLater = new Date(now)
  twoHoursLater.setHours(twoHoursLater.getHours() + 2)
  const timeNow = `${String(currentHour).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const timeLater = `${String(twoHoursLater.getHours()).padStart(2, '0')}:${String(twoHoursLater.getMinutes()).padStart(2, '0')}`

  const { data: bigReservations } = await supabase
    .from('reservations')
    .select('party_size, time, customer_name')
    .eq('tenant_id', tenantId)
    .eq('date', today)
    .gte('party_size', 8)
    .gte('time', timeNow)
    .lte('time', timeLater)
    .in('status', ['confirmed', 'pending'])

  if (bigReservations) {
    for (const res of bigReservations) {
      const name = res.customer_name ? ` (${res.customer_name})` : ''
      alerts.push({
        type: 'big_reservation',
        icon: '👥',
        message: `Grupo de ${res.party_size} a las ${res.time}${name}`,
        priority: res.party_size >= 12 ? 'warning' : 'info',
      })
    }
  }

  // --- Unusual item selling ---
  // Compare items sold in last 2 hours vs their 30-day average daily sales
  const twoHoursAgo = new Date(now)
  twoHoursAgo.setHours(twoHoursAgo.getHours() - 2)

  const { data: recentItemOrders } = await supabase
    .from('order_events')
    .select('items')
    .eq('tenant_id', tenantId)
    .gte('created_at', twoHoursAgo.toISOString())
    .neq('status', 'cancelled')

  if (recentItemOrders && recentItemOrders.length > 0) {
    const recentCounts = countItems(recentItemOrders)

    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: monthOrders } = await supabase
      .from('order_events')
      .select('items')
      .eq('tenant_id', tenantId)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .neq('status', 'cancelled')

    if (monthOrders && monthOrders.length > 0) {
      const monthCounts = countItems(monthOrders)
      const daysInRange = 30

      for (const [name, recentQty] of recentCounts) {
        const monthTotal = monthCounts.get(name) ?? 0
        const dailyAvg = monthTotal / daysInRange
        // If item rarely sells (less than 1/day avg) but sold 3+ in last 2h
        if (dailyAvg < 1 && recentQty >= 3) {
          alerts.push({
            type: 'unusual_item',
            icon: '📈',
            message: `${name} se está vendiendo más de lo normal (${recentQty} en 2h, media diaria: ${dailyAvg.toFixed(1)})`,
            priority: 'info',
          })
        }
      }
    }
  }

  // Sort: critical first, then warning, then info
  const priorityOrder = { critical: 0, warning: 1, info: 2 }
  alerts.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

  return alerts
}

// ─── 5. getSmartTPVOrder ────────────────────────────────────────────────────

// Time-based priority (replicates tpv-engine.ts logic without importing)
const TIME_PRIORITIES: { start: number; end: number; cats: string[] }[] = [
  { start: 7, end: 11, cats: ['Cafes', 'Desayunos', 'Bolleria'] },
  { start: 11, end: 13, cats: ['Cafes', 'Bebidas', 'Bocadillos'] },
  { start: 13, end: 16, cats: ['Raciones', 'Platos', 'Cervezas', 'Vinos', 'Bebidas'] },
  { start: 16, end: 18, cats: ['Cafes', 'Bebidas', 'Meriendas'] },
  { start: 18, end: 20, cats: ['Cervezas', 'Tapas', 'Raciones', 'Bebidas'] },
  { start: 20, end: 24, cats: ['Raciones', 'Platos', 'Cervezas', 'Vinos', 'Cocteles'] },
  { start: 0, end: 7, cats: ['Cocteles', 'Cervezas', 'Bebidas'] },
]

function getTimePriorities(hour: number): string[] {
  const h = ((hour % 24) + 24) % 24
  for (const slot of TIME_PRIORITIES) {
    if (slot.start <= slot.end) {
      if (h >= slot.start && h < slot.end) return slot.cats
    } else {
      if (h >= slot.start || h < slot.end) return slot.cats
    }
  }
  return TIME_PRIORITIES[TIME_PRIORITIES.length - 1].cats
}

export function getSmartTPVOrder(
  items: any[],
  hour: number,
  trending: TrendingData,
  combos: Combo[],
): SmartLayout {
  const activeItems = items.filter((i: any) => i.active !== false)
  const timeCats = getTimePriorities(hour)

  // Build sets for fast lookup
  const trendingUpNames = new Set(trending.trendingUp.map(t => t.name))
  const comboItemNames = new Set<string>()
  for (const c of combos) {
    comboItemNames.add(c.itemA)
    comboItemNames.add(c.itemB)
  }

  // Group items by category and calculate priority
  const grouped = new Map<string, any[]>()
  for (const item of activeItems) {
    const cat = item.category || 'Otro'
    if (!grouped.has(cat)) grouped.set(cat, [])
    grouped.get(cat)!.push(item)
  }

  const categories: SmartLayout['categories'] = []
  for (const [catName, catItems] of grouped) {
    const timeIndex = timeCats.indexOf(catName)
    let priority = timeIndex >= 0 ? (timeCats.length - timeIndex) * 10 : 0

    // Boost categories with trending items
    const hasTrending = catItems.some((i: any) => trendingUpNames.has(i.name))
    if (hasTrending) priority += 50

    // Boost categories with combo items
    const hasCombo = catItems.some((i: any) => comboItemNames.has(i.name))
    if (hasCombo) priority += 20

    categories.push({
      name: catName,
      priority,
      items: catItems.map((i: any) => ({ id: i.id, name: i.name, price: i.price, category: i.category })),
    })
  }

  categories.sort((a, b) => b.priority - a.priority)

  // "Populares ahora" — trending up items + first few from top categories
  const popularNow: SmartLayout['popularNow'] = []
  const addedIds = new Set<string>()

  // First add trending up items
  for (const t of trending.trendingUp) {
    const item = activeItems.find((i: any) => i.name === t.name)
    if (item && !addedIds.has(item.id)) {
      popularNow.push({ id: item.id, name: item.name, price: item.price, trend: 'up' })
      addedIds.add(item.id)
    }
  }

  // Fill up to 8 with items from top priority categories
  for (const cat of categories) {
    for (const item of cat.items) {
      if (popularNow.length >= 8) break
      if (!addedIds.has(item.id)) {
        popularNow.push({ id: item.id, name: item.name, price: item.price, trend: 'stable' })
        addedIds.add(item.id)
      }
    }
    if (popularNow.length >= 8) break
  }

  // Suggested combos — top 4 from detected combos
  const suggestedCombos = combos.slice(0, 4).map(c => ({ itemA: c.itemA, itemB: c.itemB }))

  return {
    categories,
    popularNow,
    suggestedCombos,
    alerts: [], // Alerts are fetched separately via generateServiceAlerts
  }
}
