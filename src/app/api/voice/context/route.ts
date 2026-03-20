import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveTemplate } from '@/lib/templates'
import { getBusinessKnowledge, buildKnowledgeContext, buildAgentKnowledge } from '@/lib/business-knowledge'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT WEBHOOK — cargado por ElevenLabs al inicio de cada llamada.
// NO crea registro de llamada aquí — lo hace Twilio en post-call con el
// CallSid real. Esto evita el problema de doble registro (ctx_* + callSid).
// ─────────────────────────────────────────────────────────────────────────────

const D = {
  tenant_id: '', business_name: 'Recepcionista', agent_name: 'Sofia',
  zones: '', caller_phone: '', today: new Date().toISOString().slice(0, 10),
  business_hours: '', is_open: 'true',
}

function isBusinessOpen(businessHours: any): boolean {
  if (!businessHours) return true
  try {
    const now = new Date()
    const dayNames = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
    const today = dayNames[now.getDay()]
    const hours = businessHours[today]
    if (!hours || hours.closed) return false
    const [openH, openM]  = (hours.open  || '00:00').split(':').map(Number)
    const [closeH, closeM] = (hours.close || '23:59').split(':').map(Number)
    const nowMin = now.getHours() * 60 + now.getMinutes()
    const openMin  = openH  * 60 + openM
    const closeMin = closeH * 60 + closeM
    return nowMin >= openMin && nowMin < closeMin
  } catch { return true }
}

function formatBusinessHours(businessHours: any): string {
  if (!businessHours) return ''
  try {
    const dayNames = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']
    return dayNames.map(d => {
      const h = businessHours[d]
      if (!h || h.closed) return d + ': cerrado'
      return d + ': ' + h.open + '-' + h.close
    }).join(', ')
  } catch { return '' }
}

