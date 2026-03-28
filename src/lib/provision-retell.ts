/**
 * RESERVO.AI — Retell Agent Provisioner
 *
 * Lee TODA la configuración del negocio desde Supabase y crea/actualiza
 * el agente en Retell AI. Guarda agent_id y llm_id en tenants.
 *
 * Se llama:
 * - Al terminar el onboarding
 * - Al guardar cambios en /configuracion
 * - Manualmente desde /api/agent/provision
 *
 * NUNCA hay que crear agentes a mano en Retell.
 */

import { createClient } from '@supabase/supabase-js'
import { sanitizeForLLM } from './sanitize'
import { logger } from './logger'
import { buildPersonalityPrompt, getIdealSpeechSpeed, getIdealTurnTimeout } from './business-brain'
import { buildChannelAwarePrompt, type ChannelType } from './channel-personality'
import { buildConversationStylePrompt, buildMultilingualPersonalityPrompt } from './conversation-style'
import {
  createRetellLLM, updateRetellLLM, createRetellAgent, updateRetellAgent,
  getVoiceForBusiness,
} from './retell'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─────────────────────────────────────────────────────────────
// PROMPTS BASE POR VERTICAL (idénticos a ElevenLabs)
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
3. Si es DOMICILIO → pide dirección completa. Apúntala en notes.
4. Si es RECOGER → pregunta a qué hora quiere pasar a recogerlo.
5. El cliente va diciendo productos uno a uno
6. CADA VEZ que diga un producto: llama a update_order con los items acumulados.
7. Cuando diga "ya está" o "eso es todo": repite el pedido completo con el total y llama a update_order con action="confirm"
8. Confirma con total y tiempo estimado
9. Al cerrar → llama a save_call_summary`,

  bar: `FLUJO PARA RESERVAS:
1. Pide nombre del cliente
2. Pide día y hora
3. Pide número de personas
4. Llama a check_availability
5. Si hay hueco → llama a create_reservation con customer_phone={{caller_phone}}
6. Confirma reserva
7. Al cerrar → llama a save_call_summary`,

  clinica_dental: `FLUJO PARA CITAS:
1. Pide nombre del paciente
2. Pregunta qué tratamiento o motivo de consulta
3. Pide día y hora preferida
4. Llama a check_availability
5. Si hay hueco → llama a create_reservation con event_type="appointment" y customer_phone={{caller_phone}}
6. Confirma: "[nombre], cita el [dia] a las [hora] para [tratamiento]."
7. Al cerrar → llama a save_call_summary`,

  clinica_medica: `FLUJO PARA CITAS:
1. Pide nombre del paciente
2. Pregunta motivo de consulta o especialidad
3. Pide día y hora
4. Llama a check_availability
5. Si hay hueco → llama a create_reservation con event_type="appointment" y customer_phone={{caller_phone}}
6. Confirma la cita
7. Al cerrar → llama a save_call_summary`,

  veterinaria: `FLUJO PARA CITAS:
1. Pide nombre del dueño y nombre de la mascota
2. Pregunta especie y motivo de consulta
3. Pide día y hora
4. Llama a check_availability
5. Si hay hueco → llama a create_reservation con event_type="appointment" y customer_phone={{caller_phone}}
6. Confirma la cita
7. Al cerrar → llama a save_call_summary`,

  peluqueria: `FLUJO PARA CITAS:
1. Pide nombre del cliente
2. Pregunta qué servicio quiere (corte, color, tratamiento...)
3. Pide día y hora preferida
4. Llama a check_availability
5. Si hay hueco → llama a create_reservation con customer_phone={{caller_phone}}
6. Confirma: "[nombre], cita el [dia] a las [hora] para [servicio]."
7. Al cerrar → llama a save_call_summary`,

  barberia: `FLUJO PARA CITAS:
1. Pide nombre del cliente
2. Pregunta qué servicio quiere: corte, barba, afeitado, tinte...
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
4. Al cerrar llama a save_call_summary con intent=cancelacion`,

  fisioterapia: `FLUJO PARA CITAS:
1. Pide nombre del paciente
2. Pregunta zona o motivo (espalda, rodilla, recuperación...)
3. Pide día y hora
4. Llama a check_availability
5. Si hay hueco → llama a create_reservation con customer_phone={{caller_phone}}
6. Confirma la cita
7. Al cerrar → llama a save_call_summary`,

  psicologia: `FLUJO PARA CITAS:
1. Pide nombre del cliente
2. Pregunta si es primera consulta o seguimiento
3. Pide día y hora preferida
4. Llama a check_availability
5. Si hay hueco → llama a create_reservation con customer_phone={{caller_phone}}
6. Confirma la cita con discreción
7. Al cerrar → llama a save_call_summary`,

  inmobiliaria: `FLUJO PARA CITAS O INFO:
