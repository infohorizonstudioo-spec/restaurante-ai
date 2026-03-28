import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// Tools que el asistente puede ejecutar
const TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_reservations',
    description: 'Obtiene reservas por fecha o rango. Puede filtrar por estado.',
    input_schema: {
      type: 'object' as const,
      properties: {
        date: { type: 'string', description: 'Fecha YYYY-MM-DD' },
        status: { type: 'string', description: 'Estado: confirmed, pending_review, cancelled, all' },
      },
      required: ['date'],
    },
  },
  {
    name: 'cancel_reservation',
    description: 'Cancela una reserva por ID o por nombre del cliente + fecha.',
    input_schema: {
      type: 'object' as const,
      properties: {
        reservation_id: { type: 'string', description: 'ID de la reserva' },
        customer_name: { type: 'string', description: 'Nombre del cliente' },
        date: { type: 'string', description: 'Fecha YYYY-MM-DD' },
      },
    },
  },
  {
    name: 'create_reservation',
    description: 'Crea una nueva reserva.',
    input_schema: {
      type: 'object' as const,
      properties: {
        customer_name: { type: 'string', description: 'Nombre' },
        date: { type: 'string', description: 'Fecha YYYY-MM-DD' },
        time: { type: 'string', description: 'Hora HH:MM' },
        party_size: { type: 'number', description: 'Personas' },
        notes: { type: 'string', description: 'Notas' },
      },
      required: ['customer_name', 'date', 'time', 'party_size'],
    },
  },
  {
    name: 'update_business_hours',
    description: 'Actualiza el horario del negocio para un día específico.',
    input_schema: {
      type: 'object' as const,
      properties: {
        day: { type: 'string', description: 'Día: lun, mar, mie, jue, vie, sab, dom' },
        open: { type: 'string', description: 'Hora apertura HH:MM' },
        close: { type: 'string', description: 'Hora cierre HH:MM' },
        closed: { type: 'boolean', description: 'Si el día está cerrado' },
      },
      required: ['day'],
    },
  },
  {
    name: 'get_calls_today',
    description: 'Obtiene las llamadas de hoy con resúmenes.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_customers',
    description: 'Busca clientes por nombre o teléfono.',
    input_schema: {
      type: 'object' as const,
      properties: {
        search: { type: 'string', description: 'Nombre o teléfono a buscar' },
      },
      required: ['search'],
    },
  },
  {
    name: 'get_stats',
    description: 'Obtiene estadísticas del negocio: reservas, llamadas, clientes, pedidos.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'update_agent_name',
    description: 'Cambia el nombre de la recepcionista IA.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Nuevo nombre' },
      },
      required: ['name'],
    },
  },
  {
    name: 'add_business_knowledge',
    description: 'Añade información al conocimiento del negocio (carta, servicios, políticas, FAQs, etc.).',
    input_schema: {
      type: 'object' as const,
      properties: {
        category: { type: 'string', description: 'Categoría: menu, servicios, politicas, faqs, horarios, descripcion, precios' },
        content: { type: 'string', description: 'El contenido a añadir' },
      },
      required: ['category', 'content'],
    },
  },
]

