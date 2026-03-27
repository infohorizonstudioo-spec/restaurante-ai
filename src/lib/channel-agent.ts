/**
 * CHANNEL AGENT — Claude-based text agent for WhatsApp, Email, SMS.
 * Uses the same business context and tools as the voice agent (ElevenLabs).
 * Calls agent-tools.ts functions directly instead of HTTP routes.
 */
import Anthropic from '@anthropic-ai/sdk'
import {
  checkAvailabilityTool,
  createReservationTool,
  cancelReservationTool,
  modifyReservationTool,
  getMenuTool,
  updateOrderTool,
  addToWaitlistTool,
} from './agent-tools'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })

// ── Tool definitions for Claude ──────────────────────────────
const TOOLS: Anthropic.Tool[] = [
  {
    name: 'check_availability',
    description: 'Verifica disponibilidad de un horario para reserva/cita. Llama SIEMPRE antes de crear una reserva.',
    input_schema: {
      type: 'object' as const,
      properties: {
        date: { type: 'string', description: 'Fecha en formato YYYY-MM-DD' },
        time: { type: 'string', description: 'Hora en formato HH:MM (opcional, si no se da devuelve todos los huecos)' },
        party_size: { type: 'number', description: 'Número de personas (default 1)' },
        zone: { type: 'string', description: 'Zona preferida (opcional)' },
      },
      required: ['date'],
    },
  },
  {
    name: 'create_reservation',
    description: 'Crea una reserva/cita confirmada. Solo llamar DESPUÉS de check_availability y confirmación del cliente.',
    input_schema: {
      type: 'object' as const,
      properties: {
        customer_name: { type: 'string', description: 'Nombre del cliente' },
        customer_phone: { type: 'string', description: 'Teléfono del cliente (opcional)' },
        date: { type: 'string', description: 'Fecha YYYY-MM-DD' },
        time: { type: 'string', description: 'Hora HH:MM' },
        party_size: { type: 'number', description: 'Número de personas' },
        notes: { type: 'string', description: 'Notas adicionales (alergias, servicio, etc.)' },
        zone: { type: 'string', description: 'Zona preferida (opcional)' },
      },
      required: ['customer_name', 'date', 'time'],
    },
  },
  {
    name: 'cancel_reservation',
    description: 'Cancela una reserva existente. Busca por teléfono o nombre.',
    input_schema: {
      type: 'object' as const,
      properties: {
        customer_name: { type: 'string', description: 'Nombre del cliente' },
        customer_phone: { type: 'string', description: 'Teléfono del cliente' },
        date: { type: 'string', description: 'Fecha de la reserva (opcional)' },
      },
      required: [],
    },
  },
  {
    name: 'modify_reservation',
    description: 'Modifica una reserva existente (fecha, hora, o número de personas).',
    input_schema: {
      type: 'object' as const,
      properties: {
        customer_name: { type: 'string', description: 'Nombre del cliente' },
        customer_phone: { type: 'string', description: 'Teléfono del cliente' },
        new_date: { type: 'string', description: 'Nueva fecha YYYY-MM-DD (opcional)' },
        new_time: { type: 'string', description: 'Nueva hora HH:MM (opcional)' },
        new_party_size: { type: 'number', description: 'Nuevo número de personas (opcional)' },
      },
      required: [],
    },
  },
  {
    name: 'get_menu_or_services',
    description: 'Obtiene la carta, menú, servicios o precios del negocio.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'update_order',
    description: 'Crea o actualiza un pedido (hostelería). Permite añadir items y confirmar.',
    input_schema: {
      type: 'object' as const,
      properties: {
        order_id: { type: 'string', description: 'ID del pedido (para actualizar uno existente)' },
        action: { type: 'string', description: '"confirm" o "cancel" (opcional)' },
        customer_name: { type: 'string', description: 'Nombre del cliente' },
        customer_phone: { type: 'string', description: 'Teléfono (opcional)' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              quantity: { type: 'number' },
              price: { type: 'number' },
            },
          },
          description: 'Lista de productos',
        },
        order_type: { type: 'string', description: '"recoger", "domicilio", o "mesa"' },
        notes: { type: 'string', description: 'Notas del pedido' },
      },
      required: ['customer_name'],
    },
  },
  {
    name: 'escalate_to_human',
    description: 'Escala la conversación a un humano cuando no puedes resolver algo: quejas graves, situaciones delicadas, peticiones complejas, o cuando el cliente pide hablar con una persona.',
    input_schema: {
      type: 'object' as const,
      properties: {
        reason: { type: 'string', description: 'Motivo de la escalación (ej: "Queja grave", "Solicitud compleja")' },
      },
      required: ['reason'],
    },
  },
]

