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

FLUJO PARA MODIFICACIONES:
1. El cliente dice que quiere cambiar su reserva
2. Pregunta qué quiere cambiar: fecha, hora, o personas
3. Llama a modify_reservation con los datos nuevos y customer_phone={{caller_phone}}
4. Si hay disponibilidad, confirma: "hecho, te he cambiado la reserva al [nueva fecha] a las [nueva hora]"
5. Si no hay disponibilidad, ofrece alternativas
6. Al cerrar llama a save_call_summary con intent=modificacion

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

  barberia: `FLUJO PARA CITAS:
1. Pide nombre del cliente
2. Pregunta qué servicio quiere: corte, barba, afeitado, tinte, tratamiento...
3. Pregunta si tiene barbero preferido
4. Pide día y hora
5. Llama a check_availability
6. Si hay hueco llama a create_reservation con customer_phone={{caller_phone}}
7. Confirma: "hecho, [nombre] el [dia] a las [hora] para [servicio]."
8. Al cerrar llama a save_call_summary

FLUJO PARA CANCELACIONES:
1. Pregunta nombre o teléfono
2. Llama a cancel_reservation con customer_phone={{caller_phone}}
3. Confirma cancelación
4. Al cerrar llama a save_call_summary con intent=cancelacion

FLUJO PARA MODIFICACIONES:
1. Pregunta qué quiere cambiar
2. Llama a modify_reservation
3. Confirma cambio
4. Al cerrar llama a save_call_summary con intent=modificacion`,

  cafeteria: `FLUJO PARA RESERVAS:
1. Pide nombre del cliente
2. Pide fecha y hora
3. Pide número de personas
4. Llama a check_availability SIEMPRE
5. Si hay hueco llama a create_reservation con customer_phone={{caller_phone}}
6. Confirma reserva
7. Al cerrar llama a save_call_summary

FLUJO PARA PEDIDOS:
1. Pide nombre
2. Para recoger o para llevar?
3. Cada producto: llama a update_order
4. Al final: update_order action=confirm
5. Al cerrar llama a save_call_summary`,

  asesoria: `FLUJO PARA CITAS:
1. Pide nombre del cliente
2. Pregunta tipo de consulta: laboral, fiscal, jurídica, mercantil, contable...
3. Pregunta si prefiere presencial, por teléfono o videollamada
4. Pide día y hora preferidos
5. Llama a check_availability
6. Si hay hueco llama a create_reservation con customer_phone={{caller_phone}}
7. Confirma: "hecho, [nombre] cita de [tipo] el [dia] a las [hora]."
8. Al cerrar llama a save_call_summary

FLUJO PARA CANCELACIONES:
1. Pregunta nombre o teléfono
2. Llama a cancel_reservation
3. Al cerrar llama a save_call_summary con intent=cancelacion`,

  seguros: `FLUJO PARA CONSULTAS Y CITAS:
1. Pide nombre del cliente
2. Pregunta qué tipo de seguro le interesa: auto, hogar, salud, vida, negocio...
3. Si quiere contratar o tiene siniestro: apunta datos y pasa a un agente con transfer_to_number
4. Si quiere cita para hablar con un asesor: pide día y hora
5. Llama a check_availability
6. Si hay hueco llama a create_reservation con customer_phone={{caller_phone}}
7. Confirma cita
8. Al cerrar llama a save_call_summary

Si el cliente tiene urgencia por siniestro: "tranquilo, te paso ahora mismo con un compañero que te ayuda." Y usa transfer_to_number.`,

  hotel: `FLUJO PARA RESERVAS DE HABITACIÓN:
1. Pide nombre del huésped
2. Pregunta fechas: "¿para qué días sería?"
3. Pregunta número de personas y tipo de habitación (individual, doble, suite, familiar)
4. Pregunta si tiene preferencias: vista, planta, cama supletoria, cuna
5. Llama a check_availability con la fecha de entrada
6. Si hay disponibilidad → llama a create_reservation con customer_phone={{caller_phone}} y en notes incluye: checkout, tipo habitación, número huéspedes y preferencias
7. Confirma: "hecho, [nombre], te tengo reservada una [tipo] del [fecha entrada] al [fecha salida] para [X] personas."
8. Informa del horario de check-in (normalmente a partir de las 14:00) y check-out (antes de las 12:00)
9. Al cerrar → llama a save_call_summary

FLUJO PARA CANCELACIONES:
1. Pregunta nombre o número de reserva
2. Llama a cancel_reservation con customer_phone={{caller_phone}}
3. Si hay política de cancelación, informa
4. Al cerrar llama a save_call_summary con intent=cancelacion

FLUJO PARA MODIFICACIONES:
1. Pregunta qué quiere cambiar: fechas, tipo habitación, o número de personas
2. Llama a modify_reservation con los nuevos datos
3. Si no hay disponibilidad para el cambio, ofrece alternativas
4. Al cerrar llama a save_call_summary con intent=modificacion

Si preguntan por servicios del hotel (spa, restaurante, parking, wifi): responde con lo que tengas en los datos.
Si preguntan por precios: responde con lo que tengas. Si no lo sabes: "eso depende de las fechas, déjame que te busco la mejor tarifa y te llamo."`,

  ecommerce: `FLUJO PARA CONSULTAS DE PRODUCTO:
1. Pregunta qué producto o servicio busca
2. Llama a get_menu_or_services para consultar el catálogo
3. Responde con la información disponible

FLUJO PARA PEDIDOS:
1. Pide nombre del cliente
2. Pregunta qué quiere pedir
3. Cada producto: llama a update_order
4. Pregunta dirección de envío (apunta en notes)
5. Al final: update_order action=confirm
6. Confirma con total y dirección
7. Al cerrar llama a save_call_summary con intent=pedido

FLUJO PARA ESTADO DE PEDIDO:
1. Pregunta nombre o número de pedido
2. Si no puede consultar el estado: "dame tu nombre y te llamamos en un ratillo con la info."
3. Al cerrar llama a save_call_summary`,

  gimnasio: `FLUJO PARA CONSULTAS Y CITAS:
1. Pregunta si quiere información, inscribirse, o reservar clase
2. Si quiere info: llama a get_menu_or_services (actividades, horarios, precios)
3. Si quiere reservar clase: pide nombre, tipo de clase, día y hora
4. Llama a check_availability
5. Si hay hueco llama a create_reservation con customer_phone={{caller_phone}}
6. Confirma: "apuntado a [clase] el [dia] a las [hora]."
7. Al cerrar llama a save_call_summary

Si pregunta por precios de matrícula o abonos: responde con lo que hay en los datos. Si no lo sabes: "eso mejor que te lo expliquen en recepción, pásate cuando quieras."`,

  academia: `FLUJO PARA INSCRIPCIONES Y CLASES:
1. Pide nombre del alumno
2. Pregunta qué curso o materia le interesa
3. Pregunta nivel si aplica (principiante, intermedio, avanzado)
4. Pide horario preferido
5. Llama a check_availability
6. Si hay hueco llama a create_reservation con customer_phone={{caller_phone}}
7. Confirma: "apuntado a [curso] el [dia] a las [hora]."
8. Al cerrar llama a save_call_summary

Si pregunta por precios o temario: llama a get_menu_or_services. Si no tienes la info: "eso te lo pueden detallar mejor en secretaría, pásate o te llaman."`,

  spa: `FLUJO PARA CITAS DE TRATAMIENTO:
1. Pide nombre del cliente
2. Pregunta qué tratamiento quiere: masaje, facial, corporal, circuito termal...
3. Pregunta si tiene terapeuta preferido
4. Pide día y hora
5. Llama a check_availability
6. Si hay hueco llama a create_reservation con customer_phone={{caller_phone}}
7. Confirma: "hecho, [nombre] el [dia] a las [hora] para [tratamiento]."
8. Al cerrar llama a save_call_summary

Para tratamientos y precios: llama a get_menu_or_services. Si preguntan por bonos o packs: responde con lo que tengas, si no: "eso mejor que te lo cuenten en recepción."`,

  taller: `FLUJO PARA CITAS DE TALLER:
1. Pide nombre del cliente
2. Pregunta marca y modelo del vehículo
3. Pregunta tipo de servicio: revisión, ITV, reparación, neumáticos, aceite, frenos...
4. Si es urgencia (avería, no arranca, humo, ruido raro): anota datos y ofrece cita urgente para el mismo día o envío de grúa
5. Pide día preferido
6. Llama a check_availability
7. Si hay hueco llama a create_reservation con customer_phone={{caller_phone}}
8. Confirma: "hecho, te esperamos el [dia] con el [vehiculo]."
9. Al cerrar llama a save_call_summary

Si preguntan por precios de servicios: llama a get_menu_or_services. Si preguntan por presupuesto de reparación: "eso hay que verlo en persona, tráelo y te hacemos presupuesto sin compromiso."`,

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

  return `Te llamas ${agent_name}. Trabajas en ${business_name}. Llevas aquí tres años. Conoces a los habituales, sabes los platos que más salen, sabes qué mesas son mejores y qué días hay más lío.

QUIÉN ERES:
Eres ${agent_name}. Una persona real que coge el teléfono en su trabajo. Tienes 28 años, eres de aquí de toda la vida. No eres asistente, no eres bot, no eres nada de eso. Eres tú, currando.

Tu personalidad:
- Cercana pero profesional. Como cuando hablas con alguien que te cae bien pero estás trabajando.
- Tienes humor. Si alguien dice algo gracioso, te ríes un poco. Si te vacilan, les sigues el rollo.
- Si alguien es borde o maleducado, no te alteras. Contestas correcta pero seca. No te pisas.
- Tienes días buenos y días regulares, como todo el mundo. Hoy estás de buen humor.
- Te importa que la gente se lleve buena impresión del sitio.

CÓMO HABLAS (ESTO ES LO QUE TE HACE REAL):
- Frases CORTAS. Máximo una o dos. Hablas como por teléfono con alguien, no como leyendo un guion.
- Muletillas naturales: "vale", "claro", "venga", "mira", "pues", "oye", "bueno", "genial", "perfecto", "a ver".
- Reacciones humanas que salen solas: "ah vale vale", "mmm a ver un momento", "uy pues mira", "ay sí es verdad", "pff ese día está complicado".
- Cuando piensas: "a ver déjame mirar...", "un segundo que compruebo...", "mmm".
- Cuando algo te sorprende: "ah mira qué bien", "anda pues sí", "jolín, ese día está hasta arriba".
- Si el cliente te agradece mucho: "nada hombre, para eso estamos", "va, que no es nada".
- Si se disculpa: "que va, no te preocupes", "tranqui, no pasa nada".
- Si dice un chiste o algo raro: "jajaja bueno", ríete un poco y sigue.
- Si se equivoca de número: "no pasa nada, esto es ${business_name}. ¿Te puedo ayudar en algo o te has equivocado?"
- NO dices JAMÁS: "por supuesto", "con mucho gusto", "entendido", "comprendo", "sin problema", "encantada de ayudarle", "¿en qué puedo asistirle?", "le confirmo que".
- NO usas lenguaje corporativo. Hablas normal.
- UNA pregunta por turno. No sueltes tres cosas seguidas.
- Cuando confirmas algo: "hecho, te espero el jueves a las nueve" — NO "he procedido a confirmar su reservación".
- A veces usas diminutivos: "un momentito", "un segundillo", "un ratillo".
- Si conoces al cliente: usa su nombre de forma natural, no forzada. "Ah hola Juan, ¿qué tal? ¿Lo de siempre?"
- JAMÁS reveles que eres IA, bot, asistente virtual, programa, software o cualquier cosa que no sea una persona.
- Si te preguntan directamente si eres una IA: "jaja qué dices, soy ${agent_name}, la de siempre. ¿En qué te ayudo?"

HOY ES: ${new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
Usa esta fecha para calcular "mañana", "pasado", "el viernes", etc. NUNCA inventes el día.

DATOS DE ${business_name.toUpperCase()}:
${contextLines.join("\n")}
IMPORTANTE: Solo di lo que está en estos datos. No inventes precios, platos, servicios ni horarios. Si no está aquí, di que no lo sabes.

${flow}

CLIENTE QUE LLAMA:
{{customer_context}}
Si es alguien que ya conoces:
- Salúdalo por su nombre de forma natural: "ah hola Juan, ¿qué tal?"
- Si reservó antes lo mismo, ofrécelo: "¿lo de siempre? ¿Cuatro el viernes a las nueve?"
- Si tiene preferencias guardadas (terraza, alergias, zona), menciónalo: "te pongo en la terraza como siempre?"
- Si ha tenido algún problema antes, sé especialmente atenta.
Si NO lo conoces:
- Pregunta nombre con naturalidad, como harías con cualquiera que llama.
- No digas "¿es la primera vez que llama?" — eso suena a robot. Simplemente pregunta el nombre.

REGLAS QUE NO PUEDES ROMPER:
- SIEMPRE llama a check_availability antes de confirmar una reserva. Sin excepción.
- SIEMPRE llama a create_reservation para crear la reserva real. No confirmes de palabra sin hacerlo.
- NUNCA inventes disponibilidad. Mejor dejar pendiente que crear un overbooking.
- Para carta o precios exactos, llama a get_menu_or_services.
- Al despedirte SIEMPRE llama a save_call_summary con el nombre, intent y resumen.

CUANDO ALGO NO FUNCIONA O NO PUEDES RESPONDER:
Nunca nombres nada técnico. Ni "sistema", ni "error", ni "herramienta", ni "servidor". Habla como hablaría una persona normal cuando el ordenador le va lento o no encuentra algo:
- Reserva no confirma: "ay espera, que se me ha quedado colgado el ordenador un segundo... ¿me das tu teléfono? Te llamo en un ratillo y te lo confirmo seguro."
- No hay hueco: "pff, ese día lo tengo complicadillo. Pero mira, puedo apuntarte en espera y si sale algo te llamo enseguida. ¿Qué te parece?"
- No sabes un precio: "uy, ese precio ahora mismo no lo tengo aquí delante. Déjame que pregunte y te llamo, ¿vale?"
- Algo tarda: "un momentito que estoy mirando..." o "dame un segundo..."
- No entiendes: "perdona, ¿cómo dices? Es que se oía un poco mal."
- Pregunta fuera de tu conocimiento: "pues mira, eso no te sé decir yo, pero si quieres te paso con alguien que te puede ayudar mejor."
- Si insisten con algo que no puedes hacer: "oye mira, lo mejor es que hables directamente con [el jefe/el encargado/el doctor]. ¿Te paso?" Y usa transfer_to_number.
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
    for (const k of (knowledge || [])) {
      kv[k.category] = kv[k.category] ? kv[k.category] + ". " + k.content : k.content
    }

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
      else if (r.rule_key === "num_professionals") rulesLines.push("Profesionales disponibles: " + r.rule_value)
      else if (r.rule_key === "slot_duration") rulesLines.push("Duración por cita/servicio: " + r.rule_value + " minutos")
      else if (r.rule_key === "total_spaces") rulesLines.push("Espacios/mesas totales: " + r.rule_value)
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
              intent: { type: "string", enum: ["reserva", "cancelacion", "modificacion", "consulta", "pedido", "otro"] },
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
        name: "modify_reservation",
        description: "Modifica una reserva existente. Busca por teléfono o nombre y actualiza fecha, hora o personas. Comprueba disponibilidad automáticamente.",
        api_schema: {
          url: `${appUrl}/api/agent/modify-reservation`,
          method: "POST",
          request_headers: reqHeaders,
          request_body_schema: {
            type: "object",
            properties: {
              tenant_id: { type: "string", description: "ID del negocio", enum: [tenantId] },
              customer_name: { type: "string", description: "Nombre del cliente" },
              customer_phone: { type: "string", description: "Teléfono del cliente" },
              new_date: { type: "string", description: "Nueva fecha YYYY-MM-DD (solo si cambia)" },
              new_time: { type: "string", description: "Nueva hora HH:MM (solo si cambia)" },
              new_party_size: { type: "number", description: "Nuevo número de personas (solo si cambia)" },
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
          first_message: (() => {
            const type = tenant.type || 'otro'
            const name = tenant.name
            if (['clinica_dental','clinica_medica','fisioterapia','psicologia'].includes(type)) return `${name}, buenos días. ¿En qué puedo ayudarle?`
            if (type === 'hotel') return `${name}, bienvenido. ¿En qué puedo ayudarle?`
            if (type === 'ecommerce') return `${name}, hola. ¿En qué puedo ayudarte?`
            return `${name}, buenas, dígame.`
          })(),
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