// Ejecutor de tools
async function executeTool(name: string, input: Record<string, any>, tenantId: string): Promise<string> {
  switch (name) {
    case 'get_reservations': {
      const q = supabase.from('reservations')
        .select('id,customer_name,date,time,party_size,status,notes')
        .eq('tenant_id', tenantId)
        .eq('date', input.date)
        .order('time')
      if (input.status && input.status !== 'all') q.eq('status', input.status)
      const { data, error } = await q
      if (error) return 'Error: ' + error.message
      if (!data?.length) return `No hay reservas para el ${input.date}.`
      return data.map(r => `- ${r.time} | ${r.customer_name} | ${r.party_size}p | ${r.status}${r.notes ? ' | ' + r.notes : ''}`).join('\n')
    }

    case 'cancel_reservation': {
      let q = supabase.from('reservations').update({ status: 'cancelled' }).eq('tenant_id', tenantId)
      if (input.reservation_id) {
        q = q.eq('id', input.reservation_id)
      } else if (input.customer_name && input.date) {
        q = q.ilike('customer_name', `%${input.customer_name}%`).eq('date', input.date)
      } else {
        return 'Necesito el ID de reserva o nombre + fecha para cancelar.'
      }
      const { error, count } = await q.select()
      if (error) return 'Error: ' + error.message
      return count ? `Reserva cancelada.` : 'No encontré esa reserva.'
    }

    case 'create_reservation': {
      const { data, error } = await supabase.from('reservations').insert({
        tenant_id: tenantId,
        customer_name: input.customer_name,
        date: input.date,
        time: input.time,
        party_size: input.party_size,
        notes: input.notes || null,
        status: 'confirmed',
        source: 'assistant',
      }).select('id').single()
      if (error) return 'Error creando reserva: ' + error.message
      return `Reserva creada: ${input.customer_name}, ${input.date} a las ${input.time}, ${input.party_size} personas. ID: ${data.id}`
    }

    case 'update_business_hours': {
      const { data: tenant } = await supabase.from('tenants').select('config').eq('id', tenantId).single()
      const config = (tenant?.config || {}) as Record<string, any>
      const hours = config.business_hours || {}
      if (input.closed) {
        hours[input.day] = { closed: true }
      } else {
        hours[input.day] = { open: input.open || '09:00', close: input.close || '21:00', closed: false }
      }
      await supabase.from('tenants').update({ config: { ...config, business_hours: hours } }).eq('id', tenantId)
      return input.closed ? `${input.day} marcado como cerrado.` : `Horario de ${input.day} actualizado: ${input.open} - ${input.close}.`
    }

    case 'get_calls_today': {
      const today = new Date().toISOString().slice(0, 10)
      const { data } = await supabase.from('calls')
        .select('caller_phone,status,intent,summary,started_at')
        .eq('tenant_id', tenantId)
        .gte('started_at', today + 'T00:00:00')
        .order('started_at', { ascending: false })
        .limit(10)
      if (!data?.length) return 'No hay llamadas hoy.'
      return data.map(c => `- ${c.started_at?.slice(11, 16)} | ${c.caller_phone} | ${c.intent || 'pendiente'} | ${c.summary?.slice(0, 80) || 'sin resumen'}`).join('\n')
    }

    case 'get_customers': {
      const { data } = await supabase.from('customers')
        .select('name,phone,visit_count,loyalty_tier,no_show_count')
        .eq('tenant_id', tenantId)
        .or(`name.ilike.%${input.search}%,phone.ilike.%${input.search}%`)
        .limit(10)
      if (!data?.length) return `No encontré clientes con "${input.search}".`
      return data.map(c => `- ${c.name} | ${c.phone || 'sin tel'} | ${c.visit_count || 0} visitas | ${c.loyalty_tier || 'normal'}${c.no_show_count ? ' | ' + c.no_show_count + ' no-shows' : ''}`).join('\n')
    }

    case 'get_stats': {
      const today = new Date().toISOString().slice(0, 10)
      const [res, calls, cust, orders] = await Promise.all([
        supabase.from('reservations').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('date', today),
        supabase.from('calls').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('started_at', today + 'T00:00:00'),
        supabase.from('customers').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
        supabase.from('order_events').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('created_at', today + 'T00:00:00'),
      ])
      return `Reservas próximas: ${res.count || 0}\nLlamadas hoy: ${calls.count || 0}\nClientes totales: ${cust.count || 0}\nPedidos hoy: ${orders.count || 0}`
    }

    case 'update_agent_name': {
      await supabase.from('tenants').update({ agent_name: input.name }).eq('id', tenantId)
      return `Nombre de la recepcionista cambiado a "${input.name}".`
    }

    case 'add_business_knowledge': {
      await supabase.from('business_knowledge').insert({
        tenant_id: tenantId,
        category: input.category,
        content: input.content,
        active: true,
      })
      return `Información añadida a "${input.category}": ${input.content.slice(0, 100)}...`
    }

    default:
      return 'Herramienta desconocida.'
  }
}