// ── Execute a tool call ──────────────────────────────────────
async function executeTool(tenantId: string, name: string, input: any, source: string): Promise<any> {
  const params = { ...input, tenant_id: tenantId }

  switch (name) {
    case 'check_availability':
      return checkAvailabilityTool(params)
    case 'create_reservation':
      return createReservationTool({ ...params, source })
    case 'cancel_reservation':
      return cancelReservationTool(params)
    case 'modify_reservation':
      return modifyReservationTool(params)
    case 'get_menu_or_services':
      return getMenuTool(params)
    case 'update_order':
      return updateOrderTool(params)
    case 'add_to_waitlist':
      return addToWaitlistTool(params)
    case 'escalate_to_human':
      return escalateToHumanTool(tenantId, input)
    default:
      return { error: `Unknown tool: ${name}` }
  }
}

// ── Escalate to human handler ────────────────────────────────
async function escalateToHumanTool(tenantId: string, input: { reason: string }) {
  const { createClient } = await import('@supabase/supabase-js')
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  // Create critical notification
  await admin.from('notifications').insert({
    tenant_id: tenantId,
    type: 'important_alert',
    title: 'Conversación escalada',
    body: input.reason,
    priority: 'critical',
    read: false,
    action_required: true,
    target_url: '/mensajes',
  })

  return {
    success: true,
    message: 'Conversación escalada al responsable. El equipo se pondrá en contacto.',
    reason: input.reason,
  }
}

// ── Channel-specific formatting instructions ─────────────────
const CHANNEL_INSTRUCTIONS: Record<string, string> = {
  whatsapp: `Estás respondiendo por WhatsApp. Sé conciso y directo. Usa párrafos cortos. Puedes usar *negritas* para destacar. Máximo 300 caracteres por mensaje cuando sea posible. No uses markdown complejo.`,
  email: `Estás respondiendo por email. Usa un formato más formal. Incluye saludo y despedida. Puedes ser más detallado que por WhatsApp. Firma como el asistente virtual del negocio.`,
  sms: `Estás respondiendo por SMS. Sé ultra-conciso. Máximo 160 caracteres. Sin emojis. Solo información esencial.`,
}

const TONE_INSTRUCTIONS: Record<string, string> = {
  professional: 'Usa un tono profesional, cortés y eficiente.',
  friendly: 'Usa un tono cálido y cercano, pero profesional. Algún emoji puntual está bien.',
  casual: 'Usa un tono informal y conversacional, como hablando con un amigo.',
}