export async function POST(req: Request) {
  const t0 = Date.now()
  try {
    const body = await req.json().catch(() => ({}))

    const agentPhone:  string = body?.phone_call?.agent_number    || body?.to_number   || body?.to   || ''
    const callerPhone: string = body?.phone_call?.external_number || body?.caller_phone || body?.from || ''
    const convId:      string = body?.conversation_id || ''

    if (!agentPhone) {
      return NextResponse.json({ dynamic_variables: { ...D, caller_phone: callerPhone } })
    }

    const { data: tenant } = await admin.from('tenants')
      .select('id,name,type,plan,agent_name,free_calls_used,free_calls_limit,language,business_hours,business_description,agent_config')
      .eq('agent_phone', agentPhone).maybeSingle()

    if (!tenant) {
      console.log('context: tenant not found for', agentPhone)
      return NextResponse.json({ dynamic_variables: { ...D, caller_phone: callerPhone } })
    }

    // Verificar trial agotado — informar al agente para que corte la llamada
    const isTrial = ['trial', 'free'].includes((tenant.plan as string) || 'trial')
    if (isTrial && ((tenant.free_calls_used as number) || 0) >= ((tenant.free_calls_limit as number) || 10)) {
      return NextResponse.json({
        dynamic_variables: {
          ...D, tenant_id: tenant.id,
          business_name: tenant.name || D.business_name,
          caller_phone: callerPhone,
          blocked: 'true',
          block_reason: 'trial_exhausted',
        },
        conversation_config_override: {
          agent: {
            first_message: 'Lo sentimos, el servicio no está disponible en este momento. Por favor, contacte con el negocio directamente. ¡Hasta pronto!'
          }
        }
      })
    }

    // Resolver plantilla del negocio para contexto del agente
    const tmpl = resolveTemplate((tenant.type as string) || 'otro')

    // Verificar horario
    const isOpen = isBusinessOpen(tenant.business_hours)

    const today = new Date().toISOString().slice(0, 10)
    const [zr, rr, cr] = await Promise.all([
      admin.from('zones').select('name').eq('tenant_id', tenant.id).eq('active', true),
      admin.from('reservations')
        .select('time,people,customer_name')
        .eq('tenant_id', tenant.id).eq('date', today)
        .in('status', ['confirmada', 'confirmed', 'pendiente'])
        .order('time').limit(10),
      callerPhone
        ? admin.from('customers').select('name,vip,total_reservations').eq('tenant_id', tenant.id).eq('phone', callerPhone).maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    const zones    = (zr.data || []).map((z: any) => z.name).join(', ') || ''
    const resHoy   = (rr.data || []) as any[]
    const cliente  = cr.data as any
    const biz      = (tenant.name as string) || D.business_name
    const bhHuman  = formatBusinessHours(tenant.business_hours)

    const resumenHoy = resHoy.length > 0
      ? resHoy.map((r: any) => r.time + ' ' + r.people + 'p ' + r.customer_name).join(' | ')
      : 'Sin reservas'

    const clienteInfo = cliente?.name
      ? 'Cliente conocido: ' + cliente.name + (cliente.vip ? ' [VIP]' : '') + (cliente.total_reservations ? ' (' + cliente.total_reservations + ' visitas)' : '')
      : ''

    const lang = (tenant.language as string) || 'es'

    // ── Cargar agent_config y construir reglas para el agente ─────────────
    const agentCfg = (tenant.agent_config as any) || {}
    const auto = agentCfg.automation || {}
    const rev  = agentCfg.review     || {}
    const rej  = agentCfg.rejection  || {}
    const alt  = agentCfg.alternatives || {}
    const know = agentCfg.knowledge  || {}
    const flow = (agentCfg.conversation_flow || ['nombre','personas','fecha','hora','confirmar']) as string[]
    const spec = agentCfg.special_cases || {}

    // Construir instrucciones de comportamiento en lenguaje natural para el agente
    const behaviorRules = [
      `AUTOMATIZACIÓN: Confirma automáticamente reservas hasta ${auto.max_auto_party||6} personas.${auto.auto_cancellations?' Las cancelaciones se gestionan directamente.':''}${auto.auto_info_queries?' Responde preguntas de información directamente.':''}`,
      `REVISIÓN: Envía a revisión si:${rev.large_groups?` grupos de más de ${auto.max_auto_party||6} personas,`:''} ${rev.special_requests?'peticiones especiales,':''} ${rev.allergies_mentioned?'se mencionan alergias,':''} ${rev.first_time_customers?'es la primera vez que llama este número,':''}`.replace(/,\s*$/,'').replace(/:\s*$/,': ningún caso extra'),
      `RECHAZO: Di que no puedes atender si:${rej.out_of_hours?' estamos fuera de horario,':''} ${rej.no_availability?' no hay disponibilidad,':''} ${rej.unknown_service?' el servicio no está en nuestra oferta,':''}`.replace(/,\s*$/,''),
      `ALTERNATIVAS: Cuando no puedas confirmar,${alt.offer_other_time?' ofrece otro horario disponible.':''}${alt.leave_pending?' Deja la solicitud pendiente si el cliente quiere esperar.':''}${alt.suggest_waitlist?' Ofrece lista de espera si no hay hueco.':''} Propón hasta ${alt.max_alternatives||2} alternativas.`,
      `FLUJO: Pide la información en este orden: ${flow.join(' → ')}.`,
      spec.allergies==='review' ? 'Si el cliente menciona alergias, anótalo y marca para revisión.' : '',
      spec.birthdays==='confirm' ? 'Para celebraciones y cumpleaños, confirma con agrado.' : spec.birthdays==='review' ? 'Para celebraciones, marca para revisión.' : '',
    ].filter(Boolean).join('\n')

    // Conocimiento adicional del negocio (servicios, condiciones, FAQs)
    const extraKnowledge = [
      know.services ? `SERVICIOS/MENÚ:\n${know.services}` : '',
      know.conditions ? `CONDICIONES:\n${know.conditions}` : '',
      know.faqs ? `PREGUNTAS FRECUENTES:\n${know.faqs}` : '',
    ].filter(Boolean).join('\n\n')


    const knowledge = await getBusinessKnowledge(tenant.id as string)
    const knowledgeCtx = buildKnowledgeContext(knowledge)

    // ── Disponibilidad operativa del menú (limited_daily, by_request, etc.) ──
    const today2 = new Date().toISOString().slice(0, 10)
    const [menuItemsRes, menuCountsRes] = await Promise.all([
      admin.from('menu_items').select('id,name,availability_type,daily_limit,requires_confirmation,alternatives').eq('tenant_id', tenant.id).eq('active', true),
      admin.from('menu_daily_counts').select('item_id,count').eq('tenant_id', tenant.id).eq('date', today2),
    ])
    const menuItems = menuItemsRes.data || []
    const countMap: Record<string,number> = {}
    ;(menuCountsRes.data || []).forEach((r:any) => { countMap[r.item_id] = r.count })
    const opLines: string[] = []
    for (const item of menuItems) {
      const used = countMap[item.id] || 0
      if (item.availability_type === 'unavailable') {
        opLines.push(`- ${item.name}: NO DISPONIBLE HOY`)
      } else if (item.availability_type === 'limited_daily') {
        const remaining = (item.daily_limit || 0) - used
        if (remaining <= 0) opLines.push(`- ${item.name}: AGOTADO hoy${item.alternatives?.length ? '. Di al cliente: "Se nos acabó, pero tenemos '+item.alternatives.join(' o ')+'"' : ''}`)
        else opLines.push(`- ${item.name}: quedan ${remaining} raciones hoy`)
      } else if (item.availability_type === 'by_request') {
        opLines.push(`- ${item.name}: requiere confirmación — di "lo consulto y te confirmo"`)
      }
    }
    const menuAvailability = opLines.length > 0 ? ('DISPONIBILIDAD REAL HOY (usa esto siempre):\n' + opLines.join('\n')) : ''

    const greeting = !isOpen
      ? biz + ', en este momento estamos cerrados. ' + (bhHuman ? 'Nuestro horario es: ' + bhHuman + '. ' : '') + 'Por favor llame en horario de atención.'
      : biz + ', dígame.'

    // Contexto del agente desde la plantilla del negocio
    const agentSystemContext = tmpl.agentContext

    // ── Herramientas del agente para hostelería ─────────────────────────────
    const isHosteleriaType = ['restaurante','bar','cafeteria'].includes(tenant.type as string)
    const agentTools = isHosteleriaType ? {
      tools: [
        {
          name: 'check_availability',
          description: 'Comprueba disponibilidad de mesa antes de confirmar. SIEMPRE llama esto antes de confirmar una reserva.',
          url: process.env.NEXT_PUBLIC_APP_URL + '/api/voice/availability',
          method: 'POST',
          parameters: {
            tenant_id: '{{tenant_id}}',
            date: 'fecha en formato YYYY-MM-DD',
            time: 'hora en formato HH:MM',
            party_size: 'número de personas',
            zone_name: 'zona preferida opcional',
          }
        },
        {
          name: 'create_reservation',
          description: 'Crea la reserva DESPUÉS de verificar disponibilidad. Solo llama si check_availability devuelve available:true.',
          url: process.env.NEXT_PUBLIC_APP_URL + '/api/voice/reservation',
          method: 'POST',
          parameters: {
            tenant_id: '{{tenant_id}}',
            customer_name: 'nombre del cliente',
            customer_phone: '{{caller_phone}}',
            reservation_date: 'fecha YYYY-MM-DD',
            reservation_time: 'hora HH:MM',
            party_size: 'número de personas',
            zone_preference: 'zona opcional',
            notes: 'notas opcionales',
          }
        },
        {
          name: 'update_order',
          description: 'Actualiza o confirma un pedido en tiempo real. Llama con action=start al detectar pedido, action=update al añadir items, action=confirm al cerrar.',
          url: process.env.NEXT_PUBLIC_APP_URL + '/api/voice/order',
          method: 'POST',
          parameters: {
            action: 'start | update | confirm | cancel',
            call_sid: '{{conversation_id}}',
            tenant_id: '{{tenant_id}}',
            order_type: 'recoger | domicilio | mesa',
            customer_name: 'nombre del cliente',
            customer_phone: '{{caller_phone}}',
            items: '[{name, quantity, notes}]',
            pickup_time: 'hora de recogida HH:MM opcional',
          }
        },
        {
          name: 'update_session',
          description: 'Actualiza el estado visible en el panel en tiempo real. Llama cuando cambia la fase de la llamada.',
          url: process.env.NEXT_PUBLIC_APP_URL + '/api/voice/session',
          method: 'POST',
          parameters: {
            call_sid: '{{conversation_id}}',
            tenant_id: '{{tenant_id}}',
            session_state: 'tomando_reserva | tomando_pedido | verificando_disponibilidad | confirmando_reserva | confirmando_pedido | escuchando',
          }
        },
      ]
    } : {}

    const contextPayload: any = {
      dynamic_variables: {
        tenant_id:        tenant.id,
        business_name:    biz,
        agent_name:       tenant.agent_name || D.agent_name,
        caller_phone:     callerPhone,
        zones,
        today,
        language:         lang,
        is_open:          String(isOpen),
        business_hours:   bhHuman,
        business_description: (tenant.business_description as string) || '',
        reservas_hoy:     resumenHoy,
        cliente_info:     clienteInfo,
        template_type:    tmpl.id,
        reservation_unit: tmpl.labels.reserva,
        agent_context:    agentSystemContext,
        business_knowledge: buildAgentKnowledge(knowledge) || extraKnowledge || '',
        menu_availability:  menuAvailability,
        behavior_rules:     behaviorRules,
      },
      conversation_config_override: {
        agent: { first_message: greeting }
      }
    }
    if (isHosteleriaType && agentTools.tools) {
      contextPayload.client_tools = agentTools.tools
    }
    // Fire-and-forget con IIFE async — NO usar .catch() encadenado sobre
    // admin.rpc() (rompe Turbopack/Next.js 16 — ver regla crítica en docs)
    const sessionSid = convId || ('ctx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7));
    (async () => {
      try {
        await admin.rpc('upsert_call_session', {
          p_call_sid:        sessionSid,
          p_tenant_id:       tenant.id,
          p_caller_phone:    callerPhone || '',
          p_agent_phone:     agentPhone  || '',
          p_conversation_id: convId      || null,
          p_session_state:   'iniciando',
        })
      } catch(e: any) {
        console.error('upsert_call_session error:', e.message)
      }
    })()

    console.log('context ok | tenant:', (tenant.id as string).slice(0, 8), '| type:', tenant.type, '| tmpl:', tmpl.id, '| caller:', callerPhone, '| open:', isOpen, '| sid:', sessionSid.slice(0,20), '| ms:', Date.now() - t0)

    return NextResponse.json(contextPayload)
  } catch (e: any) {
    console.error('voice/context error:', e.message)
    return NextResponse.json({ dynamic_variables: { ...D } })
  }
}
