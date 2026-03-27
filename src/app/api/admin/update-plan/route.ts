import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { sanitizeUUID } from '@/lib/sanitize'
import { logger } from '@/lib/logger'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const PLAN_LIMITS: Record<string, { calls: number; rate: number }> = {
  trial:      { calls: 10,  rate: 0 },
  free:       { calls: 10,  rate: 0 },
  starter:    { calls: 50,  rate: 0.90 },
  pro:        { calls: 200, rate: 0.70 },
  business:   { calls: 600, rate: 0.50 },
  enterprise: { calls: 600, rate: 0.50 },
}

async function verifySuperadmin(req: Request): Promise<boolean> {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) return false
  const { data: { user }, error } = await admin.auth.getUser(token)
  if (error || !user) return false
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
  return (profile as any)?.role === 'superadmin'
}

export async function POST(req: Request) {
  try {
    const rl = rateLimitByIp(req, RATE_LIMITS.admin, 'admin:update-plan')
    if (rl.blocked) return rl.response

    // SEGURIDAD: verificar que es superadmin
    const isSuperadmin = await verifySuperadmin(req)
    if (!isSuperadmin) {
      logger.security('Unauthorized update-plan attempt')
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const tenantId = sanitizeUUID(body.tenantId)
    const plan = typeof body.plan === 'string' ? body.plan.trim().toLowerCase() : ''
    if (!tenantId || !plan) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    const ALLOWED_PLANS = Object.keys(PLAN_LIMITS)
    if (!ALLOWED_PLANS.includes(plan)) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

    const limits = PLAN_LIMITS[plan]
    const isTrial = plan === 'trial' || plan === 'free'

    // Actualizar plan + límites correctos + resetear contadores al cambiar
    const updates: any = { plan }
    if (isTrial) {
      updates.free_calls_limit = limits.calls
      updates.free_calls_used  = 0
    } else {
      updates.plan_calls_included = limits.calls
      updates.plan_calls_used     = 0
      updates.plan_extra_rate     = limits.rate
      updates.extra_calls         = 0
      updates.subscription_status = 'active'
    }

    const { error } = await admin.from('tenants').update(updates).eq('id', tenantId)
    if (error) {
      logger.error('Admin update-plan: update failed', { tenantId }, error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 400 })
    }
    logger.info('Admin: plan updated', { tenantId, plan })
    return NextResponse.json({ success: true, plan, limits })
  } catch(e: any) {
    logger.error('Admin update-plan: unexpected error', {}, e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
