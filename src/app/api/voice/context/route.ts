export const runtime = 'edge'
import { createClient } from '@supabase/supabase-js'
import { BUSINESS_TEMPLATES } from '@/types'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const toNumber = body?.call?.to_number || body?.to_number || body?.To || ''

    let tenant: any = null
    if (toNumber) {
      const { data } = await admin.from('tenants').select('*').eq('agent_phone', toNumber).maybeSingle()
      tenant = data
    }

    const businessName = tenant?.name || 'nuestro negocio'
    const agentName = tenant?.agent_name || 'Gabriela'
    const businessType = tenant?.type || 'restaurante'
    const tenantId = tenant?.id || ''
    const template = BUSINESS_TEMPLATES[businessType as keyof typeof BUSINESS_TEMPLATES] || BUSINESS_TEMPLATES.otro

    const hours = tenant?.business_hours
      ? Object.entries(tenant.business_hours).map(([day, h]: any) => 
          !h.closed ? `${day}: ${h.open}-${h.close}` : `${day}: cerrado`
        ).join(', ')
      : 'Consulta nuestro horario'

    // Incrementar contador de llamadas
    if (tenant) {
      await admin.from('tenants').update({
        call_count: (tenant.call_count || 0) + 1,
        free_calls_used: tenant.plan === 'trial' ? (tenant.free_calls_used || 0) + 1 : tenant.free_calls_used
      }).eq('id', tenant.id).catch(() => {})

      // Crear registro de llamada
      await admin.from('calls').insert({
        tenant_id: tenant.id,
        call_sid: body?.call?.call_sid || body?.CallSid || 'unknown',
        from_number: body?.call?.from_number || body?.From || 'unknown',
        to_number: toNumber,
        status: 'in-progress',
        direction: 'inbound'
      }).catch(() => {})
    }

    return Response.json({
      type: 'conversation_initiation_client_data',
      conversation_config_override: {
        agent: {
          prompt: {
            prompt: `${template.agentSystemPrompt}

INFORMACIÓN DEL NEGOCIO:
- Nombre: ${businessName}
- Tipo: ${template.label}
- Horario: ${hours}
- ID (usar en herramientas): ${tenantId}

INSTRUCCIONES CRÍTICAS:
- Respuestas cortas, 1-2 frases máximo
- Habla de forma natural y coloquial en español
- NUNCA menciones que eres IA o robot
- Cuando hagas una reserva, usa siempre tenant_id: "${tenantId}"`,
          },
          first_message: `¡Hola! Gracias por llamar a ${businessName}. Soy ${agentName}, ¿en qué puedo ayudarte?`
        }
      },
      dynamic_variables: {
        tenant_id: tenantId,
        business_name: businessName,
        agent_name: agentName
      }
    })
  } catch(e) {
    console.error('Context error:', e)
    return Response.json({
      type: 'conversation_initiation_client_data',
      dynamic_variables: { business_name: 'nuestro negocio', agent_name: 'Gabriela', tenant_id: '' }
    })
  }
}