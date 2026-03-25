import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/api-auth'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export const dynamic = 'force-dynamic'

/**
 * POST /api/tenant/update
 * Updates tenant configuration using service role key (bypasses RLS).
 * Only allows the tenant owner to update their own tenant.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (!auth.ok || !auth.tenantId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const updates = await req.json()

    // Whitelist allowed fields — don't allow arbitrary updates
    const allowed: Record<string, any> = {}
    const SAFE_FIELDS = [
      'name', 'agent_name', 'agent_phone', 'transfer_phone', 'language',
      'agent_config', 'reservation_config', 'business_hours', 'business_description',
    ]
    for (const key of SAFE_FIELDS) {
      if (updates[key] !== undefined) allowed[key] = updates[key]
    }

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: 'no valid fields' }, { status: 400 })
    }

    const { error } = await admin.from('tenants')
      .update(allowed)
      .eq('id', auth.tenantId)

    if (error) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, updated: Object.keys(allowed) })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
