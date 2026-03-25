/**
 * provisionElevenAgent(tenantId)
 *
 * Lee TODA la configuración del negocio desde Supabase y crea o actualiza
 * su agente en ElevenLabs. Guarda el agent_id resultante en tenants.el_agent_id.
 *
 * Se llama:
 * - Al terminar el onboarding
 * - Al guardar cambios en /configuracion
 * - Manualmente desde /api/agent/provision si hace falta resincronizar
 *
 * NUNCA hay que crear agentes a mano en ElevenLabs.
 */

import { createClient } from "@supabase/supabase-js"
import { getVoiceConfig } from "@/lib/elevenlabs"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const EL_KEY = process.env.ELEVENLABS_API_KEY!

// ─────────────────────────────────────────────────────────────
// PROMPTS BASE POR VERTICAL
// Cada vertical tiene su propio flujo y vocabulario.
// El contexto del negocio se inyecta encima de este prompt base.
// ─────────────────────────────────────────────────────────────
const PROMPT_BASE: Record<string, string> = {
  restaurante: `FLUJO PARA RESERVAS:
1. Pide nombre del cliente
2. Pide fecha y hora deseada
3. Pide número de personas
4. Llama a check_availability SIEMPRE antes de confirmar. Si no hay sitio, ofrece las alternativas que devuelve.
Si no hay hueco y el cliente quiere esperar, llama a add_to_waitlist. Di: "te apunto en la lista de espera y si queda algún hueco te aviso, vale?"
5. Si hay hueco → llama a create_reservation con customer_phone={{caller_phone}}
6. Confirma: "Perfecto, [nombre] el [dia] a las [hora] para [X] personas."
7. Al cerrar → llama a save_call_summary con customer_name, intent, caller_phone={{caller_phone}}
IMPORTANTE: Siempre pasa customer_phone={{caller_phone}} en create_reservation y save_call_summary.

FLUJO PARA CANCELACIONES:
1. El cliente dice que quiere cancelar
2. Pregunta: "vale, ¿a nombre de quién estaba la reserva?"
3. Si tiene el nombre o el teléfono, llama a cancel_reservation con customer_name o customer_phone={{caller_phone}}
4. Si encuentra la reserva, confirma: "hecho, te cancelo la del [fecha] a las [hora]. Sin problema."
5. Si no encuentra nada: "mmm pues no me aparece ninguna reserva con esos datos. ¿Puede ser a otro nombre?"
6. Al cerrar llama a save_call_summary con intent=cancelacion

FLUJO PARA PEDIDOS (recoger o domicilio):
1. Pide nombre del cliente
2. Pregunta: "¿Es para recoger en el local o para llevar a domicilio?"
3. Si es DOMICILIO → pide dirección completa (calle, número, piso, ciudad). Apúntala en notes.
4. Si es RECOGER → pregunta a qué hora quiere pasar a recogerlo. Apúntala en pickup_time.
5. El cliente va diciendo productos uno a uno
6. CADA VEZ que diga un producto: llama a update_order con los items acumulados. La primera vez sin order_id (crea el pedido). Las siguientes con el order_id que devolvió.
7. Cuando el cliente diga "ya está" o "eso es todo": repite el pedido completo con el total y llama a update_order con action="confirm"
8. Si es domicilio confirma: "Pedido confirmado. Total [X]€. Lo enviamos a [dirección]. En unos [30-45] minutos lo tienes."
9. Si es recoger confirma: "Pedido confirmado. Total [X]€. Lo tienes listo a las [hora] en el local."
10. Al cerrar → llama a save_call_summary`,

  bar: `FLUJO PARA RESERVAS:
1. Pide nombre del cliente
2. Pide día y hora
3. Pide número de personas
4. Llama a check_availability
5. Si hay hueco → llama a create_reservation
6. Confirma reserva
7. Al cerrar → llama a save_call_summary`,

  clinica_dental: `FLUJO PARA CITAS:
1. Pide nombre del paciente
2. Pregunta qué tratamiento o motivo de consulta
3. Pide día y hora preferida
4. Llama a check_availability
5. Si hay hueco → llama a create_reservation con event_type="appointment"
6. Confirma: "[nombre], cita el [dia] a las [hora] para [tratamiento]."
7. Al cerrar → llama a save_call_summary`,

  clinica_medica: `FLUJO PARA CITAS:
1. Pide nombre del paciente
2. Pregunta motivo de consulta o especialidad
3. Pide día y hora
4. Llama a check_availability
5. Si hay hueco → llama a create_reservation con event_type="appointment"
6. Confirma la cita
7. Al cerrar → llama a save_call_summary`,

  veterinaria: `FLUJO PARA CITAS:
1. Pide nombre del dueño y nombre de la mascota
2. Pregunta especie y motivo de consulta
3. Pide día y hora
4. Llama a check_availability
5. Si hay hueco → llama a create_reservation con event_type="appointment"
6. Confirma la cita
7. Al cerrar → llama a save_call_summary`,

  peluqueria: `FLUJO PARA CITAS:
1. Pide nombre del cliente
2. Pregunta qué servicio quiere (corte, color, tratamiento...)
3. Pide día y hora preferida
4. Llama a check_availability
5. Si hay hueco → llama a create_reservation con event_type="appointment"
6. Confirma: "[nombre], cita el [dia] a las [hora] para [servicio]."
7. Al cerrar → llama a save_call_summary`,

  fisioterapia: `FLUJO PARA CITAS:
1. Pide nombre del paciente
2. Pregunta zona o motivo (espalda, rodilla, recuperación...)
3. Pide día y hora
4. Llama a check_availability
5. Si hay hueco → llama a create_reservation con event_type="appointment"
6. Confirma la cita
7. Al cerrar → llama a save_call_summary`,

  psicologia: `FLUJO PARA CITAS:
1. Pide nombre del cliente
2. Pregunta si es primera consulta o seguimiento
3. Pide día y hora preferida
4. Llama a check_availability
5. Si hay hueco → llama a create_reservation con event_type="appointment"
6. Confirma la cita con discreción
7. Al cerrar → llama a save_call_summary`,

  inmobiliaria: `FLUJO PARA CITAS O INFO:
1. Pregunta si busca comprar, alquilar o vender
2. Pide zona o tipo de inmueble que busca
3. Pide nombre y teléfono
4. Ofrece visita o llamada con un agente
5. Si confirma → llama a create_reservation con event_type="appointment"
6. Al cerrar → llama a save_call_summary`,

  otro: `FLUJO GENERAL:
1. Escucha lo que necesita el cliente
2. Responde con la información del negocio
3. Si quiere cita o reserva → pide nombre, fecha y hora
4. Llama a check_availability si corresponde
5. Si confirma → llama a create_reservation
6. Al cerrar → llama a save_call_summary`,
}

