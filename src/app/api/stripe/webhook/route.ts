import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
const LIMITS: Record<string, { calls: number; rate: number }> = { starter: { calls: 50, rate: 0.90 }, pro: { calls: 200, rate: 0.70 }, business: { calls: 600, rate: 0.50 } }

export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')
  if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ received: true })

  let event: any
  try {
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' })
    event = stripe.webhooks.constructEvent(body, sig!, process.env.STRIPE_WEBHOOK_SECRET || '')
  } catch(e: any) { return NextResponse.json({ error: e.message }, { status: 400 }) }

  const data = event.data.object as any
  const tenantId = data.metadata?.tenant_id

  if (event.type === 'checkout.session.completed' && tenantId) {
    const plan = data.metadata?.plan
    const limits = LIMITS[plan] || LIMITS.starter
    await admin.from('tenants').update({ plan, stripe_customer_id: data.customer, stripe_subscription_id: data.subscription, plan_calls_included: limits.calls, plan_extra_rate: limits.rate, plan_calls_used: 0, plan_period_start: new Date().toISOString() }).eq('id', tenantId)
  }
  if (event.type === 'customer.subscription.deleted') {
    const { data: t } = await admin.from('tenants').select('id').eq('stripe_subscription_id', data.id).maybeSingle()
    if (t) await admin.from('tenants').update({ plan: 'free' }).eq('id', t.id)
  }
  if (event.type === 'invoice.payment_succeeded') {
    const { data: t } = await admin.from('tenants').select('id, plan').eq('stripe_customer_id', data.customer).maybeSingle()
    if (t?.plan) {
      const limits = LIMITS[t.plan] || LIMITS.starter
      await admin.from('tenants').update({ plan_calls_used: 0, plan_period_start: new Date().toISOString(), plan_calls_included: limits.calls }).eq('id', t.id)
    }
  }
  return NextResponse.json({ received: true })
}