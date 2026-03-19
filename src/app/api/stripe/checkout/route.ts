import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

// Lazy init — evita crash en build cuando no hay env vars
function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-02-24.acacia' })
}
function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
}

// Price IDs con limites embebidos en metadata
const PLANS: Record<string, { priceId: string; name: string; calls: number; rate: number; amount: number }> = {
  starter:  { priceId: 'price_1TBtxK0yU3RZWdR1MP4Z1lwj', name: 'Starter',  calls: 50,  rate: 0.90, amount: 9900 },
  pro:      { priceId: 'price_1TBtxM0yU3RZWdR1DGs87LNC', name: 'Pro',      calls: 200, rate: 0.70, amount: 29900 },
  business: { priceId: 'price_1TBtxN0yU3RZWdR1dAiCDE3n', name: 'Business', calls: 600, rate: 0.50, amount: 49900 },
}

export async function POST(req: Request) {
  const stripe = getStripe()
  const admin  = getAdmin()
  try {
    const { plan, tenant_id, user_id } = await req.json()

    // SEGURIDAD: validar plan contra whitelist
    if (!PLANS[plan]) return NextResponse.json({ error: 'Plan invalido' }, { status: 400 })
    if (!tenant_id)   return NextResponse.json({ error: 'Tenant requerido' }, { status: 400 })

    // Verificar tenant existe
    const { data: tenant } = await admin.from('tenants').select('id,name,stripe_customer_id,plan').eq('id', tenant_id).single()
    if (!tenant) return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 404 })

    const planData = PLANS[plan]

    // Crear o recuperar customer de Stripe
    let customerId = tenant.stripe_customer_id
    if (!customerId) {
      const { data: profile } = await admin.from('profiles').select('id').eq('tenant_id', tenant_id).limit(1).single()
      const { data: user } = profile ? await admin.auth.admin.getUserById(profile.id) : { data: null }
      const customer = await stripe.customers.create({
        email: user?.user?.email || '',
        name: tenant.name,
        metadata: { tenant_id, app: 'reservo_ai' }
      })
      customerId = customer.id
      await admin.from('tenants').update({ stripe_customer_id: customerId }).eq('id', tenant_id)
    }

    // Crear sesión de checkout
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: planData.priceId, quantity: 1 }],
      success_url: process.env.NEXT_PUBLIC_APP_URL + '/precios/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url:  process.env.NEXT_PUBLIC_APP_URL + '/precios',
      metadata: { tenant_id, plan, included_calls: String(planData.calls), extra_rate: String(planData.rate) },
      subscription_data: {
        metadata: { tenant_id, plan, included_calls: String(planData.calls), extra_rate: String(planData.rate) }
      },
      allow_promotion_codes: true,
    })

    return NextResponse.json({ url: session.url, session_id: session.id })
  } catch (e: any) {
    console.error('Checkout error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}