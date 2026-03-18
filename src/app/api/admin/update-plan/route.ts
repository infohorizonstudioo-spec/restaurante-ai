import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { tenantId, plan } = await req.json()
    if (!tenantId || !plan) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    const allowed = ['trial','free','starter','pro','business','enterprise']
    if (!allowed.includes(plan)) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { error } = await admin.from('tenants').update({ plan }).eq('id', tenantId)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch(e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}