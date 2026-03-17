import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const tenantId = url.searchParams.get('tenant_id')
    if (!tenantId) return NextResponse.json({ error: 'tenant_id required' }, { status: 400 })

    const { data, error } = await admin.rpc('get_billing_summary', { p_tenant_id: tenantId })
    if (error) throw error

    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}