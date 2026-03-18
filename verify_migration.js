const SB  = 'https://phrfucpinxxcsgxgbcno.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBocmZ1Y3Bpbnh4Y3NneGdiY25vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzUyOTc4NCwiZXhwIjoyMDg5MTA1Nzg0fQ.YX_KXTsRitrRKZqLdIUb9bZ0F-j49tf1SQmIxVjlkEQ';
const h   = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
const fs  = require('fs');
const PAT = fs.readFileSync('C:/Users/krush/.supabase/access-token','utf8').trim();

const rpc = (fn, body) => fetch(SB+'/rest/v1/rpc/'+fn, { method:'POST', headers:h, body:JSON.stringify(body) }).then(r=>r.json());
const sql = (q) => fetch('https://api.supabase.com/v1/projects/phrfucpinxxcsgxgbcno/database/query', {
  method:'POST', headers:{ Authorization:'Bearer '+PAT, 'Content-Type':'application/json' },
  body: JSON.stringify({ query: q })
}).then(r=>r.json());

async function main() {
  // 1. Verificar columna session_state
  const cols = await sql("SELECT column_name,data_type,column_default FROM information_schema.columns WHERE table_name='calls' AND column_name='session_state'");
  console.log('1. session_state column:', JSON.stringify(cols));

  // 2. Verificar indexes
  const idxs = await sql("SELECT indexname FROM pg_indexes WHERE tablename='calls' AND indexname LIKE 'idx_calls%'");
  console.log('2. indexes:', idxs.map(i=>i.indexname).join(', '));

  // 3. Verificar RPCs
  const fns = await sql("SELECT proname FROM pg_proc WHERE proname IN ('upsert_call_session','update_call_session_state','complete_call_session','get_active_calls','cleanup_stale_calls')");
  console.log('3. RPCs:', fns.map(f=>f.proname).join(', '));

  // 4. Test upsert_call_session con datos reales
  const TID = '7be3fb2c-6da4-4129-a49d-3af1c2c45b77';
  const testSid = 'TEST_CONC_' + Date.now();
  const r4 = await rpc('upsert_call_session', {
    p_call_sid: testSid, p_tenant_id: TID,
    p_caller_phone: '+34600000001', p_agent_phone: '+12138753573',
    p_session_state: 'iniciando'
  });
  console.log('4. upsert_call_session:', JSON.stringify(r4));

  // 5. Test update_call_session_state
  const r5 = await rpc('update_call_session_state', {
    p_call_sid: testSid, p_session_state: 'escuchando', p_tenant_id: TID
  });
  console.log('5. update_session_state:', JSON.stringify(r5));

  // 6. Test get_active_calls
  const r6 = await rpc('get_active_calls', { p_tenant_id: TID });
  console.log('6. active calls:', Array.isArray(r6) ? r6.length : JSON.stringify(r6));
  if (Array.isArray(r6) && r6.length > 0) {
    console.log('   sample:', JSON.stringify(r6[0]));
  }

  // 7. Limpiar test
  await fetch(SB+'/rest/v1/calls?call_sid=eq.'+testSid, { method:'DELETE', headers:h });
  console.log('7. cleanup done');
}
main().catch(e => console.error('ERR:', e.message));
