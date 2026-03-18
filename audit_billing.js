const fs  = require('fs');
const SB  = 'https://phrfucpinxxcsgxgbcno.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBocmZ1Y3Bpbnh4Y3NneGdiY25vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzUyOTc4NCwiZXhwIjoyMDg5MTA1Nzg0fQ.YX_KXTsRitrRKZqLdIUb9bZ0F-j49tf1SQmIxVjlkEQ';
const PAT = fs.readFileSync('C:/Users/krush/.supabase/access-token','utf8').trim();
const TID = '7be3fb2c-6da4-4129-a49d-3af1c2c45b77';
const h   = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
const sql = (q) => fetch('https://api.supabase.com/v1/projects/phrfucpinxxcsgxgbcno/database/query', {
  method:'POST', headers:{ Authorization:'Bearer '+PAT, 'Content-Type':'application/json' },
  body: JSON.stringify({ query: q })
}).then(r=>r.json());
const rpc = (fn,b) => fetch(SB+'/rest/v1/rpc/'+fn,{method:'POST',headers:h,body:JSON.stringify(b)}).then(r=>r.json());

async function main() {
  // 1. Columnas de tenants relacionadas con billing
  const tenantCols = await sql(`SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name='tenants' AND column_name IN ('plan','plan_calls_included','plan_calls_used','plan_extra_rate','plan_period_start','free_calls_used','free_calls_limit','billing_cycle_start','billing_cycle_end','extra_calls','next_plan','trial_abused','subscription_status','stripe_subscription_id','stripe_customer_id') ORDER BY column_name`);
  console.log('=== TENANT BILLING COLUMNS ===');
  tenantCols.forEach(c => console.log(c.column_name, '|', c.data_type, '|', c.column_default?.slice(0,30)||''));

  // 2. Estado actual del tenant demo
  const r2 = await fetch(SB+'/rest/v1/tenants?id=eq.'+TID+'&select=plan,plan_calls_included,plan_calls_used,plan_extra_rate,free_calls_used,free_calls_limit,billing_cycle_start,billing_cycle_end,extra_calls,subscription_status,trial_abused',{headers:h});
  const tenant = await r2.json();
  console.log('\n=== TENANT DEMO BILLING STATE ===');
  console.log(JSON.stringify(tenant[0], null, 2));

  // 3. RPC get_billing_summary
  const b = await rpc('get_billing_summary', {p_tenant_id: TID});
  console.log('\n=== get_billing_summary ===');
  console.log(JSON.stringify(b, null, 2));

  // 4. RPCs de billing existentes
  const rpcs = await sql(`SELECT proname, pronargs, proargnames FROM pg_proc WHERE proname IN ('get_billing_summary','process_billable_call','reset_billing_cycle','apply_plan_change','increment_plan_calls','increment_free_calls') ORDER BY proname`);
  console.log('\n=== BILLING RPCs ===');
  rpcs.forEach(r => console.log(r.proname, '| args:', r.proargnames?.join(', ')||'none'));

  // 5. Tabla billing_history — columnas
  const bhCols = await sql(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='billing_history' ORDER BY ordinal_position`);
  console.log('\n=== billing_history COLUMNS ===');
  bhCols.forEach(c => console.log(c.column_name, '|', c.data_type));

  // 6. ¿Hay registros en billing_history?
  const r6 = await fetch(SB+'/rest/v1/billing_history?tenant_id=eq.'+TID+'&select=*&limit=3',{headers:h});
  const bh = await r6.json();
  console.log('\n=== billing_history records:', bh.length, '===');
  if (bh.length > 0) console.log(JSON.stringify(bh[0]));
}
main().catch(e=>console.error(e.message));
