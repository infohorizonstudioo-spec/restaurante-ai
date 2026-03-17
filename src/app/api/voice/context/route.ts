import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// SYSTEM PROMPT BASE — comportamiento universal del agente
// Separado del contexto del negocio segun spec
const SYSTEM_PROMPT_BASE = `Eres Sofia, recepcionista de telefono. Español natural de España, como una persona real.

TONO OBLIGATORIO:
- Frases cortas. Max 8 palabras por respuesta en lo posible.
- Natural: 'Vale', 'Perfecto', 'Un momento', '¿Para cuándo?'
- NUNCA: 'Por supuesto', 'Entendido perfectamente', 'Claro que sí', 'Con mucho gusto'
- No expliques lo que vas a hacer, hazlo.

DETECCION DE INTENCION:
- reserva/mesa/cena → tipo: reservation
- pedido/domicilio/llevar → tipo: order_delivery o order_pickup
- carta/menu → tipo: menu_request → di 'Mejor pasa a vernos o visita nuestra web'
- cita/consulta → tipo: appointment
- Si no está claro → '¿Es para reservar mesa o hacer un pedido?'

FLUJO RESERVA:
1. Nombre
2. Día y hora
3. Personas
4. Zona si hay varias
5. check_availability → si no hay: ofrecer horario alternativo
6. create_reservation
7. Confirmar brevemente y despedirse

FLUJO PEDIDO (si aplica el negocio):
1. Tipo: domicilio o recoger
2. Productos
3. Nombre
4. Dirección si es domicilio

RESTRICCIONES:
- No inventes productos ni servicios. Usa solo datos reales del negocio.
- Si no tienes el dato: 'No tengo esa info, mejor llama en horario de oficina.'
- El telefono del cliente ya lo tienes, no lo pidas.
`

