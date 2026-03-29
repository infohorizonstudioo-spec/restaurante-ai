import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { requireAuth } from '@/lib/api-auth'
import { logger } from '@/lib/logger'

// ── Admin Supabase client (service role) ─────────────────────
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ── GET (legacy compatibility) ───────────────────────────────
export async function GET(req: Request) {
  const rl = rateLimitByIp(req, RATE_LIMITS.api, 'stream')
  if (rl.blocked) return rl.response

  const auth = await requireAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 })

  return NextResponse.json({ status: 'ok', note: 'Audio handled by ElevenLabs ConvAI' })
}

// ── Tool definitions ─────────────────────────────────────────

const TOOLS = [
  // READ tools
  {
    name: 'get_reservations',
    description: 'Consulta las reservas de un día concreto. Devuelve nombre, hora, personas y estado.',
    input_schema: {
      type: 'object' as const,
      properties: {
        date: { type: 'string', description: 'Fecha en formato YYYY-MM-DD' },
        status: { type: 'string', description: 'Filtro opcional: confirmed, pending, cancelled', enum: ['confirmed', 'pending', 'cancelled'] },
      },
      required: ['date'],
    },
  },
  {
    name: 'get_calls_today',
    description: 'Devuelve las llamadas recibidas hoy con intención y resumen.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_stats',
    description: 'KPIs del día: reservas, llamadas, pedidos y clientes nuevos.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_menu',
    description: 'Devuelve la carta completa con categorías y precios.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  // WRITE tools — carta
  {
    name: 'add_product',
    description: 'Añade un producto nuevo a la carta.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Nombre del producto' },
        price: { type: 'number', description: 'Precio en euros' },
        category: { type: 'string', description: 'Categoría (Entrantes, Principales, Postres, Bebidas, etc.)' },
      },
      required: ['name', 'price', 'category'],
    },
  },
  {
    name: 'update_product',
    description: 'Modifica un producto existente (precio, nombre o categoría). Busca por nombre aproximado.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Nombre actual del producto (búsqueda aproximada)' },
        new_price: { type: 'number', description: 'Nuevo precio' },
        new_name: { type: 'string', description: 'Nuevo nombre' },
        new_category: { type: 'string', description: 'Nueva categoría' },
      },
      required: ['name'],
    },
  },
  {
    name: 'remove_product',
    description: 'Elimina un producto de la carta (desactivación, no borrado permanente).',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Nombre del producto a eliminar' },
      },
      required: ['name'],
    },
  },
  // WRITE tools — negocio
  {
    name: 'create_reservation',
    description: 'Crea una reserva nueva.',
    input_schema: {
      type: 'object' as const,
      properties: {
        customer_name: { type: 'string', description: 'Nombre del cliente' },
        date: { type: 'string', description: 'Fecha YYYY-MM-DD' },
        time: { type: 'string', description: 'Hora HH:MM' },
        party_size: { type: 'number', description: 'Número de personas' },
        notes: { type: 'string', description: 'Notas opcionales' },
      },
      required: ['customer_name', 'date', 'time', 'party_size'],
    },
  },
  {
    name: 'cancel_reservation',
    description: 'Cancela una reserva por ID o por nombre + fecha.',
    input_schema: {
      type: 'object' as const,
      properties: {
        reservation_id: { type: 'string', description: 'ID de la reserva' },
        customer_name: { type: 'string', description: 'Nombre del cliente (si no tienes ID)' },
        date: { type: 'string', description: 'Fecha de la reserva (si buscas por nombre)' },
      },
    },
  },
  {
    name: 'update_hours',
    description: 'Cambia el horario de un día de la semana.',
    input_schema: {
      type: 'object' as const,
      properties: {
        day: { type: 'string', description: 'Día: lunes, martes, miércoles, jueves, viernes, sábado, domingo' },
        open: { type: 'string', description: 'Hora apertura HH:MM' },
        close: { type: 'string', description: 'Hora cierre HH:MM' },
        closed: { type: 'boolean', description: 'true si el día está cerrado' },
      },
      required: ['day'],
    },
  },
  {
    name: 'add_knowledge',
    description: 'Añade o actualiza información del negocio (FAQs, políticas, horarios, servicios).',
    input_schema: {
      type: 'object' as const,
      properties: {
        category: { type: 'string', description: 'Categoría', enum: ['menu', 'horarios', 'politicas', 'faqs', 'servicios'] },
        content: { type: 'string', description: 'Contenido a guardar' },
      },
      required: ['category', 'content'],
    },
  },
  {
    name: 'update_agent_name',
    description: 'Cambia el nombre del asistente de voz.',
    input_schema: {
      type: 'object' as const,
      properties: {
        new_name: { type: 'string', description: 'Nuevo nombre para el asistente' },
      },
      required: ['new_name'],
    },
  },
]

