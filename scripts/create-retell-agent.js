const RETELL_KEY = 'key_9e00bdb1fce028e5f33fc877ce4e';
const APP_URL = 'https://restaurante-ai.vercel.app';
const LLM_ID = 'llm_1c0046ec63c3c33e89b4e90d4e61';

async function run() {
  console.log('Creating new Retell agent...');
  const res = await fetch('https://api.retellai.com/create-agent', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + RETELL_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agent_name: 'Reservo Universal v2',
      response_engine: { type: 'retell-llm', llm_id: LLM_ID },
      voice_id: '11labs-Gaby',
      fallback_voice_ids: ['cartesia-Isabel', 'openai-Santiago'],
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
      post_call_analysis_model: 'gpt-5.4',
      data_storage_setting: 'everything',
      opt_in_signed_url: false
    })
  });
  const data = await res.json();
  
  if (data.agent_id) {
    console.log('');
    console.log('NEW AGENT CREATED!');
    console.log('  Agent ID:   ' + data.agent_id);
    console.log('  LLM ID:     ' + LLM_ID);
    console.log('  Voice:      ' + data.voice_id);
    console.log('  Language:   ' + data.language);
    console.log('  Webhook:    ' + data.webhook_url);
  } else {
    console.log('FAILED:', JSON.stringify(data));
  }
}

run().catch(e => console.error('Error:', e));
