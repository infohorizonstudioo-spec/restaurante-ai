const https = require('https');

function req(method, url, data, extraHeaders = {}) {
  return new Promise((res, rej) => {
    const u = new URL(url);
    const body = data ? (typeof data === 'string' ? data : JSON.stringify(data)) : null;
    const opts = {
      hostname: u.hostname, path: u.pathname + u.search, method,
      headers: { 'Content-Type': 'application/json', ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}), ...extraHeaders }
    };
    const r = https.request(opts, resp => {
      let d = ''; resp.on('data', c => d += c);
      resp.on('end', () => { try { res({ status: resp.statusCode, body: JSON.parse(d) }) } catch { res({ status: resp.statusCode, body: d.slice(0, 200) }) } });
    });
    r.on('error', rej); if (body) r.write(body); r.end();
  });
}

const SB  = 'https://phrfucpinxxcsgxgbcno.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBocmZ1Y3Bpbnh4Y3NneGdiY25vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzUyOTc4NCwiZXhwIjoyMDg5MTA1Nzg0fQ.YX_KXTsRitrRKZqLdIUb9bZ0F-j49tf1SQmIxVjlkEQ';
const SBH = { apikey: KEY, Authorization: 'Bearer ' + KEY };
const TID = '7be3fb2c-6da4-4129-a49d-3af1c2c45b77';

(async () => {
  // 1. Borrar calls de test y ctx_ huérfanas
  const d1 = await req('DELETE', SB + '/rest/v1/calls?call_sid=like.ctx_%&tenant_id=eq.' + TID, null, SBH);
  const d2 = await req('DELETE', SB + '/rest/v1/calls?call_sid=like.CAhc%&tenant_id=eq.' + TID, null, SBH);
  const d3 = await req('DELETE', SB + '/rest/v1/calls?call_sid=like.CAtest%&tenant_id=eq.' + TID, null, SBH);
  console.log('CLEANUP calls ctx_:', d1.status, '| CAhc:', d2.status, '| CAtest:', d3.status);

  // 2. Resetear billing del tenant demo (no es cliente real)
  const r2 = await req('PATCH', SB + '/rest/v1/tenants?id=eq.' + TID, {
    subscription_status: 'active',
    plan_calls_used: 0,
    extra_calls: 0,
    free_calls_used: 0,
  }, { ...SBH, Prefer: 'return=minimal' });
  console.log('TENANT RESET billing:', r2.status);

  // 3. Verificar estado final
  const t = await req('GET', SB + '/rest/v1/tenants?id=eq.' + TID + '&select=name,plan,subscription_status,plan_calls_used,agent_phone,agent_name', null, SBH);
  console.log('TENANT FINAL:', JSON.stringify(t.body?.[0]));

  const calls = await req('GET', SB + '/rest/v1/calls?tenant_id=eq.' + TID + '&order=started_at.desc&limit=5&select=call_sid,status,intent,duration_seconds', null, SBH);
  console.log('CALLS REMAINING (' + calls.body?.length + '):');
  (calls.body || []).forEach(c => console.log('  -', c.call_sid?.slice(0, 25), c.status, c.intent || '?', c.duration_seconds + 's'));

  console.log('\n=== CLEANUP COMPLETO ===');
})().catch(e => console.error('ERROR:', e.message));
