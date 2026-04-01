/**
 * RESERVO.AI — Team List API
 * GET: Returns all profiles for the current tenant with auth email.
 */
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function GET(req: Request) {
  try {
    const rl = rateLimitByIp(req, RATE_LIMITS.api, 'team:list')
    if (rl.blocked) return rl.response

    const auth = await requireAuth(req)
    if (!auth.ok || !auth.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: auth.status || 401 })
    }

    // Get all profiles for this tenant
    const { data: profiles, error: profilesError } = await admin
      .from('profiles')
      .select('id, name, role, created_at, last_sign_in')
      .eq('tenant_id', auth.tenantId)
      .order('created_at', { ascending: true })

    if (profilesError) {
      logger.error('Team list: failed to fetch profiles', { tenantId: auth.tenantId }, profilesError)
      return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }

    // Get emails from auth.users via admin API
    const userIds = (profiles || []).map(p => p.id)
    const membersWithEmail = await Promise.all(
      userIds.map(async (uid) => {
        const profile = (profiles || []).find(p => p.id === uid)
        if (!profile) return null
        try {
          const { data: { user } } = await admin.auth.admin.getUserById(uid)
          return {
            id: profile.id,
            name: profile.name || '',
            email: user?.email || '',
            role: profile.role || 'staff',
            last_sign_in: user?.last_sign_in_at || null,
            created_at: profile.created_at,
          }
        } catch {
          return {
            id: profile.id,
            name: profile.name || '',
            email: '',
            role: profile.role || 'staff',
            last_sign_in: null,
            created_at: profile.created_at,
          }
        }
      })
    )

    return NextResponse.json({ members: membersWithEmail.filter(Boolean) })
  } catch (e: unknown) {
    logger.error('Team list: unexpected error', {}, e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