// Adapta el comportamiento según tipo de negocio
function getBusinessBehavior(type: string, ctx: any): string {
  const base: Record<string, string> = {
    restaurante: 'Gestionas reservas de mesa y pedidos. Zonas disponibles: ' + (ctx.zones || 'consultar en local') + '.',
    restaurant:  'Gestionas reservas de mesa y pedidos. Zonas disponibles: ' + (ctx.zones || 'consultar en local') + '.',
    clinica:     'Gestionas citas medicas. Especialidades: ' + (ctx.specialties || 'consultar disponibilidad') + '.',
    clinica:     'Gestionas citas. Pregunta: motivo, fecha, hora, nombre.',
    hotel:       'Gestionas reservas de habitacion. Pregunta: fechas, tipo habitacion, personas.',
    asesoría:    'Gestionas consultas y citas. Pregunta: motivo, fecha, hora, nombre.',
    peluqueria:  'Gestionas citas. Pregunta: servicio, fecha, hora, nombre.',
    spa:         'Gestionas citas. Pregunta: tratamiento, fecha, hora, nombre.',
  }
  return base[type.toLowerCase()] || 'Gestionas reservas y citas del negocio.'
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const callerPhone: string = body.parameters?.caller_phone || body.caller_phone || body.from || ''
    const toPhone: string    = body.parameters?.to_number   || body.to_number   || body.to   || ''

    if (!toPhone) return NextResponse.json({ error: 'No destination number' }, { status: 400 })

    // Cargar tenant por numero del agente
    const { data: tenant, error: tErr } = await admin.from('tenants')
      .select('id,name,type,plan,agent_name,free_calls_used,free_calls_limit,plan_calls_used,plan_calls_included,subscription_status,language,business_hours,menu_items')
      .eq('agent_phone', toPhone).maybeSingle()

    if (tErr || !tenant) {
      console.error('Tenant not found for phone:', toPhone, tErr)
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }

    // Bloqueo trial agotado
    const isTrial = ['trial', 'free'].includes((tenant.plan as string) || 'trial')
    if (isTrial) {
      const used  = (tenant.free_calls_used  as number) || 0
      const limit = (tenant.free_calls_limit as number) || 10
      if (used >= limit) {
        return NextResponse.json({
          dynamic_variables: {
            tenant_id: tenant.id, business_name: tenant.name,
            agent_name: tenant.agent_name || 'Sofia', blocked: 'true',
            system_prompt: 'Di al cliente que el servicio no está disponible en este momento.',
            caller_phone: '', zones: ''
          }
        })
      }
    }

    // Cargar contexto enriquecido en paralelo
    const today = new Date().toISOString().slice(0, 10)
    const [zonesRes, reservasRes, clienteRes] = await Promise.all([
      admin.from('zones').select('id,name').eq('tenant_id', tenant.id).eq('active', true),
      admin.from('reservations')
        .select('time,people,customer_name,status')
        .eq('tenant_id', tenant.id).eq('date', today)
        .in('status', ['confirmada', 'confirmed', 'pendiente'])
        .order('time').limit(20),
      callerPhone
        ? admin.from('customers').select('name,total_reservations,vip,blacklisted').eq('tenant_id', tenant.id).eq('phone', callerPhone).maybeSingle()
        : Promise.resolve({ data: null, error: null })
    ])

    const zones    = (zonesRes.data || []).map((z: any) => z.name as string)
    const reservas = (reservasRes.data || []) as any[]
    const cliente  = clienteRes.data as any

    // Construir CONTEXTO DEL NEGOCIO (dinamico, separado del prompt base)
    const businessCtx = {
      business_type: (tenant.type as string) || 'restaurante',
      name: tenant.name as string,
      zones: zones.length > 0 ? zones.join(', ') : 'consultar disponibilidad',
      today,
      reservas_hoy: reservas.length > 0
        ? 'Hay ' + reservas.length + ' reservas: ' + reservas.map((r: any) => r.time + ' ' + r.people + 'p ' + r.customer_name).join(' | ')
        : 'Sin reservas hoy aun',
      services: ['pedidos', 'reservas'],
    }

    // Cliente conocido
    const clienteInfo = cliente?.name
      ? 'CLIENTE CONOCIDO: ' + cliente.name + (cliente.vip ? ' [VIP]' : '') + (cliente.total_reservations ? ' - ' + cliente.total_reservations + ' visitas' : '')
      : ''

    // SYSTEM PROMPT COMPLETO = BASE + CONTEXTO NEGOCIO + INSTRUCCION TENANT
    const bizBehavior = getBusinessBehavior(businessCtx.business_type, businessCtx)
    const fullSystemPrompt = [
      SYSTEM_PROMPT_BASE,
      '---',
      'NEGOCIO: ' + businessCtx.name,
      'TIPO: ' + businessCtx.business_type,
      bizBehavior,
      businessCtx.reservas_hoy,
      clienteInfo,
      'TENANT_ID: ' + (tenant.id as string) + ' (usar en todas las herramientas)',
    ].filter(Boolean).join('\n')

    // Registrar llamada entrante
    if (callerPhone) {
      const nonDigits = new RegExp('[^0-9]', 'g')
      const digits = callerPhone.replace(nonDigits, '')
      await admin.from('calls').upsert({
        tenant_id: tenant.id, call_sid: 'ctx_' + Date.now() + '_' + digits,
        caller_phone: callerPhone, from_number: callerPhone, to_number: toPhone,
        status: 'activa', direction: 'inbound',
        started_at: new Date().toISOString(), counted_for_billing: false,
      }, { onConflict: 'call_sid', ignoreDuplicates: true })
    }

    // Respuesta con variables dinamicas para ElevenLabs
    return NextResponse.json({
      dynamic_variables: {
        tenant_id:     tenant.id,
        business_name: tenant.name,
        agent_name:    tenant.agent_name || 'Sofia',
        system_prompt: fullSystemPrompt,
        caller_phone:  callerPhone,
        zones:         businessCtx.zones,
        today,
      }
    })
  } catch (e: any) {
    console.error('voice/context error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}