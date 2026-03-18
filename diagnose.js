const BASE = 'https://restaurante-ai.vercel.app';
const SB   = 'https://phrfucpinxxcsgxgbcno.supabase.co';
const KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBocmZ1Y3Bpbnh4Y3NneGdiY25vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzUyOTc4NCwiZXhwIjoyMDg5MTA1Nzg0fQ.YX_KXTsRitrRKZqLdIUb9bZ0F-j49tf1SQmIxVjlkEQ';
const h    = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };

async function main() {
  // 1. Verificar agent_phone del tenant demo
  const r1 = await fetch(SB+'/rest/v1/tenants?id=eq.7be3fb2c-6da4-4129-a49d-3af1c2c45b77&select=agent_phone,name,plan', { headers: h });
  const t = await r1.json();
  console.log('Tenant agent_phone:', t[0]?.agent_phone, '| name:', t[0]?.name, '| plan:', t[0]?.plan);

  // 2. Llamada directa al context endpoint y ver respuesta completa
  const r2 = await fetch(BASE+'/api/voice/context', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ phone_call:{ agent_number:'+12138753573', external_number:'+34611000001' }, conversation_id:'DIAG_001' })
  });
  const d2 = await r2.json();
  console.log('Context response:', JSON.stringify(d2).slice(0,500));

  // 3. Verificar si el build nuevo está activo (endpoint /api/voice/session debe existir)
  const r3 = await fetch(BASE+'/api/voice/session', { method:'GET' });
  console.log('Session endpoint status:', r3.status, await r3.json().then(d=>d.status||'?'));

  // 4. Verificar si la sesión DIAG_001 fue creada en DB
  await new Promise(r=>setTimeout(r,2000));
  const r4 = await fetch(SB+'/rest/v1/calls?call_sid=eq.DIAG_001&select=call_sid,status,session_state,caller_phone', { headers: h });
  const rows4 = await r4.json();
  console.log('Session in DB:', JSON.stringify(rows4));

  // 5. Cleanup
  await fetch(SB+'/rest/v1/calls?call_sid=eq.DIAG_001', { method:'DELETE', headers: h });
}
main().catch(e=>console.error('DIAG ERR:', e.message));
