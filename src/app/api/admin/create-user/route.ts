import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

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
    // SEGURIDAD: verificar que es superadmin
    const isSuperadmin = await verifySuperadmin(req)
    if (!isSuperadmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { email, password, name, tenantId, role = 'client' } = await req.json()
    if (!email || !password || !tenantId) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Contraseña mínimo 8 caracteres' }, { status: 400 })
    }

    const { data: userData, error: userError } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { name, role }
    })
    if (userError) return NextResponse.json({ error: userError.message }, { status: 400 })

    // El trigger handle_new_user crea el perfil automáticamente.
    // Solo actualizamos tenant_id y role.
    const { error: profileError } = await admin.from('profiles')
      .update({ tenant_id: tenantId, role, name })
      .eq('id', userData.user.id)
    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 })

    return NextResponse.json({ success: true, userId: userData.user.id })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
