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
  const rl = rateLimitByIp(req, RATE_LIMITS.api, 'tables:get')
  if (rl.blocked) return rl.response

  let tenantId: string | null = null

  // Method 1: auth header
  const auth = await requireAuth(req)
  if (auth.ok && auth.tenantId) {
    tenantId = auth.tenantId
  }

  // Method 2: token verification
  if (!tenantId) {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (token) {
      const { data: { user } } = await admin.auth.getUser(token)
      if (user) {
        const { data: profile } = await admin.from('profiles').select('tenant_id').eq('id', user.id).maybeSingle()
        tenantId = profile?.tenant_id || null
      }
    }
  }

  // Method 3: tenant_id query param (for internal use from same origin)
  if (!tenantId) {
    const url = new URL(req.url)
    const paramTid = url.searchParams.get('tenant_id')
    if (paramTid && /^[0-9a-f-]{36}$/.test(paramTid)) {
      tenantId = paramTid
    }
  }

  if (!tenantId) return NextResponse.json({ tables: [] })

  const { data } = await admin.from('tables')
    .select('id, number, name, capacity, zone_id, x_pos, y_pos, w, h, shape_type, status, rotation')
    .eq('tenant_id', tenantId)
    .order('number')

  return NextResponse.json({ tables: data || [] })
}

export async function PATCH(req: NextRequest) {
  const rl = rateLimitByIp(req, RATE_LIMITS.api, 'tables:patch')
  if (rl.blocked) return rl.response

  const auth = await requireAuth(req)
  if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id, status } = await req.json()
  if (!id || !status) return NextResponse.json({ error: 'id and status required' }, { status: 400 })

  const { error } = await admin.from('tables')
    .update({ status })
    .eq('id', id)
    .eq('tenant_id', auth.tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
