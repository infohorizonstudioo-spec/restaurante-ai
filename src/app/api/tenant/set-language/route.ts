import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/api-auth'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export const dynamic = 'force-dynamic'

/**
 * POST /api/tenant/set-language
 * Simple endpoint to change tenant language.
 */
export async function POST(req: NextRequest) {
  try {
    const rl = rateLimitByIp(req, RATE_LIMITS.api, 'tenant:set-language')
    if (rl.blocked) return rl.response

    const auth = await requireAuth(req)
    if (!auth.ok || !auth.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const language = typeof body.language === 'string' ? body.language.trim().toLowerCase() : ''

    if (!language) {
      return NextResponse.json({ error: 'language required' }, { status: 400 })
    }

    const ALLOWED_LANGUAGES = ['es', 'en', 'fr', 'pt', 'ca'] as const
    if (!ALLOWED_LANGUAGES.includes(language as any)) {
      logger.security('Invalid language attempt', { tenantId: auth.tenantId, language })
      return NextResponse.json({ error: 'Invalid language' }, { status: 400 })
    }

    const { error } = await admin.from('tenants')
      .update({ language })
      .eq('id', auth.tenantId)

    if (error) {
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, language })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
