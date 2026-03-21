import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/api-auth'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 })
    if (!auth.tenantId) return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 403 })

    const { data, error } = await admin.rpc('get_plan_usage', { p_tenant_id: auth.tenantId })
    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 404 })

    const usage = data as any
    const alerts: string[] = []
    if (usage.is_trial && usage.remaining_calls <= 3) alerts.push('trial_almost_exhausted')
    if (!usage.is_trial && usage.extra_calls > 0) alerts.push('extra_calls_active')
    if (!usage.is_trial && usage.used_pct >= 90) alerts.push('usage_near_limit')
    if (usage.days_remaining !== null && usage.days_remaining <= 5) alerts.push('cycle_ending_soon')

    return NextResponse.json({ ...usage, alerts })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function HEAD() {
  return new Response(null, { status: 200 })
}
