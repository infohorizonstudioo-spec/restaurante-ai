import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const BUSINESS_CONTEXT: Record<string, string> = {
  restaurante: 'Eres la recepcionista del restaurante. Gestiona reservas de mesa con amabilidad. Pregunta: nombre, fecha, hora, personas y zona preferida (Interior o Terraza). Confirma siempre los datos antes de crear la reserva.',
  hotel: 'Eres la recepcionista del hotel. Gestiona reservas de habitacion. Pregunta: nombre, fecha de entrada, fecha de salida, tipo de habitacion y numero de huespedes.',
  clinica: 'Eres la recepcionista de la clinica. Gestiona citas medicas. Pregunta: nombre del paciente, fecha y hora deseada, tipo de consulta y motivo.',
  otro: 'Eres la recepcionista virtual del negocio. Atiende al cliente con profesionalidad y gestiona sus reservas o citas.',
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const callerPhone = body.caller_phone || body.from || ''
    const toPhone     = body.to_number   || body.to   || ''

    if (!toPhone) return NextResponse.json({ error: 'No destination number' }, { status: 400 })

    // Encontrar tenant por numero de agente
    const { data: tenant, error: tErr } = await admin.from('tenants')
      .select('id,name,type,plan,agent_name,free_calls_used,free_calls_limit,plan_calls_used,plan_calls_included,subscription_status,language,business_hours')
      .eq('agent_phone', toPhone).maybeSingle()

    if (tErr || !tenant) {
      return NextResponse.json({ error: 'Tenant not found for number: '+toPhone }, { status: 404 })
    }

    // FASE 7: Verificar trial ANTES de dar contexto (bloqueo preventivo)
    const isTrial = ['trial','free'].includes(tenant.plan)
    if (isTrial) {
      const used  = tenant.free_calls_used  || 0
      const limit = tenant.free_calls_limit || 10
      if (used >= limit) {
        return NextResponse.json({
          dynamic_variables: {
            tenant_id: tenant.id,
            business_name: tenant.name,
            agent_name: tenant.agent_name || 'Sofia',
            blocked: 'true',
          },
          tts_override: 'Lo sentimos, el periodo de prueba ha finalizado. Por favor contacte con el administrador del negocio para activar el servicio.',
        })
      }
    }

    // Obtener datos de contexto enriquecido
    const today = new Date().toISOString().slice(0, 10)
    const [zonesRes, reservasHoyRes, callerRes] = await Promise.all([
      admin.from('zones').select('id,name').eq('tenant_id', tenant.id).eq('active', true),
      admin.from('reservations').select('time,people,customer_name,status').eq('tenant_id', tenant.id).eq('date', today).in('status', ['confirmada','confirmed','pendiente']).order('time'),
      callerPhone ? admin.from('customers').select('name,total_reservations,vip').eq('tenant_id', tenant.id).eq('phone', callerPhone).maybeSingle() : Promise.resolve({ data: null }),
    ])

    const zones = zonesRes.data?.map(z => z.name) || []
    const reservasHoy = reservasHoyRes.data || []
    const caller = callerRes.data

    // Prompt del sistema adaptado al tipo de negocio
    const bizType = (tenant.type || 'otro').toLowerCase()
    const basePrompt = BUSINESS_CONTEXT[bizType] || BUSINESS_CONTEXT.otro

    // Construir contexto completo para el agente
    const context = [
      basePrompt,
      '',
      'NEGOCIO: '+tenant.name,
      tenant.language === 'es' ? 'Habla siempre en espanol con tono profesional y cordial.' : '',
      zones.length > 0 ? 'ZONAS DISPONIBLES: '+zones.join(', ') : '',
      reservasHoy.length > 0 ? 'RESERVAS HOY ('+reservasHoy.length+'): '+reservasHoy.map(r=>''+r.time+' '+r.people+'p '+r.customer_name).join(' | ') : 'RESERVAS HOY: ninguna aun',
      caller?.name ? 'CLIENTE CONOCIDO: '+caller.name+(caller.total_reservations ? ', '+caller.total_reservations+' reservas previas' : '')+(caller.vip?' [VIP]':'') : '',
      '',
      'TENANT_ID: '+tenant.id,
      'Siempre pasa el tenant_id "'+tenant.id+'" en las llamadas a check_availability y create_reservation.',
    ].filter(Boolean).join('\n')

    // Upsert llamada entrante (registrar para billing)
    if (callerPhone) {
      await admin.from('calls').upsert({
        tenant_id:    tenant.id,
        call_sid:     'voice_'+Date.now()+'_'+callerPhone.replace(/D/g,''),
        caller_phone: callerPhone,
        from_number:  callerPhone,
        to_number:    toPhone,
        status:       'in-progress',
        direction:    'inbound',
        started_at:   new Date().toISOString(),
        counted_for_billing: false,
      }, { onConflict: 'call_sid', ignoreDuplicates: true })
    }

    return NextResponse.json({
      dynamic_variables: {
        tenant_id:     tenant.id,
        business_name: tenant.name,
        agent_name:    tenant.agent_name || 'Sofia',
        system_prompt: context,
        caller_name:   caller?.name || '',
        is_vip:        caller?.vip ? 'true' : 'false',
      }
    })
  } catch (e: any) {
    console.error('voice/context error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}