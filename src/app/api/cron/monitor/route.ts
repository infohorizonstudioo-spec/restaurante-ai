import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { createNotification } from '@/lib/notifications'
import { sendPush } from '@/lib/notifications'
import { timingSafeEqual } from 'crypto'
import type { HealthStatus } from '@/app/api/health/route'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/monitor
 * Hourly health check — alerts tenants when services are degraded or down.
 */
export async function GET(req: Request) {
  const rl = rateLimitByIp(req, RATE_LIMITS.cron, 'cron:monitor')
  if (rl.blocked) return rl.response

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: 'not configured' }, { status: 503 })

  const authHeader = req.headers.get('authorization') || ''
  const expectedHeader = `Bearer ${cronSecret}`
  const a = Buffer.from(authHeader)
  const b = Buffer.from(expectedHeader)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    // Call the health endpoint
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

    const healthRes = await fetch(`${baseUrl}/api/health`, {
      signal: AbortSignal.timeout(10_000),
    })
    const health: HealthStatus = await healthRes.json()

    if (health.status === 'ok') {
      logger.info('Monitor cron: all services healthy')
      return NextResponse.json({ status: 'ok', health })
    }

    // Build a human-readable list of down services
    const downServices = Object.entries(health.services)
      .filter(([, up]) => !up)
      .map(([name]) => name)

    const title = health.status === 'down'
      ? 'Servicio interrumpido'
      : 'Servicio degradado'
    const body = `Servicios afectados: ${downServices.join(', ')}`

    // Notify all non-trial tenants
    const { data: tenants } = await admin
      .from('tenants')
      .select('id, plan')
      .neq('plan', 'trial')

    if (tenants && tenants.length > 0) {
      const notifPromises = tenants.map((t) =>
        createNotification({
          tenant_id: t.id,
          type: 'important_alert',
          title,
          body,
          priority: health.status === 'down' ? 'critical' : 'warning',
          target_url: '/panel',
        })
      )
      await Promise.allSettled(notifPromises)

      // Push notification to first admin tenant
      await sendPush({
        tenant_id: tenants[0].id,
        title,
        body,
        url: '/panel',
        priority: health.status === 'down' ? 'critical' : 'warning',
        tag: 'service-monitor',
      }).catch(() => {})
    }

    logger.warn('Monitor cron: services degraded', { status: health.status, downServices })
    return NextResponse.json({ status: health.status, downServices, notified: tenants?.length ?? 0 })
  } catch (e) {
    logger.error('Monitor cron failed', {}, e)
    return NextResponse.json({ error: 'monitor failed' }, { status: 500 })
  }
}
