/**
 * GET  /api/voice/rules — Carga reglas del agente para el tenant actual
 * POST /api/voice/rules — Guarda reglas actualizadas
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { DEFAULT_RULES } from '@/lib/agent-decision'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function getTenantId(req: Request): Promise<string | null> {
  const auth = req.headers.get('authorization') || ''
  const token = auth.replace('Bearer ', '')
  if (!token) return null
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { data: { user } } = await anon.auth.getUser(token)
  if (!user) return null
  const { data: p } = await admin.from('profiles').select('tenant_id').eq('id', user.id).maybeSingle()
  return p?.tenant_id || null
}

export async function GET(req: Request) {
  try {
    const tenantId = await getTenantId(req)
    if (!tenantId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data } = await admin.from('business_rules')
      .select('rules, patterns, updated_at')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    const rules   = { ...DEFAULT_RULES, ...(data?.rules || {}) }
    const patterns = { ...DEFAULT_RULES.patterns, ...(data?.patterns || {}) }
    const updatedAt = data?.updated_at || null

    // Historial de feedback resumido
    const { data: fb } = await admin.from('agent_feedback')
      .select('original_status, corrected_status, flags, intent, created_at, note')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(20)

    return NextResponse.json({ rules, patterns, updated_at: updatedAt, feedback: fb || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const tenantId = await getTenantId(req)
    if (!tenantId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json()
    const { rules, patterns } = body

    // Validar rangos básicos
    if (rules.max_auto_party_size < 1 || rules.max_auto_party_size > 50)
      return NextResponse.json({ error: 'Tamaño de grupo inválido (1-50)' }, { status: 400 })
    if (rules.min_confidence_to_confirm < 0.3 || rules.min_confidence_to_confirm > 1)
      return NextResponse.json({ error: 'Confianza mínima inválida (0.3-1.0)' }, { status: 400 })

    const { data: existing } = await admin.from('business_rules')
      .select('id').eq('tenant_id', tenantId).maybeSingle()

    if (existing) {
      await admin.from('business_rules')
        .update({ rules, patterns, updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId)
    } else {
      await admin.from('business_rules')
        .insert({ tenant_id: tenantId, rules, patterns })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
