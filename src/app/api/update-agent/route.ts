import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getBusinessKnowledge, buildKnowledgeContext } from '@/lib/business-knowledge'
import { requireAuth } from '@/lib/api-auth'
import { getAgentContext } from '@/lib/agent-contexts'

const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
  )

const EL_KEY   = process.env.ELEVENLABS_API_KEY!
const AGENT_ID = process.env.ELEVENLABS_AGENT_ID!
const EL_BASE  = 'https://api.elevenlabs.io/v1/convai/agents'

export async function POST(req: Request) {
    try {
          const auth = await requireAuth(req)
          if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status || 401 })
          if (!auth.tenantId) return NextResponse.json({ ok: false, error: 'Tenant no encontrado' }, { status: 403 })

      const { business_name, agent_name } = await req.json()
          const tenant_id = auth.tenantId
          if (!business_name) return NextResponse.json({ ok: false, error: 'missing params' }, { status: 400 })

      const { data: tenant } = await admin.from('tenants')
            .select('id,name,type,agent_config').eq('id', tenant_id).maybeSingle()
          if (!tenant) return NextResponse.json({ ok: false, error: 'Tenant no encontrado' }, { status: 404 })

      const tenantType = (tenant as any).type || 'otro'
          const agentCfg   = ((tenant as any).agent_config as any) || {}

                // Contexto especifico para este tipo de negocio
                const agentContext = getAgentContext(tenantType, {
                        zones:         agentCfg.zones?.join(', ') || '',
                        businessHours: agentCfg.business_hours || '',
                })

      // Knowledge del negocio
      let knowledgeText = ''
          try {
                  const knowledge = await getBusinessKnowledge(tenant_id)
                  if (knowledge) knowledgeText = buildKnowledgeContext(knowledge)
          } catch { /* non-critical */ }

      const agentNameFinal = agent_name || agentCfg.agent_name || 'Sofia'
          const firstMessage   = business_name + ', digame.'

      const patchBody: any = {
              conversation_config: {
                        agent: {
                                    first_message: firstMessage,
                        }
              },
              platform_settings: {
                        overrides: {
                                    conversation_config_override: {
                                                  agent: {
                                                                  prompt: {
                                                                                    variables: {
                                                                                                        business_name,
                    agent_name:    agentNameFinal,
                                                                                                        tenant_id,
                                                                                                        agent_context: agentContext,
                                                                                                        caller_phone:  '{{caller_phone}}',
                                                                                      }
                                                                  }
                                                  }
                                    }
                                                                                                          }
              }
      }

      // Anadir knowledge si existe
      if (knowledgeText) {
              patchBody.conversation_config.agent.prompt = {
                        knowledge_base: [{
                                    type: 'text',
                                    name: 'negocio',
                                    id: 'kb_negocio_' + tenant_id.slice(0, 8),
                                    text: knowledgeText.slice(0, 4000)
                        }]
              }
      }

      const res = await fetch(EL_BASE + '/' + AGENT_ID, {
              method: 'PATCH',
              headers: { 'xi-api-key': EL_KEY, 'Content-Type': 'application/json' },
              body: JSON.stringify(patchBody)
      })

      const ok = res.status === 200
          console.log('update-agent:', ok ? 'OK' : res.status, '| tenant:', tenant_id, '| type:', tenantType)
          return NextResponse.json({ ok, tenantType, context_preview: agentContext.slice(0, 80) })
    } catch (e: any) {
          console.error('update-agent error:', e.message)
          return NextResponse.json({ ok: false, error: e.message })
    }
}
