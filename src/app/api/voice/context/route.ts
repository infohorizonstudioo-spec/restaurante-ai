import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
const PROMPTS: Record<string, string> = {
  restaurante: 'Eres recepcionista de restaurante. Para reservas: nombre, fecha, hora, personas.',
  bar: 'Eres recepcionista de bar. Para reservas: nombre, fecha, hora, personas.',
  clinica_dental: 'Eres recepcionista de clínica dental. Gestiona citas.',
  clinica_medica: 'Eres recepcionista de clínica médica. Gestiona citas.',
  asesoria: 'Eres recepcionista de asesoría. Gestiona citas de consultoría.',
  peluqueria: 'Eres recepcionista de peluquería. Gestiona citas.',
  seguros: 'Eres recepcionista de correduría de seguros.',
  inmobiliaria: 'Eres recepcionista de inmobiliaria.',
  otro: 'Eres recepcionista virtual amable.',
}
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const toNumber = body?.call?.to_number || body?.To || ''
    let tenant: any = null
    if (toNumber) { const { data } = await admin.from('tenants').select('*').eq('agent_phone', toNumber).maybeSingle(); tenant = data }
    const businessName = tenant?.name || 'nuestro negocio'
    const agentName = tenant?.agent_name || 'Gabriela'
    const tenantId = tenant?.id || ''
    const systemPrompt = PROMPTS[tenant?.type || 'otro'] || PROMPTS.otro
    if (tenant) {
      await admin.from('tenants').update({ call_count: (tenant.call_count || 0) + 1 }).eq('id', tenant.id).catch(() => {})
      await admin.from('calls').insert({ tenant_id: tenant.id, call_sid: 'conv', from_number: 'unknown', to_number: toNumber, status: 'in-progress', direction: 'inbound' }).catch(() => {})
    }
    return NextResponse.json({ type: 'conversation_initiation_client_data', conversation_config_override: { agent: { prompt: { prompt: `${systemPrompt} Negocio: ${businessName}. ID: ${tenantId}. Responde siempre en español, max 2 frases. NUNCA digas que eres IA.` }, first_message: `¡Hola! Gracias por llamar a ${businessName}. Soy ${agentName}, ¿en qué puedo ayudarte?` } }, dynamic_variables: { tenant_id: tenantId, business_name: businessName, agent_name: agentName } })
  } catch(e) { return NextResponse.json({ type: 'conversation_initiation_client_data', dynamic_variables: { business_name: 'nuestro negocio', agent_name: 'Gabriela', tenant_id: '' } }) }
}