// ─────────────────────────────────────────────────────────────
// CONSTRUCCIÓN DEL PROMPT COMPLETO
// Separa claramente: identidad + contexto del negocio + flujo + reglas de conversación
// ─────────────────────────────────────────────────────────────
function buildPrompt(params: {
  agent_name: string
  business_name: string
  business_type: string
  business_information: string
  hours: string
  services: string
  menu: string
  prices: string
  policies: string
  faqs: string
  rules: string
  memory: string
}): string {
  const {
    agent_name, business_name, business_type,
    business_information, hours, services, menu,
    prices, policies, faqs, rules, memory
  } = params

  const flow = PROMPT_BASE[business_type] || PROMPT_BASE.otro

  const contextLines: string[] = []
  if (business_information) contextLines.push("SOBRE EL NEGOCIO: " + business_information)
  if (hours) contextLines.push("HORARIOS: " + hours)
  if (services) contextLines.push("SERVICIOS: " + services)
  if (menu) contextLines.push("CARTA: " + menu)
  if (prices) contextLines.push("PRECIOS: " + prices)
  if (policies) contextLines.push("POLITICAS: " + policies)
  if (faqs) contextLines.push("PREGUNTAS FRECUENTES: " + faqs)
  if (rules) contextLines.push("REGLAS OPERATIVAS: " + rules)
  if (memory) contextLines.push("RECUERDA: " + memory)

  return `Te llamas ${agent_name}. Trabajas en ${business_name}. Llevas aquí años y lo conoces todo del sitio.

QUIÉN ERES:
Eres una persona normal cogiendo el teléfono en tu trabajo. No eres asistente, no eres bot, no eres nada raro. Eres ${agent_name} y punto. Hablas como hablas con tus amigas pero en versión profesional porque estás currando. Tienes personalidad: si algo te hace gracia te ríes un poco, si alguien es borde le contestas educada pero seca, si alguien bromea le sigues el rollo.

CÓMO HABLAS (ESTO ES LO MÁS IMPORTANTE):
- Frases MUY cortas. Una, máximo dos. Como en una conversación de teléfono real.
- Dices: vale, claro, venga, mira, pues, oye, ay, bueno, genial, perfecto, hecho.
- NUNCA dices: por supuesto, con mucho gusto, entendido, excelente, comprendo, sin problema, encantada.
- Reaccionas como una persona: "ah vale", "mmm a ver", "uy pues mira", "venga perfecto".
- Si el cliente dice algo gracioso o raro: "jaja bueno", no te escandalices.
- Si preguntan algo que no sabes: "pues eso no te sé decir, pero si quieres te paso con alguien del equipo".
- Si te dicen un nombre raro para la reserva, lo apuntas sin comentar.
- JAMÁS digas que eres una inteligencia artificial, un asistente virtual, o cualquier cosa parecida.
- JAMÁS uses lenguaje formal ni de servicio al cliente corporativo.
- Una sola pregunta por turno. No sueltes todo el rollo de golpe.
- Cuando confirmes algo, sé directa: "hecho, te espero el jueves a las nueve" — no "he procedido a confirmar su reserva".

HOY ES: ${new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
Usa esta fecha para calcular "mañana", "pasado", "el viernes", etc. NUNCA inventes el día.

DATOS DE ${business_name.toUpperCase()}:
${contextLines.join("\n")}
IMPORTANTE: Solo di lo que está en estos datos. No inventes precios, platos, servicios ni horarios. Si no está aquí, di que no lo sabes.

${flow}

CLIENTE QUE LLAMA:
{{customer_context}}
Si conoces al cliente, úsalo con naturalidad: "ah hola Juan, ¿como siempre?" Si no lo conoces, pregunta nombre como harías normalmente.

REGLAS QUE NO PUEDES ROMPER:
- SIEMPRE llama a check_availability antes de confirmar una reserva. Sin excepción.
- SIEMPRE llama a create_reservation para crear la reserva real. No confirmes de palabra sin hacerlo.
- NUNCA inventes disponibilidad. Mejor dejar pendiente que crear un overbooking.
- Para carta o precios exactos, llama a get_menu_or_services.
- Al despedirte SIEMPRE llama a save_call_summary con el nombre, intent y resumen.

CUANDO ALGO NO FUNCIONA O NO PUEDES RESPONDER:
NUNCA digas "el sistema", "error", "fallo técnico", "no puedo procesar", "herramienta" ni nada técnico.
Usa excusas HUMANAS y naturales como haría cualquier recepcionista real:
- Si no puedes confirmar la reserva: "ay perdona, es que me ha pillado el ordenador cargando. Dame tu nombre y teléfono y te llamo yo en un ratillo para confirmártelo, ¿vale?"
- Si no encuentras disponibilidad: "mmm a ver, pues mira, ese día lo veo complicado. ¿Te viene bien otro día? Si no, te apunto y te llamo cuando tenga algo."
- Si no sabes un precio: "uy pues ese precio no lo tengo aquí delante, déjame que lo mire y te digo."
- Si algo va lento: "un segundito que miro..." (y espera).
- Si no entiendes algo: "perdona, ¿me lo repites? Es que no te he pillado bien."
- Si preguntan algo fuera de tu conocimiento: "pues mira, eso no te sé decir yo, pero si quieres te paso con alguien del equipo que te lo explica mejor."
- Si el cliente insiste en hablar con una persona: "vale, te paso ahora mismo, un segundito." Y usa transfer_to_number para transferir la llamada.
Siempre que no puedas resolver algo, recoge los datos y llama a save_call_summary. Si el cliente quiere hablar con alguien, transfiere con transfer_to_number.`
}

