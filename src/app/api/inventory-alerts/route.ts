/**
 * RESERVO.AI — Inventory Alerts API
 *
 * GET /api/inventory-alerts
 * Returns smart inventory alerts (low stock, seasonal, peak days).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { generateInventoryAlerts } from '@/lib/inventory-intelligence'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.ok || !auth.tenantId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const tenantId = auth.tenantId

  // If tenant_id is provided as query param, verify it matches authenticated user
  const queryTenantId = req.nextUrl.searchParams.get('tenant_id')
  if (queryTenantId && queryTenantId !== tenantId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  try {
    const alerts = await generateInventoryAlerts(tenantId)
    return NextResponse.json({ ok: true, alerts })
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to generate inventory alerts' }, { status: 500 })
  }
}