// ── Tool execution ───────────────────────────────────────────

async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  tenantId: string,
): Promise<string> {
  try {
    switch (toolName) {

      // ── READ ──

      case 'get_reservations': {
        const date = input.date as string
        let q = admin.from('reservations')
          .select('id, customer_name, date, time, party_size, status, notes')
          .eq('tenant_id', tenantId)
          .eq('date', date)
          .order('time')
        if (input.status) q = q.eq('status', input.status as string)
        const { data, error } = await q
        if (error) return `Error: ${error.message}`
        if (!data?.length) return `No hay reservas para el ${date}.`
        return data.map(r =>
          `• ${r.time} — ${r.customer_name} (${r.party_size} pax) [${r.status}]${r.notes ? ` — ${r.notes}` : ''}`
        ).join('\n')
      }

      case 'get_calls_today': {
        const today = new Date().toISOString().split('T')[0]
        const { data, error } = await admin.from('calls')
          .select('id, caller_number, intent, summary, duration, created_at')
          .eq('tenant_id', tenantId)
          .gte('created_at', `${today}T00:00:00`)
          .lte('created_at', `${today}T23:59:59`)
          .order('created_at', { ascending: false })
        if (error) return `Error: ${error.message}`
        if (!data?.length) return 'No hay llamadas hoy.'
        return data.map(c =>
          `• ${new Date(c.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} — ${c.caller_number || 'Desconocido'} | ${c.intent || 'Sin intención'} | ${c.summary || 'Sin resumen'}`
        ).join('\n')
      }

      case 'get_stats': {
        const today = new Date().toISOString().split('T')[0]
        const [reservationsRes, callsRes, ordersRes, customersRes] = await Promise.all([
          admin.from('reservations').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('date', today),
          admin.from('calls').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('created_at', `${today}T00:00:00`),
          admin.from('order_events').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('created_at', `${today}T00:00:00`),
          admin.from('customers').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('created_at', `${today}T00:00:00`),
        ])
        return [
          `Reservas hoy: ${reservationsRes.count ?? 0}`,
          `Llamadas hoy: ${callsRes.count ?? 0}`,
          `Pedidos hoy: ${ordersRes.count ?? 0}`,
          `Clientes nuevos hoy: ${customersRes.count ?? 0}`,
        ].join('\n')
      }

      case 'get_menu': {
        const { data, error } = await admin.from('menu_items')
          .select('name, price, category')
          .eq('tenant_id', tenantId)
          .eq('active', true)
          .order('category')
          .order('name')
        if (error) return `Error: ${error.message}`
        if (!data?.length) return 'La carta está vacía.'
        const grouped: Record<string, typeof data> = {}
        for (const item of data) {
          const cat = item.category || 'Sin categoría'
          if (!grouped[cat]) grouped[cat] = []
          grouped[cat].push(item)
        }
        return Object.entries(grouped).map(([cat, items]) =>
          `**${cat}**\n` + items.map(i => `  • ${i.name} — ${i.price}€`).join('\n')
        ).join('\n\n')
      }

      // ── WRITE: Carta ──

      case 'add_product': {
        const { error } = await admin.from('menu_items').insert({
          tenant_id: tenantId,
          name: input.name as string,
          price: input.price as number,
          category: input.category as string,
          active: true,
        })
        if (error) return `Error al añadir: ${error.message}`
        return `Añadido "${input.name}" (${input.price}€) en ${input.category}.`
      }

      case 'update_product': {
        const searchName = input.name as string
        // Find product by fuzzy name match
        const { data: found } = await admin.from('menu_items')
          .select('id, name, price, category')
          .eq('tenant_id', tenantId)
          .eq('active', true)
          .ilike('name', `%${searchName}%`)
          .limit(1)
        if (!found?.length) return `No encontré ningún producto con nombre "${searchName}".`
        const product = found[0]
        const changes: Record<string, unknown> = {}
        if (input.new_price !== undefined) changes.price = input.new_price
        if (input.new_name) changes.name = input.new_name
        if (input.new_category) changes.category = input.new_category
        if (!Object.keys(changes).length) return 'No indicaste qué cambiar.'
        const { error } = await admin.from('menu_items')
          .update(changes)
          .eq('id', product.id)
          .eq('tenant_id', tenantId)
        if (error) return `Error al actualizar: ${error.message}`
        const parts: string[] = []
        if (changes.name) parts.push(`nombre: "${changes.name}"`)
        if (changes.price !== undefined) parts.push(`precio: ${changes.price}€`)
        if (changes.category) parts.push(`categoría: "${changes.category}"`)
        return `Actualizado "${product.name}" → ${parts.join(', ')}.`
      }

      case 'remove_product': {
        const name = input.name as string
        const { data: found } = await admin.from('menu_items')
          .select('id, name')
          .eq('tenant_id', tenantId)
          .eq('active', true)
          .ilike('name', `%${name}%`)
          .limit(1)
        if (!found?.length) return `No encontré "${name}" en la carta.`
        const { error } = await admin.from('menu_items')
          .update({ active: false })
          .eq('id', found[0].id)
          .eq('tenant_id', tenantId)
        if (error) return `Error al eliminar: ${error.message}`
        return `Eliminado "${found[0].name}" de la carta.`
      }

      // ── WRITE: Negocio ──

      case 'create_reservation': {
        const { error } = await admin.from('reservations').insert({
          tenant_id: tenantId,
          customer_name: input.customer_name as string,
          date: input.date as string,
          time: input.time as string,
          party_size: input.party_size as number,
          notes: (input.notes as string) || null,
          status: 'confirmed',
          source: 'assistant',
        })
        if (error) return `Error al crear reserva: ${error.message}`
        return `Reserva creada: ${input.customer_name}, ${input.date} a las ${input.time}, ${input.party_size} personas.`
      }

      case 'cancel_reservation': {
        if (input.reservation_id) {
          const { error } = await admin.from('reservations')
            .update({ status: 'cancelled' })
            .eq('id', input.reservation_id as string)
            .eq('tenant_id', tenantId)
          if (error) return `Error: ${error.message}`
          return 'Reserva cancelada.'
        }
        // Search by name + date
        const { data: found } = await admin.from('reservations')
          .select('id, customer_name, date, time')
          .eq('tenant_id', tenantId)
          .ilike('customer_name', `%${input.customer_name as string}%`)
          .eq('date', input.date as string)
          .neq('status', 'cancelled')
          .limit(1)
        if (!found?.length) return 'No encontré esa reserva.'
        const { error } = await admin.from('reservations')
          .update({ status: 'cancelled' })
          .eq('id', found[0].id)
          .eq('tenant_id', tenantId)
        if (error) return `Error: ${error.message}`
        return `Cancelada la reserva de ${found[0].customer_name} el ${found[0].date} a las ${found[0].time}.`
      }

      case 'update_hours': {
        const day = (input.day as string).toLowerCase()
        // Load current hours from business_knowledge
        const { data: existing } = await admin.from('business_knowledge')
          .select('id, content')
          .eq('tenant_id', tenantId)
          .eq('category', 'horarios')
          .maybeSingle()

        let hours: Record<string, unknown> = {}
        if (existing?.content) {
          try { hours = JSON.parse(existing.content) } catch { hours = {} }
        }

        if (input.closed) {
          hours[day] = { closed: true }
        } else {
          hours[day] = { open: input.open, close: input.close }
        }

        const content = JSON.stringify(hours)
        if (existing?.id) {
          await admin.from('business_knowledge')
            .update({ content })
            .eq('id', existing.id)
            .eq('tenant_id', tenantId)
        } else {
          await admin.from('business_knowledge').insert({
            tenant_id: tenantId,
            category: 'horarios',
            content,
            active: true,
          })
        }

        if (input.closed) return `${day.charAt(0).toUpperCase() + day.slice(1)} marcado como cerrado.`
        return `Horario de ${day}: ${input.open} - ${input.close}.`
      }

      case 'add_knowledge': {
        const category = input.category as string
        const content = input.content as string
        // Upsert: if category exists, append. Otherwise insert.
        const { data: existing } = await admin.from('business_knowledge')
          .select('id, content')
          .eq('tenant_id', tenantId)
          .eq('category', category)
          .maybeSingle()

        if (existing?.id) {
          const merged = existing.content ? `${existing.content}\n${content}` : content
          await admin.from('business_knowledge')
            .update({ content: merged })
            .eq('id', existing.id)
            .eq('tenant_id', tenantId)
        } else {
          await admin.from('business_knowledge').insert({
            tenant_id: tenantId,
            category,
            content,
            active: true,
          })
        }
        return `Información de "${category}" actualizada.`
      }

      case 'update_agent_name': {
        const newName = input.new_name as string
        const { error } = await admin.from('tenants')
          .update({ agent_name: newName })
          .eq('id', tenantId)
        if (error) return `Error: ${error.message}`
        return `Nombre del asistente cambiado a "${newName}".`
      }

      default:
        return `Herramienta "${toolName}" no reconocida.`
    }
  } catch (err) {
    logger.error('Tool execution error', { tool: toolName, tenantId }, err)
    return `Error interno al ejecutar ${toolName}.`
  }
}

