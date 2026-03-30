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

    // Calculate total
    const total = items.reduce(
      (s: number, i: { price?: number; quantity?: number }) =>
        s + (i.price || 0) * (i.quantity || 1),
      0
    )

    // Build notes string
    const noteParts = [
      mesa ? `Mesa: ${mesa}` : '',
      context ? `Contexto: ${sanitizeString(context, 100)}` : '',
      notes ? sanitizeString(notes, 500) : '',
    ].filter(Boolean)

    // Create order
    const { data: order, error } = await admin
      .from('order_events')
      .insert({
        tenant_id: tenant.id,
        call_sid: 'qr_' + Date.now().toString(36),
        status: 'confirmed',
        order_type: 'mesa',
        customer_name: sanitizeName(customer_name) || 'QR',
        items,
        notes: noteParts.join(' | ') || 'Pedido QR',
        total_estimate: total,
        payment_method: 'pending',
      })
      .select('id')
      .maybeSingle()

    if (error) {
      logger.error('public order error', {}, error)
      return NextResponse.json({ error: 'Error al crear pedido' }, { status: 500 })
    }

    // If table number provided, update table status to ocupada
    if (mesa) {
      const { data: dbTable } = await admin
        .from('tables')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('number', String(mesa))
        .maybeSingle()
      if (dbTable) {
        await admin.from('tables').update({ status: 'ocupada' }).eq('id', dbTable.id)
      }
    }

    // Trigger harmonize: stock decrement + owner notification (non-blocking)
    try {
      await notifyOrderCreated(tenant.id, {
        customer_name: customer_name || 'QR',
        items,
        total,
        order_type: 'mesa',
        source: 'qr',
      })
    } catch { /* non-critical */ }

    // Create kitchen-focused in-app notification with full order details
    try {
      await admin.from('notifications').insert({
        tenant_id: tenant.id,
        type: 'new_order',
        title: `🍳 Comanda QR${mesa ? ' — Mesa ' + mesa : ''}`,
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