// ── Build system prompt ──────────────────────────────────────
function buildSystemPrompt(params: {
  channel: string
  businessContext: any
  businessTypeLogic: any
  responseTone: string
  customerContext?: string
}): string {
  const { channel, businessContext, businessTypeLogic, responseTone, customerContext } = params
  const bc = businessContext
  const btl = businessTypeLogic

  const today = new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  // Contexto específico por tipo de negocio
  const TYPE_CONTEXT: Record<string, string> = {
    restaurante: 'Eres la recepcionista del restaurante. Hablas de reservas, mesas, carta y pedidos.',
    bar: 'Eres la persona que atiende en el bar. Hablas de reservas, zona, tapas y eventos.',
    clinica_dental: 'Eres la recepcionista de la clínica dental. Hablas de citas, tratamientos y urgencias dentales. NO preguntes síntomas.',
    clinica_medica: 'Eres la recepcionista de la clínica. Hablas de citas, especialidades y revisiones. NO preguntes motivo médico.',
    veterinaria: 'Eres la recepcionista de la veterinaria. Hablas de citas para mascotas, vacunas y urgencias.',
    peluqueria: 'Eres la recepcionista del salón. Hablas de citas, servicios de peluquería y estilismo.',
    barberia: 'Eres quien atiende en la barbería. Hablas de citas, cortes, barba y servicios.',
    fisioterapia: 'Eres la recepcionista de fisioterapia. Hablas de sesiones, tratamientos y rehabilitación.',
    psicologia: 'Eres la recepcionista de psicología. Hablas de citas con total DISCRECIÓN. NUNCA preguntes motivos.',
    hotel: 'Eres el/la recepcionista del hotel. Hablas de reservas de habitación, check-in, check-out y servicios.',
    ecommerce: 'Eres el servicio de atención al cliente de la tienda. Hablas de pedidos, productos, envíos y devoluciones.',
    gimnasio: 'Eres quien atiende en el gimnasio. Hablas de clases, horarios, abonos e inscripciones.',
    academia: 'Eres la secretaría de la academia. Hablas de clases, cursos, horarios e inscripciones.',
    spa: 'Eres la recepcionista del spa. Hablas de citas, tratamientos, masajes y bonos.',
    taller: 'Eres quien atiende en el taller. Hablas de citas, revisiones, reparaciones y presupuestos.',
    asesoria: 'Eres la recepcionista de la asesoría. Hablas de citas, consultas fiscales, laborales y jurídicas.',
    seguros: 'Eres quien atiende en la correduría. Hablas de citas, pólizas, seguros y siniestros urgentes.',
    inmobiliaria: 'Eres quien atiende en la inmobiliaria. Hablas de visitas, pisos disponibles y citas con agentes.',
  }

  const typeContext = TYPE_CONTEXT[bc.business_type] || `Eres ${bc.agent_name || 'el asistente'} de ${bc.business_name}.`

  return `${typeContext}
Te llamas ${bc.agent_name || 'Asistente'}. Trabajas en ${bc.business_name}.

${CHANNEL_INSTRUCTIONS[channel] || CHANNEL_INSTRUCTIONS.whatsapp}
${TONE_INSTRUCTIONS[responseTone] || TONE_INSTRUCTIONS.professional}

FECHA DE HOY: ${today}

INFORMACIÓN DEL NEGOCIO:
${bc.business_information || 'No disponible'}

HORARIOS:
${typeof bc.hours_var === 'object' ? JSON.stringify(bc.hours_var) : bc.hours_var || 'Consultar'}

SERVICIOS${btl.catalog_label ? ' / ' + btl.catalog_label.toUpperCase() : ''}:
${(bc.services_var || bc.catalog_var || bc.menu_var || []).join(', ') || 'Disponible bajo petición'}

REGLAS:
${JSON.stringify(bc.rules_var || {})}

FAQs:
${(bc.faqs_var || []).join('\n') || 'No disponible'}

FLUJO DE TRABAJO (${btl.sector || bc.business_type}):
Acción principal: ${btl.action_name || 'gestión'}
Campos requeridos: ${(btl.required_fields || []).join(', ')}
Campos opcionales: ${(btl.optional_fields || []).join(', ')}
Pasos: ${(btl.flow || []).join(' → ')}
${btl.urgency_keywords ? `Palabras de urgencia: ${btl.urgency_keywords.join(', ')}` : ''}
${btl.urgency_action ? `Si detectas urgencia: ${btl.urgency_action}` : ''}
${btl.crisis_keywords ? `Palabras de crisis: ${btl.crisis_keywords.join(', ')}` : ''}
${btl.crisis_action ? `Si detectas crisis: ${btl.crisis_action}` : ''}

${customerContext ? `CONTEXTO DEL CLIENTE:\n${customerContext}` : ''}

${bc.memory_var?.owner_rules?.length ? `REGLAS DEL PROPIETARIO:\n${bc.memory_var.owner_rules.join('\n')}` : ''}

INSTRUCCIONES IMPORTANTES:
- SIEMPRE llama a check_availability ANTES de crear una reserva/cita
- Solo llama a create_reservation tras confirmación explícita del cliente
- Si el cliente tiene una queja grave, situación delicada, o pide hablar con una persona, usa escalate_to_human
- Si el cliente pregunta algo que no puedes resolver, usa escalate_to_human o sugiere llamar al negocio
- Responde SIEMPRE en el idioma del cliente
- NO inventes información que no esté en el contexto del negocio
- Usa la terminología correcta: "${btl.action_name || 'gestión'}" (no digas "reserva" si es una cita, sesión o clase)`
}

// ── Main agent function ──────────────────────────────────────
export interface AgentResponse {
  content: string
  intent?: string
  actions: { type: string; params: any; result: any }[]
  shouldClose?: boolean
}

