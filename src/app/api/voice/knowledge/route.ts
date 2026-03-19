/**
 * GET  /api/voice/knowledge — carga knowledge del tenant
 * POST /api/voice/knowledge — guarda knowledge del tenant
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getBusinessKnowledge, saveBusinessKnowledge, DEFAULT_KNOWLEDGE } from '@/lib/business-knowledge'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function getTenantId(req: Request): Promise<string | null> {
  const auth  = req.headers.get('authorization') || ''
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
    const knowledge = await getBusinessKnowledge(tenantId)
    return NextResponse.json({ knowledge })
  } catch(e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const tenantId = await getTenantId(req)
    if (!tenantId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { knowledge } = await req.json()
    if (!knowledge || typeof knowledge !== 'object')
      return NextResponse.json({ error: 'Knowledge inválido' }, { status: 400 })
    await saveBusinessKnowledge(tenantId, { ...DEFAULT_KNOWLEDGE, ...knowledge })
    return NextResponse.json({ ok: true })
  } catch(e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
