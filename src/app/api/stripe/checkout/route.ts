import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-01-27.acacia' })
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Map price_id → plan name (fuente de verdad)
const PRICE_TO_PLAN: Record<string, string> = {
  'price_1TBtxK0yU3RZWdR1MP4Z1lwj': 'starter',
  'price_1TBtxM0yU3RZWdR1DGs87LNC': 'pro',
  'price_1TBtxN0yU3RZWdR1dAiCDE3n': 'business',
}

export async function POST(req: Request) {
  try {
    const { priceId, tenantId } = await req.json()

    if (!priceId || !tenantId) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    const plan = PRICE_TO_PLAN[priceId]
    if (!plan) {
      return NextResponse.json({ error: 'Plan no válido' }, { status: 400 })
    }

    const { data: tenant, error: tErr } = await admin
      .from('tenants').select('*').eq('id', tenantId).single()
    if (tErr || !tenant) {
      return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://restaurante-ai.vercel.app'

    // Crear o recuperar cliente de Stripe
    let customerId = tenant.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: tenant.email || undefined,
        name: tenant.name,
        metadata: { tenant_id: tenantId, plan },
      })
      customerId = customer.id
      await admin.from('tenants').update({ stripe_customer_id: customerId }).eq('id', tenantId)
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/precios/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/precios`,
      metadata: {
        tenant_id: tenantId,
        plan,          // ← CRÍTICO: pasar nombre del plan para el webhook
        price_id: priceId,
      },
      subscription_data: {
        metadata: {
          tenant_id: tenantId,
          plan,
        },
      },
      locale: 'es',
    })

    return NextResponse.json({ url: session.url })
  } catch (e: any) {
    console.error('Stripe checkout error:', e)
    return NextResponse.json({ error: e.message || 'Error al procesar' }, { status: 500 })
  }
}