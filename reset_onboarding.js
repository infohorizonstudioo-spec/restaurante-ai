const SB  = 'https://phrfucpinxxcsgxgbcno.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBocmZ1Y3Bpbnh4Y3NneGdiY25vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzUyOTc4NCwiZXhwIjoyMDg5MTA1Nzg0fQ.YX_KXTsRitrRKZqLdIUb9bZ0F-j49tf1SQmIxVjlkEQ';
const h   = { apikey:KEY, Authorization:'Bearer '+KEY, 'Content-Type':'application/json' };

fetch(SB+'/rest/v1/tenants?id=eq.7be3fb2c-6da4-4129-a49d-3af1c2c45b77', {
  method:'PATCH', headers:h,
  body: JSON.stringify({ onboarding_complete:false, onboarding_step:1 })
}).then(r=>r.text()).then(d=>console.log('RESET:', d)).catch(e=>console.error(e.message));
