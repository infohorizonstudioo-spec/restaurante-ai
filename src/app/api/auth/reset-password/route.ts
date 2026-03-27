import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export async function POST(req: Request) {
  try {
    const rl = rateLimitByIp(req, RATE_LIMITS.auth, 'auth:reset-password')
    if (rl.blocked) return rl.response

    // Verificar que el usuario está autenticado
    const auth = await requireAuth(req)
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status || 401 })
    }

    const { password } = await req.json()
    if (!password || typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return NextResponse.json({ error: 'Password debe tener entre 8 y 128 caracteres' }, { status: 400 })
    }

    // Solo puede cambiar su propia contraseña — usa su userId verificado del token
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { data, error } = await admin.auth.admin.updateUserById(auth.userId!, { password })
    if (error) {
      logger.error('Reset password: update failed', { userId: auth.userId }, error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 400 })
    }
    logger.info('Reset password: success', { userId: auth.userId })
    return NextResponse.json({ success: true, email: data.user?.email })
  } catch (e: any) {
    logger.error('Reset password: unexpected error', {}, e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
