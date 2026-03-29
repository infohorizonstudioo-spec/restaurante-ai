/**
 * RESERVO.AI — Team Remove API
 * POST: Removes a member from the tenant (unlinks profile, does not delete user).
 */
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { sanitizeUUID } from '@/lib/sanitize'
import { logger } from '@/lib/logger'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: Request) {
  try {
    const rl = rateLimitByIp(req, RATE_LIMITS.admin, 'team:remove')
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
      logger.security('Team remove: non-admin attempt', { userId: auth.userId, tenantId: auth.tenantId })
      return NextResponse.json({ error: 'Solo administradores pueden eliminar miembros' }, { status: 403 })
    }

    const body = await req.json()
    const targetUserId = sanitizeUUID(body.user_id)

    if (!targetUserId) {
      return NextResponse.json({ error: 'ID de usuario invalido' }, { status: 400 })
    }

    // Cannot remove yourself
    if (targetUserId === auth.userId) {
      return NextResponse.json({ error: 'No puedes eliminarte a ti mismo del equipo' }, { status: 400 })
    }

    // Verify target user belongs to this tenant
    const { data: targetProfile } = await admin
      .from('profiles')
      .select('id, name, role')
      .eq('id', targetUserId)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle()

    if (!targetProfile) {
      return NextResponse.json({ error: 'Usuario no encontrado en este equipo' }, { status: 404 })
    }

    // Unlink: set tenant_id to null (keeps the user account intact)
    const { error: updateError } = await admin
      .from('profiles')
      .update({ tenant_id: null, role: 'staff' })
      .eq('id', targetUserId)
      .eq('tenant_id', auth.tenantId)

    if (updateError) {
      logger.error('Team remove: failed to unlink profile', { targetUserId, tenantId: auth.tenantId }, updateError)
      return NextResponse.json({ error: 'Error al eliminar miembro' }, { status: 500 })
    }

    logger.info('Team remove: member removed', {
      targetUserId,
      targetName: targetProfile.name,
      tenantId: auth.tenantId,
      removedBy: auth.userId,
    })

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    logger.error('Team remove: unexpected error', {}, e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
