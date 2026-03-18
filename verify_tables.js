// Verificar que las 5 reservas del test tienen table_id únicos en DB
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBocmZ1Y3Bpbnh4Y3NneGdiY25vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzUyOTc4NCwiZXhwIjoyMDg5MTA1Nzg0fQ.YX_KXTsRitrRKZqLdIUb9bZ0F-j49tf1SQmIxVjlkEQ';
const TID = '7be3fb2c-6da4-4129-a49d-3af1c2c45b77';
const SB = 'https://phrfucpinxxcsgxgbcno.supabase.co';
const h = { apikey: KEY, Authorization: 'Bearer '+KEY };

async function main() {
  // Reservas de test de hoy para la fecha 2026-04-15 21:00
  const r = await fetch(
    SB+'/rest/v1/reservations?tenant_id=eq.'+TID+
    '&date=eq.2026-04-15&time=eq.21%3A00%3A00&select=id,customer_name,table_id,zone_id,zone,status',
    { headers: h }
  );
  const rows = await r.json();
  console.log('\n=== Reservas en DB para 2026-04-15 21:00 ===');
  console.log('Total:', rows.length);
  rows.forEach(r => console.log(' >', r.customer_name, '| table_id:', r.table_id?.slice(0,8)||'null', '| zone:', r.zone?.slice(0,8)||'null'));
  
  const tableIds = rows.map(r => r.table_id).filter(Boolean);
  const uniqueIds = new Set(tableIds);
  console.log('\nTable IDs únicos:', uniqueIds.size, '/', tableIds.length);
  if (uniqueIds.size === tableIds.length) {
    console.log('✅ CORRECTO — Cada reserva tiene table_id diferente (sin colisión real)');
    console.log('   (El ❌ anterior era falso: mismo número de mesa en zonas distintas = mesas diferentes)');
  } else {
    console.log('❌ COLISIÓN REAL — Dos reservas con el mismo table_id');
    const seen = {};
    rows.forEach(r => {
      if (r.table_id) {
        if (seen[r.table_id]) console.log('  DUPLICADO:', r.customer_name, '==', seen[r.table_id]);
        seen[r.table_id] = r.customer_name;
      }
    });
  }

  // Ver las mesas completas del tenant para confirmar que "5" existe en ambas zonas
  const tr = await fetch(SB+'/rest/v1/tables?tenant_id=eq.'+TID+'&number=eq.5&select=id,number,capacity,zone,zone_id', { headers: h });
  const tables5 = await tr.json();
  console.log('\nMesas con número "5":', tables5.length);
  tables5.forEach(t => console.log(' >', 'id:'+t.id.slice(0,8), 'zona:'+t.zone?.slice(0,8)||'null'));
}
main().catch(e => console.error(e.message));
