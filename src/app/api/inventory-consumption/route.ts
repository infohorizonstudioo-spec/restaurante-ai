import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { getConsumptionData } from '@/lib/inventory-intelligence'

export const dynamic = 'force-dynamic'

/**
 * GET /api/inventory-consumption
 * Returns consumption data for all inventory items:
 * - avgWeekly: average units consumed per week (from 8 weeks of order_events)
 * - daysUntilEmpty: estimated days before stock runs out
 * - currentStock, minStock, maxStock
 */
export async function GET(req: NextRequest) {
  const rl = rateLimitByIp(req, RATE_LIMITS.api, 'inventory-consumption')
  if (rl.blocked) return rl.response

  const auth = await requireAuth(req)
  if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  try {
    const consumption = await getConsumptionData(auth.tenantId)

    // Sort: items running out soonest first
    const sorted = consumption.sort((a, b) => {
      const aDays = a.daysUntilEmpty ?? 999
      const bDays = b.daysUntilEmpty ?? 999
      return aDays - bDays
    })

    return NextResponse.json({ ok: true, consumption: sorted })
  } catch (e: any) {
    return NextResponse.json({ error: 'Error al cargar consumo' }, { status: 500 })
  }
}
