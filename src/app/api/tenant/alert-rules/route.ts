/**
 * GET/PUT /api/tenant/alert-rules
 * Read and update alert rules for a tenant.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAlertRules, type AlertEventType } from '@/lib/alert-rules'
import { requireAuth } from '@/lib/api-auth'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { sanitizeString } from '@/lib/sanitize'
import { logger } from '@/lib/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const rl = rateLimitByIp(req, RATE_LIMITS.api, 'tenant:alert-rules')
  if (rl.blocked) return rl.response

  const auth = await requireAuth(req)
  if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const rules = await getAlertRules(auth.tenantId)
  return NextResponse.json({ rules })
}

export async function PUT(req: NextRequest) {
  try {
    const rl = rateLimitByIp(req, RATE_LIMITS.api, 'tenant:alert-rules')
    if (rl.blocked) return rl.response

    const auth = await requireAuth(req)
    if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const tenant_id = auth.tenantId
    const { rules } = await req.json()
    if (!rules || !Array.isArray(rules)) {
      return NextResponse.json({ error: 'Missing rules' }, { status: 400 })
    }

    const VALID_EVENT_TYPES = ['new_booking', 'cancellation', 'urgency', 'no_show', 'call_attention', 'call_completed', 'call_missed', 'pending_review']
    const VALID_PRIORITIES = ['info', 'warning', 'critical']

    for (const rule of rules) {
      const eventType = sanitizeString(rule.event_type, 50)
      if (!VALID_EVENT_TYPES.includes(eventType)) continue
      const priority = VALID_PRIORITIES.includes(rule.priority) ? rule.priority : 'info'

      await supabase.from('alert_rules').upsert({
        tenant_id,
        event_type: eventType as AlertEventType,
        enabled: !!rule.enabled,
        priority,
        channels: rule.channels,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id,event_type' })
    }

    const updated = await getAlertRules(tenant_id)
    logger.info('Alert rules updated', { tenantId: tenant_id })
    return NextResponse.json({ rules: updated })
  } catch (err: any) {
    logger.error('Alert rules: update failed', {}, err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