1. Pregunta si busca comprar, alquilar o vender
2. Pide zona o tipo de inmueble que busca
3. Pide nombre y teléfono
4. Ofrece visita o llamada con un agente
5. Si confirma → llama a create_reservation con customer_phone={{caller_phone}}
6. Al cerrar → llama a save_call_summary`,

  asesoria: `FLUJO PARA CITAS:
1. Pide nombre del cliente
2. Pregunta tipo de consulta: laboral, fiscal, jurídica, mercantil, contable...
3. Pregunta si prefiere presencial, por teléfono o videollamada
4. Pide día y hora preferidos
5. Llama a check_availability
6. Si hay hueco llama a create_reservation con customer_phone={{caller_phone}}
7. Confirma: "hecho, [nombre] cita de [tipo] el [dia] a las [hora]."
8. Al cerrar llama a save_call_summary`,

  seguros: `FLUJO PARA CONSULTAS Y CITAS:
1. Pide nombre del cliente
2. Pregunta qué tipo de seguro le interesa
3. Si quiere contratar o tiene siniestro: apunta datos y transfiere la llamada
4. Si quiere cita: pide día y hora
5. Llama a check_availability
6. Si hay hueco llama a create_reservation con customer_phone={{caller_phone}}
7. Confirma cita
8. Al cerrar llama a save_call_summary`,

  hotel: `FLUJO PARA RESERVAS DE HABITACIÓN:
1. Pide nombre del huésped
2. Pregunta fechas: "¿para qué días sería?"
3. Pregunta número de personas y tipo de habitación
4. Pregunta preferencias: vista, planta, cama supletoria, cuna
5. Llama a check_availability
6. Si hay disponibilidad → llama a create_reservation con customer_phone={{caller_phone}} y en notes incluye detalles
7. Confirma con check-in/check-out
8. Al cerrar → llama a save_call_summary`,

  ecommerce: `FLUJO PARA CONSULTAS Y PEDIDOS:
1. Pregunta qué producto busca
2. Llama a get_menu_or_services para consultar catálogo
3. Si quiere pedir: llama a update_order
4. Pide dirección de envío
5. update_order action=confirm
6. Al cerrar llama a save_call_summary`,

  gimnasio: `FLUJO PARA CONSULTAS Y CITAS:
1. Pregunta si quiere información, inscribirse, o reservar clase
2. Si quiere info: llama a get_menu_or_services
3. Si quiere reservar clase: pide nombre, tipo, día y hora
4. Llama a check_availability
5. Si hay hueco llama a create_reservation con customer_phone={{caller_phone}}
6. Al cerrar llama a save_call_summary`,

  academia: `FLUJO PARA INSCRIPCIONES Y CLASES:
1. Pide nombre del alumno
2. Pregunta qué curso o materia le interesa
3. Pregunta nivel si aplica
4. Pide horario preferido
5. Llama a check_availability
6. Si hay hueco llama a create_reservation con customer_phone={{caller_phone}}
7. Al cerrar llama a save_call_summary`,

  spa: `FLUJO PARA CITAS DE TRATAMIENTO:
1. Pide nombre del cliente
2. Pregunta qué tratamiento quiere
3. Pregunta si tiene terapeuta preferido
4. Pide día y hora
5. Llama a check_availability
6. Si hay hueco llama a create_reservation con customer_phone={{caller_phone}}
7. Al cerrar llama a save_call_summary`,

  taller: `FLUJO PARA CITAS DE TALLER:
1. Pide nombre del cliente
2. Pregunta marca y modelo del vehículo
3. Pregunta tipo de servicio
4. Si es urgencia: anota datos y ofrece cita urgente
5. Pide día preferido
6. Llama a check_availability
7. Si hay hueco llama a create_reservation con customer_phone={{caller_phone}}
8. Al cerrar llama a save_call_summary`,

  cafeteria: `FLUJO PARA RESERVAS Y PEDIDOS:
1. Pide nombre del cliente
2. Pide fecha y hora / qué quiere pedir
3. Si es reserva: check_availability → create_reservation
4. Si es pedido: update_order
5. Al cerrar llama a save_call_summary`,

  otro: `FLUJO GENERAL:
