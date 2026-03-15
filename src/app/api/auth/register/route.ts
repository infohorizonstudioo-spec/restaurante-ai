import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { businessName, businessType, email, password, phone } = await req.json()
    if (!businessName || !email || !password)
      return NextResponse.json({ error: 'Nombre, email y contraseña son obligatorios' }, { status: 400 })
    if (password.length < 8)
      return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const slug = businessName.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      + '-' + Date.now().toString(36)

    const { data: tenant, error: tenantError } = await admin
      .from('tenants')
      .insert({ name: businessName, slug, type: businessType || 'restaurant', email, phone: phone || null, plan: 'trial', active: true })
      .select().single()
    if (tenantError) return NextResponse.json({ error: tenantError.message }, { status: 400 })

    const { data: userData, error: userError } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { name: businessName, role: 'client' }
    })
    if (userError) {
      await admin.from('tenants').delete().eq('id', tenant.id)
      return NextResponse.json({ error: userError.message }, { status: 400 })
    }

    await admin.from('profiles').update({ tenant_id: tenant.id, role: 'client', name: businessName }).eq('id', userData.user.id)
    return NextResponse.json({ success: true, tenantId: tenant.id, slug })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}