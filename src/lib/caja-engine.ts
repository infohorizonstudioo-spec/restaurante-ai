/**
 * CAJA ENGINE — Shift-based cash register logic.
 * Pure functions, no Supabase or React dependencies.
 */

// ── Types ──────────────────────────────────────────────────────────

export interface CajaShift {
  id: string
  tenant_id: string
  opened_by: string          // employee name or "Sistema"
  opened_at: string          // ISO timestamp
  closed_at: string | null
  initial_cash: number       // cash in register at start
  total_sales: number        // calculated from orders
  total_cash: number         // cash payments
  total_card: number         // card payments
  total_other: number        // other payment methods
  orders_count: number
  counted_cash: number | null // actual counted cash at close
  difference: number | null   // counted_cash - expected cash
  notes: string | null
  status: 'open' | 'closed'
}

export interface CajaDaySummary {
  date: string
  shifts: CajaShift[]
  total_sales: number
  total_orders: number
  top_categories: { name: string; total: number }[]
  top_products: { name: string; quantity: number; total: number }[]
}

export interface ShiftTotals {
  total_sales: number
  total_cash: number
  total_card: number
  total_other: number
  orders_count: number
}

// ── Shift helpers ──────────────────────────────────────────────────

export type ShiftName = 'morning' | 'afternoon' | 'night'

export function getShiftLabel(hour: number): string {
  if (hour >= 7 && hour < 16) return 'Turno mañana'
  if (hour >= 16 && hour < 23) return 'Turno tarde'
  return 'Turno noche'
}

export function getShiftName(hour: number): ShiftName {
  if (hour >= 7 && hour < 16) return 'morning'
  if (hour >= 16 && hour < 23) return 'afternoon'
  return 'night'
}

export function getShiftTimeRange(shift: ShiftName): { start: number; end: number } {
  switch (shift) {
    case 'morning':   return { start: 7, end: 16 }
    case 'afternoon': return { start: 16, end: 23 }
    case 'night':     return { start: 23, end: 7 }
  }
}

export function getShiftIcon(shift: ShiftName): string {
  switch (shift) {
    case 'morning':   return '☀️'
    case 'afternoon': return '🌤️'
    case 'night':     return '🌙'
  }
}

// ── Calculations ───────────────────────────────────────────────────

/**
 * Calculate totals from a list of orders.
 * Orders are expected to have: total_estimate, payment_method?, status
 */
export function calculateShiftTotals(orders: any[]): ShiftTotals {
  // Only count completed/delivered orders (not cancelled)
  const valid = orders.filter(o => o.status !== 'cancelled')

  let total_sales = 0
  let total_cash = 0
  let total_card = 0
  let total_other = 0

  for (const o of valid) {
    const amount = parseFloat(o.total_estimate) || 0
    total_sales += amount

    const method = (o.payment_method || 'cash').toLowerCase()
    if (method === 'card' || method === 'tarjeta') {
      total_card += amount
    } else if (method === 'cash' || method === 'efectivo' || !o.payment_method) {
      total_cash += amount
    } else {
      total_other += amount
    }
  }

  return {
    total_sales: round2(total_sales),
    total_cash: round2(total_cash),
    total_card: round2(total_card),
    total_other: round2(total_other),
    orders_count: valid.length,
  }
}

/**
 * Generate a day summary from shifts and orders.
 */
export function generateDaySummary(shifts: CajaShift[], orders: any[]): CajaDaySummary {
  const today = new Date().toISOString().slice(0, 10)
  const valid = orders.filter(o => o.status !== 'cancelled')

  // Top products
  const productMap: Record<string, { quantity: number; total: number }> = {}
  const categoryMap: Record<string, number> = {}

  for (const order of valid) {
    const items: any[] = order.items || []
    for (const item of items) {
      const name = item.name || item.product || 'Producto'
      const qty = item.quantity || 1
      const price = (item.price || 0) * qty

      if (!productMap[name]) productMap[name] = { quantity: 0, total: 0 }
      productMap[name].quantity += qty
      productMap[name].total += price

      const cat = item.category || 'General'
      categoryMap[cat] = (categoryMap[cat] || 0) + price
    }
  }

  const top_products = Object.entries(productMap)
    .map(([name, v]) => ({ name, quantity: v.quantity, total: round2(v.total) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  const top_categories = Object.entries(categoryMap)
    .map(([name, total]) => ({ name, total: round2(total) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)

  return {
    date: today,
    shifts,
    total_sales: round2(shifts.reduce((s, sh) => s + sh.total_sales, 0)),
    total_orders: shifts.reduce((s, sh) => s + sh.orders_count, 0),
    top_categories,
    top_products,
  }
}

// ── ID generation ──────────────────────────────────────────────────

export function generateShiftId(): string {
  return `shift_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

// ── Utils ──────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function formatCurrency(amount: number): string {
  return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}
