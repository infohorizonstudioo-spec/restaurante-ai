const BASE = 'https://restaurante-ai.vercel.app';

async function main() {
  // 1. Verificar que el nuevo endpoint /api/voice/session existe
  const r1 = await fetch(BASE+'/api/voice/session', { method:'GET' });
  const d1 = await r1.json();
  console.log('1. /api/voice/session GET:', d1.status, d1.endpoint);

  // 2. Ver los headers de la response del context (para ver version, cache etc)
  const r2 = await fetch(BASE+'/api/voice/context', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({phone_call:{agent_number:'+12138753573',external_number:'+34640000001'}})
  });
  console.log('2. context headers:');
  r2.headers.forEach((v,k) => {
    if (['x-vercel-cache','x-vercel-id','server','cf-cache-status','x-nextjs-cache'].includes(k))
      console.log('  '+k+':', v);
  });
  const d2 = await r2.json();
  console.log('  caller_phone:', d2.dynamic_variables?.caller_phone || '[EMPTY]');
  console.log('  tenant_id:', d2.dynamic_variables?.tenant_id || '[EMPTY]');

  // 3. Test con body vacío (para confirmar que el fallback works)
  const r3 = await fetch(BASE+'/api/voice/context', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({})
  });
  const d3 = await r3.json();
  console.log('\n3. Empty body response - agent_name:', d3.dynamic_variables?.agent_name);

  // 4. Test con agentPhone directamente (sin anidado)
  const r4 = await fetch(BASE+'/api/voice/context', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({to: '+12138753573', from: '+34640000001'})
  });
  const d4 = await r4.json();
  console.log('\n4. Direct to/from - caller_phone:', d4.dynamic_variables?.caller_phone||'[EMPTY]', '| tenant_id:', d4.dynamic_variables?.tenant_id||'[EMPTY]');

  // 5. Verificar que el test antiguo (sin conversation_id) también falla
  const r5 = await fetch(BASE+'/api/voice/context', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({phone_call:{agent_number:'+12138753573',external_number:'+34640000001'}})
  });
  const d5 = await r5.json();
  console.log('\n5. Old format no convId - caller_phone:', d5.dynamic_variables?.caller_phone||'[EMPTY]', '| tenant_id:', d5.dynamic_variables?.tenant_id||'[EMPTY]');
}
main().catch(e => console.error('ERR:', e.message));
