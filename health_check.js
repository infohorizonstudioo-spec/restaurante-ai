const https = require('https');

function post(url, data, extraHeaders = {}) {
  return new Promise((res, rej) => {
    const u = new URL(url);
    const body = typeof data === 'string' ? data : JSON.stringify(data);
    const isForm = typeof data === 'string';
    const opts = {
      hostname: u.hostname, path: u.pathname + u.search, method: 'POST',
      headers: { 'Content-Type': isForm ? 'application/x-www-form-urlencoded' : 'application/json',
        'Content-Length': Buffer.byteLength(body), ...extraHeaders }
    };
    const req = https.request(opts, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => { try { res({ status: r.statusCode, body: JSON.parse(d) }) } catch { res({ status: r.statusCode, body: d.slice(0, 200) }) } });
    });
    req.on('error', rej); req.write(body); req.end();
  });
}

function get(url, extraHeaders = {}) {
  return new Promise((res, rej) => {
    const u = new URL(url);
    https.get({ hostname: u.hostname, path: u.pathname + u.search, headers: extraHeaders }, r => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => { try { res({ status: r.statusCode, body: JSON.parse(d) }) } catch { res({ status: r.statusCode, body: d.slice(0, 200) }) } });
    }).on('error', rej);
  });
}

const BASE = 'https://restaurante-ai.vercel.app';
const SB   = 'https://phrfucpinxxcsgxgbcno.supabase.co';
const KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBocmZ1Y3Bpbnh4Y3NneGdiY25vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzUyOTc4NCwiZXhwIjoyMDg5MTA1Nzg0fQ.YX_KXTsRitrRKZqLdIUb9bZ0F-j49tf1SQmIxVjlkEQ';
const SBH  = { apikey: KEY, Authorization: 'Bearer ' + KEY };
const TID  = '7be3fb2c-6da4-4129-a49d-3af1c2c45b77';

(async () => {
  // 1. CONTEXT WEBHOOK
  const ctx = await post(BASE + '/api/voice/context', { phone_call: { agent_number: '+12138753573', external_number: '+34600000001' } });
  console.log('1 CTX:', ctx.status, '| biz:', ctx.body?.dynamic_variables?.business_name, '| tenant:', ctx.body?.dynamic_variables?.tenant_id?.slice(0, 8), '| first_msg:', ctx.body?.conversation_config_override?.agent?.first_message);

  // 2. AVAILABILITY
  const av = await post(BASE + '/api/voice/availability', { tenant_id: TID, date: '2026-04-01', time: '20:00', party_size: 2 });
  console.log('2 AVAIL:', av.status, '| available:', av.body?.available, '|', av.body?.message?.slice(0, 50));

  // 3. POST-CALL (Twilio format)
  const ts = 'CAhcfinal_' + Date.now();
  const pc = await post(BASE + '/api/voice/post-call', 
    'CallSid=' + ts + '&CallStatus=completed&CallDuration=42&From=%2B34619781190&To=%2B12138753573');
  console.log('3 POST-CALL:', pc.status, '| ok:', pc.body?.ok, '| intent:', pc.body?.intent, '| billed:', pc.body?.billed);

  // 4. BILLING
  const bill = await get(BASE + '/api/billing/summary?tenant_id=' + TID);
  console.log('4 BILLING:', bill.status, '| plan:', bill.body?.plan, '| used:', bill.body?.used_calls + '/' + bill.body?.included_calls);

  // 5. DB — últimas llamadas
  await new Promise(r => setTimeout(r, 2000));
  const calls = await get(SB + '/rest/v1/calls?tenant_id=eq.' + TID + '&order=started_at.desc&limit=5&select=call_sid,status,intent,summary,duration_seconds,counted_for_billing', SBH);
  console.log('5 CALLS (' + calls.body?.length + '):');
  (calls.body || []).forEach(c => console.log('  -', c.call_sid?.slice(0, 22), c.status, c.intent || '?', (c.summary || '').slice(0, 30), c.duration_seconds + 's', c.counted_for_billing ? 'BILLED' : ''));

  // 6. TENANT
  const tenant = await get(SB + '/rest/v1/tenants?id=eq.' + TID + '&select=name,plan,agent_phone,agent_name,plan_calls_used,subscription_status,free_calls_used', SBH);
  const t = tenant.body?.[0];
  console.log('6 TENANT:', t?.name, '| plan:', t?.plan, '| status:', t?.subscription_status, '| phone:', t?.agent_phone, '| agent:', t?.agent_name, '| calls_used:', t?.plan_calls_used);

  // 7. ElevenLabs agent
  const el = await get('https://api.us.elevenlabs.io/v1/convai/agents/agent_0701kkw2sdx5fp685xp6ckngf6zj', { 'xi-api-key': 'sk_0e8a74a121e33004d59cf4695d4abdd637d787ad9fabf21c' });
  const tts = el.body?.conversation_config?.tts;
  const turn = el.body?.conversation_config?.turn;
  const llm = el.body?.conversation_config?.agent?.prompt?.llm;
  const tools = (el.body?.conversation_config?.agent?.prompt?.tools || []).map(t => t.name).join(', ');
  const webhookOn = el.body?.platform_settings?.overrides?.enable_conversation_initiation_client_data_from_webhook;
  const ctxUrl = el.body?.platform_settings?.workspace_overrides?.conversation_initiation_client_data_webhook?.url;
  console.log('7 AGENT:', llm, '| stability:', tts?.stability, '| speed:', tts?.speed, '| turn:', turn?.turn_timeout + 's', '| latency:', tts?.optimize_streaming_latency);
  console.log('  TOOLS:', tools);
  console.log('  WEBHOOK_ON:', webhookOn, '| CTX_URL:', ctxUrl);

  console.log('\n=== HEALTH CHECK COMPLETO ===');
})().catch(e => console.error('ERROR:', e.message));
