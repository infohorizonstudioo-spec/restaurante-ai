/**
 * /api/decide — Decision Gateway API
 * Used by the dashboard for manual actions that need intelligence.
 * Example: owner wants to confirm a pending reservation → runs through gateway.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { decide } from '@/lib/decision-gateway'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { sanitizeName, sanitizePhone, sanitizeString, sanitizeDate, sanitizeTime, sanitizePositiveInt } from '@/lib/sanitize'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  const rl = rateLimitByIp(req, RATE_LIMITS.api, 'decide')
  if (rl.blocked) return rl.response

  const auth = await requireAuth(req)
  if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const result = await decide({
    tenant_id: auth.tenantId,
    channel: 'dashboard',
    customer_phone: sanitizePhone(body.customer_phone),
    customer_name: sanitizeName(body.customer_name),
    raw_text: sanitizeString(body.notes, 1000),
    detected_intent: sanitizeString(body.intent, 50) as any,
    date: sanitizeDate(body.date),
    time: sanitizeTime(body.time),
    party_size: sanitizePositiveInt(body.party_size, 100),
    zone: sanitizeString(body.zone, 100),
    force_action: body.force_action,
  })

  logger.info('Decide: decision made', { tenantId: auth.tenantId, intent: body.intent })
  return NextResponse.json({ decision: result })
}
