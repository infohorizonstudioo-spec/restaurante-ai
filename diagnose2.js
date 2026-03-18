// Diagnóstico detallado del endpoint context
const BASE = 'https://restaurante-ai.vercel.app';

async function test(label, body, ct) {
  const r = await fetch(BASE+'/api/voice/context', {
    method:'POST',
    headers:{'Content-Type': ct||'application/json'},
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });
  const d = await r.json();
  const vars = d.dynamic_variables;
  console.log('\n--- '+label+' ---');
  console.log('status:', r.status);
  console.log('caller_phone:', vars?.caller_phone||'[EMPTY]');
  console.log('tenant_id:', vars?.tenant_id||'[EMPTY]');
  console.log('agent_name:', vars?.agent_name||'[EMPTY]');
}

async function main() {
  // Test 1: Formato original que FUNCIONABA antes
  await test('Original format (same as old T6 test)',
    {phone_call:{agent_number:'+12138753573',external_number:'+34640000001'}},
    'application/json'
  );

  // Test 2: Con conversation_id (nuevo test)
  await test('With conversation_id',
    {phone_call:{agent_number:'+12138753573',external_number:'+34611000001'},conversation_id:'DIAG_002'},
    'application/json'
  );

  // Test 3: formUrlEncoded (como Twilio)
  await test('Form URL Encoded (Twilio format)',
    'To=%2B12138753573&From=%2B34611000001&CallSid=CTEST123',
    'application/x-www-form-urlencoded'
  );

  // Test 4: Verificar el código del endpoint actual
  const r = await fetch(BASE+'/_next/static/chunks/app/api/voice/context/route.js', {});
  console.log('\n--- Route chunk exists:', r.status, '---');
}
main().catch(e=>console.error('ERR:', e.message));
