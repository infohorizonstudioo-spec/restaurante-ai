import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/billing/usage?tenant_id=XXX
//
// Devuelve snapshot completo del consumo desde el backend.
// No hay lógica de billing en el frontend — siempre desde aquí.
// Usa get_plan_usage RPC para datos atómicamente consistentes.
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const tenantId = searchParams.get('tenant_id')
    if (!tenantId) return NextResponse.json({ error: 'tenant_id required' }, { status: 400 })

    const { data, error } = await admin.rpc('get_plan_usage', { p_tenant_id: tenantId })
    if (error) throw error
    if (!data) return NextResponse.json({ error: 'tenant not found' }, { status: 404 })

    // Calcular alertas de consumo para el frontend
    const usage = data as any
    const alerts: string[] = []
    if (usage.is_trial && usage.remaining_calls <= 3)
      alerts.push('trial_almost_exhausted')
    if (!usage.is_trial && usage.extra_calls > 0)
      alerts.push('extra_calls_active')
    if (!usage.is_trial && usage.used_pct >= 90)
      alerts.push('usage_near_limit')
    if (usage.days_remaining !== null && usage.days_remaining <= 5)
      alerts.push('cycle_ending_soon')

    return NextResponse.json({ ...usage, alerts })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET sin parámetros = health check
export async function HEAD() {
  return new Response(null, { status: 200 })
}
