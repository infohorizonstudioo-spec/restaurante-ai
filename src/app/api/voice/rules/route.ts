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

export async function GET(req: NextRequest) {
  const rl = rateLimitByIp(req, RATE_LIMITS.agent, 'voice:rules:get')
  if (rl.blocked) return rl.response

  const auth = await requireAuth(req)
  if (!auth.ok || !auth.tenantId) return NextResponse.json([], { status: 401 })

  const [rulesRes, feedbackRes] = await Promise.all([
    admin.from('business_rules').select('rule_key, rule_value')
      .eq('tenant_id', auth.tenantId),
    admin.from('agent_feedback').select('original_status, corrected_status, flags, note, intent, created_at')
      .eq('tenant_id', auth.tenantId)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const rules: Record<string, any> = {}
  const patterns: Record<string, string> = {}
  for (const r of rulesRes.data || []) {
    if (r.rule_key.startsWith('pattern_')) {
      patterns[r.rule_key.replace('pattern_', '')] = r.rule_value
    } else {
      try { rules[r.rule_key] = JSON.parse(r.rule_value) } catch { rules[r.rule_key] = r.rule_value }
    }
  }

  const lastRule = rulesRes.data?.[0]
  return NextResponse.json({
    rules,
    patterns,
    feedback: feedbackRes.data || [],
    updated_at: lastRule ? new Date().toISOString() : null,
  })
}

export async function POST(req: NextRequest) {
  const rl = rateLimitByIp(req, RATE_LIMITS.agent, 'voice:rules:post')
  if (rl.blocked) return rl.response

  const auth = await requireAuth(req)
  if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { rules, patterns } = await req.json()

  // Validate critical rule values
  if (rules) {
    if (rules.max_auto_party_size !== undefined) {
      rules.max_auto_party_size = Math.max(1, Math.min(50, parseInt(rules.max_auto_party_size) || 6))
    }
    if (rules.min_confidence_to_confirm !== undefined) {
      rules.min_confidence_to_confirm = Math.max(0.3, Math.min(1.0, parseFloat(rules.min_confidence_to_confirm) || 0.7))
    }
    if (rules.large_group_min !== undefined) {
      rules.large_group_min = Math.max(2, Math.min(100, parseInt(rules.large_group_min) || 8))
    }
    if (rules.advance_booking_max_days !== undefined) {
      rules.advance_booking_max_days = Math.max(1, Math.min(365, parseInt(rules.advance_booking_max_days) || 60))
    }
  }

  const upserts: { tenant_id: string; rule_key: string; rule_value: string }[] = []

  if (rules && typeof rules === 'object') {
    for (const [key, val] of Object.entries(rules)) {
      upserts.push({ tenant_id: auth.tenantId, rule_key: key, rule_value: typeof val === 'string' ? val : JSON.stringify(val) })
    }
  }
  if (patterns && typeof patterns === 'object') {
    for (const [key, val] of Object.entries(patterns)) {
      upserts.push({ tenant_id: auth.tenantId, rule_key: `pattern_${key}`, rule_value: String(val) })
    }
  }

  if (upserts.length > 0) {
    const { error } = await admin.from('business_rules')
      .upsert(upserts, { onConflict: 'tenant_id,rule_key' })
    if (error) return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
