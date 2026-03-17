import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const PRICE_IDS: Record<string, string> = {
  starter: process.env.STRIPE_PRICE_STARTER || '',
  pro: process.env.STRIPE_PRICE_PRO || '',
  business: process.env.STRIPE_PRICE_BUSINESS || '',
}

export async function POST(req: Request) {
  try {
    const { plan, tenant_id } = await req.json()
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    
    // Verify user
    const { data: { user } } = await admin.auth.getUser(token)
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const priceId = PRICE_IDS[plan]
    if (!priceId) return NextResponse.json({ error: 'Plan no válido' }, { status: 400 })

    // Get tenant
    const { data: tenant } = await admin.from('tenants').select('*').eq('id', tenant_id).single()
    if (!tenant) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })

    const stripe = await getStripe()
    if (!stripe) {
      // Stripe not configured - redirect to success anyway (dev mode)
      return NextResponse.json({ url: `/precios/success?plan=${plan}` })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://restaurante-ai.vercel.app'

    // Create or get Stripe customer
    let customerId = tenant.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: tenant.name,
        metadata: { tenant_id, user_id: user.id }
      })
      customerId = customer.id
      await admin.from('tenants').update({ stripe_customer_id: customerId }).eq('id', tenant_id)
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/precios/success?session_id={CHECKOUT_SESSION_ID}&plan=${plan}`,
      cancel_url: `${baseUrl}/precios`,
      metadata: { tenant_id, plan },
      subscription_data: { metadata: { tenant_id, plan } },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      locale: 'es',
    })

    return NextResponse.json({ url: session.url })
  } catch(e: any) {
    console.error('Stripe checkout error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

async function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null
  const Stripe = (await import('stripe')).default
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' })
}