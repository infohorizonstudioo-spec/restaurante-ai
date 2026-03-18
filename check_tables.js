const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBocmZ1Y3Bpbnh4Y3NneGdiY25vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzUyOTc4NCwiZXhwIjoyMDg5MTA1Nzg0fQ.YX_KXTsRitrRKZqLdIUb9bZ0F-j49tf1SQmIxVjlkEQ';
const TID = '7be3fb2c-6da4-4129-a49d-3af1c2c45b77';
const SB = 'https://phrfucpinxxcsgxgbcno.supabase.co';
const h = { apikey: KEY, Authorization: 'Bearer '+KEY };

async function main() {
  const tr = await fetch(SB+'/rest/v1/tables?tenant_id=eq.'+TID+'&select=id,number,capacity,zone_id', { headers: h });
  const tables = await tr.json();
  console.log('MESAS:', tables.length, JSON.stringify(tables).slice(0,400));

  const zr = await fetch(SB+'/rest/v1/zones?tenant_id=eq.'+TID+'&select=id,name,active', { headers: h });
  const zones = await zr.json();
  console.log('ZONAS:', zones.length, JSON.stringify(zones));
}
main().catch(e => console.error(e.message));
