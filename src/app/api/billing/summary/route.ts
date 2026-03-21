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

    // Usa el tenantId del token — no del query param (evita enumeración)
    const { data, error } = await admin.rpc('get_billing_summary', { p_tenant_id: auth.tenantId })
    if (error) throw error
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
