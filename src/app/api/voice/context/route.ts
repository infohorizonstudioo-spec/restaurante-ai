export const runtime = 'edge'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const PROMPTS: Record<string, string> = {
  restaurante: 'Eres una recepcionista de restaurante. Para reservas necesitas: nombre, fecha, hora y número de personas.',
  bar: 'Eres una recepcionista de bar. Para reservas necesitas: nombre, fecha, hora y número de personas.',
  clinica_dental: 'Eres la recepcionista de una clínica dental. Gestiona citas. Pregunta tipo de tratamiento y fecha.',
  clinica_medica: 'Eres la recepcionista de una clínica médica. Gestiona citas médicas. Pregunta especialidad y fecha.',
  asesoria: 'Eres la recepcionista de una asesoría. Gestiona citas de consultoría. Pregunta tipo de consulta y fecha.',
  peluqueria: 'Eres la recepcionista de una peluquería. Gestiona citas. Pregunta servicio y profesional preferido.',
  seguros: 'Eres la recepcionista de una correduría de seguros. Gestiona llamadas y citas.',
  inmobiliaria: 'Eres la recepcionista de una inmobiliaria. Gestiona llamadas de clientes interesados en propiedades.',
  otro: 'Eres una recepcionista virtual amable y profesional.',
}

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
    const tenantId = tenant?.id || ''
    const businessType = tenant?.type || 'otro'
    const systemPrompt = PROMPTS[businessType] || PROMPTS.otro

    if (tenant) {
      await admin.from('tenants').update({
        call_count: (tenant.call_count || 0) + 1,
        free_calls_used: tenant.plan === 'trial' ? (tenant.free_calls_used || 0) + 1 : (tenant.free_calls_used || 0)
      }).eq('id', tenant.id).catch(() => {})

      await admin.from('calls').insert({
        tenant_id: tenant.id,
        call_sid: body?.call?.call_sid || 'unknown',
        from_number: body?.call?.from_number || 'unknown',
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
            prompt: `${systemPrompt}

Negocio: ${businessName}
ID del negocio (usar en herramientas): ${tenantId}

IMPORTANTE:
- Responde siempre en español, máximo 1-2 frases
- Sé natural y cercana, nunca robótica
- NUNCA digas que eres IA
- Cuando hagas reserva usa tenant_id: "${tenantId}"`
          },
          first_message: `¡Hola! Gracias por llamar a ${businessName}. Soy ${agentName}, ¿en qué puedo ayudarte?`
        }
      },
      dynamic_variables: { tenant_id: tenantId, business_name: businessName, agent_name: agentName }
    })
  } catch(e) {
    return Response.json({
      type: 'conversation_initiation_client_data',
      dynamic_variables: { business_name: 'nuestro negocio', agent_name: 'Gabriela', tenant_id: '' }
    })
  }
}