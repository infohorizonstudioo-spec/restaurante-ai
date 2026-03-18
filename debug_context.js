const BASE = 'https://restaurante-ai.vercel.app';
const SB = 'https://phrfucpinxxcsgxgbcno.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBocmZ1Y3Bpbnh4Y3NneGdiY25vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzUyOTc4NCwiZXhwIjoyMDg5MTA1Nzg0fQ.YX_KXTsRitrRKZqLdIUb9bZ0F-j49tf1SQmIxVjlkEQ';
const h = { apikey: KEY, Authorization: 'Bearer '+KEY };

async function main() {
  // 1. Ver agent_phone del tenant en DB
  const tr = await fetch(SB+'/rest/v1/tenants?id=eq.7be3fb2c-6da4-4129-a49d-3af1c2c45b77&select=id,name,agent_phone,plan', { headers: h });
  const t = await tr.json();
  console.log('Tenant agent_phone:', JSON.stringify(t[0]?.agent_phone), '| plan:', t[0]?.plan);

  // 2. Test directo del contexto con el número del agente
  const r = await fetch(BASE+'/api/voice/context', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone_call: {
        agent_number: '+12138753573',
        external_number: '+34619781190'
      }
    })
  });
  const d = await r.json();
  console.log('Context response status:', r.status);
  console.log('tenant_id:', d.dynamic_variables?.tenant_id?.slice(0,8)||'VACIO');
  console.log('business_name:', d.dynamic_variables?.business_name);
  console.log('caller_phone:', d.dynamic_variables?.caller_phone);
  console.log('Full response:', JSON.stringify(d).slice(0,300));
}
main().catch(e => console.error(e.message));
