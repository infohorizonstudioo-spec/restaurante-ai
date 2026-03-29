/**
 * GET /api/tpv/sales-history
 * Returns sales patterns for TPV intelligence — what sells at what hour.
 * Used by tpv-engine.ts getTPVLayout() to prioritize categories by time.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/api-auth'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const rl = rateLimitByIp(req, RATE_LIMITS.api, 'tpv:sales-history')
  if (rl.blocked) return rl.response

  const auth = await requireAuth(req)
  if (!auth.ok || !auth.tenantId) return NextResponse.json({ history: [] })

  // Get last 30 days of confirmed orders
  const since = new Date(Date.now() - 30 * 86400000).toISOString()

  const { data: orders } = await admin.from('order_events')
    .select('items, created_at')
    .eq('tenant_id', auth.tenantId)
    .in('status', ['confirmed', 'preparing', 'ready', 'delivered'])
    .gte('created_at', since)

  if (!orders || orders.length === 0) return NextResponse.json({ history: [] })

  // Aggregate: for each item, count how many sold per hour bucket
  const history: { item_name: string; quantity: number; hour: number; day_of_week: number }[] = []

  for (const order of orders) {
    const date = new Date(order.created_at)
    const hour = date.getHours()
    const dow = date.getDay()
    const items = Array.isArray(order.items) ? order.items : []

    for (const item of items) {
      if (item.name) {
        history.push({
          item_name: item.name,
          quantity: item.quantity || 1,
          hour,
          day_of_week: dow,
        })
      }
    }
  }

  return NextResponse.json({ history }, { headers: { 'Cache-Control': 'max-age=300' } })
}