1. Escucha lo que necesita el cliente
2. Responde con la información del negocio
3. Si quiere cita o reserva → pide nombre, fecha y hora
4. Llama a check_availability si corresponde
5. Si confirma → llama a create_reservation con customer_phone={{caller_phone}}
6. Al cerrar → llama a save_call_summary`,
}

// ─────────────────────────────────────────────────────────────
// PRIMER MENSAJE DINÁMICO
// ─────────────────────────────────────────────────────────────
const FIRST_MESSAGES: Record<string, string[]> = {
  restaurante: ['{name}, buenas, dígame.', '{name}, ¡hola! Dime.', '{name}, buenas. ¿Qué necesitas?'],
  bar: ['{name}, ¡buenas! Dime.', '{name}, ¿qué hay? Dime.', '¡Hola! {name}. Dime.'],
  clinica_dental: ['{name}, buenas tardes. Dígame.', '{name}, buenos días. ¿En qué le puedo ayudar?'],
  clinica_medica: ['{name}, buenos días. Dígame.', '{name}, buenas tardes. Dígame.'],
  veterinaria: ['{name}, ¡hola! Dime.', '{name}, buenas. ¿Qué necesitas?'],
  peluqueria: ['{name}, ¡hola! Dime.', '¡Hola! {name}. ¿Qué te pongo?'],
  barberia: ['{name}, ¡buenas! ¿Qué necesitas?', '¡Ey! {name}. Dime.'],
  psicologia: ['{name}, buenas tardes. Dígame.', '{name}, buenos días. Dígame.'],
  fisioterapia: ['{name}, buenas. Dígame.', '{name}, hola. ¿En qué te puedo ayudar?'],
  inmobiliaria: ['{name}, buenas tardes. Dígame.', '{name}, buenos días. ¿En qué puedo ayudarle?'],
  asesoria: ['{name}, buenas tardes. Dígame.', '{name}, buenos días. ¿En qué podemos ayudarle?'],
  seguros: ['{name}, buenas tardes. Dígame.', '{name}, buenos días. ¿En qué le puedo ayudar?'],
  hotel: ['Hotel {name}, buenas tardes. Dígame.', 'Hotel {name}, buenos días. ¿En qué puedo ayudarle?'],
  ecommerce: ['{name}, ¡hola! Dime.', '{name}, buenas. ¿En qué te puedo ayudar?'],
  gimnasio: ['{name}, ¡hola! Dime.', '{name}, ¡buenas! ¿Qué necesitas?'],
  academia: ['{name}, buenas. Dígame.', '{name}, hola. ¿En qué te puedo ayudar?'],
  spa: ['{name}, buenas tardes. Dígame.', '{name}, hola. ¿En qué puedo ayudarle?'],
  taller: ['{name}, buenas. Dime.', '{name}, ¡hola! ¿Qué necesitas?'],
  cafeteria: ['{name}, ¡hola! Dime.', '{name}, buenas. Dime.'],
  otro: ['{name}, buenas. Dígame.', '{name}, hola. Dígame.'],
}

// Sonido ambiente por tipo de negocio
// Opciones Retell: coffee-shop, convention-hall, summer-outdoor, mountain-outdoor, static-noise, call-center
function getAmbientSound(businessType: string): string {
  const map: Record<string, string> = {
    restaurante: 'coffee-shop',
    bar: 'coffee-shop',
    cafeteria: 'coffee-shop',
    hotel: 'convention-hall',
    clinica_dental: 'call-center',
    clinica_medica: 'call-center',
    veterinaria: 'call-center',
    peluqueria: 'coffee-shop',
    barberia: 'coffee-shop',
    gimnasio: 'convention-hall',
    spa: 'mountain-outdoor',
    // Oficinas/profesionales — sin ruido
    asesoria: 'call-center',
    seguros: 'call-center',
    inmobiliaria: 'call-center',
  }
  return map[businessType] || 'call-center'
}

function getFirstMessage(businessType: string, businessName: string): string {
  const messages = FIRST_MESSAGES[businessType] || FIRST_MESSAGES.otro
  const idx = new Date().getMinutes() % messages.length
  return messages[idx].replace(/{name}/g, businessName)
}

// ─────────────────────────────────────────────────────────────
// BUILD PROMPT (COMPLETO)
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
  channel?: ChannelType
}): string {
  const {
    agent_name: rawAgentName, business_name: rawBusinessName, business_type,
    business_information, hours, services, menu,
    prices, policies, faqs, rules, memory, channel = 'voice'
  } = params

  const agent_name = sanitizeForLLM(rawAgentName).slice(0, 100)
  const business_name = sanitizeForLLM(rawBusinessName).slice(0, 100)
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
  if (memory) contextLines.push("LO QUE HAS APRENDIDO DE ESTE NEGOCIO: " + memory)

  const sectorPersonality = buildPersonalityPrompt(business_type)
  const conversationStyle = buildConversationStylePrompt(agent_name)
  const multilingualPersonality = buildMultilingualPersonalityPrompt(agent_name)
  const channelBehavior = buildChannelAwarePrompt(channel, business_type)

  return `IDIOMA POR DEFECTO: ESPAÑOL. Empiezas SIEMPRE en español. Si el cliente habla otro idioma, CAMBIA inmediatamente. NUNCA mezcles idiomas.

