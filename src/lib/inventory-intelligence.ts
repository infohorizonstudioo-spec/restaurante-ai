/**
 * RESERVO.AI — Inventory Intelligence
 *
 * Predicts consumption patterns, detects seasonal/event spikes,
 * and generates actionable inventory alerts per tenant.
 *
 * Used by:
 *   - /api/cron/supplier-orders  (adjust quantities before ordering)
 *   - /api/inventory-alerts      (dashboard display)
 */

import { createClient } from '@supabase/supabase-js'
import { logger } from './logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface InventoryAlert {
  type: 'low_stock' | 'seasonal' | 'peak_day' | 'critical'
  urgency: 'info' | 'warning' | 'critical'
  product?: string
  message: string
  suggestedMultiplier?: number
}

export interface ConsumptionData {
  itemId: string
  itemName: string
  avgWeekly: number
  currentStock: number
  daysUntilEmpty: number
  minStock: number
  maxStock: number | null
  supplierId: string | null
}

// ─────────────────────────────────────────────────────────────
// Spanish holidays & seasonal events
// ─────────────────────────────────────────────────────────────

interface SeasonalEvent {
  name: string
  /** Returns the date(s) for a given year, or null if not applicable */
  getDates: (year: number) => Date[]
  multiplier: number
  categories: string[] // affected product categories
  alertMessage: string
}

function easterSunday(year: number): Date {
  // Anonymous Gregorian algorithm
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month, day)
}

function semanaSantaDates(year: number): Date[] {
  const easter = easterSunday(year)
  const dates: Date[] = []
  // Domingo de Ramos to Domingo de Resurreccion (7 days before Easter to Easter)
  for (let i = 7; i >= 0; i--) {
    const d = new Date(easter)
    d.setDate(d.getDate() - i)
    dates.push(d)
  }
  return dates
}

const SEASONAL_EVENTS: SeasonalEvent[] = [
  {
    name: 'Semana Santa',
    getDates: (year) => semanaSantaDates(year),
    multiplier: 2.0,
    categories: ['Bebidas', 'Carnes', 'Pescados', 'Panadería'],
    alertMessage: 'Semana Santa en {days} dias. Historicamente se consume 2x mas de bebidas y carnes. Sugerimos pedir extra.',
  },
  {
    name: 'Navidad',
    getDates: (year) => [new Date(year, 11, 24), new Date(year, 11, 25), new Date(year, 11, 26)],
    multiplier: 2.0,
    categories: ['Bebidas', 'Carnes', 'Pescados', 'Lácteos', 'Panadería', 'Frutas'],
    alertMessage: 'Navidad en {days} dias. La demanda sube un 100%. Revisar todo el inventario.',
  },
  {
    name: 'Nochevieja',
    getDates: (year) => [new Date(year, 11, 31)],
    multiplier: 2.0,
    categories: ['Bebidas', 'Carnes', 'Pescados', 'Frutas'],
    alertMessage: 'Nochevieja en {days} dias. Pico maximo de demanda de bebidas y mariscos.',
  },
  {
    name: 'San Valentin',
    getDates: (year) => [new Date(year, 1, 14)],
    multiplier: 1.5,
    categories: ['Bebidas', 'Carnes', 'Lácteos', 'Frutas'],
    alertMessage: 'San Valentin en {days} dias. Prevision de +50% en reservas y consumo.',
  },
  {
    name: 'Dia de la Madre',
    getDates: (year) => {
      // First Sunday of May in Spain
      const may1 = new Date(year, 4, 1)
      const day = may1.getDay()
      const firstSunday = day === 0 ? 1 : 8 - day
      return [new Date(year, 4, firstSunday)]
    },
    multiplier: 1.5,
    categories: ['Bebidas', 'Carnes', 'Lácteos', 'Frutas', 'Panadería'],
    alertMessage: 'Dia de la Madre en {days} dias. Prevision alta de reservas. Sugerimos pedir extra.',
  },
  {
    name: 'Puente de la Constitucion',
    getDates: (year) => [new Date(year, 11, 6), new Date(year, 11, 7), new Date(year, 11, 8)],
    multiplier: 1.5,
    categories: ['Bebidas', 'Carnes', 'Verduras'],
    alertMessage: 'Puente de la Constitucion en {days} dias. Se espera +50% de demanda.',
  },
  {
    name: 'Puente de Mayo',
    getDates: (year) => [new Date(year, 4, 1), new Date(year, 4, 2)],
    multiplier: 1.5,
    categories: ['Bebidas', 'Carnes', 'Verduras'],
    alertMessage: 'Puente de Mayo en {days} dias. Se espera +50% de demanda.',
  },
  {
    name: 'Dia de Reyes',
    getDates: (year) => [new Date(year, 0, 5), new Date(year, 0, 6)],
    multiplier: 1.8,
    categories: ['Bebidas', 'Carnes', 'Panadería', 'Lácteos', 'Frutas'],
    alertMessage: 'Dia de Reyes en {days} dias. Alta demanda prevista.',
  },
]

