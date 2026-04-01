import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const rl = rateLimitByIp(req, RATE_LIMITS.api, 'customer-memory')
  if (rl.blocked) return rl.response

  const auth = await requireAuth(req)
  if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const customerId = req.nextUrl.searchParams.get('customer_id')
  if (!customerId) return NextResponse.json({ error: 'customer_id required' }, { status: 400 })

  const tenantId = auth.tenantId

  const [customerRes, memoriesRes, alertsRes, eventsRes] = await Promise.all([
    supabase.from('customers')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', customerId)
      .maybeSingle(),
    supabase.from('customer_memory')
      .select('memory_type,memory_key,memory_value,memory_data,confidence,weight,source,reinforced_count,created_at,updated_at')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .eq('active', true)
      .gte('confidence', 0.4)
      .order('weight', { ascending: false })
      .order('confidence', { ascending: false })
      .limit(30),
    supabase.from('customer_alerts')
      .select('alert_type,severity,title,body,created_at')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase.from('customer_events')
      .select('event_type,channel,summary,sentiment,created_at,agent_name,duration_seconds')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const customer = customerRes.data
  if (!customer) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // Compute scoring breakdown (same formula as updateCustomerScoring)
  const visits = customer.visit_count || 0
  const noShows = customer.no_show_count || 0
  const cancels = customer.cancel_count || 0
  const lateCount = customer.late_count || 0

  const frequency = visits === 0 ? 0 : visits <= 2 ? 10 : visits <= 5 ? 20 : 30
  const total = visits + noShows + cancels || 1
  const badRate = (noShows * 2 + cancels + lateCount * 0.3) / total
  const reliability = badRate === 0 ? 30 : badRate < 0.15 ? 20 : badRate < 0.3 ? 10 : 0
  const lastVisit = customer.last_visit ? new Date(customer.last_visit).getTime() : 0
  const daysSince = lastVisit ? (Date.now() - lastVisit) / (24 * 60 * 60 * 1000) : 999
  const recency = daysSince <= 7 ? 20 : daysSince <= 30 ? 15 : daysSince <= 90 ? 10 : 0
  const interactions = customer.lifetime_interactions || 0
  const engagement = interactions >= 10 ? 10 : interactions >= 3 ? 5 : 0

  return NextResponse.json({
    customer,
    memories: memoriesRes.data || [],
    alerts: alertsRes.data || [],
    events: eventsRes.data || [],
    scoring: {
      loyalty_score: customer.loyalty_score || 0,
      loyalty_tier: customer.loyalty_tier || 'normal',
      risk_level: customer.risk_level || 'none',
      frequency,
      reliability,
      recency,
      engagement,
    },
  })
}
