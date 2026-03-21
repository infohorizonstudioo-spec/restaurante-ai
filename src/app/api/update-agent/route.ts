import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getBusinessKnowledge, buildKnowledgeContext } from '@/lib/business-knowledge'
import { requireAuth } from '@/lib/api-auth'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const EL_KEY   = process.env.ELEVENLABS_API_KEY!
const AGENT_ID = process.env.ELEVENLABS_AGENT_ID!
const EL_BASE  = 'https://api.us.elevenlabs.io/v1/convai/agents'

// Bloque que se inserta en el prompt si no tiene {{business_knowledge}}
const KNOWLEDGE_BLOCK = `
CONOCIMIENTO DEL NEGOCIO:
{{business_knowledge}}
Usa este conocimiento para responder preguntas sobre el menú, horarios, servicios y políticas.
Si algo no está en el conocimiento, di "No tengo esa información, mejor llama en horario de atención."`

export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req)
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 })
    if (!auth.tenantId) return NextResponse.json({ ok: false, error: 'Tenant no encontrado' }, { status: 403 })

    const { business_name, agent_name } = await req.json()
    const tenant_id = auth.tenantId  // usar siempre el del token
    if (!business_name) {
      return NextResponse.json({ ok: false, error: 'missing params' }, { status: 400 })
    }

    const { data: tenantRow } = await admin
      .from('tenants').select('name, elevenlabs_agent_id').eq('id', tenant_id).maybeSingle()
    const oldName = tenantRow?.name || ''
    const agentId = tenantRow?.elevenlabs_agent_id || AGENT_ID

    if (!agentId || !EL_KEY) {
      return NextResponse.json({ ok: true, elevenlabs: false, reason: 'no agent id or api key' })
    }

    const getRes = await fetch(`${EL_BASE}/${agentId}`, {
      headers: { 'xi-api-key': EL_KEY }
    })
    if (!getRes.ok) {
      return NextResponse.json({ ok: true, elevenlabs: false, reason: 'EL get failed ' + getRes.status })
    }
    const agentData = await getRes.json()
    const cfg       = agentData.conversation_config ?? {}
    const agentCfg  = cfg.agent ?? {}

    const replaceAll = (str: string, from: string, to: string) => {
      if (!from) return str
      return str.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), to)
    }

    let newPrompt = replaceAll(agentCfg.prompt?.prompt ?? '', oldName, business_name)
    const newFirst = replaceAll(agentCfg.first_message ?? '', oldName, business_name)

    // Inyectar bloque de conocimiento si el prompt no lo tiene ya
    if (!newPrompt.includes('{{business_knowledge}}') && newPrompt.length > 20) {
      // Insertar después del bloque de TONO si existe, o al final
      const tonoIdx = newPrompt.indexOf('TONO')
      if (tonoIdx > -1) {
        // Buscar el final del bloque TONO (siguiente línea en blanco doble)
        const afterTono = newPrompt.indexOf('\n\n', tonoIdx + 4)
        if (afterTono > -1) {
          newPrompt = newPrompt.slice(0, afterTono) + '\n' + KNOWLEDGE_BLOCK + newPrompt.slice(afterTono)
        } else {
          newPrompt = newPrompt + '\n' + KNOWLEDGE_BLOCK
        }
      } else {
        newPrompt = newPrompt + '\n' + KNOWLEDGE_BLOCK
      }
    }

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
