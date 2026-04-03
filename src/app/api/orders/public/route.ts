import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimitByIp } from '@/lib/rate-limit'
import { sanitizeName, sanitizeString } from '@/lib/sanitize'
import { notifyOrderCreated } from '@/lib/harmonize-engine'
import { logger } from '@/lib/logger'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const PUBLIC_ORDER_LIMIT = { limit: 5, windowSeconds: 60 }

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 5 orders per minute per IP
    const rl = rateLimitByIp(req, PUBLIC_ORDER_LIMIT, 'orders:public')
    if (rl.blocked) return rl.response

    const body = await req.json()
    const { slug, mesa, items, customer_name, notes, context } = body

    // Validate
    if (!slug || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    // Validate items structure
    for (const item of items) {
      if (!item.name || typeof item.price !== 'number' || item.price < 0) {
        return NextResponse.json({ error: 'Producto invalido' }, { status: 400 })
      }
      if (item.quantity && (item.quantity < 1 || item.quantity > 99)) {
        return NextResponse.json({ error: 'Cantidad invalida' }, { status: 400 })
      }
    }

    // Find tenant by slug
    const { data: tenant } = await admin
      .from('tenants')
      .select('id, name, plan')
      .ilike('slug', slug)
      .maybeSingle()

    if (!tenant) {
      return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
    }

    // Check daily limits — reject items that exceed their daily_limit
    const today = new Date().toISOString().slice(0, 10)
    const itemIds = items.map((i: any) => i.id).filter(Boolean)
    if (itemIds.length > 0) {
      const [menuRes, countsRes] = await Promise.all([
        admin.from('menu_items').select('id,daily_limit,availability_type').eq('tenant_id', tenant.id).in('id', itemIds),
        admin.from('menu_daily_counts').select('item_id,count').eq('tenant_id', tenant.id).eq('date', today),
      ])
      const countMap: Record<string, number> = {}
      for (const c of (countsRes.data || [])) countMap[c.item_id] = c.count
      for (const mi of (menuRes.data || [])) {
        if (mi.availability_type === 'unavailable') {
          return NextResponse.json({ error: `${items.find((i: any) => i.id === mi.id)?.name || 'Producto'} no esta disponible` }, { status: 400 })
        }
        if (mi.availability_type === 'limited_daily' && mi.daily_limit) {
          const used = countMap[mi.id] || 0
          const ordered = items.find((i: any) => i.id === mi.id)?.quantity || 1
          if (used + ordered > mi.daily_limit) {
            return NextResponse.json({ error: `${items.find((i: any) => i.id === mi.id)?.name || 'Producto'} agotado por hoy` }, { status: 400 })
          }
        }
      }
    }

    // Calculate total
    const total = items.reduce(
      (s: number, i: { price?: number; quantity?: number }) =>
        s + (i.price || 0) * (i.quantity || 1),
      0
    )

    // Resolve table BEFORE creating order (so we can store table_id)
    let tableId: string | null = null
    let zoneName: string | null = null
    if (mesa) {
      const { data: dbTable } = await admin
        .from('tables')
        .select('id, zone_name')
        .eq('tenant_id', tenant.id)
        .eq('number', String(mesa))
        .maybeSingle()
      if (dbTable) {
        tableId = dbTable.id
        zoneName = dbTable.zone_name || null
        await admin.from('tables').update({ status: 'ocupada' }).eq('id', dbTable.id)
      }
    }

    // Build notes string
    const noteParts = [
      mesa ? `Mesa: ${mesa}` : '',
      context ? `Contexto: ${sanitizeString(context, 100)}` : '',
      notes ? sanitizeString(notes, 500) : '',
    ].filter(Boolean)

    // Determine order type: barra (no mesa) vs mesa
    const isBarra = !mesa && !tableId
    const orderType = isBarra ? 'barra' : 'mesa'
    const safeName = sanitizeName(customer_name) || (isBarra ? 'Barra' : 'QR')

    // Create order with table_id
    const { data: order, error } = await admin
      .from('order_events')
      .insert({
        tenant_id: tenant.id,
        call_sid: 'qr_' + Date.now().toString(36),
        status: 'confirmed',
        order_type: orderType,
        customer_name: safeName,
        items,
        notes: noteParts.join(' | ') || 'Pedido QR',
        total_estimate: total,
        payment_method: 'pending',
        table_id: tableId,
      })
      .select('id')
      .maybeSingle()

    if (error) {
      logger.error('public order error', {}, error)
      return NextResponse.json({ error: 'Error al crear pedido' }, { status: 500 })
    }

    // Trigger harmonize: stock decrement + owner notification (non-blocking)
    try {
      await notifyOrderCreated(tenant.id, {
        customer_name: customer_name || 'QR',
        items,
        total,
        order_type: orderType,
        source: 'qr',
      })
    } catch { /* non-critical */ }

    // Create kitchen-focused in-app notification with full order details
    try {
      const locationLabel = mesa
        ? `Mesa ${mesa}${zoneName ? ' \u00b7 ' + zoneName : ''}`
        : `Barra \u2014 ${safeName}`
      await admin.from('notifications').insert({
        tenant_id: tenant.id,
        type: 'new_order',
        title: `\uD83C\uDF73 Comanda QR \u2014 ${locationLabel}`,
        body: items.map((i: { name: string; quantity?: number }) => `${i.quantity || 1}x ${i.name}`).join(', ') + (notes ? ` | Notas: ${sanitizeString(notes, 500)}` : ''),
        priority: 'warning',
        read: false,
        target_url: '/pedidos',
      })
    } catch { /* non-critical */ }

    return NextResponse.json({ success: true, order_id: order?.id })
  } catch (e: unknown) {
    logger.error('public order error', {}, e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
