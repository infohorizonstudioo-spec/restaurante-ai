const fs  = require('fs');
const SB  = 'https://phrfucpinxxcsgxgbcno.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBocmZ1Y3Bpbnh4Y3NneGdiY25vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzUyOTc4NCwiZXhwIjoyMDg5MTA1Nzg0fQ.YX_KXTsRitrRKZqLdIUb9bZ0F-j49tf1SQmIxVjlkEQ';
const PAT = fs.existsSync('C:/Users/krush/.supabase/access-token')
  ? fs.readFileSync('C:/Users/krush/.supabase/access-token','utf8').trim() : '';

const h = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
const sql = fs.readFileSync('./migrations/concurrent_calls.sql', 'utf8');

// Split por sentencias individuales para enviar una por una
// Alternativamente, usar el endpoint de SQL de Supabase Management API
async function runSQL(query) {
  const r = await fetch('https://api.supabase.com/v1/projects/phrfucpinxxcsgxgbcno/database/query', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + PAT, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  const d = await r.json();
  if (r.status !== 200) throw new Error(JSON.stringify(d).slice(0,200));
  return d;
}

async function main() {
  console.log('PAT length:', PAT.length);
  if (!PAT) { console.error('No PAT found at ~/.supabase/access-token'); process.exit(1); }

  // Ejecutar en bloques separados para mayor control de errores
  const blocks = [
    // 1. Add column
    `ALTER TABLE calls ADD COLUMN IF NOT EXISTS session_state TEXT DEFAULT 'iniciando' CHECK (session_state IN ('iniciando','escuchando','procesando','respondiendo','esperando_datos','finalizando','completada','error'))`,
    // 2. Indexes
    `CREATE INDEX IF NOT EXISTS idx_calls_active ON calls (tenant_id, status, started_at DESC) WHERE status = 'activa'`,
    `CREATE INDEX IF NOT EXISTS idx_calls_session_state ON calls (tenant_id, session_state) WHERE session_state NOT IN ('completada','error')`,
    // 3. upsert_call_session - read from file
    ...sql.split('-- 3.').slice(0,1).map(()=> // placeholder - we'll extract manually below
      null
    ).filter(Boolean),
  ];

  // Run the full SQL directly
  console.log('Running migration...');
  const result = await runSQL(sql);
  console.log('Migration result:', JSON.stringify(result).slice(0,300));
}
main().catch(e => console.error('FAILED:', e.message));
