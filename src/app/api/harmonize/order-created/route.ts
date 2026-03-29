/**
 * POST /api/harmonize/order-created
 * Called after ANY order is confirmed. Triggers stock decrement and notifications.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/api-auth'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { decrementStock, notifyOrderCreated } from '@/lib/harmonize-engine'
import { logger } from '@/lib/logger'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const rl = rateLimitByIp(req, RATE_LIMITS.api, 'harmonize:order-created')
    if (rl.blocked) return rl.response

    const auth = await requireAuth(req)
    if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const { order_id } = await req.json()
    if (!order_id) return NextResponse.json({ error: 'order_id required' }, { status: 400 })

    // Read the order
    const { data: order, error } = await admin.from('order_events')
      .select('id, tenant_id, customer_name, items, total_estimate, order_type, status')
      .eq('id', order_id)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle()

    if (error || !order) {
      return NextResponse.json({ error: 'order not found' }, { status: 404 })
    }

    const items = Array.isArray(order.items) ? order.items : []
    const stockItems = items
      .filter((i: Record<string, unknown>) => i.name)
      .map((i: Record<string, unknown>) => ({
        name: i.name as string,
        quantity: (i.quantity as number) || (i.qty as number) || 1,
      }))

    // Decrement stock (non-blocking errors)
    await decrementStock(auth.tenantId, stockItems).catch(() => {})

    // Notify order created
    await notifyOrderCreated(auth.tenantId, {
      customer_name: order.customer_name,
      items,
      total: order.total_estimate || 0,
      order_type: order.order_type || 'mesa',
      source: 'tpv',
    }).catch(() => {})

    logger.info('harmonize:order-created', { tenant_id: auth.tenantId, order_id })

    return NextResponse.json({ ok: true })
  } catch (err) {
    logger.error('harmonize:order-created', {}, err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
