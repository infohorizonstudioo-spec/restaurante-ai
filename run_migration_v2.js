const fs  = require('fs');
const PAT = fs.readFileSync('C:/Users/krush/.supabase/access-token','utf8').trim();
const sql_content = fs.readFileSync('./migrations/postcall_v2.sql','utf8');

const run = (q) => fetch('https://api.supabase.com/v1/projects/phrfucpinxxcsgxgbcno/database/query', {
  method:'POST', headers:{ Authorization:'Bearer '+PAT, 'Content-Type':'application/json' },
  body: JSON.stringify({ query: q })
}).then(r=>r.json());

async function main() {
  console.log('Running migration postcall_v2.sql...');
  const r = await run(sql_content);
  if (Array.isArray(r) && r.length === 0) {
    console.log('Migration OK (empty result = success for DDL)');
  } else if (r.message) {
    console.error('Migration ERROR:', r.message);
  } else {
    console.log('Migration result:', JSON.stringify(r).slice(0,200));
  }

  // Verify
  const cols = await run(`SELECT column_name FROM information_schema.columns WHERE table_name='calls' AND column_name IN ('action_required','session_state','transcript') ORDER BY column_name`);
  console.log('Columns verified:', cols.map(c=>c.column_name).join(', '));

  const fns = await run(`SELECT proname FROM pg_proc WHERE proname IN ('complete_call_session','get_daily_metrics','get_active_calls','upsert_call_session') ORDER BY proname`);
  console.log('RPCs verified:', fns.map(f=>f.proname).join(', '));
}
main().catch(e=>console.error(e.message));