// ─────────────────────────────────────────────────────────────
// Consumption analysis
// ─────────────────────────────────────────────────────────────

/**
 * Calculate average weekly consumption per inventory item
 * by analyzing past order_events (sales).
 */
async function getConsumptionData(tenantId: string): Promise<ConsumptionData[]> {
  // Fetch active inventory items
  const { data: items, error: itemsErr } = await supabase
    .from('inventory_items')
    .select('id, name, category, current_stock, min_stock, max_stock, supplier_id')
    .eq('tenant_id', tenantId)
    .eq('active', true)

  if (itemsErr || !items || items.length === 0) return []

  // Fetch order_events from last 8 weeks to compute averages
  const eightWeeksAgo = new Date()
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56)

  const { data: events } = await supabase
    .from('order_events')
    .select('payload, created_at')
    .eq('tenant_id', tenantId)
    .gte('created_at', eightWeeksAgo.toISOString())

  // Count product mentions in order events
  const productCounts: Record<string, number> = {}
  if (events) {
    for (const evt of events) {
      const payload = typeof evt.payload === 'string' ? JSON.parse(evt.payload) : evt.payload
      const orderItems = payload?.items || payload?.productos || []
      for (const oi of orderItems) {
        const name = (oi.name || oi.nombre || '').toLowerCase().trim()
        if (name) {
          productCounts[name] = (productCounts[name] || 0) + (oi.quantity || oi.cantidad || oi.qty || 1)
        }
      }
    }
  }

  // Calculate weeks of data (min 1 to avoid division by zero)
  const weeksOfData = Math.max(1, Math.min(8, events ? Math.ceil(events.length > 0 ? 8 : 1) : 1))

  return items.map(item => {
    const nameKey = item.name.toLowerCase().trim()
    const totalConsumed = productCounts[nameKey] || 0
    const avgWeekly = totalConsumed / weeksOfData
    const daysUntilEmpty = avgWeekly > 0
      ? Math.floor((item.current_stock / (avgWeekly / 7)))
      : item.current_stock > 0 ? 999 : 0

    return {
      itemId: item.id,
      itemName: item.name,
      avgWeekly: Math.round(avgWeekly * 10) / 10,
      currentStock: item.current_stock,
      daysUntilEmpty,
      minStock: item.min_stock,
      maxStock: item.max_stock,
      supplierId: item.supplier_id,
    }
  })
}

// ─────────────────────────────────────────────────────────────
// Seasonal & event detection
// ─────────────────────────────────────────────────────────────

function isSummerMonth(month: number): boolean {
  return month >= 5 && month <= 8 // June (5) through September (8)
}

function isPeakDay(dayOfWeek: number): boolean {
  return dayOfWeek === 5 || dayOfWeek === 6 // Friday=5, Saturday=6
}

interface UpcomingEvent {
  event: SeasonalEvent
  daysUntil: number
}

function getUpcomingEvents(lookAheadDays: number = 10): UpcomingEvent[] {
  const now = new Date()
  const upcoming: UpcomingEvent[] = []

  for (const event of SEASONAL_EVENTS) {
    // Check current year and next year
    for (const year of [now.getFullYear(), now.getFullYear() + 1]) {
      const dates = event.getDates(year)
      for (const d of dates) {
        const diff = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        if (diff >= 0 && diff <= lookAheadDays) {
          // Only add once per event (closest date)
          if (!upcoming.find(u => u.event.name === event.name)) {
            upcoming.push({ event, daysUntil: diff })
          }
          break
        }
      }
    }
  }

  return upcoming
}

// ─────────────────────────────────────────────────────────────
// Public: Generate inventory alerts
// ─────────────────────────────────────────────────────────────

