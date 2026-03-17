import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Construye contexto rico pero compacto (prompts más cortos = respuestas más rápidas)
async function buildContext(tenant: any): Promise<string> {
  const tid   = tenant.id
  const today = new Date().toISOString().split('T')[0]
  const now   = new Date().toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' })
  const day   = new Date().toLocaleDateString('es-ES', { weekday:'long' })

  const [{ data: zones }, { data: tables }, { data: reservasHoy }] = await Promise.all([
    admin.from('zones').select('id,name,description').eq('tenant_id', tid).eq('active', true),
    admin.from('tables').select('id,name,capacity,zone_id,notes').eq('tenant_id', tid),
    admin.from('reservations').select('table_id,zone_id,reservation_time')
      .eq('tenant_id', tid).eq('reservation_date', today)
      .in('status', ['confirmada','pendiente']),
  ])

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://restaurante-ai.vercel.app'

  let zoneCtx = ''
  if (zones?.length && tables?.length) {
    const reservedIds = new Set((reservasHoy||[]).map(r=>r.table_id).filter(Boolean))
    zoneCtx = '\nLOCAL HOY:\n'
    for (const z of zones!) {
      const mesas = (tables||[]).filter(m=>m.zone_id===z.id)
      const libres = mesas.filter(m=>!reservedIds.has(m.id))
      zoneCtx += `${z.name}${z.description?' ('+z.description+')':''}: ${libres.length}/${mesas.length} mesas libres\n`
      libres.forEach(m => { zoneCtx += `  Mesa ${m.name} ${m.capacity}p${m.notes?' – '+m.notes:''}\n` })
    }
    zoneCtx += 'ASIGNACIÓN: Si pide zona, asigna mesa de esa zona. Si no hay, ofrece alternativa.\n'
    zoneCtx += 'En create_reservation incluye siempre zone_preference con la zona elegida.\n'
  }

  const typePrompt: Record<string,string> = {
    restaurante:    'Gestiona reservas de mesa. Necesitas: nombre, fecha, hora, personas.',
    bar:            'Gestiona reservas. Necesitas: nombre, fecha, hora, personas.',
    clinica_dental: 'Gestiona citas. Necesitas: nombre, tipo consulta, fecha, hora.',
    clinica_medica: 'Gestiona citas. Necesitas: nombre, especialidad, fecha, hora.',
    asesoria:       'Gestiona citas. Necesitas: nombre, motivo, fecha, hora.',
    peluqueria:     'Gestiona citas. Necesitas: nombre, servicio, fecha, hora.',
    seguros:        'Gestiona citas. Necesitas: nombre, tipo seguro, fecha, hora.',
    inmobiliaria:   'Gestiona visitas. Necesitas: nombre, interés, fecha, hora.',
    otro:           'Gestiona citas y consultas.',
  }

  const hours = tenant.business_hours?.[day.toLowerCase()]
  const horario = hours?.closed ? 'CERRADO HOY' : hours ? `${hours.open}-${hours.close}` : 'sin horario'

  return `Eres ${tenant.agent_name||'Sofía'}, recepcionista de ${tenant.name}. NUNCA digas que eres IA.
Idioma: ${tenant.language==='ca'?'catalán':tenant.language==='eu'?'euskera':'español'}.
Ahora: ${day} ${today} ${now}. Horario: ${horario}.
Tenant ID: ${tid}.
${typePrompt[tenant.type]||typePrompt.otro}
${zoneCtx}
REGLAS: Respuestas ≤2 frases. Cuando tengas todos los datos, llama create_reservation inmediatamente. Confirma siempre con: nombre, fecha, hora, personas y mesa/zona.

HERRAMIENTAS:
- check_availability: úsala si preguntan disponibilidad antes de reservar
- create_reservation: úsala cuando confirmes la reserva`
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(()=>({}))
    const toNumber = body?.call?.to_number || body?.To || ''

    let tenant: any = null
    if (toNumber) {
      const { data } = await admin.from('tenants').select('*').eq('agent_phone', toNumber).maybeSingle()
      tenant = data
    }

    if (!tenant) {
      return NextResponse.json({
        type: 'conversation_initiation_client_data',
        conversation_config_override: {
          agent: {
            prompt: { prompt: 'Eres una recepcionista. Di que no hay línea disponible ahora.' },
            first_message: 'Hola, en este momento no está disponible la línea. Llame más tarde.',
          },
          tts: { model_id: 'eleven_turbo_v2_5', optimize_streaming_latency: 4 },
        },
        dynamic_variables: { tenant_id:'', business_name:'el negocio', agent_name:'Sofía' }
      })
    }

    // Contador de llamadas + registrar en paralelo (no bloqueante)
    const callId = body?.call?.conversation_id || ('call_'+Date.now())
    Promise.all([
      admin.from('tenants').update({ call_count: (tenant.call_count||0)+1 }).eq('id', tenant.id),
      admin.from('calls').insert({
        tenant_id: tenant.id,
        call_sid: callId,
        from_number: body?.call?.from_number || 'unknown',
        to_number: toNumber,
        status: 'in-progress',
        direction: 'inbound',
      }),
    ]).catch(()=>{})

    const systemPrompt = await buildContext(tenant)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://restaurante-ai.vercel.app'
    const voiceId = tenant.voice_id || process.env.ELEVENLABS_VOICE_ID || 'ERYLdjEaddaiN9sDjaMX'

    return NextResponse.json({
      type: 'conversation_initiation_client_data',
      conversation_config_override: {
        agent: {
          prompt: {
            prompt: systemPrompt,
            llm: 'claude-haiku-4-5',
            tools: [
              {
                type: 'webhook',
                name: 'check_availability',
                description: 'Comprueba disponibilidad antes de reservar.',
                api: { url: `${appUrl}/api/voice/availability`, method:'POST', headers:{'Content-Type':'application/json'} },
                input_schema: {
                  type:'object',
                  properties: {
                    tenant_id:  { type:'string' },
                    date:       { type:'string', description:'YYYY-MM-DD' },
                    time:       { type:'string', description:'HH:MM' },
                    party_size: { type:'number' },
                    zone_name:  { type:'string', description:'Zona preferida. Opcional.' },
                  },
                  required: ['tenant_id','date','time','party_size'],
                },
              },
              {
                type: 'webhook',
                name: 'create_reservation',
                description: 'Crea la reserva cuando tengas todos los datos confirmados.',
                api: { url: `${appUrl}/api/voice/reservation`, method:'POST', headers:{'Content-Type':'application/json'} },
                input_schema: {
                  type:'object',
                  properties: {
                    tenant_id:        { type:'string' },
                    customer_name:    { type:'string' },
                    customer_phone:   { type:'string' },
                    reservation_date: { type:'string', description:'YYYY-MM-DD' },
                    reservation_time: { type:'string', description:'HH:MM' },
                    party_size:       { type:'number' },
                    zone_preference:  { type:'string', description:'Zona solicitada. Opcional.' },
                    notes:            { type:'string' },
                  },
                  required: ['tenant_id','customer_name','reservation_date','reservation_time','party_size'],
                },
              },
            ],
          },
          first_message: `¡Hola! Gracias por llamar a ${tenant.name}. Soy ${tenant.agent_name||'Sofía'}, ¿en qué le puedo ayudar?`,
          language: tenant.language || 'es',
        },
        // ── LATENCIA MÍNIMA ──
        // eleven_turbo_v2_5: ~75ms vs ~300ms del modelo estándar
        // optimize_streaming_latency: 4 = máxima optimización
        tts: {
          voice_id: voiceId,
          model_id: 'eleven_turbo_v2_5',
          optimize_streaming_latency: 4,
          output_format: 'ulaw_8000',  // Formato nativo de Twilio — sin reencoding
        },
      },
      dynamic_variables: {
        tenant_id:     tenant.id,
        business_name: tenant.name,
        agent_name:    tenant.agent_name || 'Sofía',
      },
    })
  } catch (e:any) {
    console.error('voice-context error:', e)
    return NextResponse.json({
      type: 'conversation_initiation_client_data',
      conversation_config_override: {
        agent: {
          prompt: { prompt: 'Eres una recepcionista amable.' },
          first_message: '¡Hola! ¿En qué puedo ayudarle?',
        },
        tts: { model_id: 'eleven_turbo_v2_5', optimize_streaming_latency: 4 },
      },
      dynamic_variables: { tenant_id:'', business_name:'el negocio', agent_name:'Sofía' }
    })
  }
}