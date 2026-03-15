import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { email, password, name, tenantId, role = 'client' } = await req.json()
    if (!email || !password || !tenantId) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
    }
    // Use service role to create users
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    // Create auth user
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { name, role }
    })
    if (userError) return NextResponse.json({ error: userError.message }, { status: 400 })
    // Update profile with tenant_id and role
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ tenant_id: tenantId, role, name })
      .eq('id', userData.user.id)
    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 })
    return NextResponse.json({ success: true, userId: userData.user.id })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}