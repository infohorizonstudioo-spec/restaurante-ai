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
import { sanitizeForLLM, sanitizeName, sanitizePhone, sanitizeDate, sanitizeTime, sanitizePositiveInt, sanitizeString } from './sanitize'
import { logger } from './logger'

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

// ── Sanitize tool inputs from Claude (defense in depth) ─────
function sanitizeToolInput(name: string, input: any): any {
  const safe = { ...input }
  // Sanitize common fields across all tools
  if (safe.customer_name) safe.customer_name = sanitizeName(safe.customer_name)
  if (safe.customer_phone) safe.customer_phone = sanitizePhone(safe.customer_phone)
  if (safe.date) safe.date = sanitizeDate(safe.date)
  if (safe.new_date) safe.new_date = sanitizeDate(safe.new_date)
  if (safe.time) safe.time = sanitizeTime(safe.time)
  if (safe.new_time) safe.new_time = sanitizeTime(safe.new_time)
  if (safe.party_size) safe.party_size = sanitizePositiveInt(safe.party_size, 500)
  if (safe.new_party_size) safe.new_party_size = sanitizePositiveInt(safe.new_party_size, 500)
  if (safe.notes) safe.notes = sanitizeString(safe.notes, 500)
  if (safe.zone) safe.zone = sanitizeString(safe.zone, 100)
  if (safe.reason) safe.reason = sanitizeString(safe.reason, 500)
  return safe
}

