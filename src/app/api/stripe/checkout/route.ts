import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/api-auth'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-02-24.acacia' })
}
function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const PLANS: Record<string, { priceId: string; name: string; calls: number; rate: number; amount: number }> = {
  starter:  { priceId: process.env.STRIPE_PRICE_STARTER  || 'price_1TBtxK0yU3RZWdR1MP4Z1lwj', name: 'Starter',  calls: 50,  rate: 0.90, amount: 9900 },
  pro:      { priceId: process.env.STRIPE_PRICE_PRO      || 'price_1TBtxM0yU3RZWdR1DGs87LNC', name: 'Pro',      calls: 200, rate: 0.70, amount: 29900 },
  business: { priceId: process.env.STRIPE_PRICE_BUSINESS || 'price_1TBtxN0yU3RZWdR1dAiCDE3n', name: 'Business', calls: 600, rate: 0.50, amount: 49900 },
}

export async function POST(req: Request) {
  const rl = rateLimitByIp(req, RATE_LIMITS.api, 'stripe:checkout')
  if (rl.blocked) return rl.response

  // Verificar autenticación
  const auth = await requireAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 })
  if (!auth.tenantId) return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 403 })

  const stripe = getStripe()
  const admin  = getAdmin()
  try {
    const { plan } = await req.json()

    if (!PLANS[plan]) return NextResponse.json({ error: 'Plan invalido' }, { status: 400 })

    // Usar tenantId del token — no del body (evita que alguien pague por otro tenant)
    const { data: tenant } = await admin.from('tenants')
      .select('id,name,stripe_customer_id,plan')
      .eq('id', auth.tenantId)
      .single()
    if (!tenant) return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 404 })

    const planData = PLANS[plan]
    let customerId = tenant.stripe_customer_id
    if (!customerId) {
      const { data: profile } = await admin.from('profiles').select('id').eq('tenant_id', auth.tenantId).limit(1).single()
      const { data: user } = profile ? await admin.auth.admin.getUserById(profile.id) : { data: null }
      const customer = await stripe.customers.create({
        email: user?.user?.email || '',
        name: tenant.name,
        metadata: { tenant_id: auth.tenantId, app: 'reservo_ai' }
      })
      customerId = customer.id
      await admin.from('tenants').update({ stripe_customer_id: customerId }).eq('id', auth.tenantId)
    }

    // IVA 21% tax rate (not included in price)
    const taxRateId = process.env.STRIPE_TAX_RATE_ID || 'txr_1TGHDL1xqUog1tyMuqypu6j2'

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: planData.priceId, quantity: 1, tax_rates: [taxRateId] }],
      success_url: process.env.NEXT_PUBLIC_APP_URL + '/panel?checkout=success&session_id={CHECKOUT_SESSION_ID}',
      cancel_url:  process.env.NEXT_PUBLIC_APP_URL + '/precios',
      metadata: { tenant_id: auth.tenantId, plan, included_calls: String(planData.calls), extra_rate: String(planData.rate) },
      subscription_data: { metadata: { tenant_id: auth.tenantId, plan, included_calls: String(planData.calls), extra_rate: String(planData.rate) } },
      allow_promotion_codes: true,
    })

    logger.info('Stripe: checkout session created', { tenantId: auth.tenantId, plan })
    return NextResponse.json({ url: session.url, session_id: session.id })
  } catch (e: any) {
    logger.error('Stripe checkout: error', {}, e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