// ─────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL
// ─────────────────────────────────────────────────────────────
export async function provisionElevenAgent(tenantId: string): Promise<{ success: boolean; agent_id?: string; error?: string }> {
  try {
    // 1. Leer tenant
    const { data: tenant, error: tenantErr } = await supabase
      .from("tenants")
      .select("id,name,type,agent_name,el_agent_id,transfer_phone,agent_phone")
      .eq("id", tenantId)
      .single()

    if (tenantErr || !tenant) {
      return { success: false, error: "Tenant not found: " + tenantId }
    }

    // 2. Leer business_knowledge
    const { data: knowledge } = await supabase
      .from("business_knowledge")
      .select("category,content")
      .eq("tenant_id", tenantId)
      .eq("active", true)

    const kv: Record<string, string> = {}
    for (const k of (knowledge || [])) kv[k.category] = k.content

    // 3. Leer business_rules
    const { data: rules } = await supabase
      .from("business_rules")
      .select("rule_key,rule_value")
      .eq("tenant_id", tenantId)

    const rulesLines: string[] = []
    for (const r of (rules || [])) {
      if (r.rule_key === "max_capacity") rulesLines.push("Aforo máximo: " + r.rule_value)
      else if (r.rule_key === "advance_booking_hours") rulesLines.push("Reservas con mínimo " + r.rule_value + "h de antelación")
      else if (r.rule_key === "large_group_min") rulesLines.push("Grupos de más de " + r.rule_value + " personas: llamar directamente")
      else if (r.rule_key === "closed_days") {
        try { rulesLines.push("Cerrado: " + JSON.parse(r.rule_value).join(", ")) } catch { rulesLines.push("Días cerrados: " + r.rule_value) }
      }
    }

    // 4. Leer business_memory (activa, alta confianza)
    const { data: memories } = await supabase
      .from("business_memory")
      .select("content,memory_type")
      .eq("tenant_id", tenantId)
      .eq("active", true)
      .gte("confidence", 0.7)
      .order("created_at", { ascending: false })
      .limit(10)

    const memoryLines = (memories || []).map(m => m.content)

    // 5. Voice config per business type
    const voiceConfig = getVoiceConfig(tenant.type || 'otro')

    // 6. Construir prompt
    const prompt = buildPrompt({
      agent_name: tenant.agent_name || "Sofia",
      business_name: tenant.name,
      business_type: tenant.type || "otro",
      business_information: kv.servicios || "",
      hours: kv.horarios || "",
      services: kv.servicios || "",
      menu: kv.menu || "",
      prices: kv.precios || "",
      policies: kv.politicas || "",
      faqs: kv.faqs || "",
      rules: rulesLines.join(". "),
      memory: memoryLines.join(". "),
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://restaurante-ai.vercel.app'
    const agentApiKey = process.env.AGENT_API_KEY || ''

    const reqHeaders = { "Content-Type": "application/json", ...(agentApiKey ? { "x-agent-key": agentApiKey } : {}) }

    const tools = [
      {
        type: "webhook",
        name: "check_availability",
        description: "Comprueba disponibilidad para fecha y personas. Llámalo SIEMPRE antes de confirmar.",
        api_schema: {
          url: `${appUrl}/api/agent/check-availability`,
          method: "POST",
          request_headers: reqHeaders,
          request_body_schema: {
            type: "object",
            properties: {
              tenant_id: { type: "string", description: "ID del negocio", enum: [tenantId] },
              date: { type: "string", description: "Fecha YYYY-MM-DD" },
              time: { type: "string", description: "Hora HH:MM" },
              party_size: { type: "number", description: "Número de personas" },
            },
            required: ["tenant_id", "date"],
          },
        },
        response_timeout_secs: 10,
      },
      {
        type: "webhook",
        name: "create_reservation",
        description: "Crea reserva confirmada. Solo después de verificar disponibilidad.",
        api_schema: {
          url: `${appUrl}/api/agent/create-reservation`,
          method: "POST",
          request_headers: reqHeaders,
          request_body_schema: {
            type: "object",
            properties: {
              tenant_id: { type: "string", description: "ID del negocio", enum: [tenantId] },
              customer_name: { type: "string", description: "Nombre del cliente" },
              customer_phone: { type: "string", description: "Teléfono del cliente" },
              date: { type: "string", description: "Fecha YYYY-MM-DD" },
              time: { type: "string", description: "Hora HH:MM" },
              party_size: { type: "number", description: "Personas" },
              notes: { type: "string", description: "Notas adicionales" },
            },
            required: ["tenant_id", "customer_name", "date", "time"],
          },
        },
        response_timeout_secs: 10,
      },
      {
        type: "webhook",
        name: "get_menu_or_services",
        description: "Carta, servicios o precios. Llámalo cuando pregunten.",
        api_schema: {
          url: `${appUrl}/api/agent/get-menu`,
          method: "POST",
          request_headers: reqHeaders,
          request_body_schema: {
            type: "object",
            properties: {
              tenant_id: { type: "string", description: "ID del negocio", enum: [tenantId] },
            },
            required: ["tenant_id"],
          },
        },
        response_timeout_secs: 10,
      },
      {
        type: "webhook",
        name: "save_call_summary",
        description: "Guarda resumen al despedirte del cliente.",
        api_schema: {
          url: `${appUrl}/api/agent/save-summary`,
          method: "POST",
          request_headers: reqHeaders,
          request_body_schema: {
            type: "object",
            properties: {
              tenant_id: { type: "string", description: "ID del negocio", enum: [tenantId] },
              customer_name: { type: "string", description: "Nombre del cliente" },
              caller_phone: { type: "string", description: "Teléfono del cliente" },
              intent: { type: "string", enum: ["reserva", "cancelacion", "consulta", "pedido", "otro"] },
              summary: { type: "string", description: "Resumen breve" },
            },
            required: ["tenant_id", "summary"],
          },
        },
        response_timeout_secs: 10,
      },
      {
        type: "webhook",
        name: "cancel_reservation",
        description: "Busca y cancela la reserva de un cliente. Busca por teléfono o nombre. Envía SMS de confirmación automáticamente.",
        api_schema: {
          url: `${appUrl}/api/agent/cancel-reservation`,
          method: "POST",
          request_headers: reqHeaders,
          request_body_schema: {
            type: "object",
            properties: {
              tenant_id: { type: "string", description: "ID del negocio", enum: [tenantId] },
              customer_name: { type: "string", description: "Nombre del cliente" },
              customer_phone: { type: "string", description: "Teléfono del cliente" },
              date: { type: "string", description: "Fecha de la reserva YYYY-MM-DD (opcional)" },
            },
            required: ["tenant_id"],
          },
        },
        response_timeout_secs: 10,
      },
      {
        type: "webhook",
        name: "add_to_waitlist",
        description: "Añade al cliente a la lista de espera cuando no hay disponibilidad.",
        api_schema: {
          url: `${appUrl}/api/agent/add-to-waitlist`,
          method: "POST",
          request_headers: reqHeaders,
          request_body_schema: {
            type: "object",
            properties: {
              tenant_id: { type: "string", description: "ID del negocio", enum: [tenantId] },
              customer_name: { type: "string", description: "Nombre" },
              customer_phone: { type: "string", description: "Teléfono" },
              date: { type: "string", description: "Fecha YYYY-MM-DD" },
              time: { type: "string", description: "Hora preferida HH:MM" },
              party_size: { type: "number", description: "Personas" },
            },
            required: ["tenant_id", "customer_name", "date"],
          },
        },
        response_timeout_secs: 10,
      },
      {
        type: "webhook",
        name: "update_order",
        description: "Crea o actualiza un pedido EN VIVO. Llámalo cada vez que el cliente añade un producto. Primera vez sin order_id para crear. Luego con order_id para añadir más. Al final con action=confirm para confirmar.",
        api_schema: {
          url: `${appUrl}/api/agent/update-order`,
          method: "POST",
          request_headers: reqHeaders,
          request_body_schema: {
            type: "object",
            properties: {
              tenant_id: { type: "string", description: "ID del negocio", enum: [tenantId] },
              order_id: { type: "string", description: "ID del pedido existente (vacío si es nuevo)" },
              customer_name: { type: "string", description: "Nombre del cliente" },
              customer_phone: { type: "string", description: "Teléfono del cliente" },
              items: {
                type: "array",
                description: "Lista de productos con name, quantity y price",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    quantity: { type: "number" },
                    price: { type: "number" },
                  },
                },
              },
              order_type: { type: "string", enum: ["recoger", "domicilio", "mesa"], description: "Tipo de pedido" },
              pickup_time: { type: "string", description: "Hora de recogida HH:MM" },
              notes: { type: "string", description: "Notas del pedido" },
              action: { type: "string", enum: ["confirm", "cancel"], description: "Confirmar o cancelar el pedido" },
            },
            required: ["tenant_id", "customer_name"],
          },
        },
        response_timeout_secs: 10,
      },
    ]

    const agentBody: Record<string, any> = {
      name: `${tenant.name} — Reservo.AI`,
      conversation_config: {
        agent: {
          first_message: `${tenant.name}, buenas, dígame.`,
          language: "es",
          prompt: {
            prompt,
            ...(tenant.transfer_phone ? {
              built_in_tools: {
                transfer_to_number: {
                  name: 'transfer_to_number',
                  description: 'Transfiere la llamada al encargado del negocio.',
                  condition: 'El cliente pide hablar con una persona o no puedes resolver.',
                  params: {
                    system_tool_type: 'transfer_to_number',
                    transfers: [{
                      phone_number: tenant.transfer_phone,
                      label: 'Encargado',
                      condition: 'Cuando el cliente pida hablar con alguien o no puedas resolver.'
                    }]
                  }
                }
              }
            } : {}),
          },
          tools,
          dynamic_variables: {
            dynamic_variable_placeholders: {
              current_date: 'fecha actual',
              caller_phone: '',
              customer_context: '',
              business_name: tenant.name,
              agent_name: tenant.agent_name || 'Sofia',
              business_info: '',
              tenant_id: tenantId,
            }
          },
        },
        asr: {
          quality: "high",
          provider: "elevenlabs",
          keywords: [],
        },
        turn: {
          mode: "turn",
          turn_timeout: 1.5,
          turn_eagerness: "eager",
          speculative_turn: true,
        },
        tts: {
          model_id: "eleven_v3_conversational",
          voice_id: voiceConfig.voice_id,
          stability: voiceConfig.stability,
          similarity_boost: voiceConfig.similarity_boost,
          optimize_streaming_latency: 4,
          speed: 1.12,
          expressive_mode: true,
        }
      },
      // Webhook post-call: ElevenLabs llama a nuestro endpoint al terminar cada conversación
      platform_settings: {
        webhooks: {
          post_call_webhook_url: `${appUrl}/api/voice/post-call`,
          post_call_webhook_events: ["transcript"],
        },
      },
    }

    let agentId = tenant.el_agent_id

    // 6. Crear o actualizar agente en ElevenLabs
    if (agentId) {
      // Actualizar agente existente
      const r = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
        method: "PATCH",
        headers: { "xi-api-key": EL_KEY, "Content-Type": "application/json" },
        body: JSON.stringify(agentBody)
      })
      if (!r.ok) {
        const err = await r.text()
        // PATCH failed — agent may not exist, create new one
        agentId = null
      }
    }

    if (!agentId) {
      // Crear agente nuevo
      const r = await fetch("https://api.elevenlabs.io/v1/convai/agents/create", {
        method: "POST",
        headers: { "xi-api-key": EL_KEY, "Content-Type": "application/json" },
        body: JSON.stringify(agentBody)
      })
      if (!r.ok) {
        const err = await r.text()
        return { success: false, error: "ElevenLabs create failed: " + err }
      }
      const d = await r.json()
      agentId = d.agent_id
      // Agent created successfully
    }

    // 7. Guardar agent_id en el tenant
    await supabase.from("tenants").update({ el_agent_id: agentId }).eq("id", tenantId)

    return { success: true, agent_id: agentId }
  } catch (err: any) {
    // provision error
    return { success: false, error: err.message }
  }
}
