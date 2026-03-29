import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-02-24.acacia' })
}
function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
}

// Idempotency: track processed Stripe event IDs to prevent replay attacks
const processedEvents = new Set<string>()
if (typeof setInterval !== 'undefined') {
  setInterval(() => { processedEvents.clear() }, 10 * 60_000)
}

const PLAN_LIMITS: Record<string, { calls: number; rate: number }> = {
  starter:  { calls: 50,  rate: 0.90 },
  pro:      { calls: 200, rate: 0.70 },
  business: { calls: 600, rate: 0.50 },
  enterprise:{ calls: 600, rate: 0.50 },
}

// Mapa priceId -> plan (usa env vars con fallback a IDs hardcoded)
function buildPriceToPlan(): Record<string, string> {
  const map: Record<string, string> = {}
  const starter  = process.env.STRIPE_PRICE_STARTER  || 'price_1TBtxK0yU3RZWdR1MP4Z1lwj'
  const pro      = process.env.STRIPE_PRICE_PRO      || 'price_1TBtxM0yU3RZWdR1DGs87LNC'
  const business = process.env.STRIPE_PRICE_BUSINESS || 'price_1TBtxN0yU3RZWdR1dAiCDE3n'
  map[starter]  = 'starter'
  map[pro]      = 'pro'
  map[business] = 'business'
  return map
}
const PRICE_TO_PLAN = buildPriceToPlan()

function getPlanFromEvent(obj: any): string | null {
  // Intentar desde metadata (fuente mas fiable)
  const meta = obj?.metadata || {}
  if (meta.plan && PLAN_LIMITS[meta.plan]) return meta.plan
  // Intentar desde items de la suscripcion
  const items = obj?.items?.data || []
  for (const item of items) {
    const priceId = item?.price?.id
    if (priceId && PRICE_TO_PLAN[priceId]) return PRICE_TO_PLAN[priceId]
  }
  return null
}

export async function POST(req: Request) {
  const rl = rateLimitByIp(req, RATE_LIMITS.webhook, 'stripe:webhook')
  if (rl.blocked) return rl.response

  const stripe = getStripe()
  const admin  = getAdmin()
  const body = await req.text()
  const sig  = req.headers.get('stripe-signature')!

  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret)
  } catch (e: any) {
    logger.security('Stripe webhook: invalid signature', { error: e.message })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Idempotency check: skip already-processed events
  if (processedEvents.has(event.id)) {
    return NextResponse.json({ received: true, duplicate: true })
  }
  processedEvents.add(event.id)

  try {
    switch (event.type) {

      // ── PAGO INICIAL ────────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const tenantId = session.metadata?.tenant_id
        const plan     = session.metadata?.plan
        if (!tenantId || !plan || !PLAN_LIMITS[plan]) break

        const limits = PLAN_LIMITS[plan]
        await admin.from('tenants').update({
          plan,
          subscription_status: 'active',
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
          plan_calls_included: limits.calls,
          plan_calls_used: 0,
          extra_calls: 0,
          plan_extra_rate: limits.rate,
          billing_cycle_start: new Date().toISOString(),
          billing_cycle_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        }).eq('id', tenantId)
        // checkout.session.completed handled
        break
      }

      // ── SUSCRIPCION CREADA ───────────────────────
      case 'customer.subscription.created': {
        const sub = event.data.object as Stripe.Subscription
        const tenantId = sub.metadata?.tenant_id
        const plan = getPlanFromEvent(sub)
        if (!tenantId || !plan) break
        const limits = PLAN_LIMITS[plan]
        await admin.from('tenants').update({
          plan, subscription_status: sub.status,
          stripe_subscription_id: sub.id,
          plan_calls_included: limits.calls,
          plan_extra_rate: limits.rate,
          billing_cycle_start: new Date(sub.current_period_start * 1000).toISOString(),
          billing_cycle_end: new Date(sub.current_period_end * 1000).toISOString(),
        }).eq('id', tenantId)
        break
      }

      // ── SUSCRIPCION ACTUALIZADA ──────────────────
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const tenantId = sub.metadata?.tenant_id
        const plan = getPlanFromEvent(sub)
        if (!tenantId) break

        const updates: any = { subscription_status: sub.status }
        if (plan && PLAN_LIMITS[plan]) {
          const limits = PLAN_LIMITS[plan]
          // Upgrade inmediato, downgrade en siguiente ciclo ya lo maneja Stripe
          updates.plan = plan
          updates.plan_calls_included = limits.calls
          updates.plan_extra_rate = limits.rate
          // Recalcular extra con nuevo limite
          const { data: t } = await admin.from('tenants').select('plan_calls_used').eq('id', tenantId).single()
          if (t) updates.extra_calls = Math.max(0, (t.plan_calls_used||0) - limits.calls)
        }
        updates.billing_cycle_start = new Date(sub.current_period_start * 1000).toISOString()
        updates.billing_cycle_end   = new Date(sub.current_period_end * 1000).toISOString()
        await admin.from('tenants').update(updates).eq('id', tenantId)
        break
      }

      // ── CANCELACION ─────────────────────────────
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const tenantId = sub.metadata?.tenant_id
        if (!tenantId) break
        await admin.from('tenants').update({
          plan: 'trial', subscription_status: 'cancelled',
          stripe_subscription_id: null,
          plan_calls_used: 0, extra_calls: 0,
          free_calls_used: 0, free_calls_limit: 10,
        }).eq('id', tenantId)
        // subscription.deleted handled
        break
      }

      // ── FACTURA PAGADA (reset mensual) ───────────
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        const sub = invoice.subscription
          ? await stripe.subscriptions.retrieve(invoice.subscription as string)
          : null
        const tenantId = sub?.metadata?.tenant_id || (invoice as any).metadata?.tenant_id
        if (!tenantId) break
        // Solo resetear en renovaciones (no en la primera factura)
        if (invoice.billing_reason === 'subscription_cycle') {
          await admin.rpc('reset_billing_cycle', { p_tenant_id: tenantId })
          // invoice.paid - cycle reset handled
        }
        await admin.from('billing_history').update({ stripe_invoice_id: invoice.id, status: 'paid' })
          .eq('tenant_id', tenantId).is('stripe_invoice_id', null).order('created_at', { ascending: false }).limit(1)
        break
      }

      // ── PAGO FALLIDO ─────────────────────────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const sub = invoice.subscription
          ? await stripe.subscriptions.retrieve(invoice.subscription as string)
          : null
        const tenantId = sub?.metadata?.tenant_id
        if (!tenantId) break
        await admin.from('tenants').update({ subscription_status: 'past_due' }).eq('id', tenantId)
        // invoice.payment_failed handled
        break
      }
    }
  } catch (e: any) {
    logger.error('Stripe webhook handler error', { eventType: event.type }, e)
    // No retornar 500 a Stripe para evitar reintentos infinitos en errores no críticos
    return NextResponse.json({ received: true, warning: 'processing error' })
  }

  return NextResponse.json({ received: true })
}