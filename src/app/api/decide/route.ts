/**
 * /api/decide — Decision Gateway API
 * Used by the dashboard for manual actions that need intelligence.
 * Example: owner wants to confirm a pending reservation → runs through gateway.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { decide } from '@/lib/decision-gateway'

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const result = await decide({
    tenant_id: auth.tenantId,
    channel: 'dashboard',
    customer_phone: body.customer_phone,
    customer_name: body.customer_name,
    raw_text: body.notes,
    detected_intent: body.intent,
    date: body.date,
    time: body.time,
    party_size: body.party_size,
    zone: body.zone,
    force_action: body.force_action,
  })

  return NextResponse.json({ decision: result })
}
