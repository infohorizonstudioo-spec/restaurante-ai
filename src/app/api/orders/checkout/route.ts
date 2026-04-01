import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { rateLimitByIp } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-02-24.acacia' })
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const CHECKOUT_LIMIT = { limit: 5, windowSeconds: 60 }

export const dynamic = 'force-dynamic'

/**
 * POST /api/orders/checkout
 * Creates a Stripe Checkout session for a table bill payment.
 * Public endpoint (no auth) — rate limited.
 */
export async function POST(req: NextRequest) {
  const rl = rateLimitByIp(req, CHECKOUT_LIMIT, 'orders:checkout')
  if (rl.blocked) return rl.response

  try {
    const { slug, mesa, customer_name } = await req.json()

    if (!slug || !mesa) {
      return NextResponse.json({ error: 'slug and mesa required' }, { status: 400 })
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Pagos no configurados' }, { status: 503 })
    }

    // Find tenant with Stripe Connect info
    const { data: tenant } = await admin
      .from('tenants')
      .select('id, name, slug, stripe_connect_id, stripe_connect_enabled')
      .ilike('slug', slug)
      .maybeSingle()

    if (!tenant) {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }

    // Verify restaurant has Stripe Connect configured
    if (!tenant.stripe_connect_id || !tenant.stripe_connect_enabled) {
      return NextResponse.json({ error: 'Pagos online no disponibles en este establecimiento' }, { status: 400 })
    }

    // Find table
    const { data: table } = await admin
      .from('tables')
      .select('id, zone_name')
      .eq('tenant_id', tenant.id)
      .eq('number', String(mesa))
      .maybeSingle()

    if (!table) {
      return NextResponse.json({ error: 'table not found' }, { status: 404 })
    }

    const today = new Date().toISOString().slice(0, 10)

    // Get unpaid orders for this table today
    const { data: orders } = await admin
      .from('order_events')
      .select('id, items, total_estimate')
      .eq('tenant_id', tenant.id)
      .eq('table_id', table.id)
      .gte('created_at', today + 'T00:00:00')
      .in('payment_method', ['pending', 'bizum_pending'])
      .not('status', 'eq', 'cancelled')

    if (!orders || orders.length === 0) {
      return NextResponse.json({ error: 'No hay pedidos pendientes de pago' }, { status: 400 })
    }

    // Aggregate all items into Stripe line items
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = []
    for (const order of orders) {
      for (const item of (order.items || [])) {
        const qty = item.quantity || item.qty || 1
        const price = Math.round((item.price || 0) * 100) // Stripe uses cents
        if (price > 0) {
          lineItems.push({
            price_data: {
              currency: 'eur',
              product_data: { name: item.name },
              unit_amount: price,
            },
            quantity: qty,
          })
        }
      }
    }

    if (lineItems.length === 0) {
      return NextResponse.json({ error: 'No hay items que cobrar' }, { status: 400 })
    }

    const stripe = getStripe()
    const orderIds = orders.map(o => o.id)

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.get('host')}`
    const returnUrl = `${baseUrl}/pedir/${tenant.slug}?mesa=${mesa}&paid=true`
    const cancelUrl = `${baseUrl}/pedir/${tenant.slug}?mesa=${mesa}`

    // Calculate total in cents for application fee (RESERVO.AI commission: 1.5%)
    const totalCents = lineItems.reduce((s, li) => s + (li.price_data?.unit_amount || 0) * (li.quantity || 1), 0)
    const appFee = Math.round(totalCents * 0.015) // 1.5% commission

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: lineItems,
      // Stripe Connect: money goes to restaurant, RESERVO.AI takes commission
      payment_intent_data: {
        application_fee_amount: appFee,
        transfer_data: {
          destination: tenant.stripe_connect_id!,
        },
      },
      success_url: returnUrl,
      cancel_url: cancelUrl,
      metadata: {
        tenant_id: tenant.id,
        table_id: table.id,
        mesa: String(mesa),
        order_ids: orderIds.join(','),
        customer_name: customer_name || 'QR',
        source: 'qr_table_payment',
      },
    })

    logger.info('Stripe table checkout created', { tenantId: tenant.id, mesa, total: orders.reduce((s, o) => s + (o.total_estimate || 0), 0) })

    return NextResponse.json({ url: session.url, session_id: session.id })
  } catch (e: any) {
    logger.error('orders/checkout error', {}, e)
    return NextResponse.json({ error: 'Error al crear sesion de pago' }, { status: 500 })
  }
}
