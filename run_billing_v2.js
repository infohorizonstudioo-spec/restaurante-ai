const fs  = require('fs');
const PAT = fs.readFileSync('C:/Users/krush/.supabase/access-token','utf8').trim();
const sql_content = fs.readFileSync('./migrations/billing_v2.sql','utf8');
const run = (q) => fetch('https://api.supabase.com/v1/projects/phrfucpinxxcsgxgbcno/database/query', {
  method:'POST', headers:{ Authorization:'Bearer '+PAT, 'Content-Type':'application/json' },
  body: JSON.stringify({ query: q })
}).then(r=>r.json());
async function main() {
  console.log('Running billing_v2.sql...');
  const r = await run(sql_content);
  if (Array.isArray(r) && r.length===0) console.log('Migration OK');
  else console.log('Result:', JSON.stringify(r).slice(0,300));
  // Verify
  const fns = await run(`SELECT proname FROM pg_proc WHERE proname IN ('process_billable_call','get_plan_usage','reset_billing_cycle') ORDER BY proname`);
  console.log('RPCs:', fns.map(f=>f.proname).join(', '));
}
main().catch(e=>console.error(e.message));
