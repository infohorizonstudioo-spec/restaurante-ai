/**
 * GET/PUT /api/tenant/reminders
 * Read and update reminder configuration for a tenant.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getRemindersConfig } from '@/lib/reminder-engine'
import { requireAuth } from '@/lib/api-auth'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { sanitizeString } from '@/lib/sanitize'
import { logger } from '@/lib/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const rl = rateLimitByIp(req, RATE_LIMITS.api, 'tenant:reminders')
  if (rl.blocked) return rl.response

  const auth = await requireAuth(req)
  if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const config = await getRemindersConfig(auth.tenantId)
  return NextResponse.json({ config })
}

export async function PUT(req: NextRequest) {
  try {
    const rl = rateLimitByIp(req, RATE_LIMITS.api, 'tenant:reminders')
    if (rl.blocked) return rl.response

    const auth = await requireAuth(req)
    if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const tenant_id = auth.tenantId
    const { config } = await req.json()
    if (!config) {
      return NextResponse.json({ error: 'Missing config' }, { status: 400 })
    }

    // Validate intervals
    const VALID_INTERVALS = ['30m', '1h', '2h', '4h', '12h', '24h', '48h']
    const intervals = Array.isArray(config.intervals)
      ? config.intervals.filter((i: string) => VALID_INTERVALS.includes(i))
      : ['24h']

    // Validate channel
    const VALID_CHANNELS = ['sms', 'whatsapp', 'email', 'push']
    const channel = VALID_CHANNELS.includes(config.channel) ? config.channel : 'sms'

    const templateOverride = config.template_override ? sanitizeString(config.template_override, 500) : null

    await supabase.from('reminder_configs').upsert({
      tenant_id,
      intervals: intervals,
      channel,
      template_override: templateOverride,
      enabled: config.enabled !== false,
    }, { onConflict: 'tenant_id' })

    const updated = await getRemindersConfig(tenant_id)
    logger.info('Reminders config updated', { tenantId: tenant_id })
    return NextResponse.json({ config: updated })
  } catch (err: any) {
    logger.error('Reminders: update failed', {}, err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
