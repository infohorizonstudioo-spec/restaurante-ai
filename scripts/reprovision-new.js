/**
 * Reprovisiona el agente con el prompt NUEVO (buildPrompt + getFirstMessage).
 * Usa las funciones del código actualizado, no prompt hardcodeado.
 */
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');
const { buildPrompt, getFirstMessage } = require('../src/lib/provision-agent');
const { getVoiceConfig } = require('../src/lib/elevenlabs');
const { getIdealSpeechSpeed, getIdealTurnTimeout } = require('../src/lib/business-brain');

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const EL_KEY = process.env.ELEVENLABS_API_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL;
const AGENT_KEY = process.env.AGENT_API_KEY || '';

async function reprovision(tenantId, agentId) {
  const { data: tenant } = await sb.from('tenants')
    .select('id,name,type,agent_name,transfer_phone,agent_phone')
    .eq('id', tenantId).single();

  if (!tenant) { console.error('Tenant not found:', tenantId); return false; }

  const { data: kb } = await sb.from('business_knowledge')
    .select('category,content').eq('tenant_id', tenantId).eq('active', true);
  const kv = {};
  for (const k of (kb || [])) {
    kv[k.category] = kv[k.category] ? kv[k.category] + '. ' + k.content : k.content;
  }

  const { data: rules } = await sb.from('business_rules')
    .select('rule_key,rule_value').eq('tenant_id', tenantId);
  const rulesLines = [];
  for (const r of (rules || [])) {
    if (r.rule_key === 'max_capacity') rulesLines.push('Aforo maximo: ' + r.rule_value);
    else if (r.rule_key === 'advance_booking_hours') rulesLines.push('Reservas con minimo ' + r.rule_value + 'h de antelacion');
    else if (r.rule_key === 'total_spaces') rulesLines.push('Mesas totales: ' + r.rule_value);
    else if (r.rule_key === 'closed_days') {
      try { rulesLines.push('Cerrado: ' + JSON.parse(r.rule_value).join(', ')); } catch {}
    }
  }

  const { data: memories } = await sb.from('business_memory')
    .select('content').eq('tenant_id', tenantId).eq('active', true)
    .gte('confidence', 0.7).order('created_at', { ascending: false }).limit(10);

  const businessType = tenant.type || 'otro';

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
  });

  const firstMessage = getFirstMessage(businessType, tenant.name);
  const voiceConfig = getVoiceConfig(businessType);
  const idealSpeed = getIdealSpeechSpeed(businessType);
  const idealTurnTimeout = getIdealTurnTimeout(businessType);

  console.log('  First message:', firstMessage);
  console.log('  Prompt:', prompt.length, 'chars');
  console.log('  Voice:', voiceConfig.voice_id, '| Speed:', idealSpeed, '| Timeout:', idealTurnTimeout);

  const reqHeaders = { 'Content-Type': 'application/json' };
  if (AGENT_KEY) reqHeaders['x-agent-key'] = AGENT_KEY;

  const tools = [
    { type: 'webhook', name: 'check_availability', description: 'Comprueba disponibilidad.', api_schema: { url: APP_URL + '/api/agent/check-availability', method: 'POST', request_headers: reqHeaders, request_body_schema: { type: 'object', properties: { tenant_id: { type: 'string', enum: [tenantId] }, date: { type: 'string' }, time: { type: 'string' }, party_size: { type: 'number' } }, required: ['tenant_id', 'date'] } }, response_timeout_secs: 10 },
    { type: 'webhook', name: 'create_reservation', description: 'Crea reserva confirmada.', api_schema: { url: APP_URL + '/api/agent/create-reservation', method: 'POST', request_headers: reqHeaders, request_body_schema: { type: 'object', properties: { tenant_id: { type: 'string', enum: [tenantId] }, customer_name: { type: 'string' }, customer_phone: { type: 'string' }, date: { type: 'string' }, time: { type: 'string' }, party_size: { type: 'number' }, notes: { type: 'string' } }, required: ['tenant_id', 'customer_name', 'date', 'time'] } }, response_timeout_secs: 10 },
    { type: 'webhook', name: 'get_menu_or_services', description: 'Carta, servicios o precios.', api_schema: { url: APP_URL + '/api/agent/get-menu', method: 'POST', request_headers: reqHeaders, request_body_schema: { type: 'object', properties: { tenant_id: { type: 'string', enum: [tenantId] } }, required: ['tenant_id'] } }, response_timeout_secs: 10 },
    { type: 'webhook', name: 'save_call_summary', description: 'Guarda resumen al despedirte.', api_schema: { url: APP_URL + '/api/agent/save-summary', method: 'POST', request_headers: reqHeaders, request_body_schema: { type: 'object', properties: { tenant_id: { type: 'string', enum: [tenantId] }, customer_name: { type: 'string' }, caller_phone: { type: 'string' }, intent: { type: 'string', enum: ['reserva', 'cancelacion', 'modificacion', 'consulta', 'pedido', 'otro'] }, summary: { type: 'string' } }, required: ['tenant_id', 'summary'] } }, response_timeout_secs: 10 },
    { type: 'webhook', name: 'cancel_reservation', description: 'Cancela reserva.', api_schema: { url: APP_URL + '/api/agent/cancel-reservation', method: 'POST', request_headers: reqHeaders, request_body_schema: { type: 'object', properties: { tenant_id: { type: 'string', enum: [tenantId] }, customer_name: { type: 'string' }, customer_phone: { type: 'string' }, date: { type: 'string' } }, required: ['tenant_id'] } }, response_timeout_secs: 10 },
    { type: 'webhook', name: 'modify_reservation', description: 'Modifica reserva.', api_schema: { url: APP_URL + '/api/agent/modify-reservation', method: 'POST', request_headers: reqHeaders, request_body_schema: { type: 'object', properties: { tenant_id: { type: 'string', enum: [tenantId] }, customer_name: { type: 'string' }, customer_phone: { type: 'string' }, new_date: { type: 'string' }, new_time: { type: 'string' }, new_party_size: { type: 'number' } }, required: ['tenant_id'] } }, response_timeout_secs: 10 },
    { type: 'webhook', name: 'add_to_waitlist', description: 'Lista de espera.', api_schema: { url: APP_URL + '/api/agent/add-to-waitlist', method: 'POST', request_headers: reqHeaders, request_body_schema: { type: 'object', properties: { tenant_id: { type: 'string', enum: [tenantId] }, customer_name: { type: 'string' }, customer_phone: { type: 'string' }, date: { type: 'string' }, time: { type: 'string' }, party_size: { type: 'number' } }, required: ['tenant_id', 'customer_name', 'date'] } }, response_timeout_secs: 10 },
    { type: 'webhook', name: 'update_order', description: 'Crea o actualiza pedido.', api_schema: { url: APP_URL + '/api/agent/update-order', method: 'POST', request_headers: reqHeaders, request_body_schema: { type: 'object', properties: { tenant_id: { type: 'string', enum: [tenantId] }, order_id: { type: 'string' }, customer_name: { type: 'string' }, customer_phone: { type: 'string' }, items: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, quantity: { type: 'number' }, price: { type: 'number' } } } }, order_type: { type: 'string', enum: ['recoger', 'domicilio', 'mesa'] }, pickup_time: { type: 'string' }, notes: { type: 'string' }, action: { type: 'string', enum: ['confirm', 'cancel'] } }, required: ['tenant_id', 'customer_name'] } }, response_timeout_secs: 10 },
  ];

  const body = {
    conversation_config: {
      agent: {
        first_message: firstMessage,
        language: 'es',
        prompt: { prompt },
        tools,
        dynamic_variables: {
          dynamic_variable_placeholders: {
            current_date: 'fecha actual',
            caller_phone: '',
            customer_context: '',
            business_name: tenant.name,
            agent_name: tenant.agent_name || 'Sofia',
            business_info: '',
            tenant_id: tenantId,
            business_personality: '',
          }
        },
      },
      asr: { quality: 'high', provider: 'elevenlabs', language: 'multi', keywords: ['reserva', 'reservar', 'mesa', 'cita', 'personas', 'hora', 'cancelar', 'pedido', 'terraza', 'interior', 'reservation', 'booking', 'table', 'appointment', 'cancel', 'people'] },
      turn: { mode: 'turn', turn_timeout: idealTurnTimeout, silence_end_call_timeout: 15, turn_eagerness: 'high', speculative_turn: true, interruption_sensitivity: 0.9 },
      tts: { model_id: 'eleven_v3_conversational', voice_id: voiceConfig.voice_id, stability: voiceConfig.stability, similarity_boost: voiceConfig.similarity_boost, optimize_streaming_latency: 4, speed: idealSpeed, expressive_mode: true },
    },
    platform_settings: { webhooks: { post_call_webhook_url: APP_URL + '/api/voice/post-call', post_call_webhook_events: ['transcript'] } },
  };

  const res = await fetch('https://api.elevenlabs.io/v1/convai/agents/' + agentId, {
    method: 'PATCH',
    headers: { 'xi-api-key': EL_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (res.ok) {
    console.log('  => ACTUALIZADO');
    return true;
  } else {
    const err = await res.text();
    console.error('  => ERROR:', res.status, err.substring(0, 300));
    return false;
  }
}

async function main() {
  const { data: tenants } = await sb.from('tenants')
    .select('id, name, type, el_agent_id')
    .not('el_agent_id', 'is', null);

  if (!tenants || tenants.length === 0) {
    console.log('No hay tenants con agente ElevenLabs');
    return;
  }

  console.log('Reprovisionando', tenants.length, 'agente(s)...\n');
  for (const t of tenants) {
    console.log(t.name, '(' + t.type + ')');
    await reprovision(t.id, t.el_agent_id);
    console.log('');
  }
  console.log('Hecho.');
}

main().catch(e => { console.error(e); process.exit(1); });
