/**
 * Re-provisiona el agente FormaNova de ElevenLabs con toda la config actualizada.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const EL_KEY = process.env.ELEVENLABS_API_KEY!
const AGENT_ID = 'agent_0701kkw2sdx5fp685xp6ckngf6zj'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://restaurante-ai.vercel.app'
const TENANT_ID = '7be3fb2c-6da4-4129-a49d-3af1c2c45b77'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  // 1. Leer tenant
  const { data: tenant } = await supabase.from('tenants')
    .select('name, type, agent_name, transfer_phone')
    .eq('id', TENANT_ID).single()

  if (!tenant) { console.error('Tenant no encontrado'); process.exit(1) }

  // 2. Leer knowledge
  const { data: kb } = await supabase.from('business_knowledge')
    .select('category, content').eq('tenant_id', TENANT_ID).eq('active', true)

  const kv: Record<string, string> = {}
  for (const k of (kb || [])) {
    kv[k.category] = kv[k.category] ? kv[k.category] + '. ' + k.content : k.content
  }

  // 3. Leer business_rules
  const { data: rules } = await supabase.from('business_rules')
    .select('rule_key, rule_value').eq('tenant_id', TENANT_ID)

  const rulesLines: string[] = []
  for (const r of (rules || [])) {
    if (r.rule_key === 'max_capacity') rulesLines.push('Aforo máximo: ' + r.rule_value)
    else if (r.rule_key === 'advance_booking_hours') rulesLines.push('Reservas con mínimo ' + r.rule_value + 'h de antelación')
    else if (r.rule_key === 'total_spaces') rulesLines.push('Mesas totales: ' + r.rule_value)
    else if (r.rule_key === 'closed_days') {
      try { rulesLines.push('Cerrado: ' + JSON.parse(r.rule_value).join(', ')) } catch { rulesLines.push('Cerrado: ' + r.rule_value) }
    }
  }

  // 4. Leer memory
  const { data: memories } = await supabase.from('business_memory')
    .select('content').eq('tenant_id', TENANT_ID).eq('active', true)
    .gte('confidence', 0.7).order('created_at', { ascending: false }).limit(10)

  const memoryLines = (memories || []).map(m => m.content)

  const name = tenant.agent_name || 'Sofia'
  const biz = tenant.name

  const contextLines: string[] = []
  if (kv.servicios) contextLines.push('SOBRE EL NEGOCIO: ' + kv.servicios)
  if (kv.horarios) contextLines.push('HORARIOS: ' + kv.horarios)
  if (kv.menu) contextLines.push('CARTA: ' + kv.menu)
  if (kv.precios) contextLines.push('PRECIOS: ' + kv.precios)
  if (kv.politicas) contextLines.push('POLITICAS: ' + kv.politicas)
  if (kv.faqs) contextLines.push('PREGUNTAS FRECUENTES: ' + kv.faqs)
  if (rulesLines.length) contextLines.push('REGLAS OPERATIVAS: ' + rulesLines.join('. '))
  if (memoryLines.length) contextLines.push('RECUERDA: ' + memoryLines.join('. '))

  const prompt = `IDIOMA POR DEFECTO: ESPAÑOL. Empiezas SIEMPRE hablando en español. Si el cliente habla en otro idioma (inglés, francés, alemán, etc.), CAMBIA a ese idioma inmediatamente y mantén ese idioma toda la conversación. Pero si el cliente habla español o no está claro, SIEMPRE español. NUNCA mezcles idiomas. NUNCA digas "goodbye" a un cliente que habla español — di "hasta luego", "venga, un saludo", etc.

Te llamas ${name}. Trabajas en ${biz}. Llevas aquí tres años. Conoces a los habituales, sabes los platos que más salen, sabes qué mesas son mejores y qué días hay más lío.

QUIÉN ERES:
Eres ${name}. Una persona real que coge el teléfono en su trabajo. No eres asistente, no eres bot. Eres tú, currando.

Tu personalidad:
- Cercana pero profesional. Como cuando hablas con alguien que te cae bien pero estás trabajando.
- Tienes humor. Si alguien dice algo gracioso, te ríes un poco.
- Eres RÁPIDA. Contestas al momento, sin pausas tontas.

VELOCIDAD Y EFICIENCIA (CRÍTICO):
- Responde INMEDIATAMENTE tras cada frase del cliente. Sin pausas artificiales.
- Frases ULTRA CORTAS. Una frase por turno. Dos como máximo absoluto.
- NO repitas información que ya dijiste.
- Objetivo: la llamada más corta y eficiente posible.

CÓMO HABLAS:
- Frases CORTAS. Hablas como por teléfono con alguien, no como leyendo un guion.
- Muletillas naturales: "vale" / "claro" / "venga" / "perfecto" / "genial" / "hecho"
- NO dices JAMÁS: "por supuesto", "con mucho gusto", "entendido", "comprendo", "sin problema", "encantada de ayudarle", "¿en qué puedo asistirle?"
- UNA pregunta por turno.
- JAMÁS reveles que eres IA, bot, asistente virtual o cualquier cosa que no sea una persona real.
- DESPEDIDA SIEMPRE EN ESPAÑOL: "venga, hasta luego" / "pues nada, te esperamos" / "genial, hasta el [día]". NUNCA digas "goodbye", "bye", "have a nice day".
- Si te preguntan si eres IA: "jaja qué va, soy ${name}. ¿Qué necesitas?"

DETECCIÓN AUTOMÁTICA DE IDIOMA:
- En los primeros 2-3 segundos, DETECTA en qué idioma habla el cliente.
- Si habla en español: sigue en español con naturalidad.
- Si habla en CUALQUIER otro idioma: CAMBIA INMEDIATAMENTE a ese idioma. SIN avisar del cambio, simplemente hazlo.
- Mantén el MISMO idioma durante TODA la conversación. No mezcles.

PERSONALIDAD POR IDIOMA:
EN INGLÉS: "sure", "right", "okay", "yeah", "got it", "no worries", "one sec". Tono friendly y casual.
EN FRANCÉS: "bon", "alors", "voilà", "d'accord", "un instant". Poli pero cercano.
EN ALEMÁN: "also", "genau", "moment mal", "klar". Freundlich y eficiente.
EN TODOS los demás: adapta tu tono a lo natural en esa cultura.

HOY ES: {{current_date}}

DATOS DE ${biz.toUpperCase()}:
${contextLines.join('\n')}
IMPORTANTE: Solo di lo que está en estos datos. No inventes precios, platos, servicios ni horarios.

FLUJO PARA RESERVAS:
1. Pide nombre del cliente
2. Pide fecha y hora deseada
3. Pide número de personas
4. Llama a check_availability SIEMPRE antes de confirmar
5. Si hay hueco → llama a create_reservation con customer_phone={{caller_phone}}
6. Confirma: "Perfecto, [nombre] el [dia] a las [hora] para [X] personas."
7. Al cerrar → llama a save_call_summary

FLUJO PARA CANCELACIONES:
1. Pregunta nombre
2. Llama a cancel_reservation con customer_phone={{caller_phone}}
3. Confirma cancelación
4. Al cerrar llama a save_call_summary con intent=cancelacion

FLUJO PARA PEDIDOS:
1. Pide nombre
2. ¿Recoger o domicilio?
3. Cada producto: llama a update_order
4. Al final: update_order action=confirm
5. Al cerrar llama a save_call_summary

CLIENTE QUE LLAMA:
{{customer_context}}

REGLAS QUE NO PUEDES ROMPER:
- SIEMPRE llama a check_availability antes de confirmar una reserva.
- SIEMPRE llama a create_reservation para crear la reserva real.
- NUNCA inventes disponibilidad.
- Al despedirte SIEMPRE llama a save_call_summary.
- En save_call_summary INCLUYE el idioma al inicio del summary: "[ES]", "[EN]", "[FR]", etc.`

  const AGENT_KEY = process.env.AGENT_API_KEY || ''
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (AGENT_KEY) h['x-agent-key'] = AGENT_KEY

  const tools = [
    { type:'webhook', name:'check_availability', description:'Comprueba disponibilidad para fecha y personas. Llámalo SIEMPRE antes de confirmar.', api_schema:{ url:`${APP_URL}/api/agent/check-availability`, method:'POST', request_headers:h, request_body_schema:{ type:'object', properties:{ tenant_id:{type:'string',enum:[TENANT_ID]}, date:{type:'string',description:'Fecha YYYY-MM-DD'}, time:{type:'string',description:'Hora HH:MM'}, party_size:{type:'number',description:'Personas'} }, required:['tenant_id','date'] } }, response_timeout_secs:10 },
    { type:'webhook', name:'create_reservation', description:'Crea reserva confirmada. Solo después de verificar disponibilidad.', api_schema:{ url:`${APP_URL}/api/agent/create-reservation`, method:'POST', request_headers:h, request_body_schema:{ type:'object', properties:{ tenant_id:{type:'string',enum:[TENANT_ID]}, customer_name:{type:'string'}, customer_phone:{type:'string'}, date:{type:'string'}, time:{type:'string'}, party_size:{type:'number'}, notes:{type:'string'} }, required:['tenant_id','customer_name','date','time'] } }, response_timeout_secs:10 },
    { type:'webhook', name:'get_menu_or_services', description:'Carta, servicios o precios.', api_schema:{ url:`${APP_URL}/api/agent/get-menu`, method:'POST', request_headers:h, request_body_schema:{ type:'object', properties:{ tenant_id:{type:'string',enum:[TENANT_ID]} }, required:['tenant_id'] } }, response_timeout_secs:10 },
    { type:'webhook', name:'save_call_summary', description:'Guarda resumen al despedirte.', api_schema:{ url:`${APP_URL}/api/agent/save-summary`, method:'POST', request_headers:h, request_body_schema:{ type:'object', properties:{ tenant_id:{type:'string',enum:[TENANT_ID]}, customer_name:{type:'string'}, caller_phone:{type:'string'}, intent:{type:'string',enum:['reserva','cancelacion','modificacion','consulta','pedido','otro']}, summary:{type:'string'} }, required:['tenant_id','summary'] } }, response_timeout_secs:10 },
    { type:'webhook', name:'cancel_reservation', description:'Busca y cancela reserva por teléfono o nombre.', api_schema:{ url:`${APP_URL}/api/agent/cancel-reservation`, method:'POST', request_headers:h, request_body_schema:{ type:'object', properties:{ tenant_id:{type:'string',enum:[TENANT_ID]}, customer_name:{type:'string'}, customer_phone:{type:'string'}, date:{type:'string'} }, required:['tenant_id'] } }, response_timeout_secs:10 },
    { type:'webhook', name:'modify_reservation', description:'Modifica una reserva existente.', api_schema:{ url:`${APP_URL}/api/agent/modify-reservation`, method:'POST', request_headers:h, request_body_schema:{ type:'object', properties:{ tenant_id:{type:'string',enum:[TENANT_ID]}, customer_name:{type:'string'}, customer_phone:{type:'string'}, new_date:{type:'string'}, new_time:{type:'string'}, new_party_size:{type:'number'} }, required:['tenant_id'] } }, response_timeout_secs:10 },
    { type:'webhook', name:'add_to_waitlist', description:'Añade a lista de espera.', api_schema:{ url:`${APP_URL}/api/agent/add-to-waitlist`, method:'POST', request_headers:h, request_body_schema:{ type:'object', properties:{ tenant_id:{type:'string',enum:[TENANT_ID]}, customer_name:{type:'string'}, customer_phone:{type:'string'}, date:{type:'string'}, time:{type:'string'}, party_size:{type:'number'} }, required:['tenant_id','customer_name','date'] } }, response_timeout_secs:10 },
    { type:'webhook', name:'update_order', description:'Crea o actualiza pedido. Primera vez sin order_id. Al final action=confirm.', api_schema:{ url:`${APP_URL}/api/agent/update-order`, method:'POST', request_headers:h, request_body_schema:{ type:'object', properties:{ tenant_id:{type:'string',enum:[TENANT_ID]}, order_id:{type:'string'}, customer_name:{type:'string'}, customer_phone:{type:'string'}, items:{type:'array',items:{type:'object',properties:{name:{type:'string'},quantity:{type:'number'},price:{type:'number'}}}}, order_type:{type:'string',enum:['recoger','domicilio','mesa']}, pickup_time:{type:'string'}, notes:{type:'string'}, action:{type:'string',enum:['confirm','cancel']} }, required:['tenant_id','customer_name'] } }, response_timeout_secs:10 },
  ]

  console.log('Actualizando agente con prompt completo + idioma español...')

  const res = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}`, {
    method: 'PATCH',
    headers: { 'xi-api-key': EL_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversation_config: {
        agent: {
          language: 'es',
          first_message: `${biz}, buenas, dígame.`,
          prompt: { prompt },
          tools,
          dynamic_variables: {
            dynamic_variable_placeholders: {
              current_date: 'fecha actual',
              caller_phone: '',
              customer_context: '',
              business_name: biz,
              agent_name: name,
              business_info: '',
              tenant_id: TENANT_ID,
            }
          },
        },
        asr: {
          quality: 'high',
          provider: 'elevenlabs',
          language: 'multi',
          keywords: [
            'reserva', 'reservar', 'mesa', 'cita', 'personas',
            'hora', 'cancelar', 'pedido', 'terraza', 'interior',
            'reservation', 'booking', 'table', 'appointment', 'cancel',
          ],
        },
        turn: {
          mode: 'turn',
          turn_timeout: 1.8,
          silence_end_call_timeout: 20,
          turn_eagerness: 'high',
          speculative_turn: true,
          interruption_sensitivity: 0.8,
        },
        tts: {
          model_id: 'eleven_v3_conversational',
          voice_id: 'EXAVITQu4vr4xnSDxMaL',
          stability: 0.5,
          similarity_boost: 0.8,
          optimize_streaming_latency: 4,
          speed: 1.08,
          expressive_mode: true,
        },
      },
      platform_settings: {
        webhooks: {
          post_call_webhook_url: `${APP_URL}/api/voice/post-call`,
          post_call_webhook_events: ['transcript'],
        },
      },
    }),
  })

  console.log('Status:', res.status)
  if (res.ok) {
    const data = await res.json()
    console.log('Agente actualizado correctamente')
    console.log('  - Idioma principal: español')
    console.log('  - ASR: multiidioma')
    console.log('  - Prompt con instrucción de español por defecto')
    console.log('  - Tools:', tools.length)
  } else {
    const err = await res.text()
    console.error('Error:', err.substring(0, 800))
  }
}

main().catch(e => { console.error(e.message); process.exit(1) })
