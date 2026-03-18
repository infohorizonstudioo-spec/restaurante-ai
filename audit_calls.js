const SB  = 'https://phrfucpinxxcsgxgbcno.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBocmZ1Y3Bpbnh4Y3NneGdiY25vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzUyOTc4NCwiZXhwIjoyMDg5MTA1Nzg0fQ.YX_KXTsRitrRKZqLdIUb9bZ0F-j49tf1SQmIxVjlkEQ';
const h   = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };

async function main() {
  // 1. Columnas actuales de calls
  const r1 = await fetch(SB + '/rest/v1/calls?limit=1', { headers: h });
  const rows = await r1.json();
  console.log('Columnas calls:', Object.keys(rows[0] || {}).join(', '));

  // 2. ¿Existe session_state?
  const r2 = await fetch(SB + '/rest/v1/calls?select=id,status,session_state&limit=3', { headers: h });
  const rows2 = await r2.json();
  console.log('session_state exists?', !rows2[0] || 'session_state' in rows2[0]);
  console.log('sample:', JSON.stringify(rows2[0]));

  // 3. Ver RPCs disponibles (upsert_call_session)
  const r3 = await fetch(SB + '/rest/v1/rpc/upsert_call_session', {
    method: 'POST', headers: h,
    body: JSON.stringify({ p_call_sid: 'TEST', p_tenant_id: 'TEST', p_caller_phone: '', p_agent_phone: '' })
  });
  console.log('upsert_call_session status:', r3.status, await r3.text().then(t => t.slice(0, 100)));

  // 4. Ver llamadas activas ahora mismo
  const r4 = await fetch(SB + '/rest/v1/calls?status=eq.activa&select=id,call_sid,status,started_at&limit=5', { headers: h });
  const active = await r4.json();
  console.log('Active calls now:', active.length, active.map(c => c.call_sid?.slice(0,12)).join(', '));
}
main().catch(e => console.error('ERR:', e.message));
