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
  const rl = rateLimitByIp(req, RATE_LIMITS.agent, 'voice:knowledge:get')
  if (rl.blocked) return rl.response

  const auth = await requireAuth(req)
  if (!auth.ok || !auth.tenantId) return NextResponse.json([], { status: 401 })

  const { data } = await admin.from('business_knowledge')
    .select('category, content')
    .eq('tenant_id', auth.tenantId)
    .eq('active', true)

  const knowledge: Record<string, any> = { services: [], menu: {}, hours: {}, faqs: [], policies: {}, special_notes: '' }

  for (const row of data || []) {
    if (row.category === 'servicios') knowledge.services.push(row.content)
    else if (row.category === 'horarios') {
      try { knowledge.hours = JSON.parse(row.content) } catch { knowledge.hours = { text: row.content } }
    } else if (row.category === 'menu') {
      try { knowledge.menu = JSON.parse(row.content) } catch { knowledge.menu = {} }
    } else if (row.category === 'faqs') {
      try { knowledge.faqs = JSON.parse(row.content) } catch { knowledge.faqs = [] }
    } else if (row.category === 'notas') knowledge.special_notes = row.content
  }

  return NextResponse.json({ knowledge })
}

export async function POST(req: NextRequest) {
  const rl = rateLimitByIp(req, RATE_LIMITS.agent, 'voice:knowledge:post')
  if (rl.blocked) return rl.response

  const auth = await requireAuth(req)
  if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { knowledge } = await req.json()
  if (!knowledge) return NextResponse.json({ error: 'knowledge required' }, { status: 400 })

  // Deactivate existing knowledge for this tenant
  await admin.from('business_knowledge')
    .update({ active: false })
    .eq('tenant_id', auth.tenantId)

  const rows: { tenant_id: string; category: string; content: string; active: boolean }[] = []

  if (knowledge.services?.length) {
    for (const s of knowledge.services) {
      rows.push({ tenant_id: auth.tenantId, category: 'servicios', content: s, active: true })
    }
  }
  if (knowledge.hours && Object.keys(knowledge.hours).length) {
    rows.push({ tenant_id: auth.tenantId, category: 'horarios', content: JSON.stringify(knowledge.hours), active: true })
  }
  if (knowledge.menu && Object.keys(knowledge.menu).length) {
    rows.push({ tenant_id: auth.tenantId, category: 'menu', content: JSON.stringify(knowledge.menu), active: true })
  }
  if (knowledge.faqs?.length) {
    rows.push({ tenant_id: auth.tenantId, category: 'faqs', content: JSON.stringify(knowledge.faqs), active: true })
  }
  if (knowledge.special_notes) {
    rows.push({ tenant_id: auth.tenantId, category: 'notas', content: knowledge.special_notes, active: true })
  }

  if (rows.length > 0) {
    const { error } = await admin.from('business_knowledge').insert(rows)
    if (error) return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
