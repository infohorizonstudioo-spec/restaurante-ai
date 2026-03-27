/**
 * GET/PUT /api/tenant/alert-rules
 * Read and update alert rules for a tenant.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAlertRules, type AlertEventType } from '@/lib/alert-rules'
import { requireAuth } from '@/lib/api-auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const rules = await getAlertRules(auth.tenantId)
  return NextResponse.json({ rules })
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const tenant_id = auth.tenantId
    const { rules } = await req.json()
    if (!rules || !Array.isArray(rules)) {
      return NextResponse.json({ error: 'Missing rules' }, { status: 400 })
    }

    for (const rule of rules) {
      await supabase.from('alert_rules').upsert({
        tenant_id,
        event_type: rule.event_type as AlertEventType,
        enabled: rule.enabled,
        priority: rule.priority,
        channels: rule.channels,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id,event_type' })
    }

    const updated = await getAlertRules(tenant_id)
    return NextResponse.json({ rules: updated })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
