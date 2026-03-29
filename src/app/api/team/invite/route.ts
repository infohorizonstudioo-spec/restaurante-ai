/**
 * RESERVO.AI — Team Invite API
 * POST: Invites a new member to the tenant's team.
 * Creates auth user + profile linked to same tenant_id.
 */
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { sanitizeEmail, sanitizeName } from '@/lib/sanitize'
import { logger } from '@/lib/logger'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const VALID_ROLES = ['admin', 'manager', 'staff'] as const
type TeamRole = typeof VALID_ROLES[number]

export async function POST(req: Request) {
  try {
    const rl = rateLimitByIp(req, RATE_LIMITS.admin, 'team:invite')
    if (rl.blocked) return rl.response

    const auth = await requireAuth(req)
    if (!auth.ok || !auth.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: auth.status || 401 })
    }

    // Verify requester is admin of the tenant
    const { data: requesterProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', auth.userId!)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle()

    if (!requesterProfile || requesterProfile.role !== 'admin') {
      logger.security('Team invite: non-admin attempt', { userId: auth.userId, tenantId: auth.tenantId })
      return NextResponse.json({ error: 'Solo administradores pueden invitar miembros' }, { status: 403 })
    }

    const body = await req.json()
    const email = sanitizeEmail(body.email)
    const name = sanitizeName(body.name)
    const role: TeamRole = VALID_ROLES.includes(body.role) ? body.role : 'staff'

    if (!email) {
      return NextResponse.json({ error: 'Email invalido' }, { status: 400 })
    }
    if (!name) {
      return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })
    }

    // Check if user already exists in this tenant
    const { data: existingUsers } = await admin.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === email)

    if (existingUser) {
      // Check if already in this tenant
      const { data: existingProfile } = await admin
        .from('profiles')
        .select('id')
        .eq('id', existingUser.id)
        .eq('tenant_id', auth.tenantId)
        .maybeSingle()

      if (existingProfile) {
        return NextResponse.json({ error: 'Este usuario ya pertenece al equipo' }, { status: 409 })
      }
    }

    // Use inviteUserByEmail which sends the invite email automatically
    const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { name, role },
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.reservo.ai'}/auth/callback`,
    })

    if (inviteError) {
      // If user already exists, link them to the tenant instead
      if (existingUser) {
        const { error: linkError } = await admin
          .from('profiles')
          .update({ tenant_id: auth.tenantId, role, name })
          .eq('id', existingUser.id)

        if (linkError) {
          logger.error('Team invite: failed to link existing user', { email, tenantId: auth.tenantId }, linkError)
          return NextResponse.json({ error: 'Error al vincular usuario' }, { status: 500 })
        }

        logger.info('Team invite: linked existing user', { userId: existingUser.id, tenantId: auth.tenantId, role })
        return NextResponse.json({ success: true, userId: existingUser.id, linked: true })
      }

      logger.error('Team invite: invite failed', { email, tenantId: auth.tenantId }, inviteError)
      return NextResponse.json({ error: 'Error al enviar invitacion' }, { status: 500 })
    }

    // Create/update profile for the invited user
    const userId = inviteData.user.id
    const { error: profileError } = await admin
      .from('profiles')
      .upsert({
        id: userId,
        tenant_id: auth.tenantId,
        role,
        name,
      }, { onConflict: 'id' })

    if (profileError) {
      logger.error('Team invite: profile creation failed', { userId, tenantId: auth.tenantId }, profileError)
      return NextResponse.json({ error: 'Error al crear perfil' }, { status: 500 })
    }

    logger.info('Team invite: user invited', { userId, email, tenantId: auth.tenantId, role })
    return NextResponse.json({ success: true, userId })
  } catch (e: unknown) {
    logger.error('Team invite: unexpected error', {}, e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
