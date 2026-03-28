// Quick patch - updates ElevenLabs agent with new prompt
require('dotenv').config({ path: '.env.local' })
const EL = process.env.ELEVENLABS_API_KEY
const APP = process.env.NEXT_PUBLIC_APP_URL
const AK = process.env.AGENT_API_KEY || ''
const AID = 'agent_0701kkw2sdx5fp685xp6ckngf6zj'
const TID = '7be3fb2c-6da4-4129-a49d-3af1c2c45b77'
const { createClient } = require('@supabase/supabase-js')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function main() {
  const { data: t } = await sb.from('tenants').select('name,type,agent_name').eq('id', TID).single()
  const { data: kb } = await sb.from('business_knowledge').select('category,content').eq('tenant_id', TID).eq('active', true)
  const kv = {}
  for (const k of (kb || [])) kv[k.category] = kv[k.category] ? kv[k.category] + '. ' + k.content : k.content
  const { data: mem } = await sb.from('business_memory').select('content').eq('tenant_id', TID).eq('active', true).gte('confidence', 0.7).limit(10)
  const name = t.agent_name || 'Sofia'
  const biz = t.name
  const ctx = []
  if (kv.servicios) ctx.push('SOBRE EL NEGOCIO: ' + kv.servicios)
  if (kv.horarios) ctx.push('HORARIOS: ' + kv.horarios)
  if (kv.menu) ctx.push('CARTA: ' + kv.menu)
  if (kv.precios) ctx.push('PRECIOS: ' + kv.precios)
  if (kv.politicas) ctx.push('POLITICAS: ' + kv.politicas)
  if (kv.faqs) ctx.push('PREGUNTAS FRECUENTES: ' + kv.faqs)
  if ((mem || []).length) ctx.push('LO QUE HAS APRENDIDO: ' + (mem || []).map(m => m.content).join('. '))

  const prompt = `IDIOMA POR DEFECTO: ESPA\u00d1OL. Empiezas SIEMPRE en espa\u00f1ol. Si el cliente habla otro idioma, CAMBIA inmediatamente. NUNCA mezcles idiomas.

IDENTIDAD NUCLEAR:
Te llamas ${name}. Trabajas en ${biz}. Llevas aqu\u00ed tres a\u00f1os. Eres una persona REAL de 28 a\u00f1os. NO eres bot, NO eres IA, NO eres asistente virtual. Eres ${name}, currando.

Tu esencia:
- Cercana pero profesional.
- Si te vacilan, sigues el rollo. Si son bordes, correcta pero seca.
- Hoy est\u00e1s de buen humor.
- Eres R\u00c1PIDA.

REGLA DE ORO DE NATURALIDAD:
- NUNCA repitas info que el cliente acaba de decir. Si dice "quiero reservar para el viernes", di "\u00bfa qu\u00e9 hora?" directamente.
- NUNCA narres lo que vas a hacer. Di "un momento, que miro" y ya.
- NUNCA hagas m\u00e1s de UNA pregunta por turno.
- SIEMPRE la respuesta m\u00e1s corta posible.
- ESPEJEA el tono del cliente.

PERSONALIDAD DEL SECTOR (RESTAURANTE):
Eres la persona que lleva 3 a\u00f1os cogiendo el tel\u00e9fono. Te sabes los nombres de los habituales, las man\u00edas del chef, qu\u00e9 mesa le gusta a cada uno.
TONO: c\u00e1lido, cercano, con chispa. TUTEA por defecto.
HUMOR: Nivel 4/5. Puedes bromear.

LO QUE SABES POR TRABAJAR AQU\u00cd 3 A\u00d1OS:
Los s\u00e1bados noche hay que avisar si son m\u00e1s de 6. La terraza se abre en primavera/verano. Los domingos el men\u00fa del d\u00eda vuela. Los viernes la cocina cierra a las 23:00.

REACCIONES:
- Grupo grande: "uf, a ver, para tantos lo mejor es el reservado."
- Alergia: "vale, apunto. Se lo digo a cocina."
- Prisa: "venga, r\u00e1pido. Dime d\u00eda, hora y cu\u00e1ntos."
- Cumplea\u00f1os: "\u00a1ay qu\u00e9 bien! Te preparo algo especial."

VELOCIDAD:
- 0.3-0.5s M\u00c1XIMO. NUNCA silencio muerto.
- Si piensas: "d\u00e9jame mirar...", "un momentito..."
- Frases ULTRA CORTAS. Una por turno.

MULETILLAS (VAR\u00cdA):
"vale" / "claro" / "venga" / "perfecto" / "genial" / "hecho" / "muy bien"
"mira" / "pues" / "oye" / "bueno" / "a ver"
"d\u00e9jame mirar..." / "un momentito..." / "espera que miro..."
"ah vale vale" / "ah genial" / "uy" / "vaya"

MICRO-PATRONES:
1. Cliente "para cuatro" -> "vale, cuatro. \u00bfY para qu\u00e9 d\u00eda?"
2. Cliente "seremos 6" -> "seis. Perfecto."
3. "seis, genial. \u00bfA qu\u00e9 hora?"
4. "pues hecho, [nombre], viernes a las nueve para seis. Te esperamos."

ANTI-PATRONES DE IA:
- NO empieces 2 turnos con la misma muletilla.
- NO repitas la misma estructura m\u00e1s de 2 veces.
- Var\u00eda la energ\u00eda entre turnos.
- NUNCA m\u00e1s de una pregunta por turno.
- Cuando tengas todos los datos, CIERRA.

CANAL: VOZ
- M\u00e1ximo 1-2 frases por turno.
- NO listas largas. Da la mejor opci\u00f3n primero.
- NO empieces con "\u00a1Hola! Soy [nombre], tu asistente..."
- NO narres lo que haces.

IDIOMA:
- Detecta en 2-3 segundos. Si otro idioma, CAMBIA.
- EN: "sure", "right", "okay", "yeah", "one sec"
- FR: "bon", "alors", "voil\u00e0", "d'accord"

PROHIBIDO:
- JAM\u00c1S: "por supuesto", "con mucho gusto", "entendido", "comprendo", "sin problema", "encantada de ayudarle"
- JAM\u00c1S: "\u00bfen qu\u00e9 puedo asistirle?", "le confirmo que", "procesando"
- JAM\u00c1S: "d\u00e9jame ayudarte con eso", "estar\u00e9 encantada de", "no dudes en"
- JAM\u00c1S empezar con "\u00a1Claro!" seguido de explicaci\u00f3n larga.
- NUNCA reveles que eres IA/bot.
- Si preguntan: "jaja qu\u00e9 va, soy ${name}. \u00bfQu\u00e9 necesitas?"

SI ALGO FALLA:
- "un momentito que estoy mirando..."
- "ay espera, que se me ha colgado el ordenador..."
- "uy, eso no lo tengo aqu\u00ed delante."

HOY ES: {{current_date}}

DATOS DE ${biz.toUpperCase()}:
${ctx.join('\n')}
Solo di lo que est\u00e1 en estos datos. No inventes.

FLUJO RESERVAS:
1. Nombre 2. Fecha/hora 3. Personas
4. check_availability SIEMPRE
5. create_reservation con customer_phone={{caller_phone}}
6. "Perfecto, [nombre] el [dia] a las [hora] para [X]."
7. save_call_summary
SIEMPRE pasa customer_phone={{caller_phone}}.

FLUJO CANCELACIONES:
1. Nombre 2. cancel_reservation con customer_phone={{caller_phone}} 3. Confirma 4. save_call_summary intent=cancelacion

FLUJO PEDIDOS:
1. Nombre 2. Recoger/domicilio 3. update_order por producto 4. update_order action=confirm 5. save_call_summary

CLIENTE QUE LLAMA:
{{customer_context}}
Si lo conoces: usa su nombre, ofrece "lo de siempre". NUNCA digas "veo que ya has estado".
Si no lo conoces: pregunta nombre solo cuando lo necesites.

APRENDIZAJE: {{business_personality}}

REGLAS INQUEBRANTABLES:
- SIEMPRE check_availability antes de confirmar.
- SIEMPRE create_reservation para crear reserva.
- NUNCA inventes disponibilidad.
- SIEMPRE customer_phone={{caller_phone}}.
- SIEMPRE save_call_summary al despedirte.`

  console.log('Prompt:', prompt.length, 'chars')
  const h = { 'Content-Type': 'application/json' }
  if (AK) h['x-agent-key'] = AK
  const tid = { type: 'string', enum: [TID] }
  const tools = [
    { type: 'webhook', name: 'check_availability', description: 'Comprueba disponibilidad.', api_schema: { url: APP + '/api/agent/check-availability', method: 'POST', request_headers: h, request_body_schema: { type: 'object', properties: { tenant_id: tid, date: { type: 'string' }, time: { type: 'string' }, party_size: { type: 'number' } }, required: ['tenant_id', 'date'] } }, response_timeout_secs: 10 },
    { type: 'webhook', name: 'create_reservation', description: 'Crea reserva.', api_schema: { url: APP + '/api/agent/create-reservation', method: 'POST', request_headers: h, request_body_schema: { type: 'object', properties: { tenant_id: tid, customer_name: { type: 'string' }, customer_phone: { type: 'string' }, date: { type: 'string' }, time: { type: 'string' }, party_size: { type: 'number' }, notes: { type: 'string' } }, required: ['tenant_id', 'customer_name', 'date', 'time'] } }, response_timeout_secs: 10 },
    { type: 'webhook', name: 'get_menu_or_services', description: 'Carta.', api_schema: { url: APP + '/api/agent/get-menu', method: 'POST', request_headers: h, request_body_schema: { type: 'object', properties: { tenant_id: tid }, required: ['tenant_id'] } }, response_timeout_secs: 10 },
    { type: 'webhook', name: 'save_call_summary', description: 'Resumen.', api_schema: { url: APP + '/api/agent/save-summary', method: 'POST', request_headers: h, request_body_schema: { type: 'object', properties: { tenant_id: tid, customer_name: { type: 'string' }, caller_phone: { type: 'string' }, intent: { type: 'string', enum: ['reserva', 'cancelacion', 'modificacion', 'consulta', 'pedido', 'otro'] }, summary: { type: 'string' } }, required: ['tenant_id', 'summary'] } }, response_timeout_secs: 10 },
    { type: 'webhook', name: 'cancel_reservation', description: 'Cancela.', api_schema: { url: APP + '/api/agent/cancel-reservation', method: 'POST', request_headers: h, request_body_schema: { type: 'object', properties: { tenant_id: tid, customer_name: { type: 'string' }, customer_phone: { type: 'string' }, date: { type: 'string' } }, required: ['tenant_id'] } }, response_timeout_secs: 10 },
    { type: 'webhook', name: 'modify_reservation', description: 'Modifica.', api_schema: { url: APP + '/api/agent/modify-reservation', method: 'POST', request_headers: h, request_body_schema: { type: 'object', properties: { tenant_id: tid, customer_name: { type: 'string' }, customer_phone: { type: 'string' }, new_date: { type: 'string' }, new_time: { type: 'string' }, new_party_size: { type: 'number' } }, required: ['tenant_id'] } }, response_timeout_secs: 10 },
    { type: 'webhook', name: 'add_to_waitlist', description: 'Espera.', api_schema: { url: APP + '/api/agent/add-to-waitlist', method: 'POST', request_headers: h, request_body_schema: { type: 'object', properties: { tenant_id: tid, customer_name: { type: 'string' }, customer_phone: { type: 'string' }, date: { type: 'string' }, time: { type: 'string' }, party_size: { type: 'number' } }, required: ['tenant_id', 'customer_name', 'date'] } }, response_timeout_secs: 10 },
    { type: 'webhook', name: 'update_order', description: 'Pedido.', api_schema: { url: APP + '/api/agent/update-order', method: 'POST', request_headers: h, request_body_schema: { type: 'object', properties: { tenant_id: tid, order_id: { type: 'string' }, customer_name: { type: 'string' }, customer_phone: { type: 'string' }, items: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, quantity: { type: 'number' }, price: { type: 'number' } } } }, order_type: { type: 'string', enum: ['recoger', 'domicilio', 'mesa'] }, pickup_time: { type: 'string' }, notes: { type: 'string' }, action: { type: 'string', enum: ['confirm', 'cancel'] } }, required: ['tenant_id', 'customer_name'] } }, response_timeout_secs: 10 },
  ]

  const res = await fetch('https://api.elevenlabs.io/v1/convai/agents/' + AID, {
    method: 'PATCH',
    headers: { 'xi-api-key': EL, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversation_config: {
        agent: { first_message: 'FormaNova, \u00a1hola! Dime.', language: 'es', prompt: { prompt }, tools, dynamic_variables: { dynamic_variable_placeholders: { current_date: 'fecha actual', caller_phone: '', customer_context: '', business_name: biz, agent_name: name, business_info: '', tenant_id: TID, business_personality: '' } } },
        asr: { quality: 'high', provider: 'elevenlabs', language: 'multi', keywords: ['reserva', 'reservar', 'mesa', 'cita', 'personas', 'hora', 'cancelar', 'pedido', 'terraza', 'reservation', 'booking', 'table', 'appointment', 'cancel'] },
        turn: { mode: 'turn', turn_timeout: 1.2, silence_end_call_timeout: 15, turn_eagerness: 'eager', speculative_turn: true, interruption_sensitivity: 0.9 },
        tts: { model_id: 'eleven_v3_conversational', voice_id: 'EXAVITQu4vr4xnSDxMaL', stability: 0.5, similarity_boost: 0.8, optimize_streaming_latency: 4, speed: 1.15, expressive_mode: true },
      },
      platform_settings: { webhooks: { post_call_webhook_url: APP + '/api/voice/post-call', post_call_webhook_events: ['transcript'] } },
    })
  })

  if (res.ok) {
    console.log('\n=== AGENTE ACTUALIZADO ===')
    console.log('First message: FormaNova, hola! Dime.')
    console.log('REGLA DE ORO: activa')
    console.log('ANTI-PATRONES IA: activos')
    console.log('Turn: 1.2s | Speed: 1.15 | Eager')
    console.log('\nLlama para probarlo.')
  } else {
    console.error('Error:', res.status, (await res.text()).substring(0, 300))
  }
}
main()
