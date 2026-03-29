import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimitByIp } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'down'
  services: {
    supabase: boolean
    retell: boolean
    twilio: boolean
    stripe: boolean
  }
  timestamp: string
}

/**
 * GET /api/health
 * Public health check — no auth required.
 * Returns service availability for monitoring and the dashboard status widget.
 */
export async function GET(req: Request) {
  const rl = rateLimitByIp(req, { limit: 60, windowSeconds: 60 }, 'health')
  if (rl.blocked) return rl.response

  const start = Date.now()
  const services = {
    supabase: false,
    retell: false,
    twilio: false,
    stripe: false,
  }

  // 1. Supabase — attempt a lightweight query
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (url && key) {
      const admin = createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const { error } = await admin.from('tenants').select('id').limit(1)
      services.supabase = !error
    }
  } catch {
    services.supabase = false
  }

  // 2. Retell — check API key exists
  services.retell = !!process.env.RETELL_API_KEY

  // 3. Twilio — check credentials exist
  services.twilio = !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN
  )

  // 4. Stripe — check key exists
  services.stripe = !!process.env.STRIPE_SECRET_KEY

  // Determine overall status
  const allUp = Object.values(services).every(Boolean)
  const criticalDown = !services.supabase
  const status: HealthStatus['status'] = criticalDown
    ? 'down'
    : allUp
      ? 'ok'
      : 'degraded'

  const result: HealthStatus = {
    status,
    services,
    timestamp: new Date().toISOString(),
  }

  const durationMs = Date.now() - start
  if (status !== 'ok') {
    logger.warn('Health check degraded/down', { status, services, durationMs })
  }

  return NextResponse.json(result, {
    status: status === 'down' ? 503 : 200,
    headers: { 'Cache-Control': 'no-cache, no-store, max-age=0' },
  })
}
