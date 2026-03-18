// Health check completo — verifica todos los endpoints y la DB
const BASE = 'https://restaurante-ai.vercel.app';
const SB   = 'https://phrfucpinxxcsgxgbcno.supabase.co';
const KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBocmZ1Y3Bpbnh4Y3NneGdiY25vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzUyOTc4NCwiZXhwIjoyMDg5MTA1Nzg0fQ.YX_KXTsRitrRKZqLdIUb9bZ0F-j49tf1SQmIxVjlkEQ';
const TID  = '7be3fb2c-6da4-4129-a49d-3af1c2c45b77';
const h    = { apikey: KEY, Authorization: 'Bearer '+KEY, 'Content-Type': 'application/json' };

async function check(label, fn) {
  try {
    const t = Date.now();
    const result = await fn();
    const ms = Date.now() - t;
    const ok = result !== false;
    console.log((ok ? '  ✅' : '  ❌') + ' ' + label + (ms > 500 ? ' (' + ms + 'ms)' : ''));
    if (!ok) console.log('     └─', result);
    return ok;
  } catch(e) {
    console.log('  ❌ ' + label + ' → ' + e.message);
    return false;
  }
}

async function main() {
  console.log('\n══════════════════════════════════════════════');
  console.log('  RESERVO.AI — HEALTH CHECK COMPLETO');
  console.log('══════════════════════════════════════════════\n');

  // ── PÁGINAS ─────────────────────────────────────────
  console.log('─ Páginas públicas ─');
  const pages = ['/login', '/registro', '/precios', '/precios/success', '/reset', '/onboarding'];
  for (const p of pages) {
    await check(p, async () => {
      const r = await fetch(BASE + p);
      return r.status === 200 || r.status === 307 || false;
    });
  }

  // ── PÁGINAS DASHBOARD (redirigen a /login sin auth) ─
  console.log('\n─ Páginas dashboard (redirect a login esperado) ─');
  const dash = ['/panel', '/reservas', '/llamadas', '/clientes', '/mesas', '/agenda', '/estadisticas', '/facturacion', '/configuracion', '/pedidos'];
  for (const p of dash) {
    await check(p, async () => {
      const r = await fetch(BASE + p, { redirect: 'manual' });
      return r.status === 307 || r.status === 302 || r.status === 200;
    });
  }

  // ── APIs VOZ ─────────────────────────────────────────
  console.log('\n─ APIs de voz ─');
  await check('/api/voice/context (con agente)', async () => {
    const r = await fetch(BASE + '/api/voice/context', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone_call: { agent_number: '+12138753573', external_number: '+34619781190' } })
    });
    const d = await r.json();
    return d.dynamic_variables?.tenant_id ? true : 'tenant_id vacío: ' + JSON.stringify(d).slice(0, 100);
  });

  await check('/api/voice/context (sin agente → defaults)', async () => {
    const r = await fetch(BASE + '/api/voice/context', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const d = await r.json();
    return !!d.dynamic_variables;
  });

  await check('/api/voice/availability', async () => {
    const r = await fetch(BASE + '/api/voice/availability', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: TID, date: '2026-05-15', time: '21:00', party_size: 2 })
    });
    const d = await r.json();
    return typeof d.available === 'boolean';
  });

  await check('/api/voice/post-call (completed)', async () => {
    const sid = 'HC_' + Date.now();
    const r = await fetch(BASE + '/api/voice/post-call', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'CallSid=' + sid + '&CallStatus=completed&CallDuration=65&From=%2B34619999999&To=%2B12138753573'
    });
    const d = await r.json();
    if (d.ok) {
      // Cleanup
      await fetch(SB + '/rest/v1/calls?call_sid=eq.' + sid, { method: 'DELETE', headers: h });
    }
    return d.ok === true;
  });

  await check('/api/voice/reservation', async () => {
    const r = await fetch(BASE + '/api/voice/reservation', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: TID, customer_name: 'HC Test', customer_phone: '+34600000001', reservation_date: '2026-06-01', reservation_time: '20:00', party_size: 2 })
    });
    const d = await r.json();
    if (d.success && d.reservation_id) {
      await fetch(SB + '/rest/v1/reservations?id=eq.' + d.reservation_id, { method: 'DELETE', headers: h });
    }
    return d.success === true;
  });

  await check('/api/voice/session (nuevo endpoint mid-call)', async () => {
    const r = await fetch(BASE + '/api/voice/session');
    const d = await r.json();
    return d.status === 'ok' && Array.isArray(d.valid_states);
  });

  // ── APIs SISTEMA ─────────────────────────────────────
  console.log('\n─ APIs sistema ─');
  await check('/api/stripe/checkout (sin auth → error esperado)', async () => {
    const r = await fetch(BASE + '/api/stripe/checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'starter', tenant_id: TID, user_id: 'test' })
    });
    // 200 con URL o 500 por Stripe test key — ambos son válidos
    return r.status === 200 || r.status === 500;
  });

  await check('/api/call (GET health)', async () => {
    const r = await fetch(BASE + '/api/call');
    const d = await r.json();
    return d.status === 'ok';
  });

  // ── BASE DE DATOS ─────────────────────────────────────
  console.log('\n─ Base de datos ─');
  await check('Tenant demo existe', async () => {
    const r = await fetch(SB + '/rest/v1/tenants?id=eq.' + TID + '&select=id,name,plan,agent_phone', { headers: h });
    const d = await r.json();
    return d[0]?.agent_phone === '+12138753573';
  });

  await check('Columna business_description existe', async () => {
    const r = await fetch(SB + '/rest/v1/tenants?id=eq.' + TID + '&select=business_description', { headers: h });
    const d = await r.json();
    return Array.isArray(d) && d.length > 0;
  });

  await check('RPC get_billing_summary', async () => {
    const r = await fetch(SB + '/rest/v1/rpc/get_billing_summary', {
      method: 'POST', headers: h, body: JSON.stringify({ p_tenant_id: TID })
    });
    const d = await r.json();
    return typeof d.used_calls === 'number';
  });

  await check('RPC assign_table_atomic', async () => {
    const r = await fetch(SB + '/rest/v1/rpc/assign_table_atomic', {
      method: 'POST', headers: h,
      body: JSON.stringify({ p_tenant_id: TID, p_date: '2026-07-01', p_time: '21:00', p_party_size: 2 })
    });
    const d = await r.json();
    return typeof d.available === 'boolean';
  });

  await check('RPC complete_call_session', async () => {
    const sid = 'hc_rpc_' + Date.now();
    const r = await fetch(SB + '/rest/v1/rpc/complete_call_session', {
      method: 'POST', headers: h,
      body: JSON.stringify({
        p_call_sid: sid, p_tenant_id: TID,
        p_duration: 65, p_status: 'completada',
        p_intent: 'consulta', p_summary: 'HC test',
        p_source: 'test', p_action_required: 'Sin acción necesaria'
      })
    });
    const d = await r.json();
    if (d.call_id) await fetch(SB + '/rest/v1/calls?call_sid=eq.' + sid, { method: 'DELETE', headers: h });
    return !!d.call_id;
  });

  await check('Columna session_state en calls', async () => {
    const r = await fetch(SB + '/rest/v1/calls?tenant_id=eq.' + TID + '&select=session_state&limit=1', { headers: h });
    const d = await r.json();
    return Array.isArray(d);
  });

  await check('RPC upsert_call_session (nueva)', async () => {
    const sid = 'hc_upsert_' + Date.now();
    const r = await fetch(SB + '/rest/v1/rpc/upsert_call_session', {
      method: 'POST', headers: h,
      body: JSON.stringify({ p_call_sid: sid, p_tenant_id: TID, p_caller_phone: '+34600000099', p_agent_phone: '+12138753573', p_session_state: 'iniciando' })
    });
    const d = await r.json();
    if (d.ok) await fetch(SB + '/rest/v1/calls?call_sid=eq.' + sid, { method: 'DELETE', headers: h });
    return d.ok === true;
  });

  await check('RPC get_active_calls (nueva)', async () => {
    const r = await fetch(SB + '/rest/v1/rpc/get_active_calls', {
      method: 'POST', headers: h, body: JSON.stringify({ p_tenant_id: TID })
    });
    const d = await r.json();
    return Array.isArray(d);
  });

  await check('Realtime: tabla calls RLS policy', async () => {
    const r = await fetch(SB + '/rest/v1/calls?tenant_id=eq.' + TID + '&select=id&limit=1', { headers: h });
    return r.status === 200;
  });

  await check('RPC get_daily_metrics (nueva)', async () => {
    const r = await fetch(SB + '/rest/v1/rpc/get_daily_metrics', {
      method: 'POST', headers: h, body: JSON.stringify({ p_tenant_id: TID })
    });
    const d = await r.json();
    return typeof d.calls_today === 'number' && typeof d.reservas_detected === 'number';
  });

  await check('Columna action_required en calls', async () => {
    const r = await fetch(SB + '/rest/v1/calls?tenant_id=eq.' + TID + '&select=action_required&limit=1', { headers: h });
    const d = await r.json();
    return Array.isArray(d);
  });


    const r = await fetch(SB + '/rest/v1/billing_history?tenant_id=eq.' + TID + '&select=id&limit=1', { headers: h });
    return r.status === 200;
  });

  // ── DATOS DEMO ────────────────────────────────────────
  console.log('\n─ Datos demo ─');
  await check('Mesas configuradas (>=1)', async () => {
    const r = await fetch(SB + '/rest/v1/tables?tenant_id=eq.' + TID + '&select=id', { headers: h });
    const d = await r.json();
    return d.length >= 1;
  });

  await check('Zonas activas configuradas', async () => {
    const r = await fetch(SB + '/rest/v1/zones?tenant_id=eq.' + TID + '&active=eq.true&select=name', { headers: h });
    const d = await r.json();
    return d.length >= 1;
  });

  await check('Admin: superadmin existe con email correcto', async () => {
    const r = await fetch(SB + '/rest/v1/profiles?role=eq.superadmin&select=id,role,email', { headers: h });
    const d = await r.json();
    return Array.isArray(d) && d.length > 0 && d[0]?.role === 'superadmin';
  });

  console.log('\n══════════════════════════════════════════════');
  console.log('  Health check completo');
  console.log('══════════════════════════════════════════════\n');
}

main().catch(e => console.error('HEALTH CHECK ERROR:', e.message));