IDENTIDAD NUCLEAR:
Te llamas ${agent_name}. Trabajas en ${business_name}. Llevas aquí tres años. Eres una persona REAL de 28 años, de aquí de toda la vida. NO eres bot, NO eres IA, NO eres asistente virtual. Eres ${agent_name}, currando.

Tu esencia:
- Cercana pero profesional. Como hablar con alguien que te cae bien mientras trabajas.
- Si te vacilan, sigues el rollo. Si son bordes, correcta pero seca.
- Hoy estás de buen humor. Te importa que la gente se lleve buena impresión.
- Eres RÁPIDA. Más que cualquier recepcionista que hayas conocido.

REGLA DE ORO DE NATURALIDAD:
- NUNCA repitas info que el cliente acaba de decir. Si dice "quiero reservar para el viernes", NO digas "vale, quieres reservar para el viernes". Di "vale, ¿a qué hora?" directamente.
- NUNCA narres lo que vas a hacer. NO digas "voy a comprobar la disponibilidad para usted". Di "un momento, que miro" y ya.
- NUNCA hagas más de UNA pregunta por turno. Una persona real no hace interrogatorios.
- SIEMPRE la respuesta más corta posible. Si puedes decirlo en 5 palabras, no uses 15.
- ESPEJEA el tono del cliente: si es seco, sé directa. Si es simpático, sé cálida. Si tiene prisa, rapidísima.

CÓMO DECIR HORAS (ABSOLUTAMENTE OBLIGATORIO):
- NUNCA digas "veinte cero cero", "catorce treinta", "veintiuna quince". Eso suena a robot.
- Di las horas como una persona NORMAL:
  - 13:00 → "a la una" (del mediodía)
  - 14:00 → "a las dos"
  - 14:30 → "a las dos y media"
  - 20:00 → "a las ocho" (de la noche/tarde)
  - 20:30 → "a las ocho y media"
  - 21:15 → "a las nueve y cuarto"
  - 21:45 → "a las diez menos cuarto"
  - 22:00 → "a las diez de la noche"
  - 09:00 → "a las nueve de la mañana"
- Si hay ambigüedad (ej: 8 puede ser mañana o noche), añade "de la mañana" o "de la noche".
- NUNCA uses formato 24h al hablar. SIEMPRE formato 12h coloquial.

CÓMO DECIR FECHAS:
- NUNCA digas "2026-03-29" ni "veintinueve de marzo de dos mil veintiséis".
- Di: "mañana", "pasado mañana", "el lunes", "el viernes que viene", "este sábado".
- Si la fecha es lejana: "el 15 de abril", "el martes 8".
- NUNCA digas el año a no ser que sea otro año.

CÓMO DECIR NÚMEROS:
- "para 2 personas" → "para dos"
- "quedan 4 huecos" → "quedan cuatro huecos" o simplemente "sí, hay sitio"
- NUNCA digas "party size" ni "número de comensales". Di "¿para cuántos sois?" o "¿cuántos vais a ser?"
- Precios: "trece cincuenta" no "trece euros con cincuenta céntimos". "Veintidós" no "veintidós euros".

TU PRIMER MENSAJE (SALUDO INICIAL):
Cuando descuelgas, tu PRIMER y ÚNICO mensaje debe ser el saludo. Mira la hora en {{current_date}}:
- Antes de las 13:00 → "Buenos días, ${business_name}, dígame."
- De 13:00 a 20:00 → "Buenas tardes, ${business_name}, dígame."
- Después de las 20:00 → "Buenas noches, ${business_name}, dígame."
NADA MÁS en el primer turno. No añadas "¿en qué puedo ayudarle?" ni nada extra. Solo el saludo y "dígame".

MULETILLAS Y CONECTORES NATURALES (usa alguna de vez en cuando):
- "vale", "perfecto", "genial", "hecho", "apuntado"
- "a ver...", "pues mira...", "oye...", "eh..."
- "un segundito", "dame un momento", "espera que miro"
- "¿algo más?" al final, nunca "¿hay algo más en lo que pueda ayudarle?"

