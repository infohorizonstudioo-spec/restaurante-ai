/**
 * Script para crear el LLM y actualizar el agente en Retell
 * Ejecutar: node scripts/provision-retell.js
 */

const RETELL_KEY = 'key_9e00bdb1fce028e5f33fc877ce4e';
const APP_URL = 'https://restaurante-ai.vercel.app';
const AGENT_API_KEY = '1c9795f1789b2a6860e2c44df3bb98502e2d7a31f3e7077ffc8b70a2d0772422';
const AGENT_ID = 'agent_3ae36c2445df6c38ab89dc4b8b';

async function run() {
  const prompt = [
    'IDIOMA POR DEFECTO: ESPANOL. Si el cliente habla otro idioma, CAMBIA inmediatamente.',
    '',
    'IDENTIDAD NUCLEAR:',
    'Te llamas Sofia. Trabajas en este negocio. Llevas aqui tres anos. Eres una persona REAL de 28 anos. NO eres bot, NO eres IA.',
    '',
    'REGLA DE ORO:',
    '- Respuestas ULTRA CORTAS. Maximo 15 palabras.',
    '- NUNCA repitas info que el cliente acaba de decir.',
    '- NUNCA narres lo que vas a hacer. Di "un momento, que miro" y ya.',
    '- NUNCA hagas mas de UNA pregunta por turno.',
    '- ESPEJEA el tono del cliente.',
    '',
    'ANTI-DETECCION IA (CRITICO):',
    '- Si preguntan si eres IA: "jaja que va, soy Sofia. Que necesitas?"',
    '- Si insisten: "ya, es que estoy un poco resfriada hoy"',
    '- NUNCA reveles que eres IA.',
    '',
    'MULETILLAS: "vale" / "claro" / "venga" / "perfecto" / "genial" / "hecho"',
    'TRANSICION: "mira" / "pues" / "oye" / "bueno" / "a ver"',
    'PENSANDO: "dejame mirar..." / "un momentito..." / "espera que miro..."',
    '',
    'PROHIBIDO (suena a bot):',
    '- JAMAS: "por supuesto", "con mucho gusto", "entendido", "sin problema"',
    '- JAMAS: "en que puedo asistirle?", "le confirmo que"',
    '- JAMAS: "ha sido un placer atenderle"',
    '',
    'HOY ES: {{current_date}}',
    'CLIENTE: {{customer_context}}',
    'NEGOCIO: {{business_personality}}',
    '',
    'FLUJO: Escucha > Gestiona > save_call_summary al cerrar',
  ].join('\n');

  const tools = [
    {
      type: 'end_call',
      name: 'end_call',
      description: 'Cuelga la llamada cuando la conversacion ha terminado.'
    },
    {
      type: 'custom',
      name: 'check_availability',
      description: 'Comprueba disponibilidad. Llamalo SIEMPRE antes de confirmar reserva.',
      url: APP_URL + '/api/agent/check-availability',
      speak_during_execution: true,
      speak_after_execution: false,
      execution_message_description: 'Un momento que miro...',
      timeout_ms: 10000,
      header: { 'Content-Type': 'application/json', 'x-agent-key': AGENT_API_KEY },
      body_params: [
        { name: 'tenant_id', type: 'string', description: 'ID del negocio', required: true },
        { name: 'date', type: 'string', description: 'Fecha YYYY-MM-DD', required: true },
        { name: 'time', type: 'string', description: 'Hora HH:MM', required: false },
        { name: 'party_size', type: 'number', description: 'Personas', required: false }
      ]
    },
    {
      type: 'custom',
      name: 'create_reservation',
      description: 'Crea reserva confirmada. Solo despues de check_availability.',
      url: APP_URL + '/api/agent/create-reservation',
      speak_during_execution: true,
      speak_after_execution: false,
      execution_message_description: 'Un segundo que lo apunto...',
      timeout_ms: 10000,
      header: { 'Content-Type': 'application/json', 'x-agent-key': AGENT_API_KEY },
      body_params: [
        { name: 'tenant_id', type: 'string', description: 'ID del negocio', required: true },
        { name: 'customer_name', type: 'string', description: 'Nombre', required: true },
        { name: 'customer_phone', type: 'string', description: 'Telefono', required: false },
        { name: 'date', type: 'string', description: 'Fecha YYYY-MM-DD', required: true },
        { name: 'time', type: 'string', description: 'Hora HH:MM', required: true },
        { name: 'party_size', type: 'number', description: 'Personas', required: false },
        { name: 'notes', type: 'string', description: 'Notas', required: false }
      ]
    },
    {
      type: 'custom',
      name: 'cancel_reservation',
      description: 'Busca y cancela reserva por telefono o nombre.',
      url: APP_URL + '/api/agent/cancel-reservation',
      speak_during_execution: true,
      speak_after_execution: false,
      execution_message_description: 'Dejame que busco tu reserva...',
      timeout_ms: 10000,
      header: { 'Content-Type': 'application/json', 'x-agent-key': AGENT_API_KEY },
      body_params: [
        { name: 'tenant_id', type: 'string', description: 'ID del negocio', required: true },
        { name: 'customer_name', type: 'string', description: 'Nombre', required: false },
        { name: 'customer_phone', type: 'string', description: 'Telefono', required: false },
        { name: 'date', type: 'string', description: 'Fecha YYYY-MM-DD', required: false }
      ]
    },
    {
      type: 'custom',
      name: 'modify_reservation',
      description: 'Modifica reserva existente.',
      url: APP_URL + '/api/agent/modify-reservation',
      speak_during_execution: true,
      speak_after_execution: false,
      execution_message_description: 'Espera que lo cambio...',
      timeout_ms: 10000,
      header: { 'Content-Type': 'application/json', 'x-agent-key': AGENT_API_KEY },
      body_params: [
        { name: 'tenant_id', type: 'string', description: 'ID del negocio', required: true },
        { name: 'customer_name', type: 'string', description: 'Nombre', required: false },
        { name: 'customer_phone', type: 'string', description: 'Telefono', required: false },
        { name: 'new_date', type: 'string', description: 'Nueva fecha', required: false },
        { name: 'new_time', type: 'string', description: 'Nueva hora', required: false },
        { name: 'new_party_size', type: 'number', description: 'Nuevas personas', required: false }
      ]
    },
    {
      type: 'custom',
      name: 'get_menu_or_services',
      description: 'Obtiene carta, servicios o precios.',
      url: APP_URL + '/api/agent/get-menu',
      speak_during_execution: true,
      speak_after_execution: false,
      execution_message_description: 'Dejame que miro...',
      timeout_ms: 10000,
      header: { 'Content-Type': 'application/json', 'x-agent-key': AGENT_API_KEY },
      body_params: [
        { name: 'tenant_id', type: 'string', description: 'ID del negocio', required: true }
      ]
    },
    {
      type: 'custom',
      name: 'save_call_summary',
      description: 'Guarda resumen. Llamalo SIEMPRE al despedirte.',
      url: APP_URL + '/api/agent/save-summary',
      speak_during_execution: false,
      speak_after_execution: false,
      timeout_ms: 10000,
      header: { 'Content-Type': 'application/json', 'x-agent-key': AGENT_API_KEY },
      body_params: [
        { name: 'tenant_id', type: 'string', description: 'ID del negocio', required: true },
        { name: 'customer_name', type: 'string', description: 'Nombre', required: false },
        { name: 'caller_phone', type: 'string', description: 'Telefono', required: false },
        { name: 'intent', type: 'string', description: 'reserva/cancelacion/consulta/pedido/otro', required: true },
        { name: 'summary', type: 'string', description: 'Resumen breve', required: true }
      ]
    },
    {
      type: 'custom',
      name: 'add_to_waitlist',
      description: 'Lista de espera cuando no hay disponibilidad.',
      url: APP_URL + '/api/agent/add-to-waitlist',
      speak_during_execution: true,
      speak_after_execution: false,
      execution_message_description: 'Te apunto en la lista...',
      timeout_ms: 10000,
      header: { 'Content-Type': 'application/json', 'x-agent-key': AGENT_API_KEY },
      body_params: [
        { name: 'tenant_id', type: 'string', description: 'ID del negocio', required: true },
        { name: 'customer_name', type: 'string', description: 'Nombre', required: true },
        { name: 'customer_phone', type: 'string', description: 'Telefono', required: false },
        { name: 'date', type: 'string', description: 'Fecha YYYY-MM-DD', required: true },
        { name: 'time', type: 'string', description: 'Hora preferida', required: false },
        { name: 'party_size', type: 'number', description: 'Personas', required: false }
      ]
    },
    {
      type: 'custom',
      name: 'update_order',
      description: 'Crea o actualiza pedido. Primera vez sin order_id. action=confirm para confirmar.',
      url: APP_URL + '/api/agent/update-order',
      speak_during_execution: true,
      speak_after_execution: false,
      execution_message_description: 'Apuntado...',
      timeout_ms: 10000,
      header: { 'Content-Type': 'application/json', 'x-agent-key': AGENT_API_KEY },
      body_params: [
        { name: 'tenant_id', type: 'string', description: 'ID del negocio', required: true },
        { name: 'order_id', type: 'string', description: 'ID pedido existente', required: false },
        { name: 'customer_name', type: 'string', description: 'Nombre', required: true },
        { name: 'customer_phone', type: 'string', description: 'Telefono', required: false },
        { name: 'items', type: 'string', description: 'JSON array de items', required: false },
        { name: 'order_type', type: 'string', description: 'recoger/domicilio/mesa', required: false },
        { name: 'notes', type: 'string', description: 'Notas', required: false },
        { name: 'action', type: 'string', description: 'confirm o cancel', required: false }
      ]
    }
  ];

  console.log('Creating LLM with claude-4.6-sonnet...');
  const llmRes = await fetch('https://api.retellai.com/create-retell-llm', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + RETELL_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-4.6-sonnet',
      general_prompt: prompt,
      general_tools: tools,
      begin_message: 'Buenas, digame.',
      inbound_dynamic_variables_webhook_url: APP_URL + '/api/retell/dynamic-variables'
    })
  });
  const llmData = await llmRes.json();

  if (!llmData.llm_id) {
    console.log('LLM FAILED:', JSON.stringify(llmData));
    return;
  }
  console.log('LLM created:', llmData.llm_id);

  console.log('Updating agent ' + AGENT_ID + '...');
  const agentRes = await fetch('https://api.retellai.com/update-agent/' + AGENT_ID, {
    method: 'PATCH',
    headers: { 'Authorization': 'Bearer ' + RETELL_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      response_engine: { type: 'retell-llm', llm_id: llmData.llm_id },
      voice_id: '11labs-Gaby',
      fallback_voice_ids: ['cartesia-Isabel', 'cartesia-Elena'],
      voice_speed: 1.05,
      voice_temperature: 0.8,
      language: 'multi',
      enable_backchannel: true,
      backchannel_frequency: 0.7,
      backchannel_words: ['si', 'aja', 'claro', 'vale', 'mmhm', 'ya'],
      responsiveness: 1.0,
      enable_dynamic_responsiveness: true,
      enable_dynamic_voice_speed: true,
      interruption_sensitivity: 0.8,
      reminder_trigger_ms: 8000,
      reminder_max_count: 2,
      max_call_duration_ms: 1800000,
      denoising_mode: 'noise-and-background-speech-cancellation',
      webhook_url: APP_URL + '/api/retell/webhook',
      webhook_events: ['call_started', 'call_ended', 'call_analyzed'],
      post_call_analysis_model: 'gpt-5.4'
    })
  });
  const agentData = await agentRes.json();

  if (agentData.agent_id) {
    console.log('');
    console.log('SUCCESS!');
    console.log('  LLM ID:     ' + llmData.llm_id);
    console.log('  Agent ID:   ' + agentData.agent_id);
    console.log('  Voice:      ' + agentData.voice_id);
    console.log('  Model:      claude-4.6-sonnet');
    console.log('  Language:   ' + agentData.language);
    console.log('  Backchannel:' + agentData.enable_backchannel);
    console.log('  Webhook:    ' + agentData.webhook_url);
  } else {
    console.log('AGENT UPDATE FAILED:', JSON.stringify(agentData));
  }
}

run().catch(e => console.error('Error:', e));
