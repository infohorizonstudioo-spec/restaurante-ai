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

export async function POST(req: Request) {
  const rl = rateLimitByIp(req, RATE_LIMITS.api, 'stripe:portal')
  if (rl.blocked) return rl.response

  // Verificar autenticacion
  const auth = await requireAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 })
  if (!auth.tenantId) return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 403 })

  const stripe = getStripe()
  const admin  = getAdmin()

  try {
    // Obtener stripe_customer_id del tenant
    const { data: tenant } = await admin.from('tenants')
      .select('stripe_customer_id')
      .eq('id', auth.tenantId)
      .single()

    if (!tenant?.stripe_customer_id) {
      return NextResponse.json({ error: 'No tienes una suscripcion activa' }, { status: 400 })
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: tenant.stripe_customer_id,
      return_url: process.env.NEXT_PUBLIC_APP_URL + '/panel',
    })

    logger.info('Stripe: portal session created', { tenantId: auth.tenantId })
    return NextResponse.json({ url: portalSession.url })
  } catch (e: unknown) {
    logger.error('Stripe portal: error', {}, e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
