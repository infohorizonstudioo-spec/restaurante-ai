/**
 * GET/PUT /api/tenant/reminders
 * Read and update reminder configuration for a tenant.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getRemindersConfig } from '@/lib/reminder-engine'
import { requireAuth } from '@/lib/api-auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const config = await getRemindersConfig(auth.tenantId)
  return NextResponse.json({ config })
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const tenant_id = auth.tenantId
    const { config } = await req.json()
    if (!config) {
      return NextResponse.json({ error: 'Missing config' }, { status: 400 })
    }

    await supabase.from('reminder_configs').upsert({
      tenant_id,
      intervals: config.intervals || ['24h'],
      channel: config.channel || 'sms',
      template_override: config.template_override || null,
      enabled: config.enabled !== false,
    }, { onConflict: 'tenant_id' })

    const updated = await getRemindersConfig(tenant_id)
    return NextResponse.json({ config: updated })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