export async function processWithAgent(params: {
  tenantId: string
  channel: 'whatsapp' | 'email' | 'sms'
  customerMessage: string
  conversationHistory: { role: 'user' | 'assistant'; content: string }[]
  businessContext: any
  businessTypeLogic: any
  responseTone?: string
  customerContext?: string
  customerPhone?: string
}): Promise<AgentResponse> {
  const {
    tenantId, channel, customerMessage, conversationHistory,
    businessContext, businessTypeLogic,
    responseTone = 'professional', customerContext, customerPhone,
  } = params

  const source = `${channel}_agent`

  // Enrich customer context with smart intelligence
  let enrichedCustomerContext = customerContext || ''
  if (customerPhone) {
    try {
      const { buildSmartCustomerContext } = await import('@/lib/smart-context')
      const { contextText } = await buildSmartCustomerContext(tenantId, customerPhone)
      if (contextText) enrichedCustomerContext += contextText
    } catch { /* non-critical enhancement */ }
  }

  const systemPrompt = buildSystemPrompt({
    channel, businessContext, businessTypeLogic, responseTone, customerContext: enrichedCustomerContext,
  })

  // Rolling window: keep last 20 messages to fit in context
  const recentHistory = conversationHistory.length > 20
    ? conversationHistory.slice(-20)
    : conversationHistory

  // Build messages array: history + current message
  const messages: Anthropic.MessageParam[] = [
    ...recentHistory.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: customerMessage },
  ]

  const actions: { type: string; params: any; result: any }[] = []
  let finalResponse = ''

  // Tool-use loop (max 5 iterations to prevent infinite loops)
  let currentMessages = [...messages]
  for (let i = 0; i < 5; i++) {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      temperature: 0.3,
      system: systemPrompt,
      tools: TOOLS,
      messages: currentMessages,
    })

    // Check if there are tool uses
    const toolUses = response.content.filter(b => b.type === 'tool_use')
    const textBlocks = response.content.filter(b => b.type === 'text')

    if (toolUses.length === 0) {
      // No tool calls → final response
      finalResponse = textBlocks.map(b => b.type === 'text' ? b.text : '').join('')
      break
    }

    // Execute tool calls
    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const toolUse of toolUses) {
      if (toolUse.type !== 'tool_use') continue
      const input = toolUse.input as any

      // Inject customerPhone if available and tool needs it
      if (customerPhone && !input.customer_phone) {
        input.customer_phone = customerPhone
      }

      const result = await executeTool(tenantId, toolUse.name, input, source)
      actions.push({ type: toolUse.name, params: input, result })
      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(result),
      })
    }

    // Add assistant response + tool results to continue the loop
    currentMessages = [
      ...currentMessages,
      { role: 'assistant', content: response.content },
      { role: 'user', content: toolResults },
    ]
  }

  // Detect intent from actions
  let intent: string | undefined
  if (actions.some(a => a.type === 'escalate_to_human')) intent = 'escalacion'
  else if (actions.some(a => a.type === 'create_reservation')) intent = 'reserva'
  else if (actions.some(a => a.type === 'cancel_reservation')) intent = 'cancelacion'
  else if (actions.some(a => a.type === 'modify_reservation')) intent = 'modificacion'
  else if (actions.some(a => a.type === 'update_order')) intent = 'pedido'
  else if (actions.some(a => a.type === 'check_availability')) intent = 'consulta'
  else if (actions.some(a => a.type === 'get_menu_or_services')) intent = 'consulta'

  // ── Post-interaction: classify and learn (non-blocking) ──
  try {
    const { classifyInteraction, learnFromInteraction } = await import('./intelligence-engine')
    const classification = classifyInteraction({
      text: customerMessage, business_type: businessContext?.type || 'otro',
      party_size: actions.find(a => a.params?.party_size)?.params?.party_size,
    })
    learnFromInteraction({
      tenant_id: tenantId, type: (intent as any) || classification.type,
      classification, customer_phone: customerPhone,
      outcome: actions.some(a => a.type === 'escalate_to_human') ? 'escalated' : 'success',
    }).catch(() => {})
  } catch { /* non-critical */ }

  return {
    content: finalResponse || 'Lo siento, no he podido procesar tu mensaje. ¿Puedes intentarlo de nuevo?',
    intent,
    actions,
    shouldClose: false,
  }
}
