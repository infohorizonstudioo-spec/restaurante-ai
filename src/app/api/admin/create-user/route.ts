import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { sanitizeEmail, sanitizeName, sanitizeUUID } from '@/lib/sanitize'
import { logger } from '@/lib/logger'

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
    const rl = rateLimitByIp(req, RATE_LIMITS.admin, 'admin:create-user')
    if (rl.blocked) return rl.response

    // SEGURIDAD: verificar que es superadmin
    const isSuperadmin = await verifySuperadmin(req)
    if (!isSuperadmin) {
      logger.security('Unauthorized create-user attempt')
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const email = sanitizeEmail(body.email)
    const password = body.password
    const name = sanitizeName(body.name)
    const tenantId = sanitizeUUID(body.tenantId)
    const VALID_ROLES = ['client', 'staff', 'superadmin']
    const role = VALID_ROLES.includes(body.role) ? body.role : 'client'

    if (!email || !password || !tenantId) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return NextResponse.json({ error: 'Contraseña debe tener entre 8 y 128 caracteres' }, { status: 400 })
    }

    const { data: userData, error: userError } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { name, role }
    })
    if (userError) return NextResponse.json({ error: 'Internal server error' }, { status: 400 })

    // El trigger handle_new_user crea el perfil automáticamente.
    // Solo actualizamos tenant_id y role.
    const { error: profileError } = await admin.from('profiles')
      .update({ tenant_id: tenantId, role, name })
      .eq('id', userData.user.id)
    if (profileError) return NextResponse.json({ error: 'Internal server error' }, { status: 400 })

    logger.info('Admin: user created', { userId: userData.user.id, tenantId, role })
    return NextResponse.json({ success: true, userId: userData.user.id })
  } catch (e: any) {
    logger.error('Admin create-user: unexpected error', {}, e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
