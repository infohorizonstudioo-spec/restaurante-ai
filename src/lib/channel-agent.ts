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
    default:
      return { error: `Unknown tool: ${name}` }
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

  return `Eres ${bc.agent_name || 'el asistente virtual'} de ${bc.business_name}, un negocio de tipo ${bc.business_type}.

${CHANNEL_INSTRUCTIONS[channel] || CHANNEL_INSTRUCTIONS.whatsapp}
${TONE_INSTRUCTIONS[responseTone] || TONE_INSTRUCTIONS.professional}

FECHA DE HOY: ${today}

INFORMACIÓN DEL NEGOCIO:
${bc.business_information || 'No disponible'}

HORARIOS:
${typeof bc.hours_var === 'object' ? JSON.stringify(bc.hours_var) : bc.hours_var || 'Consultar'}

SERVICIOS/CARTA:
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

${customerContext ? `CONTEXTO DEL CLIENTE:\n${customerContext}` : ''}

${bc.memory_var?.owner_rules?.length ? `REGLAS DEL PROPIETARIO:\n${bc.memory_var.owner_rules.join('\n')}` : ''}

INSTRUCCIONES IMPORTANTES:
- SIEMPRE llama a check_availability ANTES de crear una reserva
- Solo llama a create_reservation tras confirmación explícita del cliente
- Si el cliente pregunta algo que no puedes resolver, sugiere llamar al negocio
- Responde SIEMPRE en el idioma del cliente
- NO inventes información que no esté en el contexto del negocio`
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

  const systemPrompt = buildSystemPrompt({
    channel, businessContext, businessTypeLogic, responseTone, customerContext,
  })

  // Build messages array: history + current message
  const messages: Anthropic.MessageParam[] = [
    ...conversationHistory.map(m => ({
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
      max_tokens: 1024,
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
  if (actions.some(a => a.type === 'create_reservation')) intent = 'reserva'
  else if (actions.some(a => a.type === 'cancel_reservation')) intent = 'cancelacion'
  else if (actions.some(a => a.type === 'modify_reservation')) intent = 'modificacion'
  else if (actions.some(a => a.type === 'update_order')) intent = 'pedido'
  else if (actions.some(a => a.type === 'check_availability')) intent = 'consulta'
  else if (actions.some(a => a.type === 'get_menu_or_services')) intent = 'consulta'

  return {
    content: finalResponse || 'Lo siento, no he podido procesar tu mensaje. ¿Puedes intentarlo de nuevo?',
    intent,
    actions,
    shouldClose: false,
  }
}