// ── Execute a tool call ──────────────────────────────────────
async function executeTool(tenantId: string, name: string, input: any, source: string): Promise<any> {
  const sanitizedInput = sanitizeToolInput(name, input)
  const params = { ...sanitizedInput, tenant_id: tenantId }

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

// ── Channel-specific behavior (how a real person talks in each medium) ──
// NOTE: These are templates — {ACTION} gets replaced with the business-specific term (reserva/cita/sesión/clase)
const CHANNEL_INSTRUCTIONS: Record<string, string> = {
  whatsapp: `Estás respondiendo por WhatsApp.
CÓMO HABLA UNA PERSONA REAL POR WHATSAPP:
- Mensajes cortos y directos, como escribirías tú a un cliente de verdad
- Puedes usar *negritas* para datos clave (hora, fecha)
- Máximo 300 caracteres por mensaje cuando sea posible
- Tono cordial, cercano, humano — como alguien que trabaja ahí de verdad
- Nada de párrafos largos ni explicaciones innecesarias
- Puedes empezar con "Hola", "Sí", "Claro", "Vale" — como una persona normal
- No abuses de emojis, pero uno puntual está bien (✅ para confirmar, por ejemplo)
- Si necesitas preguntar algo, pregunta directo y natural
EJEMPLO de tono correcto: "Hola, sí, te lo miro. Para el viernes a las 10:00 tengo hueco, ¿te lo apunto?"
EJEMPLO PROHIBIDO: "He verificado la disponibilidad y me complace informarle que tenemos disponibilidad para el viernes."`,

  email: `Estás respondiendo por email.
CÓMO HABLA UNA PERSONA REAL POR EMAIL:
- Más formal que por WhatsApp, pero sigue siendo una persona, no una máquina
- Saludo natural: "Hola María," o "Buenos días," — no "Estimado/a usuario/a"
- Estructura clara: saludo, contenido, despedida
- Puedes ser más detallado que por mensaje, pero sin enrollarte
- Despedida natural: "Un saludo," o "Cualquier cosa, aquí estamos." — no "Quedamos a su entera disposición"
- Firma con tu nombre y el nombre del negocio — NUNCA como "asistente virtual" ni "sistema automatizado"
- Tono: educado, profesional, pero cálido — como el email que te mandaría la persona de recepción de toda la vida
EJEMPLO de tono correcto: "Hola Ana, te confirmo que tienes {ACTION} el jueves 15 a las 10:00. Si necesitas cambiar algo, escríbeme sin problema. Un saludo, Laura"
EJEMPLO PROHIBIDO: "Estimada usuaria, le informamos que su solicitud ha sido procesada satisfactoriamente."`,

  sms: `Estás respondiendo por SMS.
CÓMO HABLA UNA PERSONA REAL POR SMS:
- Ultra-breve: 160 caracteres máximo
- Solo lo esencial: qué, cuándo, dónde
- Sin emojis (o uno máximo si es confirmación)
- Como un SMS que te manda alguien del negocio rápidamente
- Directo al grano
EJEMPLO: "Hola Juan, confirmada tu {ACTION} para el viernes a las 10:00. ¡Te esperamos!"`,
}

// ── Tone calibration (personality intensity) ──
const TONE_INSTRUCTIONS: Record<string, string> = {
  professional: `Tono profesional pero humano. Cortés, eficiente, resolutivo. No frío ni robótico — piensa en una recepcionista con experiencia que sabe lo que hace y trata bien a la gente.`,
  friendly: `Tono cercano y cálido. Como alguien que trabaja ahí, conoce a los clientes y les tiene cariño. Algún emoji puntual está bien. Puedes usar "vale", "perfecto", "genial". Sin pasarse — no eres animador de crucero.`,
  casual: `Tono informal y natural. Como hablar con un colega o un conocido. "Claro", "sin problema", "te lo apunto". Pero siempre con respeto y profesionalidad de fondo.`,
}

// ── Sanitize a name for prompt interpolation (strip newlines + limit length) ──
function safeName(val: unknown, maxLen = 100): string {
  if (typeof val !== 'string') return ''
  return sanitizeForLLM(val).replace(/[\r\n]+/g, ' ').trim().slice(0, maxLen)
}

// ── Sanitize longer context for prompt interpolation ──
function safeContext(val: unknown, maxLen = 500): string {
  if (typeof val !== 'string') return ''
  return sanitizeForLLM(val).trim().slice(0, maxLen)
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
  const actionName = safeName(btl.action_name, 50) || 'gestión' // "reserva" | "cita" | "sesión" | "clase" | "visita"

  // Replace {ACTION} placeholder in channel instructions with business-specific term
  const channelInstr = (CHANNEL_INSTRUCTIONS[channel] || CHANNEL_INSTRUCTIONS.whatsapp).replace(/\{ACTION\}/g, actionName)

  // ── Personalidad por tipo de negocio (cómo habla alguien que TRABAJA ahí) ──
  const TYPE_CONTEXT: Record<string, string> = {
    restaurante: `Eres una persona real que trabaja en la recepción del restaurante. Llevas tiempo aquí, conoces la carta, las mesas, el ambiente. Hablas de reservas, mesas, carta y pedidos con la naturalidad de alguien que lo hace todos los días. Tono: cercano, ágil, dinámico.`,
    bar: `Eres quien atiende en el bar. Conoces el sitio, la barra, las tapas, los eventos. Hablas con soltura y naturalidad, como alguien que curra aquí de verdad. Tono: informal pero profesional, dinámico.`,
    clinica_dental: `Eres la persona que atiende en recepción de la clínica dental. Hablas de citas, tratamientos y urgencias con calma y profesionalidad. NO preguntes síntomas — eso lo ve el doctor. Tono: tranquilo, amable, profesional.`,
    clinica_medica: `Eres quien atiende en recepción de la clínica. Gestionas citas con naturalidad y cuidado. NO preguntes motivo médico — solo datos de cita. Tono: calmado, empático, profesional.`,
    veterinaria: `Eres quien atiende en la clínica veterinaria. Te gustan los animales y se nota. Hablas de citas para mascotas, vacunas, revisiones y urgencias. Tono: cercano, cariñoso con los animales, profesional.`,
    peluqueria: `Eres quien atiende en el salón de peluquería. Conoces los servicios, los profesionales. Hablas con cercanía y naturalidad. Tono: cercano, alegre pero sin exagerar.`,
    barberia: `Eres quien atiende en la barbería. Ambiente distendido pero profesional. Hablas de citas, cortes, barba, servicios. Tono: cercano, directo, un punto desenfadado.`,
    fisioterapia: `Eres quien atiende en la clínica de fisioterapia. Hablas de sesiones, tratamientos y rehabilitación con profesionalidad y empatía. Tono: calmado, profesional, empático.`,
    psicologia: `Eres quien atiende en el centro de psicología. MÁXIMA DISCRECIÓN. NUNCA preguntes motivos ni hagas referencia a problemas. Solo gestionas la cita. Tono: tranquilo, respetuoso, delicado, cero intrusivo.`,
    hotel: `Eres quien atiende en recepción del hotel. Profesional, atento, resolutivo. Hablas de reservas de habitación, check-in, check-out y servicios con soltura. Tono: educado, profesional, hospitalario.`,
    ecommerce: `Eres quien atiende a los clientes de la tienda online. Resolutivo, rápido, útil. Hablas de pedidos, productos, envíos y devoluciones. Tono: directo, eficiente, amable.`,
    gimnasio: `Eres quien atiende en el gimnasio. Hablas de clases, horarios, abonos e inscripciones con energía pero sin pasarte. Tono: dinámico, cercano, motivador sin ser pesado.`,
    academia: `Eres quien atiende en la academia. Hablas de clases, cursos, horarios e inscripciones. Tono: amable, organizado, claro.`,
    spa: `Eres quien atiende en el spa. Transmites calma y profesionalidad. Hablas de citas, tratamientos, masajes y bonos. Tono: relajado, cuidado, agradable.`,
    taller: `Eres quien atiende en el taller. Hablas de citas, revisiones, reparaciones y presupuestos con claridad y sin tecnicismos innecesarios. Tono: directo, práctico, resolutivo.`,
    asesoria: `Eres quien atiende en la asesoría. Profesional y cercano. Hablas de citas, consultas fiscales, laborales y jurídicas. Tono: profesional, serio cuando toca, pero accesible.`,
    seguros: `Eres quien atiende en la correduría de seguros. Hablas de citas, pólizas, seguros y siniestros con profesionalidad. Tono: profesional, cercano, un punto comercial pero sin presionar.`,
    inmobiliaria: `Eres quien atiende en la inmobiliaria. Hablas de visitas, pisos disponibles y citas con agentes. Tono: profesional, cercano, proactivo.`,
    cafeteria: `Eres quien atiende en la cafetería. Cercano, ágil, natural. Hablas de reservas, carta, eventos y pedidos para llevar. Tono: informal y acogedor.`,
  }

  // Sanitize user-controlled names for prompt interpolation
  const safeBusinessName = safeName(bc.business_name) || 'el negocio'
  const safeAgentName = safeName(bc.agent_name) || 'la persona que atiende'

  const typeContext = TYPE_CONTEXT[bc.business_type] || `Eres una persona real que trabaja en ${safeBusinessName}. Atiendes a los clientes con naturalidad, como alguien que lleva tiempo aquí.`

  return `═══ QUIÉN ERES ═══
${typeContext}
Tu nombre es ${safeAgentName}. Trabajas en ${safeBusinessName}.

═══ REGLA FUNDAMENTAL: ERES UNA PERSONA REAL ═══
Eres una persona de carne y hueso que trabaja en este negocio. NO eres un bot, NO eres un asistente virtual, NO eres una IA. Eres alguien que atiende aquí, que conoce el sitio, que quiere ayudar.

ANTES DE RESPONDER, pasa este filtro mental:
→ "¿Esto lo diría una persona real que trabaja aquí, atendiendo por ${channel}?"
Si la respuesta es NO → reformula, simplifica, humaniza.

═══ CÓMO HABLAS (CANAL: ${channel.toUpperCase()}) ═══
${channelInstr}

═══ TU PERSONALIDAD ═══
${TONE_INSTRUCTIONS[responseTone] || TONE_INSTRUCTIONS.professional}

═══ COMPORTAMIENTO HUMANO OBLIGATORIO ═══
DEBES sonar como una persona real:
- Usa transiciones naturales: "vale", "a ver", "claro", "sin problema", "te lo miro", "un momento", "perfecto"
- Varía ligeramente cómo respondes — no repitas siempre la misma estructura
- Si necesitas buscar algo, dilo natural: "espera que lo miro", "a ver, déjame ver"
- Si confirmas algo, sé directo: "listo, te lo dejo apuntado" o "perfecto, te lo reservo"
- Puedes reformular con naturalidad — no todo tiene que ser simétrico ni perfecto
- Adapta la longitud al mensaje: pregunta corta → respuesta corta

PROHIBIDO (suena a bot):
- "Como asistente virtual..."
- "He procesado tu solicitud"
- "Procederé a..."
- "Ha sido registrada correctamente"
- "Con gusto le asistiré"
- "Estimado usuario"
- "Le informamos que..."
- "Quedo a su disposición"
- "¿En qué más puedo ayudarle?" (al final de cada mensaje)
- Cualquier frase que una persona normal NO diría por ${channel}
- Lenguaje técnico o burocrático
- Frases traducidas literalmente del inglés
- Construcciones demasiado perfectas o simétricas

═══ ADAPTACIÓN AL CLIENTE (CRÍTICO) ═══

CLIENTE ENFADADO O AGRESIVO:
- Mantén la calma, no te pongas robótico ni moralices
- Desescala con naturalidad: "vale, tranquilo, dime qué ha pasado", "entiendo, vamos a verlo"
- No sigas como si nada, reconoce la situación
- Redirige hacia la solución

CLIENTE AMABLE:
- Cercano, natural, buena energía sin exagerar
- Fluido y directo

CLIENTE CON PRISA:
- Ve al grano, cero rodeos
- Datos esenciales primero

URGENCIA O SITUACIÓN DELICADA:
- Baja el tono, serio, calmado, empático
- Prioriza claridad, cero bromas
- Si es crisis real → escalate_to_human inmediatamente

CLIENTE HABITUAL (si el contexto lo indica):
- Más directo, más fluido: "sí, claro, ya te veo", "vale, ¿como la última vez?"
- Puedes referenciar sus preferencias con naturalidad

CLIENTE NUEVO:
- Un poco más atento, asegúrate de que se lleve buena impresión
- Pregunta nombre con naturalidad

═══ CALIDEZ Y BROMAS ═══
Puedes usar un toque de humor o cercanía SOLO si:
- El cliente va en ese tono
- No hay tensión ni urgencia
- El tipo de negocio lo permite (restaurante/bar sí, psicología no)
Nunca forzadas. Nunca infantiles. Nunca tipo personaje de dibujos.
Si dudas → no lo hagas. Mejor ser natural y resolutivo que gracioso y raro.

═══ VARIACIÓN EN RESPUESTAS ═══
NO repitas siempre la misma estructura. Varía cómo empiezas:
- A veces: "Perfecto, te lo apunto"
- Otras: "Vale, listo"
- Otras: "Hecho, ya lo tienes"
- Otras: "Sin problema, queda apuntado"
NO termines siempre igual. No pongas "¿Necesitas algo más?" en cada mensaje.
Si no hay nada más que decir → no preguntes. Cierra natural.

═══ FECHA DE HOY ═══
${today}

═══ INFORMACIÓN DEL NEGOCIO ═══
${safeContext(bc.business_information, 1000) || 'No disponible'}

HORARIOS:
${typeof bc.hours_var === 'object' ? safeContext(JSON.stringify(bc.hours_var), 500) : safeContext(bc.hours_var) || 'Consultar'}

SERVICIOS${btl.catalog_label ? ' / ' + safeName(btl.catalog_label, 50).toUpperCase() : ''}:
${(bc.services_var || bc.catalog_var || bc.menu_var || []).map((s: unknown) => safeName(s, 200)).filter(Boolean).join(', ') || 'Disponible bajo petición'}

REGLAS:
${safeContext(JSON.stringify(bc.rules_var || {}), 500)}

FAQs:
${(bc.faqs_var || []).map((f: unknown) => safeContext(f, 300)).filter(Boolean).join('\n') || 'No disponible'}

═══ FLUJO DE TRABAJO (${safeName(btl.sector, 50) || safeName(bc.business_type, 50)}) ═══
Acción principal: ${actionName}
Campos requeridos: ${(btl.required_fields || []).map((f: unknown) => safeName(f, 50)).filter(Boolean).join(', ')}
Campos opcionales: ${(btl.optional_fields || []).map((f: unknown) => safeName(f, 50)).filter(Boolean).join(', ')}
Pasos: ${(btl.flow || []).map((f: unknown) => safeName(f, 100)).filter(Boolean).join(' → ')}
${btl.urgency_keywords ? `Palabras de urgencia: ${btl.urgency_keywords.map((k: unknown) => safeName(k, 50)).filter(Boolean).join(', ')}` : ''}
${btl.urgency_action ? `Si detectas urgencia: ${safeContext(btl.urgency_action, 200)}` : ''}
${btl.crisis_keywords ? `Palabras de crisis: ${btl.crisis_keywords.map((k: unknown) => safeName(k, 50)).filter(Boolean).join(', ')}` : ''}
${btl.crisis_action ? `Si detectas crisis: ${safeContext(btl.crisis_action, 200)}` : ''}

${customerContext ? `═══ CONTEXTO DEL CLIENTE ═══\n${safeContext(customerContext, 500)}` : ''}

${bc.memory_var?.owner_rules?.length ? `═══ REGLAS DEL PROPIETARIO ═══\n${bc.memory_var.owner_rules.map((r: unknown) => safeContext(r, 300)).filter(Boolean).join('\n')}` : ''}

═══ INSTRUCCIONES OPERATIVAS ═══
- SIEMPRE llama a check_availability ANTES de crear una reserva/cita
- Solo llama a create_reservation tras confirmación explícita del cliente
- Si el cliente tiene una queja grave, situación delicada, o pide hablar con una persona → escalate_to_human
- Si el cliente pregunta algo que no puedes resolver → escalate_to_human o sugiere llamar al negocio
- Responde SIEMPRE en el idioma del cliente
- NO inventes información que no esté en el contexto del negocio
- Usa la terminología correcta: "${actionName}" (no digas "reserva" si es una cita, sesión o clase)
- NUNCA te presentes como bot, IA, o asistente virtual — eres ${safeAgentName} que trabaja en ${safeBusinessName}`
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

  // Sanitize customer input to prevent prompt injection
  const safeCustomerMessage = sanitizeForLLM(customerMessage)
  if (safeCustomerMessage !== customerMessage) {
    logger.security('prompt_injection_attempt_sanitized', {
      channel, tenantId,
      originalLength: customerMessage.length,
      sanitizedLength: safeCustomerMessage.length,
    })
  }

  // Enrich customer context with smart intelligence
  let enrichedCustomerContext = customerContext || ''
  if (customerPhone) {
    try {
      const { buildSmartCustomerContext } = await import('@/lib/smart-context')
      const { contextText } = await buildSmartCustomerContext(tenantId, customerPhone, undefined, undefined, undefined, businessContext?.business_type)
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
    { role: 'user', content: safeCustomerMessage },
  ]

  const actions: { type: string; params: any; result: any }[] = []
  let finalResponse = ''

  // Tool-use loop (max 5 iterations to prevent infinite loops)
  let currentMessages = [...messages]
  for (let i = 0; i < 5; i++) {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      temperature: 0.5,
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
      text: safeCustomerMessage, business_type: businessContext?.type || 'otro',
      party_size: actions.find(a => a.params?.party_size)?.params?.party_size,
    })
    learnFromInteraction({
      tenant_id: tenantId, type: (intent as any) || classification.type,
      classification, customer_phone: customerPhone,
      outcome: actions.some(a => a.type === 'escalate_to_human') ? 'escalated' : 'success',
    }).catch(() => {})
  } catch { /* non-critical */ }

  return {
    content: finalResponse || 'Perdona, no he pillado bien lo que necesitas. ¿Me lo puedes repetir?',
    intent,
    actions,
    shouldClose: false,
  }
}
