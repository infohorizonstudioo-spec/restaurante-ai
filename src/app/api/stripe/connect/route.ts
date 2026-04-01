import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/api-auth'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-02-24.acacia' })
}
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export const dynamic = 'force-dynamic'

/**
 * POST /api/stripe/connect
 * Creates a Stripe Connect Express account for the restaurant and returns
 * an onboarding link. The restaurant completes KYC/bank details on Stripe's
 * hosted onboarding page, then returns to the dashboard.
 */
export async function POST(req: NextRequest) {
  const rl = rateLimitByIp(req, RATE_LIMITS.api, 'stripe:connect')
  if (rl.blocked) return rl.response

  const auth = await requireAuth(req)
  if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  const stripe = getStripe()
  const tenantId = auth.tenantId

  // Get tenant info
  const { data: tenant } = await admin.from('tenants')
    .select('id, name, stripe_connect_id, stripe_connect_enabled')
    .eq('id', tenantId).maybeSingle()

  if (!tenant) return NextResponse.json({ error: 'tenant not found' }, { status: 404 })

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.reservo.ai'

  try {
    let accountId = tenant.stripe_connect_id

    // If no Connect account exists, create one
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'ES',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'company',
        metadata: { tenant_id: tenantId, app: 'reservo_ai' },
      })
      accountId = account.id

      // Save to tenant
      await admin.from('tenants')
        .update({ stripe_connect_id: accountId })
        .eq('id', tenantId)

      logger.info('Stripe Connect: account created', { tenantId, accountId })
    }

    // Create onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/configuracion?stripe=retry`,
      return_url: `${baseUrl}/api/stripe/connect?callback=true&tenant_id=${tenantId}`,
      type: 'account_onboarding',
    })

    return NextResponse.json({ url: accountLink.url, account_id: accountId })
  } catch (e: any) {
    logger.error('Stripe Connect: onboarding error', {}, e)
    return NextResponse.json({ error: 'Error al configurar pagos' }, { status: 500 })
  }
}

/**
 * GET /api/stripe/connect?callback=true&tenant_id=...
 * Callback after restaurant completes Stripe onboarding.
 * Checks if the account is ready to accept payments and updates tenant.
 */
export async function GET(req: NextRequest) {
  const isCallback = req.nextUrl.searchParams.get('callback')
  const tenantId = req.nextUrl.searchParams.get('tenant_id')

  if (!isCallback || !tenantId) {
    return NextResponse.redirect(new URL('/configuracion', req.url))
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.redirect(new URL('/configuracion?stripe=error', req.url))
  }

  const stripe = getStripe()

  try {
    const { data: tenant } = await admin.from('tenants')
      .select('stripe_connect_id')
      .eq('id', tenantId).maybeSingle()

    if (!tenant?.stripe_connect_id) {
      return NextResponse.redirect(new URL('/configuracion?stripe=error', req.url))
    }

    // Check if onboarding is complete
    const account = await stripe.accounts.retrieve(tenant.stripe_connect_id)
    const isReady = account.charges_enabled && account.payouts_enabled

    await admin.from('tenants')
      .update({ stripe_connect_enabled: isReady })
      .eq('id', tenantId)

    logger.info('Stripe Connect: callback', { tenantId, ready: isReady })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.reservo.ai'
    return NextResponse.redirect(`${baseUrl}/configuracion?stripe=${isReady ? 'success' : 'pending'}`)
  } catch (e: any) {
    logger.error('Stripe Connect: callback error', {}, e)
    return NextResponse.redirect(new URL('/configuracion?stripe=error', req.url))
  }
}