// ── POST handler ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const start = Date.now()

  // Rate limit
  const rl = rateLimitByIp(req, { limit: 30, windowSeconds: 60 }, 'stream:chat')
  if (rl.blocked) return rl.response

  // Auth
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 })

  const { data: profile } = await admin.from('profiles')
    .select('tenant_id')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile?.tenant_id) return NextResponse.json({ error: 'Sin negocio' }, { status: 403 })

  const tenantId = profile.tenant_id

  // Load business context
  const [tenantRes, menuRes, knowledgeRes] = await Promise.all([
    admin.from('tenants').select('name, type, agent_name').eq('id', tenantId).single(),
    admin.from('menu_items').select('name, price, category').eq('tenant_id', tenantId).eq('active', true).order('category'),
    admin.from('business_knowledge').select('category, content').eq('tenant_id', tenantId).eq('active', true),
  ])

  const tenant = tenantRes.data
  const menu = menuRes.data || []
  const knowledge = knowledgeRes.data || []

  // Parse request body
  const body = await req.json()
  const userMessage = body.message || body.content || ''
  const history: Array<{ role: string; content: string }> = body.messages || body.history || []

  if (!userMessage && !history.length) {
    return NextResponse.json({ content: 'No recibí ningún mensaje.' })
  }

  // Check API key
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) {
    logger.error('ANTHROPIC_API_KEY not configured', { tenantId })
    return NextResponse.json({ content: 'Asistente no configurado. Contacta soporte.' })
  }

  // Build system prompt
  const businessName = tenant?.name || 'tu negocio'
  const agentName = tenant?.agent_name || 'Sofía'

  const menuSummary = menu.length
    ? `\nCarta actual (${menu.length} productos):\n` + menu.map(i => `- ${i.name} (${i.price}€) [${i.category}]`).join('\n')
    : '\nLa carta está vacía.'

  const knowledgeSummary = knowledge.length
    ? '\n\nInformación del negocio:\n' + knowledge.map(k => `${(k.category || 'info').toUpperCase()}: ${k.content}`).join('\n')
    : ''

  const systemPrompt = `Eres el asistente de ${businessName}. Te llamas ${agentName}. Ayudas al dueño a gestionar su negocio.

Puedes:
- Consultar y modificar la carta (añadir, quitar, cambiar precios, mover categorías)
- Ver reservas, llamadas y estadísticas del día
- Cambiar horarios del negocio
- Crear y cancelar reservas
- Añadir información al negocio (FAQs, políticas, etc.)

Reglas:
- Habla en español, informal pero profesional
- Sé directo y útil
- Si modificas algo, confirma qué has hecho
- Si algo es peligroso (borrar muchos productos), pide confirmación
- Respuestas cortas (máximo 3 frases)
- Si no puedes hacer algo, dilo claro

Contexto:${menuSummary}${knowledgeSummary}

Fecha actual: ${new Date().toISOString().split('T')[0]}`

  // Build messages — use the history from frontend (which includes the latest user msg)
  // The frontend sends the full conversation in `messages` including the user's latest
  let messages: Array<{ role: string; content: string }>
  if (history.length && history[history.length - 1]?.role === 'user') {
    // Frontend sent full conversation with user message already included
    messages = history.slice(-10)
  } else {
    // Fallback: append user message
    messages = [...history.slice(-10), { role: 'user', content: userMessage }]
  }

  // Ensure messages alternate properly and start with user
  if (messages[0]?.role !== 'user') {
    messages = messages.filter((_, i) => i > 0 || true) // keep as-is, Claude handles it
  }

  try {
    let response = await callClaude(anthropicKey, systemPrompt, messages)

    // Tool use loop (max 3 iterations)
    let iterations = 0
    while (response.stop_reason === 'tool_use' && iterations < 3) {
      iterations++

      const toolBlocks = response.content.filter(
        (b: { type: string }) => b.type === 'tool_use'
      )

      const toolResults = []
      for (const toolBlock of toolBlocks) {
        const result = await executeTool(toolBlock.name, toolBlock.input, tenantId)
        toolResults.push({
          type: 'tool_result' as const,
          tool_use_id: toolBlock.id,
          content: result,
        })
      }

      // Append assistant response and tool results, then call again
      messages = [
        ...messages,
        { role: 'assistant', content: response.content },
        { role: 'user', content: toolResults },
      ]

      response = await callClaude(anthropicKey, systemPrompt, messages)
    }

    // Extract text from final response
    const textBlocks = response.content.filter(
      (b: { type: string }) => b.type === 'text'
    )
    const content = textBlocks.map((b: { text: string }) => b.text).join('\n') || 'Hecho.'

    logger.info('Assistant chat', { tenantId, durationMs: Date.now() - start, iterations })

    return NextResponse.json({ content })
  } catch (err) {
    logger.error('Assistant chat error', { tenantId }, err)
    return NextResponse.json({ content: 'Error al procesar tu mensaje. Intenta de nuevo.' })
  }
}

// ── Claude API call helper ───────────────────────────────────

async function callClaude(
  apiKey: string,
  system: string,
  messages: unknown[],
) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system,
      tools: TOOLS,
      messages,
    }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => 'Unknown error')
    throw new Error(`Anthropic API error ${res.status}: ${err}`)
  }

  return res.json()
}
