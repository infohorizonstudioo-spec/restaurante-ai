import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export const dynamic = 'force-dynamic'

/**
 * POST /api/tenant/set-language
 * Simple endpoint to change tenant language. Uses cookie-based auth.
 */
export async function POST(req: NextRequest) {
  try {
    const { tenant_id, language } = await req.json()
    if (!tenant_id || !language) {
      return NextResponse.json({ error: 'tenant_id and language required' }, { status: 400 })
    }

    const valid = ['es', 'en', 'fr', 'pt', 'ca']
    if (!valid.includes(language)) {
      return NextResponse.json({ error: 'Invalid language' }, { status: 400 })
    }

    const { error } = await admin.from('tenants')
      .update({ language })
      .eq('id', tenant_id)

    if (error) {
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, language })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
