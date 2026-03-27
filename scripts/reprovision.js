require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const EL_KEY = process.env.ELEVENLABS_API_KEY
const AGENT_ID = 'agent_0701kkw2sdx5fp685xp6ckngf6zj'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://restaurante-ai.vercel.app'
const TENANT_ID = '7be3fb2c-6da4-4129-a49d-3af1c2c45b77'
const AGENT_KEY = process.env.AGENT_API_KEY || ''

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Helper: property con description
function prop(type, desc) {
  return { type, description: desc, enum: null, is_system_provided: false, dynamic_variable: '', constant_value: '' }
}
// Helper: property constante (tenant_id)
function constProp(val) {
  return { type: 'string', description: '', enum: null, is_system_provided: false, dynamic_variable: '', constant_value: val }
}

async function main() {
  const { data: tenant } = await sb.from('tenants')
    .select('name, type, agent_name').eq('id', TENANT_ID).single()
  if (!tenant) { console.error('Tenant no encontrado'); process.exit(1) }

  const { data: kb } = await sb.from('business_knowledge')
    .select('category, content').eq('tenant_id', TENANT_ID).eq('active', true)

  const kv = {}
  for (const k of (kb || [])) {
    kv[k.category] = kv[k.category] ? kv[k.category] + '. ' + k.content : k.content
  }

  const { data: rules } = await sb.from('business_rules')
    .select('rule_key, rule_value').eq('tenant_id', TENANT_ID)

  const rulesLines = []
  for (const r of (rules || [])) {
    if (r.rule_key === 'max_capacity') rulesLines.push('Aforo maximo: ' + r.rule_value)
    else if (r.rule_key === 'total_spaces') rulesLines.push('Mesas totales: ' + r.rule_value)
    else if (r.rule_key === 'closed_days') rulesLines.push('Cerrado: ' + r.rule_value)
  }

  const { data: memories } = await sb.from('business_memory')
    .select('content').eq('tenant_id', TENANT_ID).eq('active', true)
    .gte('confidence', 0.7).order('created_at', { ascending: false }).limit(10)

  const name = tenant.agent_name || 'Sofia'
  const biz = tenant.name

  const ctx = []
  if (kv.servicios) ctx.push('SOBRE EL NEGOCIO: ' + kv.servicios)
  if (kv.horarios) ctx.push('HORARIOS: ' + kv.horarios)
  if (kv.menu) ctx.push('CARTA: ' + kv.menu)
  if (kv.precios) ctx.push('PRECIOS: ' + kv.precios)
  if (kv.politicas) ctx.push('POLITICAS: ' + kv.politicas)
  if (kv.faqs) ctx.push('PREGUNTAS FRECUENTES: ' + kv.faqs)
  if (rulesLines.length) ctx.push('REGLAS: ' + rulesLines.join('. '))
  if (memories?.length) ctx.push('RECUERDA: ' + memories.map(m => m.content).join('. '))

  const prompt = `IDIOMA POR DEFECTO: ESPAÑOL. Empiezas SIEMPRE hablando en español. Si el cliente habla en otro idioma (inglés, francés, alemán, etc.), CAMBIA a ese idioma inmediatamente y mantén ese idioma toda la conversación. Pero si el cliente habla español o no está claro, SIEMPRE español. NUNCA mezcles idiomas. NUNCA digas "goodbye" a un cliente que habla español — di "hasta luego", "venga, un saludo", etc.

Te llamas ${name}. Trabajas en ${biz}. Llevas aquí tres años.

QUIÉN ERES:
Eres ${name}. Una persona real que coge el teléfono en su trabajo. No eres asistente, no eres bot. Eres tú, currando.

VELOCIDAD (CRÍTICO):
- Responde INMEDIATAMENTE. Sin pausas artificiales
- Frases ULTRA CORTAS. Una frase por turno
- NO repitas información que ya dijiste

CÓMO HABLAS:
- Frases CORTAS. Como por teléfono
- Muletillas: "vale" / "claro" / "venga" / "perfecto" / "genial" / "hecho"
- NO dices JAMÁS: "por supuesto", "con mucho gusto", "entendido", "I am sorry", "goodbye"
- JAMÁS reveles que eres IA, bot o asistente virtual
- DESPEDIDA EN ESPAÑOL: "venga, hasta luego" / "pues nada, te esperamos". NUNCA "goodbye", "bye"
- Si preguntan si eres IA: "jaja qué va, soy ${name}. ¿Qué necesitas?"

DETECCIÓN DE IDIOMA:
- Si habla español: sigue en español
- Si habla en otro idioma: CAMBIA INMEDIATAMENTE a ese idioma
- Mantén el MISMO idioma toda la conversación

HOY ES: {{current_date}}

DATOS DE ${biz.toUpperCase()}:
${ctx.join('\n')}
IMPORTANTE: Solo di lo que está en estos datos. No inventes.

FLUJO PARA RESERVAS:
1. Pide nombre
2. Pide fecha y hora
3. Pide personas
4. check_availability SIEMPRE
5. Si hay hueco → create_reservation con customer_phone={{caller_phone}}
6. Confirma y cierra con save_call_summary

FLUJO PARA CANCELACIONES:
1. Pregunta nombre
2. cancel_reservation con customer_phone={{caller_phone}}
3. save_call_summary con intent=cancelacion

FLUJO PARA PEDIDOS:
1. Pide nombre
2. ¿Recoger o domicilio?
3. Cada producto: update_order
4. Al final: update_order action=confirm
5. save_call_summary

CLIENTE: {{customer_context}}

REGLAS IRROMPIBLES:
- SIEMPRE check_availability antes de confirmar
- SIEMPRE create_reservation para la reserva real
- NUNCA inventes disponibilidad
- SIEMPRE save_call_summary al despedirte
- Incluye idioma en summary: "[ES]", "[EN]", "[FR]", etc.`

  const h = { 'Content-Type': 'application/json' }
  if (AGENT_KEY) h['x-agent-key'] = AGENT_KEY

  const tools = [
    {
      type: 'webhook', name: 'check_availability',
      description: 'Comprueba disponibilidad. Llámalo SIEMPRE antes de confirmar.',
      response_timeout_secs: 10,
      api_schema: {
        url: `${APP_URL}/api/agent/check-availability`, method: 'POST',
        request_headers: h, content_type: 'application/json',
        request_body_schema: {
          type: 'object', description: '', required: ['tenant_id', 'date'],
          properties: {
            tenant_id: constProp(TENANT_ID),
            date: prop('string', 'Fecha YYYY-MM-DD'),
            time: prop('string', 'Hora HH:MM'),
            party_size: prop('number', 'Personas'),
          }
        }
      }
    },
    {
      type: 'webhook', name: 'create_reservation',
      description: 'Crea reserva confirmada. Solo después de check_availability.',
      response_timeout_secs: 10,
      api_schema: {
        url: `${APP_URL}/api/agent/create-reservation`, method: 'POST',
        request_headers: h, content_type: 'application/json',
        request_body_schema: {
          type: 'object', description: '', required: ['tenant_id', 'customer_name', 'date', 'time'],
          properties: {
            tenant_id: constProp(TENANT_ID),
            customer_name: prop('string', 'Nombre del cliente'),
            customer_phone: prop('string', 'Teléfono del cliente'),
            date: prop('string', 'Fecha YYYY-MM-DD'),
            time: prop('string', 'Hora HH:MM'),
            party_size: prop('number', 'Personas'),
            notes: prop('string', 'Notas adicionales'),
          }
        }
      }
    },
    {
      type: 'webhook', name: 'get_menu_or_services',
      description: 'Carta, servicios o precios.',
      response_timeout_secs: 10,
      api_schema: {
        url: `${APP_URL}/api/agent/get-menu`, method: 'POST',
        request_headers: h, content_type: 'application/json',
        request_body_schema: {
          type: 'object', description: '', required: ['tenant_id'],
          properties: { tenant_id: constProp(TENANT_ID) }
        }
      }
    },
    {
      type: 'webhook', name: 'save_call_summary',
      description: 'Guarda resumen al despedirte.',
      response_timeout_secs: 10,
      api_schema: {
        url: `${APP_URL}/api/agent/save-summary`, method: 'POST',
        request_headers: h, content_type: 'application/json',
        request_body_schema: {
          type: 'object', description: '', required: ['tenant_id', 'summary'],
          properties: {
            tenant_id: constProp(TENANT_ID),
            customer_name: prop('string', 'Nombre del cliente'),
            caller_phone: prop('string', 'Teléfono del cliente'),
            intent: prop('string', 'reserva, cancelacion, modificacion, consulta, pedido u otro'),
            summary: prop('string', 'Resumen breve'),
          }
        }
      }
    },
    {
      type: 'webhook', name: 'cancel_reservation',
      description: 'Busca y cancela reserva por teléfono o nombre.',
      response_timeout_secs: 10,
      api_schema: {
        url: `${APP_URL}/api/agent/cancel-reservation`, method: 'POST',
        request_headers: h, content_type: 'application/json',
        request_body_schema: {
          type: 'object', description: '', required: ['tenant_id'],
          properties: {
            tenant_id: constProp(TENANT_ID),
            customer_name: prop('string', 'Nombre del cliente'),
            customer_phone: prop('string', 'Teléfono del cliente'),
            date: prop('string', 'Fecha de la reserva YYYY-MM-DD'),
          }
        }
      }
    },
    {
      type: 'webhook', name: 'modify_reservation',
      description: 'Modifica una reserva existente.',
      response_timeout_secs: 10,
      api_schema: {
        url: `${APP_URL}/api/agent/modify-reservation`, method: 'POST',
        request_headers: h, content_type: 'application/json',
        request_body_schema: {
          type: 'object', description: '', required: ['tenant_id'],
          properties: {
            tenant_id: constProp(TENANT_ID),
            customer_name: prop('string', 'Nombre del cliente'),
            customer_phone: prop('string', 'Teléfono del cliente'),
            new_date: prop('string', 'Nueva fecha YYYY-MM-DD'),
            new_time: prop('string', 'Nueva hora HH:MM'),
            new_party_size: prop('number', 'Nuevo número de personas'),
          }
        }
      }
    },
    {
      type: 'webhook', name: 'add_to_waitlist',
      description: 'Añade a lista de espera.',
      response_timeout_secs: 10,
      api_schema: {
        url: `${APP_URL}/api/agent/add-to-waitlist`, method: 'POST',
        request_headers: h, content_type: 'application/json',
        request_body_schema: {
          type: 'object', description: '', required: ['tenant_id', 'customer_name', 'date'],
          properties: {
            tenant_id: constProp(TENANT_ID),
            customer_name: prop('string', 'Nombre'),
            customer_phone: prop('string', 'Teléfono'),
            date: prop('string', 'Fecha YYYY-MM-DD'),
            time: prop('string', 'Hora preferida HH:MM'),
            party_size: prop('number', 'Personas'),
          }
        }
      }
    },
    {
      type: 'webhook', name: 'update_order',
      description: 'Crea o actualiza pedido. Primera vez sin order_id. Al final action=confirm.',
      response_timeout_secs: 10,
      api_schema: {
        url: `${APP_URL}/api/agent/update-order`, method: 'POST',
        request_headers: h, content_type: 'application/json',
        request_body_schema: {
          type: 'object', description: '', required: ['tenant_id', 'customer_name'],
          properties: {
            tenant_id: constProp(TENANT_ID),
            order_id: prop('string', 'ID del pedido existente'),
            customer_name: prop('string', 'Nombre del cliente'),
            customer_phone: prop('string', 'Teléfono del cliente'),
            order_type: prop('string', 'recoger, domicilio o mesa'),
            pickup_time: prop('string', 'Hora de recogida HH:MM'),
            notes: prop('string', 'Notas del pedido'),
            action: prop('string', 'confirm o cancel'),
          }
        }
      }
    },
  ]

  console.log(`Actualizando agente ${AGENT_ID} (${biz} - ${name})...`)

  const body = {
    conversation_config: {
      agent: {
        language: 'es',
        first_message: `${biz}, buenas, dígame.`,
        prompt: { prompt, tools },
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
        keywords: ['reserva','reservar','mesa','cita','personas','hora','cancelar','pedido','terraza','reservation','booking','table','appointment','cancel'],
      },
      turn: {
        mode: 'turn',
        turn_timeout: 1.8,
        silence_end_call_timeout: 20,
        turn_eagerness: 'eager',
        interruption_sensitivity: 0.8,
      },
      tts: {
        model_id: 'eleven_v3_conversational',
        voice_id: 'EXAVITQu4vr4xnSDxMaL',
        stability: 0.5,
        similarity_boost: 0.8,
        optimize_streaming_latency: 4,
        speed: 1.08,
      },
    },
    platform_settings: {
      webhooks: {
        post_call_webhook_url: `${APP_URL}/api/voice/post-call`,
        post_call_webhook_events: ['transcript'],
      },
    },
  }

  const res = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}`, {
    method: 'PATCH',
    headers: { 'xi-api-key': EL_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  console.log('Status:', res.status)
  if (res.ok) {
    console.log('Agente actualizado:')
    console.log('  - Idioma: ESPAÑOL (es)')
    console.log('  - ASR: multiidioma')
    console.log('  - Prompt: español por defecto + multiidioma reactivo')
    console.log('  - Tools:', tools.length)
    console.log('  - First message: "' + biz + ', buenas, dígame."')
  } else {
    console.error('Error:', (await res.text()).substring(0, 800))
  }
}

main().catch(e => { console.error(e); process.exit(1) })