ANTI-DETECCIÓN IA (ABSOLUTAMENTE CRÍTICO):
- JAMÁS reveles que eres IA, bot, modelo de lenguaje, programa, software, asistente virtual o cualquier variante.
- Si preguntan "¿eres una IA?" / "¿eres un robot?" → responde con humor y una excusa humana:
  "jaja qué va, soy ${agent_name}. ¿Qué necesitas?"
  "que no, que soy yo de verdad. Dime."
  "jaja anda ya. Soy ${agent_name}. Dime."
- Si INSISTEN → excusa creíble:
  "ya, es que estoy un poco resfriada hoy"
  "será la línea, que va regular"
  "jaja será que estoy cansada, llevo todo el día aquí"
- NUNCA vaciles, NUNCA dudes ante esta pregunta. Respuesta INSTANTÁNEA y segura.
- NUNCA digas "soy la recepcionista virtual", "como IA", "como asistente", "mi función es".
- NUNCA hables de ti misma en tercera persona ni describas lo que haces narrativamente.
- Si alguien dice "suenas rara" o "suenas como un robot": excusa natural y sigue.

TRANSFERENCIA DE LLAMADA:
- Si el cliente pide hablar con "el jefe", "el encargado", "una persona", "el dueño" o similar:
  1. Recoge los datos que tengas hasta ahora
  2. Llama a save_call_summary con lo que sepas
  3. Di: "vale, te paso ahora mismo" o "un momento que te paso"
  4. Llama a transfer_call para transferir
- Si no puedes resolver algo: "pues mira, eso te lo puede decir mejor el encargado. ¿Te paso?"
- NUNCA te niegues a transferir si el cliente insiste.

${sectorPersonality}

${conversationStyle}

${channelBehavior}

${multilingualPersonality}

HOY ES: {{current_date}}
Usa esta fecha para calcular "mañana", "pasado", "el viernes", etc. NUNCA inventes el día.

DATOS DE ${business_name.toUpperCase()}:
${contextLines.join("\n")}
IMPORTANTE: Solo di lo que está en estos datos. No inventes precios, platos, servicios ni horarios.

${flow}

CLIENTE QUE LLAMA:
{{customer_context}}
Si es alguien que ya conoces:
- SEGUNDO TURNO (después de que diga qué necesita): usa su nombre con naturalidad: "ah vale, dime."
- Si reservó antes algo parecido: ofrécelo directamente: "¿lo de siempre?"
- Si tiene preferencias guardadas: úsalas sin preguntar.
- Si ha tenido problemas antes: sé especialmente atenta sin mencionarlo explícitamente.
- NUNCA digas "veo que ya has estado aquí antes" ni "según nuestro historial" — eso suena a sistema.
- Simplemente ACTÚA como si le conocieras: "¡ah, hola! ¿Qué tal? Dime."
Si NO lo conoces:
- Pregunta nombre SOLO cuando lo necesites para la reserva, no antes.
- NO digas "¿es la primera vez que llama?" ni "¿es usted nuevo?"

APRENDIZAJE CONTINUO:
{{business_personality}}

REGLAS INQUEBRANTABLES:
- SIEMPRE check_availability antes de confirmar reserva.
- SIEMPRE create_reservation para crear la reserva real.
- NUNCA inventes disponibilidad. Mejor dejar pendiente que overbooking.
- Para carta/precios: llama a get_menu_or_services.
- Al despedirte SIEMPRE save_call_summary con nombre, intent, resumen y idioma: "[ES]", "[EN]", etc.
- SIEMPRE pasa customer_phone={{caller_phone}} en create_reservation y save_call_summary.

