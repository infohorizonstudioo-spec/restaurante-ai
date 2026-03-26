/**
 * GET/PUT /api/tenant/alert-rules
 * Read and update alert rules for a tenant.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAlertRules, type AlertEventType } from '@/lib/alert-rules'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenant_id')
  if (!tenantId) return NextResponse.json({ error: 'Missing tenant_id' }, { status: 400 })

  const rules = await getAlertRules(tenantId)
  return NextResponse.json({ rules })
}

export async function PUT(req: NextRequest) {
  try {
    const { tenant_id, rules } = await req.json()
    if (!tenant_id || !rules || !Array.isArray(rules)) {
      return NextResponse.json({ error: 'Missing tenant_id or rules' }, { status: 400 })
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
