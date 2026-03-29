import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const rl = rateLimitByIp(req, RATE_LIMITS.api, 'tpv:intelligence')
  if (rl.blocked) return rl.response

  const auth = await requireAuth(req)
  if (!auth.ok || !auth.tenantId) return NextResponse.json({ intelligence: null })

  // Import dynamically to avoid issues
  const { analyzeTrending, detectCombos, predictDayEnd, generateServiceAlerts } = await import('@/lib/tpv-intelligence')

  // Get current day stats for prediction
  const { createClient } = await import('@supabase/supabase-js')
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const today = new Date().toISOString().slice(0, 10)
  const { data: todayOrders } = await admin.from('order_events')
    .select('total_estimate')
    .eq('tenant_id', auth.tenantId)
    .gte('created_at', today + 'T00:00:00')
    .in('status', ['confirmed', 'preparing', 'ready', 'delivered'])

  const currentRevenue = (todayOrders || []).reduce((s, o) => s + (o.total_estimate || 0), 0)
  const currentOrders = (todayOrders || []).length

  const [trending, combos, prediction, alerts] = await Promise.all([
    analyzeTrending(auth.tenantId),
    detectCombos(auth.tenantId),
    predictDayEnd(auth.tenantId, currentRevenue, currentOrders),
    generateServiceAlerts(auth.tenantId),
  ])

  return NextResponse.json({
    intelligence: { trending, combos, prediction, alerts }
  })
}
