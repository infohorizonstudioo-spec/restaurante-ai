import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { BUSINESS_TEMPLATES } from '@/types'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const PLAN_LIMITS: Record<string, number> = {
  free: 10, trial: 10, starter: 50, pro: 200, business: 600,
}

async function buildContext(tenant: any): Promise<string> {
  const tid   = tenant.id
  const today = new Date().toISOString().split('T')[0]
  const now   = new Date().toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' })
  const day   = new Date().toLocaleDateString('es-ES', { weekday:'long' })

  // Usa el systemPrompt de la plantilla del tipo de negocio
  const tmpl = (BUSINESS_TEMPLATES as any)[tenant.type] || (BUSINESS_TEMPLATES as any).otro
  const basePrompt = tmpl?.agentSystemPrompt || 'Gestiona citas y reservas.'

  const [{ data: zones }, { data: tables }, { data: reservasHoy }] = await Promise.all([
    admin.from('zones').select('id,name,description').eq('tenant_id', tid).eq('active', true),
    admin.from('tables').select('id,name,capacity,zone_id,notes').eq('tenant_id', tid),
    admin.from('reservations').select('table_id,zone_id,reservation_time')
      .eq('tenant_id', tid).eq('reservation_date', today).in('status', ['confirmada','pendiente']),
  ])

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://restaurante-ai.vercel.app'

  let zoneCtx = ''
  if (zones?.length && tables?.length) {
    const reservedIds = new Set((reservasHoy||[]).map(r => r.table_id).filter(Boolean))
    zoneCtx = '\nDISPOSICIÓN DEL LOCAL HOY:\n'
    for (const z of zones!) {
      const mesas = (tables||[]).filter(m => m.zone_id === z.id)
      const libres = mesas.filter(m => !reservedIds.has(m.id))
      zoneCtx += `${z.name}${z.description ? ' (' + z.description + ')' : ''}: ${libres.length}/${mesas.length} libres\n`
      libres.forEach(m => { zoneCtx += `  Mesa ${m.name} ${m.capacity}p${m.notes ? ' – ' + m.notes : ''}\n` })
    }
    zoneCtx += '→ Si el cliente pide zona específica, asigna mesa libre en esa zona. Si no hay, ofrece alternativa inmediata.\n'
    zoneCtx += '→ Siempre incluir zone_preference en create_reservation.\n'
  } else if (tables?.length) {
    // Mesas sin zonas — asignación sin zona
    const reservedIds = new Set((reservasHoy||[]).map(r => r.table_id).filter(Boolean))
    const libres = tables.filter(m => !reservedIds.has(m.id))
    zoneCtx = `\nMESAS DISPONIBLES HOY: ${libres.length}/${tables.length}\n`
    libres.slice(0,5).forEach(m => { zoneCtx += `  Mesa ${m.name} (${m.capacity} personas)\n` })
  }

  const hours = tenant.business_hours?.[day.toLowerCase()]
  const horario = hours?.closed ? 'CERRADO HOY' : hours ? `${hours.open}–${hours.close}` : 'sin horario'

  return `Eres ${tenant.agent_name || 'Sofía'}, recepcionista de ${tenant.name}. NUNCA digas que eres IA o robot.
Idioma: ${tenant.language === 'ca' ? 'catalán' : tenant.language === 'eu' ? 'euskera' : 'español'}.
Hoy: ${day} ${today}, ${now}. Horario: ${horario}.
Tenant ID (para herramientas): ${tid}.

ROL: ${basePrompt}
${zoneCtx}
REGLAS CRÍTICAS:
1. Respuestas ≤2 frases, naturales.
2. Cuando confirmes TODOS los datos, usa create_reservation INMEDIATAMENTE.
3. Para restaurante/bar: asigna mesa automáticamente según disponibilidad y preferencia.
4. Confirma siempre: nombre, fecha, hora, personas${zones?.length ? ' y zona/mesa' : ''}.
5. Si el negocio está cerrado hoy, indícalo y ofrece otra fecha.`
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const toNumber = body?.call?.to_number || body?.To || ''
    const callId   = body?.call?.conversation_id || body?.CallSid || ('call_' + Date.now())

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
            prompt: { prompt: 'Di que la línea no está disponible.' },
            first_message: 'Hola, en este momento no está disponible el servicio. Llame más tarde.',
          },
          tts: { model_id: 'eleven_turbo_v2_5', optimize_streaming_latency: 4 },
        },
        dynamic_variables: { tenant_id: '', business_name: 'el negocio', agent_name: 'Sofía' }
      })
    }

    // ── CONTROL DE LLAMADAS ATÓMICO ──
    // Usamos una RPC/función SQL para hacer el increment y check atómica
    // Evita race conditions y deduplicación por call_sid
    const plan    = tenant.plan || 'free'
    const isTrial = plan === 'free' || plan === 'trial'

    if (isTrial) {
      const used  = tenant.free_calls_used  || 0
      const limit = tenant.free_calls_limit || PLAN_LIMITS.free
      
      if (used >= limit) {
        // Trial agotado
        return NextResponse.json({
          type: 'conversation_initiation_client_data',
          conversation_config_override: {
            agent: {
              prompt: { prompt: 'Di que el servicio de atención no está disponible y que el negocio debe activar un plan.' },
              first_message: `Gracias por llamar a ${tenant.name}. En este momento nuestro servicio no está disponible. Por favor contáctenos por otro medio.`,
            },
            tts: { model_id: 'eleven_turbo_v2_5', optimize_streaming_latency: 4 },
          },
          dynamic_variables: { tenant_id: tenant.id, business_name: tenant.name, agent_name: tenant.agent_name || 'Sofía' }
        })
      }

      // Incremento atómico via SQL (evita race condition)
      await admin.rpc('increment_free_calls', { p_tenant_id: tenant.id }).catch(async () => {
        // Fallback si la RPC no existe
        await admin.from('tenants').update({ free_calls_used: used + 1 }).eq('id', tenant.id)
      })
    } else {
      // Plan de pago — incremento atómico via SQL
      const planUsed = tenant.plan_calls_used || 0
      await admin.rpc('increment_plan_calls', { p_tenant_id: tenant.id }).catch(async () => {
        await admin.from('tenants').update({ plan_calls_used: planUsed + 1 }).eq('id', tenant.id)
      })
    }

    // ── REGISTRO DE LLAMADA CON DEDUPLICACIÓN ──
    // ON CONFLICT DO NOTHING para evitar doble conteo si ElevenLabs llama 2x
    await admin.from('calls').upsert({
      tenant_id:   tenant.id,
      call_sid:    callId,
      from_number: body?.call?.from_number || 'unknown',
      to_number:   toNumber,
      status:      'in-progress',
      direction:   'inbound',
    }, { onConflict: 'call_sid', ignoreDuplicates: true }).catch(() => {})

    const systemPrompt = await buildContext(tenant)
    const appUrl  = process.env.NEXT_PUBLIC_APP_URL || 'https://restaurante-ai.vercel.app'
    const voiceId = tenant.voice_id || process.env.ELEVENLABS_VOICE_ID || 'ERYLdjEaddaiN9sDjaMX'

    return NextResponse.json({
      type: 'conversation_initiation_client_data',
      conversation_config_override: {
        agent: {
          prompt: {
            prompt: systemPrompt,
            tools: [
              {
                type: 'webhook', name: 'check_availability',
                description: 'Comprueba disponibilidad de mesas/citas para una fecha, hora y personas.',
                api: { url: `${appUrl}/api/voice/availability`, method: 'POST', headers: { 'Content-Type': 'application/json' } },
                input_schema: {
                  type: 'object',
                  properties: {
                    tenant_id:  { type: 'string' },
                    date:       { type: 'string', description: 'YYYY-MM-DD' },
                    time:       { type: 'string', description: 'HH:MM' },
                    party_size: { type: 'number' },
                    zone_name:  { type: 'string', description: 'Zona preferida. Opcional.' },
                  },
                  required: ['tenant_id', 'date', 'time', 'party_size'],
                },
              },
              {
                type: 'webhook', name: 'create_reservation',
                description: 'Crea la reserva. Úsala cuando tengas nombre, fecha, hora y personas confirmados.',
                api: { url: `${appUrl}/api/voice/reservation`, method: 'POST', headers: { 'Content-Type': 'application/json' } },
                input_schema: {
                  type: 'object',
                  properties: {
                    tenant_id:        { type: 'string' },
                    customer_name:    { type: 'string' },
                    customer_phone:   { type: 'string' },
                    reservation_date: { type: 'string', description: 'YYYY-MM-DD' },
                    reservation_time: { type: 'string', description: 'HH:MM' },
                    party_size:       { type: 'number' },
                    zone_preference:  { type: 'string', description: 'Zona solicitada. Opcional.' },
                    notes:            { type: 'string' },
                  },
                  required: ['tenant_id', 'customer_name', 'reservation_date', 'reservation_time', 'party_size'],
                },
              },
            ],
          },
          first_message: `¡Hola! Gracias por llamar a ${tenant.name}. Soy ${tenant.agent_name || 'Sofía'}, ¿en qué le puedo ayudar?`,
          language: tenant.language || 'es',
        },
        tts: {
          voice_id: voiceId,
          model_id: 'eleven_turbo_v2_5',
          optimize_streaming_latency: 4,
          output_format: 'ulaw_8000',
        },
      },
      dynamic_variables: {
        tenant_id:     tenant.id,
        business_name: tenant.name,
        agent_name:    tenant.agent_name || 'Sofía',
      },
    })
  } catch (e: any) {
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
      dynamic_variables: { tenant_id: '', business_name: 'el negocio', agent_name: 'Sofía' }
    })
  }
}