export async function generateInventoryAlerts(tenantId: string): Promise<InventoryAlert[]> {
  const alerts: InventoryAlert[] = []
  const now = new Date()

  try {
    const consumption = await getConsumptionData(tenantId)

    // 1. Low stock / critical stock alerts
    for (const item of consumption) {
      if (item.currentStock <= 0) {
        alerts.push({
          type: 'critical',
          urgency: 'critical',
          product: item.itemName,
          message: `${item.itemName}: SIN STOCK. Media semanal: ${item.avgWeekly}. Pedir urgentemente.`,
        })
      } else if (item.daysUntilEmpty <= 3 && item.avgWeekly > 0) {
        alerts.push({
          type: 'low_stock',
          urgency: 'critical',
          product: item.itemName,
          message: `${item.itemName} stock bajo (${item.currentStock} unidades). Media semanal: ${item.avgWeekly}. Se acabara en ${item.daysUntilEmpty} dias.`,
        })
      } else if (item.currentStock <= item.minStock && item.currentStock > 0) {
        alerts.push({
          type: 'low_stock',
          urgency: 'warning',
          product: item.itemName,
          message: `${item.itemName}: stock en minimo (${item.currentStock}). Conviene reponer pronto.`,
        })
      }
    }

    // 2. Seasonal / event alerts
    const upcoming = getUpcomingEvents(10)
    for (const { event, daysUntil } of upcoming) {
      const msg = event.alertMessage.replace('{days}', String(daysUntil))
      alerts.push({
        type: 'seasonal',
        urgency: daysUntil <= 3 ? 'critical' : 'warning',
        message: msg,
        suggestedMultiplier: event.multiplier,
      })
    }

    // 3. Summer month alert
    if (isSummerMonth(now.getMonth())) {
      alerts.push({
        type: 'seasonal',
        urgency: 'info',
        message: 'Temporada de verano activa. La demanda de bebidas y helados sube un 50%. Ajustar pedidos.',
        suggestedMultiplier: 1.5,
      })
    }

    // 4. Peak day alerts (check upcoming Friday/Saturday)
    const dayOfWeek = now.getDay()
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7
    if (daysUntilFriday > 0 && daysUntilFriday <= 3) {
      alerts.push({
        type: 'peak_day',
        urgency: 'info',
        message: `Viernes en ${daysUntilFriday} dia(s): prevision alta. Revisar stock de carnes, bebidas y productos frescos.`,
        suggestedMultiplier: 1.3,
      })
    }
    const daysUntilSaturday = (6 - dayOfWeek + 7) % 7
    if (daysUntilSaturday > 0 && daysUntilSaturday <= 3 && daysUntilSaturday !== daysUntilFriday) {
      alerts.push({
        type: 'peak_day',
        urgency: 'info',
        message: `Sabado en ${daysUntilSaturday} dia(s): prevision alta. Revisar stock general.`,
        suggestedMultiplier: 1.3,
      })
    }

  } catch (err) {
    logger.error('Inventory intelligence error', { tenantId }, err)
    alerts.push({
      type: 'low_stock',
      urgency: 'warning',
      message: 'No se pudo analizar el inventario completamente. Revisa el stock manualmente.',
    })
  }

  // Sort: critical first, then warning, then info
  const urgencyOrder = { critical: 0, warning: 1, info: 2 }
  alerts.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency])

  return alerts
}

// ─────────────────────────────────────────────────────────────
// Public: Compute order quantity multiplier
// ─────────────────────────────────────────────────────────────

/**
 * Returns a multiplier (1.0 = normal, 1.5 = +50%, 2.0 = double)
 * that the cron should apply to order quantities based on upcoming events.
 */
export function getOrderMultiplier(): number {
  const now = new Date()
  let multiplier = 1.0

  // Summer boost
  if (isSummerMonth(now.getMonth())) {
    multiplier = Math.max(multiplier, 1.3)
  }

  // Peak day boost (ordering for Friday/Saturday)
  const dayOfWeek = now.getDay()
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7
  if (daysUntilFriday <= 2) {
    multiplier = Math.max(multiplier, 1.2)
  }

  // Event boost
  const upcoming = getUpcomingEvents(7)
  for (const { event } of upcoming) {
    multiplier = Math.max(multiplier, event.multiplier)
  }

  return multiplier
}

/**
 * Build a short summary of active alerts for inclusion in SMS messages.
 * Returns empty string if no notable alerts.
 */
export function summarizeAlertsForSms(alerts: InventoryAlert[]): string {
  const critical = alerts.filter(a => a.urgency === 'critical')
  const seasonal = alerts.filter(a => a.type === 'seasonal' && a.urgency !== 'info')

  const parts: string[] = []

  if (critical.length > 0) {
    parts.push(`URGENTE: ${critical.length} producto(s) en stock critico`)
  }
  if (seasonal.length > 0) {
    const eventNames = seasonal.map(a => {
      const match = a.message.match(/^([^.]+)/)
      return match ? match[1] : ''
    }).filter(Boolean)
    if (eventNames.length > 0) {
      parts.push(eventNames[0])
    }
  }

  return parts.join('. ')
}
