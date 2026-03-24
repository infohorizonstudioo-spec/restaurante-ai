import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/api-auth'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const EL_KEY = process.env.ELEVENLABS_API_KEY

export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req)
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 })
    if (!auth.tenantId) return NextResponse.json({ ok: false, error: 'Tenant no encontrado' }, { status: 403 })
    if (!EL_KEY) return NextResponse.json({ ok: false, error: 'ElevenLabs not configured' }, { status: 503 })

    const { business_name } = await req.json()
    if (!business_name) return NextResponse.json({ ok: false, error: 'missing business_name' }, { status: 400 })

    // Usar el agente específico del tenant
    const { data: tenant } = await admin.from('tenants').select('id,name,el_agent_id').eq('id', auth.tenantId).maybeSingle()
    if (!tenant) return NextResponse.json({ ok: false, error: 'Tenant no encontrado' }, { status: 404 })

    const agentId = tenant.el_agent_id || process.env.ELEVENLABS_AGENT_ID
    if (!agentId) return NextResponse.json({ ok: false, error: 'Agent not provisioned' }, { status: 503 })

    const greeting = `${business_name}, dígame.`
    const res = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
      method: 'PATCH',
      headers: { 'xi-api-key': EL_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation_config: { agent: { first_message: greeting } }
      })
    })

    return NextResponse.json({ ok: res.status === 200 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
