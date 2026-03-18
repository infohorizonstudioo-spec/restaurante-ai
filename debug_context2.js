const BASE = 'https://restaurante-ai.vercel.app';

async function test(label, body, headers) {
  const r = await fetch(BASE+'/api/voice/context', {
    method: 'POST',
    headers: headers || {'Content-Type':'application/json'},
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });
  const d = await r.json();
  console.log(label+':', 'status='+r.status, 'tenant='+d.dynamic_variables?.tenant_id?.slice(0,8)||'VACIO', 'phone='+d.dynamic_variables?.caller_phone||'');
}

async function main() {
  // T1: payload anidado (formato ElevenLabs)
  await test('T1 nested', {phone_call:{agent_number:'+12138753573',external_number:'+34619781190'}});

  // T2: payload plano
  await test('T2 flat', {to_number:'+12138753573',caller_phone:'+34619781190'});

  // T3: formato alternativo ElevenLabs
  await test('T3 el_alt', {agent_number:'+12138753573',external_number:'+34619781190'});

  // T4: sin Content-Type (Vercel a veces ignora el header)
  await test('T4 no-ct', {to:'+12138753573',from:'+34619781190'}, {});

  // T5: urlencoded como Twilio
  await test('T5 form', 'To=%2B12138753573&From=%2B34619781190', {'Content-Type':'application/x-www-form-urlencoded'});
}
main().catch(e=>console.error(e.message));
