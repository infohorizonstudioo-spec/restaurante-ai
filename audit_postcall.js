const SB  = 'https://phrfucpinxxcsgxgbcno.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBocmZ1Y3Bpbnh4Y3NneGdiY25vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzUyOTc4NCwiZXhwIjoyMDg5MTA1Nzg0fQ.YX_KXTsRitrRKZqLdIUb9bZ0F-j49tf1SQmIxVjlkEQ';
const PAT = require('fs').readFileSync('C:/Users/krush/.supabase/access-token','utf8').trim();
const h   = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
const sql = (q) => fetch('https://api.supabase.com/v1/projects/phrfucpinxxcsgxgbcno/database/query', {
  method:'POST', headers:{ Authorization:'Bearer '+PAT, 'Content-Type':'application/json' },
  body: JSON.stringify({ query: q })
}).then(r=>r.json());

async function main() {
  // 1. Columnas de calls
  const cols = await sql(`SELECT column_name, data_type, column_default, is_nullable 
    FROM information_schema.columns WHERE table_name='calls' ORDER BY ordinal_position`);
  console.log('=== CALLS COLUMNS ===');
  cols.forEach(c => console.log(c.column_name, '|', c.data_type, '|', c.is_nullable, '|', c.column_default?.slice(0,30)||''));

  // 2. Llamadas reales en DB con sus campos clave
  const r2 = await fetch(SB+'/rest/v1/calls?order=started_at.desc&limit=3&select=call_sid,status,session_state,intent,summary,action_suggested,customer_name,duration_seconds,transcript', { headers:h });
  const calls = await r2.json();
  console.log('\n=== LAST 3 CALLS ===');
  calls.forEach(c => {
    console.log('sid:', c.call_sid?.slice(0,15), '| status:', c.status, '| intent:', c.intent, '| summary:', c.summary?.slice(0,60)||'NULL', '| action:', c.action_suggested?.slice(0,40)||'NULL', '| customer:', c.customer_name||'NULL', '| dur:', c.duration_seconds, '| transcript_len:', c.transcript?.length||0);
  });

  // 3. Verificar si existe action_required
  const hasAR = cols.find(c => c.column_name === 'action_required');
  console.log('\naction_required column exists?', !!hasAR);

  // 4. Contar llamadas hoy con resumen vs sin resumen
  const today = new Date().toISOString().slice(0,10);
  const r4 = await fetch(SB+`/rest/v1/calls?started_at=gte.${today}T00:00:00&select=id,summary,intent,status`, { headers:h });
  const todayCalls = await r4.json();
  console.log('\n=== TODAY CALLS ===');
  console.log('total:', todayCalls.length);
  console.log('with summary:', todayCalls.filter(c=>c.summary&&c.summary!=='Llamada breve'&&c.summary!=='Llamada procesada').length);
  console.log('without useful summary:', todayCalls.filter(c=>!c.summary||c.summary==='Llamada breve'||c.summary==='Llamada procesada').length);
  console.log('with intent:', todayCalls.filter(c=>c.intent&&c.intent!=='consulta').length);
  console.log('completed:', todayCalls.filter(c=>c.status==='completada').length);
  console.log('active:', todayCalls.filter(c=>c.status==='activa').length);
}
main().catch(e => console.error(e.message));
