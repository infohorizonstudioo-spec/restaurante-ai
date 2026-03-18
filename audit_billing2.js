const fs  = require('fs');
const PAT = fs.readFileSync('C:/Users/krush/.supabase/access-token','utf8').trim();
const sql = (q) => fetch('https://api.supabase.com/v1/projects/phrfucpinxxcsgxgbcno/database/query', {
  method:'POST', headers:{ Authorization:'Bearer '+PAT, 'Content-Type':'application/json' },
  body: JSON.stringify({ query: q })
}).then(r=>r.json());

async function main() {
  const fns = ['process_billable_call','get_billing_summary','reset_billing_cycle','apply_plan_change','increment_plan_calls','increment_free_calls'];
  for (const fn of fns) {
    const r = await sql(`SELECT prosrc FROM pg_proc WHERE proname='${fn}' LIMIT 1`);
    console.log('\n════ '+fn+' ════');
    console.log(r[0]?.prosrc?.slice(0,800)||'NOT FOUND');
  }
}
main().catch(e=>console.error(e.message));
