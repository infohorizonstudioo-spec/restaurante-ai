import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ─────────────────────────────────────────────────────────────────────────────
// Cada llamada que llega a ElevenLabs crea su propia sesión aislada.
// El contexto se carga fresh por llamada — nunca se comparte estado.
// La sesión se registra con un call_sid único garantizado por:
//   - conversation_id de ElevenLabs (el más fiable)
//   - fallback: ctx_{timestamp}_{microsegundos}_{phone_digits}
// ─────────────────────────────────────────────────────────────────────────────

const D = {
  tenant_id:'',
  business_name:'Recepcionista',
  agent_name:'Sofia',
  zones:'',
  caller_phone:'',
  today: new Date().toISOString().slice(0,10),
}

export async function POST(req: Request) {
  const requestStart = Date.now()
  try {
    const body = await req.json().catch(()=>({}))

    // Extraer identificadores de la llamada
    const agentPhone:  string = body?.phone_call?.agent_number    || body?.to_number   || body?.to   || ''
    const callerPhone: string = body?.phone_call?.external_number || body?.caller_phone || body?.from || ''
    const convId:      string = body?.conversation_id || ''

    // Sin teléfono del agente → devolver defaults, nunca error (llamadas en curso)
    if (!agentPhone) {
      return NextResponse.json({ dynamic_variables: { ...D, caller_phone: callerPhone } })
    }

    // Cargar contexto del negocio — independiente por cada llamada
    const { data: tenant } = await admin.from('tenants')
      .select('id,name,type,plan,agent_name,free_calls_used,free_calls_limit,language')
      .eq('agent_phone', agentPhone).maybeSingle()

    if (!tenant) {
      console.log('context: tenant not found for', agentPhone)
      return NextResponse.json({ dynamic_variables: { ...D, caller_phone: callerPhone } })
    }

    // Verificar límite trial antes de crear la sesión
    const isTrial = ['trial','free'].includes((tenant.plan as string)||'trial')
    if (isTrial && ((tenant.free_calls_used as number)||0) >= ((tenant.free_calls_limit as number)||10)) {
      return NextResponse.json({
        dynamic_variables: { ...D, tenant_id:tenant.id, business_name:tenant.name||D.business_name, caller_phone:callerPhone, blocked:'true' }
      })
    }

    const today = new Date().toISOString().slice(0,10)

    // Cargar datos del negocio en paralelo — contexto fresco por llamada
    const [zr, rr, cr] = await Promise.all([
      admin.from('zones').select('name').eq('tenant_id',tenant.id).eq('active',true),
      admin.from('reservations')
        .select('time,people,customer_name')
        .eq('tenant_id',tenant.id).eq('date',today)
        .in('status',['confirmada','confirmed','pendiente'])
        .order('time').limit(10),
      callerPhone
        ? admin.from('customers').select('name,vip,total_reservations').eq('tenant_id',tenant.id).eq('phone',callerPhone).maybeSingle()
        : Promise.resolve({data:null}),
    ])

    const zones     = (zr.data||[]).map((z:any)=>z.name).join(', ') || ''
    const resHoy    = (rr.data||[]) as any[]
    const cliente   = cr.data as any
    const biz       = (tenant.name as string) || D.business_name

    // Registrar sesión de llamada — idempotente via RPC
    // Genera call_sid único: convId > ctx_{ts_ms}_{random}_{digits}
    if (callerPhone || convId) {
      const digits  = callerPhone.replace(/[^0-9]/g,'').slice(-10)
      const tsMs    = Date.now()
      const rand    = Math.random().toString(36).slice(2,7)
      const callSid = convId
        ? ('conv_'+convId)
        : ('ctx_'+tsMs+'_'+rand+'_'+digits)

      // upsert_call_session es idempotente: ON CONFLICT DO NOTHING
      try {
        await admin.rpc('upsert_call_session', {
          p_call_sid:     callSid,
          p_tenant_id:    tenant.id,
          p_caller_phone: callerPhone,
          p_agent_phone:  agentPhone,
          p_conv_id:      convId || null,
          p_status:       'activa',
          p_source:       'elevenlabs',
        })
      } catch(rpcErr: any) { console.log('session upsert warn:', rpcErr.message) }
    }

    const resumenHoy = resHoy.length > 0
      ? resHoy.map((r:any)=>r.time+' '+r.people+'p '+r.customer_name).join(' | ')
      : 'Sin reservas'

    const clienteInfo = cliente?.name
      ? 'Cliente conocido: '+cliente.name+(cliente.vip?' [VIP]':'')+(cliente.total_reservations?' ('+cliente.total_reservations+' visitas)':'')
      : ''

    console.log('context ok | tenant:', tenant.id.slice(0,8), '| caller:', callerPhone, '| conv:', convId.slice(0,12)||'-', '| ms:', Date.now()-requestStart)

    return NextResponse.json({
      dynamic_variables: {
        tenant_id:      tenant.id,
        business_name:  biz,
        agent_name:     tenant.agent_name || D.agent_name,
        caller_phone:   callerPhone,
        zones,
        today,
        reservas_hoy:   resumenHoy,
        cliente_info:   clienteInfo,
      },
      conversation_config_override: {
        agent: { first_message: biz+', dígame.' }
      }
    })
  } catch(e:any) {
    console.error('voice/context error:', e.message)
    // Siempre responder — nunca dejar una llamada sin contexto
    return NextResponse.json({ dynamic_variables: { ...D } })
  }
}
