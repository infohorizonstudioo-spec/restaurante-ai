/**
 * RESERVO.AI — Inventory Alerts API
 *
 * GET /api/inventory-alerts?tenant_id=X
 * Returns smart inventory alerts (low stock, seasonal, peak days).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateInventoryAlerts } from '@/lib/inventory-intelligence'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenant_id')
  if (!tenantId) {
    return NextResponse.json({ error: 'tenant_id required' }, { status: 400 })
  }

  // Auth: verify Supabase JWT belongs to this tenant
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.tenant_id !== tenantId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const alerts = await generateInventoryAlerts(tenantId)
    return NextResponse.json({ ok: true, alerts })
  } catch (e: any) {
    console.error('GET /api/inventory-alerts failed:', e?.message)
    return NextResponse.json({ error: 'Failed to generate inventory alerts' }, { status: 500 })
  }
}
