import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    // Auth: verify the token and get tenant_id
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

    if (!token) {
      return NextResponse.json({ error: 'no token' }, { status: 401 })
    }

    // Verify token with Supabase
    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'invalid token' }, { status: 401 })
    }

    // Get tenant_id from profile
    const { data: profile } = await admin.from('profiles')
      .select('tenant_id').eq('id', user.id).maybeSingle()
    if (!profile?.tenant_id) {
      return NextResponse.json({ error: 'no tenant' }, { status: 403 })
    }

    const updates = await req.json()

    // Whitelist fields
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
      .eq('id', profile.tenant_id)

    if (error) {
      return NextResponse.json({ error: 'update failed', detail: error.code }, { status: 500 })
    }

    return NextResponse.json({ ok: true, updated: Object.keys(allowed) })
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
