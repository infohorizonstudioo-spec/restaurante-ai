// Cargar env ANTES de cualquier import que use process.env a nivel de módulo
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
process.env.ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || ''

import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

// Dynamic imports para evitar que los módulos lean env vacío al importarse
let buildPrompt: any, getFirstMessage: any, getVoiceConfig: any, getIdealSpeechSpeed: any, getIdealTurnTimeout: any

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const EL_KEY = process.env.ELEVENLABS_API_KEY!
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!
const AGENT_KEY = process.env.AGENT_API_KEY || ''

async function main() {
  const { data: tenants } = await sb.from('tenants')
    .select('id, name, type, agent_name, el_agent_id, transfer_phone, agent_phone')
    .not('el_agent_id', 'is', null)

  if (!tenants?.length) { console.log('No hay agentes'); return }

  for (const tenant of tenants) {
    console.log(`\n=== ${tenant.name} (${tenant.type}) ===`)

    const { data: kb } = await sb.from('business_knowledge')
      .select('category,content').eq('tenant_id', tenant.id).eq('active', true)
    const kv: Record<string, string> = {}
    for (const k of (kb || [])) {
      kv[k.category] = kv[k.category] ? kv[k.category] + '. ' + k.content : k.content
    }

    const { data: rules } = await sb.from('business_rules')
      .select('rule_key,rule_value').eq('tenant_id', tenant.id)
    const rulesLines: string[] = []
    for (const r of (rules || [])) {
      if (r.rule_key === 'max_capacity') rulesLines.push('Aforo: ' + r.rule_value)
      else if (r.rule_key === 'total_spaces') rulesLines.push('Mesas: ' + r.rule_value)
      else if (r.rule_key === 'closed_days') {
        try { rulesLines.push('Cerrado: ' + JSON.parse(r.rule_value).join(', ')) } catch {}
      }
    }

    const { data: memories } = await sb.from('business_memory')
      .select('content').eq('tenant_id', tenant.id).eq('active', true)
      .gte('confidence', 0.7).order('created_at', { ascending: false }).limit(10)

    const businessType = tenant.type || 'otro'
    const prompt = buildPrompt({
      agent_name: tenant.agent_name || 'Sofia',
      business_name: tenant.name,
      business_type: businessType,
      business_information: kv.servicios || '',
      hours: kv.horarios || '',
      services: kv.servicios || '',
      menu: kv.menu || '',
      prices: kv.precios || '',
      policies: kv.politicas || '',
      faqs: kv.faqs || '',
      rules: rulesLines.join('. '),
      memory: (memories || []).map(m => m.content).join('. '),
      channel: 'voice',
    })

    const firstMessage = getFirstMessage(businessType, tenant.name)
    const voiceConfig = getVoiceConfig(businessType)
    const speed = getIdealSpeechSpeed(businessType)
    const timeout = getIdealTurnTimeout(businessType)

    console.log('First message:', firstMessage)
    console.log('Prompt:', prompt.length, 'chars')

    const reqH: Record<string, string> = { 'Content-Type': 'application/json' }
    if (AGENT_KEY) reqH['x-agent-key'] = AGENT_KEY

    const mkTool = (name: string, desc: string, path: string, schema: any) => ({
      type: 'webhook', name, description: desc,
      api_schema: { url: APP_URL + path, method: 'POST', request_headers: reqH, request_body_schema: schema },
      response_timeout_secs: 10,
    })

    const tid = { type: 'string' as const, enum: [tenant.id] }
    const tools = [
      mkTool('check_availability', 'Comprueba disponibilidad.', '/api/agent/check-availability', { type: 'object', properties: { tenant_id: tid, date: { type: 'string' }, time: { type: 'string' }, party_size: { type: 'number' } }, required: ['tenant_id', 'date'] }),
      mkTool('create_reservation', 'Crea reserva.', '/api/agent/create-reservation', { type: 'object', properties: { tenant_id: tid, customer_name: { type: 'string' }, customer_phone: { type: 'string' }, date: { type: 'string' }, time: { type: 'string' }, party_size: { type: 'number' }, notes: { type: 'string' } }, required: ['tenant_id', 'customer_name', 'date', 'time'] }),
      mkTool('get_menu_or_services', 'Carta o servicios.', '/api/agent/get-menu', { type: 'object', properties: { tenant_id: tid }, required: ['tenant_id'] }),
      mkTool('save_call_summary', 'Guarda resumen.', '/api/agent/save-summary', { type: 'object', properties: { tenant_id: tid, customer_name: { type: 'string' }, caller_phone: { type: 'string' }, intent: { type: 'string', enum: ['reserva', 'cancelacion', 'modificacion', 'consulta', 'pedido', 'otro'] }, summary: { type: 'string' } }, required: ['tenant_id', 'summary'] }),
      mkTool('cancel_reservation', 'Cancela reserva.', '/api/agent/cancel-reservation', { type: 'object', properties: { tenant_id: tid, customer_name: { type: 'string' }, customer_phone: { type: 'string' }, date: { type: 'string' } }, required: ['tenant_id'] }),
      mkTool('modify_reservation', 'Modifica reserva.', '/api/agent/modify-reservation', { type: 'object', properties: { tenant_id: tid, customer_name: { type: 'string' }, customer_phone: { type: 'string' }, new_date: { type: 'string' }, new_time: { type: 'string' }, new_party_size: { type: 'number' } }, required: ['tenant_id'] }),
      mkTool('add_to_waitlist', 'Lista de espera.', '/api/agent/add-to-waitlist', { type: 'object', properties: { tenant_id: tid, customer_name: { type: 'string' }, customer_phone: { type: 'string' }, date: { type: 'string' }, time: { type: 'string' }, party_size: { type: 'number' } }, required: ['tenant_id', 'customer_name', 'date'] }),
      mkTool('update_order', 'Crea/actualiza pedido.', '/api/agent/update-order', { type: 'object', properties: { tenant_id: tid, order_id: { type: 'string' }, customer_name: { type: 'string' }, customer_phone: { type: 'string' }, items: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, quantity: { type: 'number' }, price: { type: 'number' } } } }, order_type: { type: 'string', enum: ['recoger', 'domicilio', 'mesa'] }, pickup_time: { type: 'string' }, notes: { type: 'string' }, action: { type: 'string', enum: ['confirm', 'cancel'] } }, required: ['tenant_id', 'customer_name'] }),
    ]

    const res = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${tenant.el_agent_id}`, {
      method: 'PATCH',
      headers: { 'xi-api-key': EL_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation_config: {
          agent: { first_message: firstMessage, language: 'es', prompt: { prompt }, tools, dynamic_variables: { dynamic_variable_placeholders: { current_date: 'fecha actual', caller_phone: '', customer_context: '', business_name: tenant.name, agent_name: tenant.agent_name || 'Sofia', business_info: '', tenant_id: tenant.id, business_personality: '' } } },
          asr: { quality: 'high', provider: 'elevenlabs', language: 'multi', keywords: ['reserva', 'reservar', 'mesa', 'cita', 'personas', 'hora', 'cancelar', 'pedido', 'terraza', 'reservation', 'booking', 'table', 'appointment', 'cancel'] },
          turn: { mode: 'turn', turn_timeout: timeout, silence_end_call_timeout: 15, turn_eagerness: 'high', speculative_turn: true, interruption_sensitivity: 0.9 },
          tts: { model_id: 'eleven_v3_conversational', voice_id: voiceConfig.voice_id, stability: voiceConfig.stability, similarity_boost: voiceConfig.similarity_boost, optimize_streaming_latency: 4, speed, expressive_mode: true },
        },
        platform_settings: { webhooks: { post_call_webhook_url: APP_URL + '/api/voice/post-call', post_call_webhook_events: ['transcript'] } },
      }),
    })

    if (res.ok) {
      console.log('=> ACTUALIZADO en ElevenLabs')
    } else {
      const err = await res.text()
      console.error('=> ERROR:', res.status, err.substring(0, 300))
    }
  }
}

main().catch(e => { console.error(e); process.exit(1) })