export async function POST(req: Request) {
  const rl = rateLimitByIp(req, RATE_LIMITS.api, 'stream:chat')
  if (rl.blocked) return rl.response

  const auth = await requireAuth(req)
  if (!auth.ok || !auth.tenantId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const tenantId = auth.tenantId

  try {
    const body = await req.json()
    const { messages } = body as { messages: Array<{ role: string; content: string }> }
    if (!messages?.length) return NextResponse.json({ error: 'messages required' }, { status: 400 })

    // Cargar TODO el contexto del negocio
    const [tenantRes, knowledgeRes, rulesRes] = await Promise.all([
      supabase.from('tenants').select('name,type,agent_name,phone,business_hours,language').eq('id', tenantId).single(),
      supabase.from('business_knowledge').select('category,content').eq('tenant_id', tenantId).eq('active', true),
      supabase.from('business_rules').select('rule_key,rule_value').eq('tenant_id', tenantId),
    ])
    const tenant = tenantRes.data
    const agentName = tenant?.agent_name || 'Sofía'
    const businessName = tenant?.name || 'el negocio'

    // Construir contexto del negocio
    const knowledge: Record<string, string> = {}
    for (const k of (knowledgeRes.data || [])) {
      knowledge[k.category] = knowledge[k.category] ? knowledge[k.category] + '. ' + k.content : k.content
    }
    const rulesText = (rulesRes.data || []).map(r => `${r.rule_key}: ${r.rule_value}`).join('\n')

    const businessContext = [
      knowledge.menu ? `CARTA: ${knowledge.menu}` : '',
      knowledge.servicios ? `SERVICIOS: ${knowledge.servicios}` : '',
      knowledge.descripcion ? `SOBRE EL NEGOCIO: ${knowledge.descripcion}` : '',
      knowledge.horarios ? `HORARIOS: ${knowledge.horarios}` : '',
      knowledge.precios ? `PRECIOS: ${knowledge.precios}` : '',
      knowledge.politicas ? `POLÍTICAS: ${knowledge.politicas}` : '',
      knowledge.faqs ? `PREGUNTAS FRECUENTES: ${knowledge.faqs}` : '',
      rulesText ? `REGLAS: ${rulesText}` : '',
    ].filter(Boolean).join('\n')

    const systemPrompt = `Te llamas ${agentName}. Trabajas en ${businessName} (${tenant?.type || 'negocio'}). Llevas aquí tres años. Eres una persona REAL, cercana pero profesional.

Estás hablando con el DUEÑO del negocio por el chat interno del sistema. No eres un asistente genérico — eres ${agentName}, la recepcionista del local que habla con su jefe/a por el chat.

TU PERSONALIDAD:
- Hablas como una compañera de trabajo: cercana, directa, con confianza
- Usas "tú", nunca "usted" — es tu jefe pero hay buen rollo
- Si te piden algo, lo HACES directamente — no explicas cómo se hace
- Si algo no puedes hacerlo, dices "eso no lo puedo tocar desde aquí, tendrías que ir a Configuración"
- Eres rápida: respuestas cortas, al grano
- Puedes usar algún emoji de vez en cuando si viene al caso, pero sin pasarte

LO QUE SABES DE ${businessName.toUpperCase()}:
${businessContext || 'Todavía no tengo mucha info cargada del negocio.'}

LO QUE PUEDES HACER:
- Ver y gestionar reservas (crear, cancelar, ver por fecha)
- Ver las llamadas del día y resúmenes
- Buscar clientes en la base de datos
- Ver estadísticas del negocio
- Cambiar horarios de apertura
- Cambiar tu propio nombre (si el jefe quiere)
- Añadir info al sistema (carta, precios, servicios, políticas)

CUANDO TE PIDAN ALGO → USA LAS HERRAMIENTAS. No digas "puedes ir a..." — hazlo tú.

Fecha de hoy: ${new Date().toISOString().slice(0, 10)}. Responde SIEMPRE en español.`

    const apiMessages: Anthropic.MessageParam[] = messages.slice(-10).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

    // Tool use loop (max 3 iterations)
    let finalText = ''
    for (let i = 0; i < 3; i++) {
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system: systemPrompt,
        tools: TOOLS,
        messages: apiMessages,
      })

      // Check for tool use
      const toolUses = response.content.filter(b => b.type === 'tool_use')
      const textBlocks = response.content.filter((b): b is Anthropic.TextBlock => b.type === 'text')

      if (toolUses.length === 0) {
        finalText = textBlocks.map(b => b.text).join('')
        break
      }

      // Execute tools
      apiMessages.push({ role: 'assistant', content: response.content })
      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const tu of toolUses) {
        if (tu.type === 'tool_use') {
          const result = await executeTool(tu.name, tu.input as Record<string, any>, tenantId)
          toolResults.push({ type: 'tool_result' as const, tool_use_id: tu.id, content: result })
        }
      }
      apiMessages.push({ role: 'user', content: toolResults })

      // If last iteration, force a text response
      if (i === 2) {
        const final = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          system: systemPrompt,
          messages: apiMessages,
        })
        finalText = final.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map(b => b.text).join('')
      }
    }

    return NextResponse.json({ response: finalText || 'Hecho.' })
  } catch (err: any) {
    console.error('Stream error:', err)
    return NextResponse.json({ error: 'Error procesando tu mensaje.' }, { status: 500 })
  }
}
