/**
 * RESERVO.AI — Harmonization Engine
 *
 * The BRAIN that connects all isolated modules.
 * Called by TPV, voice agent, WhatsApp, and manual flows
 * to keep inventory, notifications, and operational state in sync.
 *
 * Pure TypeScript, no React.
 */

import { createClient } from '@supabase/supabase-js'
import { createNotification, sendPush } from './notifications'
import { logger } from './logger'

// ─────────────────────────────────────────────────────────────
// Supabase admin client (server-side only)
// ─────────────────────────────────────────────────────────────

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface OperationalContext {
  activeShift: string | null
  todayOrders: number
  todayRevenue: number
  topSellingNow: { name: string; qty: number }[]
  lowStockItems: { name: string; remaining: number }[]
  upcomingReservations: { name: string; people: number; time: string }[]
  activeAlerts: string[]
  suggestion: string
}

interface OrderParams {
  customer_name?: string
  items: { name?: string; nombre?: string; quantity?: number; cantidad?: number; qty?: number; price?: number; precio?: number; limited_daily?: boolean }[]
  total: number
  order_type: string
  source: string
}

interface ReservationParams {
  customer_name: string
  party_size: number
  date: string
  time: string
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Normalize accents + lowercase for fuzzy name matching */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/** Determine the current shift based on hour */
function currentShift(): string | null {
  const hour = new Date().getHours()
  if (hour >= 6 && hour < 12) return 'mañana'
  if (hour >= 12 && hour < 18) return 'tarde'
  if (hour >= 18 || hour < 6) return 'noche'
  return null
}

/** Get today's date as YYYY-MM-DD in local timezone */
function todayDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Get tomorrow's date as YYYY-MM-DD */
function tomorrowDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ─────────────────────────────────────────────────────────────
// 1. decrementStock
// ─────────────────────────────────────────────────────────────

/**
 * Called when an order is CONFIRMED (from any channel: TPV, voice, WhatsApp).
 * Decrements inventory and creates alerts when stock is low or depleted.
 */
export async function decrementStock(
  tenantId: string,
  items: { name: string; quantity: number }[]
): Promise<void> {
  try {
    const { data: inventory } = await admin
      .from('inventory_items')
      .select('id, name, current_stock, min_stock')
      .eq('tenant_id', tenantId)
      .eq('active', true)

    if (!inventory || inventory.length === 0) return

    for (const item of items) {
      const normalizedName = normalize(item.name)

      // Fuzzy match: find inventory item whose normalized name matches
      const match = inventory.find(inv => normalize(inv.name) === normalizedName)
      if (!match) continue

      const newStock = (match.current_stock ?? 0) - item.quantity

      await admin
        .from('inventory_items')
        .update({ current_stock: newStock })
        .eq('id', match.id)
        .eq('tenant_id', tenantId)

      // Critical: stock depleted
      if (newStock <= 0) {
        await createNotification({
          tenant_id: tenantId,
          type: 'important_alert',
          title: `Agotado: ${match.name}`,
          body: `El stock de ${match.name} ha llegado a 0. No se pueden servir más pedidos de este producto.`,
          priority: 'critical',
          target_url: '/inventario',
        })
      } else if (newStock <= (match.min_stock ?? 0)) {
        // Warning: stock below minimum
        await createNotification({
          tenant_id: tenantId,
          type: 'important_alert',
          title: `Stock bajo: ${match.name}`,
          body: `Quedan ${newStock} unidades de ${match.name}. Mínimo configurado: ${match.min_stock}.`,
          priority: 'warning',
          target_url: '/inventario',
        })
      }
    }
  } catch (err) {
    logger.error('decrementStock error', { tenantId }, err)
  }
}

// ─────────────────────────────────────────────────────────────
// 2. checkAvailability
// ─────────────────────────────────────────────────────────────

/**
 * Shared availability check used by TPV, voice agent, and WhatsApp.
 */
export async function checkAvailability(
  tenantId: string,
  itemName: string
): Promise<{ available: boolean; remaining: number | null; message: string }> {
  try {
    const normalizedName = normalize(itemName)

    // Check inventory_items
    const { data: inventory } = await admin
      .from('inventory_items')
      .select('id, name, current_stock, min_stock')
      .eq('tenant_id', tenantId)
      .eq('active', true)

    if (inventory && inventory.length > 0) {
      const match = inventory.find(inv => normalize(inv.name) === normalizedName)
      if (match && match.current_stock !== null && match.current_stock !== undefined) {
        if (match.current_stock <= 0) {
          return { available: false, remaining: 0, message: 'Agotado' }
        }
        if (match.current_stock <= (match.min_stock ?? 0)) {
          return { available: true, remaining: match.current_stock, message: 'Quedan pocas unidades' }
        }
        return { available: true, remaining: match.current_stock, message: 'Disponible' }
      }
    }

    // Check menu_daily_counts for limited_daily items
    const { data: menuItems } = await admin
      .from('menu_items')
      .select('id, name, limited_daily, daily_limit')
      .eq('tenant_id', tenantId)
      .eq('active', true)

    if (menuItems && menuItems.length > 0) {
      const menuMatch = menuItems.find(mi => normalize(mi.name) === normalizedName)
      if (menuMatch && menuMatch.limited_daily && menuMatch.daily_limit) {
        const today = todayDate()
        const { data: counts } = await admin
          .from('menu_daily_counts')
          .select('count')
          .eq('tenant_id', tenantId)
          .eq('item_id', menuMatch.id)
          .eq('date', today)
          .maybeSingle()

        const used = counts?.count ?? 0
        const remaining = menuMatch.daily_limit - used

        if (remaining <= 0) {
          return { available: false, remaining: 0, message: 'Agotado por hoy' }
        }
        return { available: true, remaining, message: `Quedan ${remaining} unidades hoy` }
      }
    }

    // No inventory record found — assume available
    return { available: true, remaining: null, message: 'Disponible' }
  } catch (err) {
    logger.error('checkAvailability error', { tenantId, itemName }, err)
    return { available: true, remaining: null, message: 'Disponible' }
  }
}

// ─────────────────────────────────────────────────────────────
// 3. notifyOrderCreated
// ─────────────────────────────────────────────────────────────

/**
 * Called when ANY order is created from ANY channel (TPV, voice, WhatsApp, manual).
 * Orchestrates notifications, stock decrement, and daily count updates.
 */
export async function notifyOrderCreated(
  tenantId: string,
  order: OrderParams
): Promise<void> {
  try {
    const sourceLabel: Record<string, string> = {
      tpv: 'TPV',
      voice: 'Voz',
      whatsapp: 'WhatsApp',
      manual: 'Manual',
      web: 'Web',
    }
    const tag = `${order.source}_order`
    const label = sourceLabel[order.source] || order.source

    // 1. In-app notification
    const itemSummary = order.items
      .map(i => i.name || i.nombre || 'Item')
      .slice(0, 3)
      .join(', ')
    const suffix = order.items.length > 3 ? ` +${order.items.length - 3} más` : ''

    await createNotification({
      tenant_id: tenantId,
      type: 'new_order',
      title: `Nuevo pedido (${label})`,
      body: `${order.customer_name || 'Cliente'}: ${itemSummary}${suffix} — ${order.total.toFixed(2)}€`,
      priority: 'info',
      target_url: '/pedidos',
    })

    // 2. Push notification
    await sendPush({
      tenant_id: tenantId,
      title: `Nuevo pedido (${label})`,
      body: `${order.customer_name || 'Cliente'}: ${itemSummary}${suffix} — ${order.total.toFixed(2)}€`,
      url: '/pedidos',
      priority: 'info',
      tag,
    })

    // 3. Decrement stock
    const stockItems = order.items
      .filter(i => (i.name || i.nombre))
      .map(i => ({
        name: (i.name || i.nombre) as string,
        quantity: i.quantity || i.cantidad || i.qty || 1,
      }))

    if (stockItems.length > 0) {
      await decrementStock(tenantId, stockItems)
    }

    // 4. Increment menu_daily_counts for limited items
    const today = todayDate()
    for (const item of order.items) {
      if (!item.limited_daily) continue
      const itemName = item.name || item.nombre
      if (!itemName) continue

      // Find the menu_item id
      const { data: menuItem } = await admin
        .from('menu_items')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('active', true)
        .ilike('name', itemName)
        .maybeSingle()

      if (!menuItem) continue

      const qty = item.quantity || item.cantidad || item.qty || 1

      // Upsert daily count
      const { data: existing } = await admin
        .from('menu_daily_counts')
        .select('count')
        .eq('tenant_id', tenantId)
        .eq('item_id', menuItem.id)
        .eq('date', today)
        .maybeSingle()

      if (existing) {
        await admin
          .from('menu_daily_counts')
          .update({ count: (existing.count ?? 0) + qty })
          .eq('tenant_id', tenantId)
          .eq('item_id', menuItem.id)
          .eq('date', today)
      } else {
        await admin
          .from('menu_daily_counts')
          .insert({ tenant_id: tenantId, item_id: menuItem.id, date: today, count: qty })
      }
    }
  } catch (err) {
    logger.error('notifyOrderCreated error', { tenantId, source: order.source }, err)
  }
}

// ─────────────────────────────────────────────────────────────
// 4. alertLargeReservation
// ─────────────────────────────────────────────────────────────

/**
 * Called when a reservation with party_size >= 8 is created.
 * Notifies staff to prepare accordingly.
 */
export async function alertLargeReservation(
  tenantId: string,
  reservation: ReservationParams
): Promise<void> {
  try {
    const isCritical = reservation.party_size >= 15
    const priority = isCritical ? 'critical' : 'warning'
    const title = isCritical
      ? `Reserva muy grande: ${reservation.customer_name}`
      : `Reserva grande: ${reservation.customer_name}`
    const body = isCritical
      ? `${reservation.party_size} personas el ${reservation.date} a las ${reservation.time} — preparar cocina y sala`
      : `${reservation.party_size} personas el ${reservation.date} a las ${reservation.time}`

    await createNotification({
      tenant_id: tenantId,
      type: 'important_alert',
      title,
      body,
      priority: priority as 'warning' | 'critical',
      target_url: '/reservas',
    })

    await sendPush({
      tenant_id: tenantId,
      title,
      body,
      url: '/reservas',
      priority: priority as 'warning' | 'critical',
      tag: 'large_reservation',
    })
  } catch (err) {
    logger.error('alertLargeReservation error', { tenantId }, err)
  }
}

// ─────────────────────────────────────────────────────────────
// 5. getOperationalContext
// ─────────────────────────────────────────────────────────────

/**
 * Returns the current operational state of the business for the dashboard.
 */
export async function getOperationalContext(
  tenantId: string
): Promise<OperationalContext> {
  const today = todayDate()
  const tomorrow = tomorrowDate()

  try {
    // Parallel queries for performance
    const [ordersRes, inventoryRes, reservationsRes, alertsRes] = await Promise.all([
      // Today's confirmed+ orders
      admin
        .from('order_events')
        .select('items, total_estimate, status, created_at')
        .eq('tenant_id', tenantId)
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`)
        .in('status', ['confirmed', 'preparing', 'ready', 'delivered', 'completed']),
      // Low stock items
      admin
        .from('inventory_items')
        .select('name, current_stock, min_stock')
        .eq('tenant_id', tenantId)
        .eq('active', true),
      // Today + tomorrow reservations
      admin
        .from('reservations')
        .select('customer_name, party_size, time, date')
        .eq('tenant_id', tenantId)
        .in('date', [today, tomorrow])
        .eq('status', 'confirmed')
        .order('time', { ascending: true }),
      // Active unread notifications (alerts)
      admin
        .from('notifications')
        .select('title')
        .eq('tenant_id', tenantId)
        .eq('read', false)
        .in('priority', ['warning', 'critical'])
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    const orders = ordersRes.data || []
    const inventory = inventoryRes.data || []
    const reservations = reservationsRes.data || []
    const alerts = alertsRes.data || []

    // Calculate today's orders and revenue
    const todayOrders = orders.length
    const todayRevenue = orders.reduce((sum, o) => sum + (o.total_estimate || 0), 0)

    // Top selling items today
    const itemCounts: Record<string, number> = {}
    for (const order of orders) {
      const orderItems = Array.isArray(order.items) ? order.items : []
      for (const oi of orderItems) {
        const name = (oi.name || oi.nombre || '').trim()
        if (name) {
          itemCounts[name] = (itemCounts[name] || 0) + (oi.quantity || oi.cantidad || oi.qty || 1)
        }
      }
    }
    const topSellingNow = Object.entries(itemCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, qty]) => ({ name, qty }))

    // Low stock items
    const lowStockItems = inventory
      .filter(i => i.current_stock !== null && i.current_stock <= (i.min_stock ?? 0) && i.current_stock >= 0)
      .sort((a, b) => a.current_stock - b.current_stock)
      .map(i => ({ name: i.name, remaining: i.current_stock }))

    // Upcoming reservations
    const upcomingReservations = reservations
      .slice(0, 10)
      .map(r => ({
        name: r.customer_name || 'Sin nombre',
        people: r.party_size || 0,
        time: r.time || '',
      }))

    // Active alerts
    const activeAlerts = alerts.map(a => a.title)

    // Generate smart suggestion
    const context: OperationalContext = {
      activeShift: currentShift(),
      todayOrders,
      todayRevenue: Math.round(todayRevenue * 100) / 100,
      topSellingNow,
      lowStockItems,
      upcomingReservations,
      activeAlerts,
      suggestion: '',
    }

    context.suggestion = generateSmartSuggestion(context)

    return context
  } catch (err) {
    logger.error('getOperationalContext error', { tenantId }, err)
    return {
      activeShift: currentShift(),
      todayOrders: 0,
      todayRevenue: 0,
      topSellingNow: [],
      lowStockItems: [],
      upcomingReservations: [],
      activeAlerts: [],
      suggestion: 'No se pudo cargar el contexto operativo.',
    }
  }
}

// ─────────────────────────────────────────────────────────────
// 6. generateSmartSuggestion
// ─────────────────────────────────────────────────────────────

/**
 * Creates ONE useful, human, specific sentence about the current state.
 */
export function generateSmartSuggestion(context: OperationalContext): string {
  // Priority 1: Critical stock issues
  const depleted = context.lowStockItems.filter(i => i.remaining <= 0)
  if (depleted.length > 0) {
    const names = depleted.slice(0, 2).map(i => i.name).join(' y ')
    return `Se ha agotado ${names}. Hay que reponer urgentemente.`
  }

  // Priority 2: Large upcoming reservation
  const bigReservation = context.upcomingReservations.find(r => r.people >= 10)
  if (bigReservation) {
    return `Tienes una reserva de ${bigReservation.people} personas a las ${bigReservation.time}. Prepara cocina.`
  }

  // Priority 3: Low stock warning
  if (context.lowStockItems.length > 0) {
    const item = context.lowStockItems[0]
    return `Se está acabando ${item.name}. Quedan ${item.remaining} unidades.`
  }

  // Priority 4: High volume day
  if (context.todayOrders >= 20 && context.topSellingNow.length > 0) {
    const top = context.topSellingNow[0]
    return `Llevas ${context.todayOrders} pedidos hoy. ${top.name} es lo más pedido con ${top.qty} unidades.`
  }

  // Priority 5: Revenue milestone
  if (context.todayRevenue >= 500) {
    return `Llevas ${context.todayRevenue.toFixed(0)}€ en ventas hoy. Buen ritmo.`
  }

  // Priority 6: Multiple reservations coming
  if (context.upcomingReservations.length >= 3) {
    const totalPeople = context.upcomingReservations.reduce((s, r) => s + r.people, 0)
    return `Tienes ${context.upcomingReservations.length} reservas próximas con ${totalPeople} personas en total.`
  }

  // Priority 7: Shift-based default
  if (context.activeShift === 'mañana') {
    return context.todayOrders > 0
      ? `${context.todayOrders} pedidos esta mañana. Buen comienzo.`
      : 'Turno de mañana tranquilo. Buen momento para revisar stock.'
  }

  if (context.activeShift === 'noche') {
    return context.todayOrders > 0
      ? `${context.todayOrders} pedidos hoy. El turno de noche está en marcha.`
      : 'Turno de noche arrancando. Todo en orden.'
  }

  // Default
  return context.todayOrders > 0
    ? `${context.todayOrders} pedidos hoy por ${context.todayRevenue.toFixed(0)}€. Todo bajo control.`
    : 'Turno tranquilo. Buen momento para revisar stock.'
}
