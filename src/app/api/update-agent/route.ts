import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const EL_KEY   = process.env.ELEVENLABS_API_KEY!
const AGENT_ID = process.env.ELEVENLABS_AGENT_ID!
const EL_BASE  = 'https://api.us.elevenlabs.io/v1/convai/agents'

export async function POST(req: Request) {
  try {
    const { tenant_id, business_name, agent_name } = await req.json()
    if (!tenant_id || !business_name) {
      return NextResponse.json({ ok: false, error: 'missing params' }, { status: 400 })
    }

    // Nombre anterior del negocio (para reemplazar en el prompt)
    const { data: tenantRow } = await admin
      .from('tenants').select('name, elevenlabs_agent_id').eq('id', tenant_id).maybeSingle()
    const oldName    = tenantRow?.name     || ''
    const agentId    = tenantRow?.elevenlabs_agent_id || AGENT_ID

    if (!agentId || !EL_KEY) {
      return NextResponse.json({ ok: true, elevenlabs: false, reason: 'no agent id or api key' })
    }

    // Obtener config actual del agente
    const getRes = await fetch(`${EL_BASE}/${agentId}`, {
      headers: { 'xi-api-key': EL_KEY }
    })
    if (!getRes.ok) {
      return NextResponse.json({ ok: true, elevenlabs: false, reason: 'EL get failed ' + getRes.status })
    }
    const agentData = await getRes.json()
    const cfg       = agentData.conversation_config ?? {}
    const agentCfg  = cfg.agent ?? {}

    // Reemplazar nombre viejo por el nuevo en prompt y first_message
    const currentPrompt = agentCfg.prompt?.prompt    ?? ''
    const currentFirst  = agentCfg.first_message     ?? ''

    const replaceAll = (str: string, from: string, to: string) => {
      if (!from) return str
      return str.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), to)
    }

    const newPrompt = replaceAll(currentPrompt, oldName, business_name)
    const newFirst  = replaceAll(currentFirst,  oldName, business_name)

    // PATCH al agente
    const patchBody = {
      conversation_config: {
        ...cfg,
        agent: {
          ...agentCfg,
          first_message: newFirst,
          prompt: { ...(agentCfg.prompt ?? {}), prompt: newPrompt }
        }
      }
    }

    const patchRes = await fetch(`${EL_BASE}/${agentId}`, {
      method: 'PATCH',
      headers: { 'xi-api-key': EL_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(patchBody)
    })

    console.log('EL agent update:', patchRes.status, '| old:', oldName, '→ new:', business_name)

    return NextResponse.json({ ok: true, elevenlabs: patchRes.ok, status: patchRes.status })
  } catch (e: any) {
    console.error('update-agent error:', e.message)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
