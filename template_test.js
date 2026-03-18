// template_test.js — Test de producción del motor de plantillas
// Valida que el contexto del agente refleja correctamente la plantilla
const BASE = 'https://restaurante-ai.vercel.app';
const SB   = 'https://phrfucpinxxcsgxgbcno.supabase.co';
const KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBocmZ1Y3Bpbnh4Y3NneGdiY25vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzUyOTc4NCwiZXhwIjoyMDg5MTA1Nzg0fQ.YX_KXTsRitrRKZqLdIUb9bZ0F-j49tf1SQmIxVjlkEQ';
const h    = { apikey: KEY, Authorization: 'Bearer '+KEY, 'Content-Type': 'application/json' };

// Tipos de negocio y lo que esperamos del template
const CASOS = [
  { type:'restaurante',   tmpl:'hosteleria', hasOrders:true,  hasSpaces:true,  unit:'Mesa',    reservaLabel:'Reserva' },
  { type:'bar',           tmpl:'hosteleria', hasOrders:true,  hasSpaces:true,  unit:'Barra/Mesa',reservaLabel:'Reserva' },
  { type:'clinica_dental',tmpl:'servicios',  hasOrders:false, hasSpaces:true,  unit:'Silla',   reservaLabel:'Cita' },
  { type:'clinica_medica',tmpl:'servicios',  hasOrders:false, hasSpaces:true,  unit:'Consulta',reservaLabel:'Cita' },
  { type:'asesoria',      tmpl:'servicios',  hasOrders:false, hasSpaces:true,  unit:'Despacho',reservaLabel:'Cita' },
  { type:'peluqueria',    tmpl:'servicios',  hasOrders:false, hasSpaces:true,  unit:'Sillón',  reservaLabel:'Cita' },
  { type:'seguros',       tmpl:'servicios',  hasOrders:false, hasSpaces:false, unit:'Consulta',reservaLabel:'Cita' },
  { type:'otro',          tmpl:'servicios',  hasOrders:false, hasSpaces:false, unit:'Consulta',reservaLabel:'Cita' },
]

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  TEST DE PLANTILLAS — Verificación en producción');
  console.log('═══════════════════════════════════════════════════════════\n');

  const TID = '7be3fb2c-6da4-4129-a49d-3af1c2c45b77';
  let pass = 0, fail = 0;

  for (const caso of CASOS) {
    // Temporalmente actualizar el tipo del tenant demo para cada prueba
    await fetch(SB + '/rest/v1/tenants?id=eq.'+TID, {
      method:'PATCH', headers: h,
      body: JSON.stringify({ type: caso.type })
    });

    // Llamar al context webhook como haría ElevenLabs
    const r = await fetch(BASE + '/api/voice/context', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ phone_call: { agent_number: '+12138753573', external_number: '+34600000000' } })
    });
    const d = await r.json();
    const dv = d.dynamic_variables || {};

    const errors = [];
    if (dv.template_type !== caso.tmpl)
      errors.push(`template_type: esperado '${caso.tmpl}', got '${dv.template_type}'`);
    if (dv.reservation_unit !== caso.reservaLabel)
      errors.push(`reservation_unit: esperado '${caso.reservaLabel}', got '${dv.reservation_unit}'`);
    if (!dv.agent_context || dv.agent_context.length < 30)
      errors.push('agent_context vacío o muy corto');
    if (!dv.tenant_id)
      errors.push('tenant_id ausente');

    const ok = errors.length === 0;
    ok ? pass++ : fail++;

    console.log(
      (ok ? '  ✅' : '  ❌') +
      ` ${caso.type.padEnd(14)} → tmpl:${(dv.template_type||'?').padEnd(10)} unit:${(dv.reservation_unit||'?').padEnd(8)} ctx:${(dv.agent_context||'').slice(0,40)}…`
    );
    if (!ok) errors.forEach(e => console.log('         └─ ERROR:', e));
  }

  // Restaurar tenant demo a restaurante
  await fetch(SB + '/rest/v1/tenants?id=eq.'+TID, {
    method:'PATCH', headers: h, body: JSON.stringify({ type: 'restaurante' })
  });

  // TEST ADICIONAL: guardia backend de pedidos para negocio de servicios
  console.log('\n─ Test guardias backend ─');

  // Asesoria intentando crear pedido → debe devolver 403
  await fetch(SB + '/rest/v1/tenants?id=eq.'+TID, {
    method:'PATCH', headers: h, body: JSON.stringify({ type: 'asesoria', plan: 'business' })
  });
  const r2 = await fetch(BASE + '/api/orders', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ tenant_id: TID, customer_name: 'Test' })
  });
  const d2 = await r2.json();
  const g1ok = r2.status === 403 && d2.error?.includes('no disponible');
  console.log((g1ok?'  ✅':'  ❌')+` Guardia pedidos asesoria → ${r2.status} ${d2.error||''}`);
  g1ok ? pass++ : fail++;

  // Restaurar
  await fetch(SB + '/rest/v1/tenants?id=eq.'+TID, {
    method:'PATCH', headers: h, body: JSON.stringify({ type: 'restaurante', plan: 'business' })
  });

  // Restaurante con plan business puede crear pedido
  const r3 = await fetch(BASE + '/api/orders', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ tenant_id: TID, customer_name: 'Test hosteleria' })
  });
  const d3 = await r3.json();
  const g2ok = r3.status === 200 && d3.success === true;
  console.log((g2ok?'  ✅':'  ❌')+` Restaurante puede crear pedido → ${r3.status} ${d3.error||'OK'}`);
  if (g2ok && d3.order?.id) {
    await fetch(SB + '/rest/v1/orders?id=eq.'+d3.order.id, { method:'DELETE', headers: h });
  }
  g2ok ? pass++ : fail++;

  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`  Resultado: ${pass}/${pass+fail} tests ✅`);
  console.log(`═══════════════════════════════════════════════════════════\n`);

  if (fail > 0) process.exit(1);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
