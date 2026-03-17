import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-01-27.acacia' })
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Límites por plan — fuente de verdad única
const LIMITS: Record<string, { calls: number; rate: number }> = {
  starter:  { calls: 50,  rate: 0.90 },
  pro:      { calls: 200, rate: 0.70 },
  business: { calls: 600, rate: 0.50 },
}

// Fallback: price_id → plan si metadata no lo trae
const PRICE_TO_PLAN: Record<string, string> = {
  'price_1TBtxK0yU3RZWdR1MP4Z1lwj': 'starter',
  'price_1TBtxM0yU3RZWdR1DGs87LNC': 'pro',
  'price_1TBtxN0yU3RZWdR1dAiCDE3n': 'business',
}

export async function POST(req: Request) {
  const body = await req.text()
  const sig  = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    console.error('Webhook signature failed:', err.message)
    return NextResponse.json({ error: err.message }, { status: 400 })
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const tenant_id = session.metadata?.tenant_id
      if (!tenant_id) { console.error('No tenant_id in session metadata'); return NextResponse.json({ ok: true }) }

      // Obtener plan — primero de metadata, fallback desde line_items
      let plan = session.metadata?.plan
      if (!plan && session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription as string)
        const priceId = sub.items.data[0]?.price?.id
        plan = priceId ? PRICE_TO_PLAN[priceId] : undefined
        // También guardar en metadata de la suscripción para futuro
        if (plan) {
          await stripe.subscriptions.update(session.subscription as string, {
            metadata: { tenant_id, plan }
          }).catch(()=>{})
        }
      }
      if (!plan) plan = 'starter' // Default seguro

      const limits = LIMITS[plan] || LIMITS.starter
      const now = new Date().toISOString().split('T')[0]

      await admin.from('tenants').update({
        plan,
        stripe_customer_id:     session.customer as string,
        stripe_subscription_id: session.subscription as string,
        plan_calls_included:    limits.calls,
        plan_extra_rate:        limits.rate,
        plan_calls_used:        0,
        plan_period_start:      now,
        onboarding_complete:    true,
      }).eq('id', tenant_id)

      console.log(`Plan ${plan} activado para tenant ${tenant_id}`)
    }

    if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object as Stripe.Subscription
      const tenant_id = sub.metadata?.tenant_id
      if (!tenant_id) return NextResponse.json({ ok: true })

      const priceId = sub.items.data[0]?.price?.id
      const plan    = priceId ? PRICE_TO_PLAN[priceId] : null
      if (!plan) return NextResponse.json({ ok: true })

      const limits = LIMITS[plan]
      await admin.from('tenants').update({
        plan,
        plan_calls_included: limits.calls,
        plan_extra_rate:     limits.rate,
        stripe_subscription_id: sub.id,
      }).eq('id', tenant_id)
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription
      const tenant_id = sub.metadata?.tenant_id
      if (!tenant_id) return NextResponse.json({ ok: true })

      // Revertir a trial cuando se cancela
      await admin.from('tenants').update({
        plan: 'free',
        stripe_subscription_id: null,
        plan_calls_included: 10,
        plan_calls_used: 0,
      }).eq('id', tenant_id)
    }

    // Renovación mensual — resetear contador de llamadas del plan
    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object as Stripe.Invoice
      if (!invoice.subscription) return NextResponse.json({ ok: true })
      const sub = await stripe.subscriptions.retrieve(invoice.subscription as string)
      const tenant_id = sub.metadata?.tenant_id
      if (!tenant_id) return NextResponse.json({ ok: true })

      const now = new Date().toISOString().split('T')[0]
      await admin.from('tenants').update({
        plan_calls_used:  0,
        plan_period_start: now,
      }).eq('id', tenant_id)
      console.log(`Llamadas reseteadas para tenant ${tenant_id} (renovación)`)
    }

  } catch (e: any) {
    console.error('Webhook handler error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}