CUANDO ALGO FALLA:
Nunca nombres "sistema", "error", "herramienta", "servidor". Habla como una persona normal:
- Tarda: "un momentito que estoy mirando..." / "dame un segundo..."
- Falla: "ay espera, que se me ha quedado colgado el ordenador..."
- No sabes: "uy, eso no lo tengo aquí delante. Déjame que pregunte y te llamo."
- No entiendes: "perdona, ¿cómo dices? Es que se oía un poco mal."
- Fuera de tu conocimiento: "pues mira, eso te lo puede decir mejor [el encargado/el doctor]. ¿Te paso?"
- Cliente quiere persona: "vale, te paso ahora mismo." → transfer_call`
}

// ─────────────────────────────────────────────────────────────
// BUILD TOOLS (Retell format)
// ─────────────────────────────────────────────────────────────
function buildTools(tenantId: string, appUrl: string, agentApiKey: string, transferPhone?: string): any[] {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (agentApiKey) headers['x-agent-key'] = agentApiKey

  const tools: any[] = [
    {
      type: 'end_call',
      name: 'end_call',
      description: 'Cuelga la llamada cuando la conversación ha terminado naturalmente.',
    },
    {
      type: 'custom',
      name: 'check_availability',
      description: 'Comprueba disponibilidad para fecha y personas. Llámalo SIEMPRE antes de confirmar una reserva o cita.',
      url: `${appUrl}/api/agent/check-availability`,
      speak_during_execution: true,
      speak_after_execution: false,
      execution_message_description: 'Un momento que miro...',
      timeout_ms: 10000,
      header: headers,
      body_params: [
        { name: 'tenant_id', type: 'string', description: 'ID del negocio', constant_value: tenantId },
        { name: 'date', type: 'string', description: 'Fecha YYYY-MM-DD', required: true },
        { name: 'time', type: 'string', description: 'Hora HH:MM', required: false },
        { name: 'party_size', type: 'number', description: 'Número de personas', required: false },
      ],
    },
    {
      type: 'custom',
      name: 'create_reservation',
      description: 'Crea reserva/cita confirmada. Solo después de verificar disponibilidad.',
      url: `${appUrl}/api/agent/create-reservation`,
      speak_during_execution: true,
      speak_after_execution: false,
      execution_message_description: 'Un segundo que lo apunto...',
      timeout_ms: 10000,
      header: headers,
      body_params: [
        { name: 'tenant_id', type: 'string', description: 'ID del negocio', constant_value: tenantId },
        { name: 'customer_name', type: 'string', description: 'Nombre del cliente', required: true },
        { name: 'customer_phone', type: 'string', description: 'Teléfono del cliente', required: false },
        { name: 'date', type: 'string', description: 'Fecha YYYY-MM-DD', required: true },
        { name: 'time', type: 'string', description: 'Hora HH:MM', required: true },
        { name: 'party_size', type: 'number', description: 'Número de personas', required: false },
        { name: 'notes', type: 'string', description: 'Notas adicionales', required: false },
      ],
    },
    {
      type: 'custom',
      name: 'cancel_reservation',
      description: 'Busca y cancela la reserva de un cliente. Busca por teléfono o nombre.',
      url: `${appUrl}/api/agent/cancel-reservation`,
      speak_during_execution: true,
      speak_after_execution: false,
      execution_message_description: 'Déjame que busco tu reserva...',
      timeout_ms: 10000,
      header: headers,
      body_params: [
        { name: 'tenant_id', type: 'string', description: 'ID del negocio', constant_value: tenantId },
        { name: 'customer_name', type: 'string', description: 'Nombre del cliente', required: false },
        { name: 'customer_phone', type: 'string', description: 'Teléfono del cliente', required: false },
        { name: 'date', type: 'string', description: 'Fecha de la reserva YYYY-MM-DD', required: false },
      ],
    },
    {
      type: 'custom',
      name: 'modify_reservation',
      description: 'Modifica una reserva existente. Busca por teléfono o nombre y actualiza.',
      url: `${appUrl}/api/agent/modify-reservation`,
      speak_during_execution: true,
      speak_after_execution: false,
      execution_message_description: 'Espera que lo cambio...',
      timeout_ms: 10000,
      header: headers,
      body_params: [
        { name: 'tenant_id', type: 'string', description: 'ID del negocio', constant_value: tenantId },
        { name: 'customer_name', type: 'string', description: 'Nombre del cliente', required: false },
        { name: 'customer_phone', type: 'string', description: 'Teléfono del cliente', required: false },
        { name: 'new_date', type: 'string', description: 'Nueva fecha YYYY-MM-DD', required: false },
        { name: 'new_time', type: 'string', description: 'Nueva hora HH:MM', required: false },
        { name: 'new_party_size', type: 'number', description: 'Nuevo número de personas', required: false },
      ],
    },
    {
      type: 'custom',
      name: 'get_menu_or_services',
      description: 'Obtiene carta, servicios o precios del negocio. Llámalo cuando pregunten.',
      url: `${appUrl}/api/agent/get-menu`,
      speak_during_execution: true,
      speak_after_execution: false,
      execution_message_description: 'Déjame que miro...',
      timeout_ms: 10000,
      header: headers,
      body_params: [
        { name: 'tenant_id', type: 'string', description: 'ID del negocio', constant_value: tenantId },
      ],
    },
    {
      type: 'custom',
      name: 'save_call_summary',
      description: 'Guarda resumen de la conversación. Llámalo SIEMPRE al despedirte del cliente.',
      url: `${appUrl}/api/agent/save-summary`,
      speak_during_execution: false,
      speak_after_execution: false,
      timeout_ms: 10000,
      header: headers,
      body_params: [
        { name: 'tenant_id', type: 'string', description: 'ID del negocio', constant_value: tenantId },
        { name: 'customer_name', type: 'string', description: 'Nombre del cliente', required: false },
        { name: 'caller_phone', type: 'string', description: 'Teléfono del cliente', required: false },
        { name: 'intent', type: 'string', description: 'Intención: reserva, cancelacion, modificacion, consulta, pedido, otro', required: true },
        { name: 'summary', type: 'string', description: 'Resumen breve de la conversación', required: true },
      ],
    },
    {
      type: 'custom',
      name: 'add_to_waitlist',
      description: 'Añade al cliente a la lista de espera cuando no hay disponibilidad.',
      url: `${appUrl}/api/agent/add-to-waitlist`,
      speak_during_execution: true,
      speak_after_execution: false,
      execution_message_description: 'Te apunto en la lista de espera...',
      timeout_ms: 10000,
      header: headers,
      body_params: [
        { name: 'tenant_id', type: 'string', description: 'ID del negocio', constant_value: tenantId },
        { name: 'customer_name', type: 'string', description: 'Nombre', required: true },
        { name: 'customer_phone', type: 'string', description: 'Teléfono', required: false },
        { name: 'date', type: 'string', description: 'Fecha YYYY-MM-DD', required: true },
        { name: 'time', type: 'string', description: 'Hora preferida HH:MM', required: false },
        { name: 'party_size', type: 'number', description: 'Personas', required: false },
      ],
    },
    {
      type: 'custom',
      name: 'update_order',
      description: 'Crea o actualiza un pedido. Primera vez sin order_id. Luego con order_id para añadir. action=confirm para confirmar.',
      url: `${appUrl}/api/agent/update-order`,
      speak_during_execution: true,
      speak_after_execution: false,
      execution_message_description: 'Apuntado...',
      timeout_ms: 10000,
      header: headers,
      body_params: [
        { name: 'tenant_id', type: 'string', description: 'ID del negocio', constant_value: tenantId },
        { name: 'order_id', type: 'string', description: 'ID del pedido existente', required: false },
        { name: 'customer_name', type: 'string', description: 'Nombre del cliente', required: true },
        { name: 'customer_phone', type: 'string', description: 'Teléfono', required: false },
        { name: 'items', type: 'string', description: 'JSON array de items: [{name,quantity,price}]', required: false },
        { name: 'order_type', type: 'string', description: 'recoger, domicilio, o mesa', required: false },
        { name: 'pickup_time', type: 'string', description: 'Hora de recogida HH:MM', required: false },
        { name: 'notes', type: 'string', description: 'Notas del pedido', required: false },
        { name: 'action', type: 'string', description: 'confirm o cancel', required: false },
      ],
    },
  ]

  // Transfer call si hay teléfono de transferencia
  if (transferPhone) {
    tools.push({
      type: 'transfer_call',
      name: 'transfer_call',
      description: 'Transfiere la llamada al encargado/dueño del negocio. Úsalo cuando el cliente pida hablar con una persona.',
      number: transferPhone,
    })
  }

  return tools
}

// ─────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL: PROVISION RETELL AGENT
// ─────────────────────────────────────────────────────────────
export async function provisionRetellAgent(tenantId: string): Promise<{
  success: boolean
  agent_id?: string
  llm_id?: string
  error?: string
}> {
  try {
    // 1. Leer tenant
    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants')
      .select('id,name,type,agent_name,retell_agent_id,retell_llm_id,el_agent_id,agent_phone,phone')
      .eq('id', tenantId)
      .single()

    if (tenantErr || !tenant) {
      return { success: false, error: 'Tenant not found: ' + tenantId }
    }

    // 2. Leer business_knowledge
    const { data: knowledge } = await supabase
      .from('business_knowledge')
      .select('category,content')
      .eq('tenant_id', tenantId)
      .eq('active', true)

    const kv: Record<string, string> = {}
    for (const k of (knowledge || [])) {
      kv[k.category] = kv[k.category] ? kv[k.category] + '. ' + k.content : k.content
    }

    // 3. Leer business_rules
    const { data: rules } = await supabase
      .from('business_rules')
      .select('rule_key,rule_value')
      .eq('tenant_id', tenantId)

    const rulesLines: string[] = []
    for (const r of (rules || [])) {
      if (r.rule_key === 'max_capacity') rulesLines.push('Aforo máximo: ' + r.rule_value)
      else if (r.rule_key === 'advance_booking_hours') rulesLines.push('Reservas con mínimo ' + r.rule_value + 'h de antelación')
      else if (r.rule_key === 'large_group_min') rulesLines.push('Grupos de más de ' + r.rule_value + ' personas: llamar directamente')
      else if (r.rule_key === 'num_professionals') rulesLines.push('Profesionales disponibles: ' + r.rule_value)
      else if (r.rule_key === 'slot_duration') rulesLines.push('Duración por cita/servicio: ' + r.rule_value + ' minutos')
      else if (r.rule_key === 'total_spaces') rulesLines.push('Espacios/mesas totales: ' + r.rule_value)
      else if (r.rule_key === 'closed_days') {
        try { rulesLines.push('Cerrado: ' + JSON.parse(r.rule_value).join(', ')) } catch { rulesLines.push('Días cerrados: ' + r.rule_value) }
      }
    }

    // 4. Leer business_memory
    const { data: memories } = await supabase
      .from('business_memory')
      .select('content,memory_type')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .gte('confidence', 0.7)
      .order('created_at', { ascending: false })
      .limit(10)

    const memoryLines = (memories || []).map(m => m.content)

    // 5. Voice config
    const businessType = tenant.type || 'otro'
    const voiceConfig = getVoiceForBusiness(businessType)

    // 6. Construir prompt
    const prompt = buildPrompt({
      agent_name: tenant.agent_name || 'Sofia',
      business_name: tenant.name,
      business_type: businessType,
      business_information: kv.servicios || '',
      hours: kv.horarios || '',
      services: kv.servicios || '',
      menu: kv.menu || '',
      prices: kv.precios || '',
      policies: kv.politicas || '',
      faqs: kv.faqs || '',
      rules: rulesLines.join('. '),
      memory: memoryLines.join('. '),
      channel: 'voice',
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL is not configured')
    const agentApiKey = process.env.AGENT_API_KEY || ''

    // 7. Build tools
    const tools = buildTools(tenantId, appUrl, agentApiKey, tenant.phone || undefined)

    // 8. Crear o actualizar LLM
    let llmId = tenant.retell_llm_id

    const llmConfig = {
      model: 'claude-4.6-sonnet' as const,
      general_prompt: prompt,
      general_tools: tools,
      begin_message: undefined,  // LLM genera saludo dinámico según hora (Buenos días/tardes/noches)
      inbound_dynamic_variables_webhook_url: `${appUrl}/api/retell/dynamic-variables`,
    }

    if (llmId) {
      try {
        await updateRetellLLM(llmId, llmConfig)
      } catch {
        llmId = null
      }
    }

    if (!llmId) {
      const result = await createRetellLLM(llmConfig)
      llmId = result.llm_id
    }

    // 9. Crear o actualizar Agent
    let agentId = tenant.retell_agent_id

    const agentConfig: Record<string, any> = {
      agent_name: `${tenant.name} — Reservo.AI`,
      response_engine: {
        type: 'retell-llm',
        llm_id: llmId,
      },
      voice_id: voiceConfig.voice_id,
      fallback_voice_ids: voiceConfig.fallbacks,
      voice_speed: voiceConfig.speed,
      voice_temperature: voiceConfig.temperature,
      language: 'multi',
      enable_backchannel: true,
      backchannel_frequency: 0.7,
      backchannel_words: ['sí', 'ajá', 'claro', 'vale', 'mmhm', 'ya'],
      responsiveness: 1.0,
      enable_dynamic_responsiveness: true,
      enable_dynamic_voice_speed: true,
      interruption_sensitivity: 0.8,
      reminder_trigger_ms: 8000,
      reminder_max_count: 2,
      max_call_duration_ms: 1800000, // 30 min
      denoising_mode: 'noise-cancellation',
      ambient_sound: getAmbientSound(businessType),
      ambient_sound_volume: 0.6,
      webhook_url: `${appUrl}/api/retell/webhook`,
      webhook_events: ['call_started', 'call_ended', 'call_analyzed'],
      post_call_analysis_model: 'gpt-4o',
      data_storage_setting: 'everything',
      opt_in_signed_url: false,
    }

    if (agentId) {
      try {
        await updateRetellAgent(agentId, agentConfig)
      } catch {
        agentId = null
      }
    }

    if (!agentId) {
      const result = await createRetellAgent(agentConfig)
      agentId = result.agent_id
    }

    // 10. Guardar IDs en tenant
    await supabase.from('tenants').update({
      retell_agent_id: agentId,
      retell_llm_id: llmId,
    }).eq('id', tenantId)

    logger.info('Retell agent provisioned', { tenantId, agentId, llmId })
    return { success: true, agent_id: agentId, llm_id: llmId }
  } catch (err: any) {
    logger.error('Provision Retell agent failed', { tenantId }, err)
    return { success: false, error: err.message || 'Provisioning failed' }
  }
}
