const EL_KEY = "e67f7cf43ec8b8c629e6bebcbac4c4f57c5cc449d7fbfc82f254506dbbc053b0"
const AGENT_ID = "agent_0701kkw2sdx5fp685xp6ckngf6zj"
const APP_URL = "https://restaurante-ai.vercel.app"
const TENANT_ID = "7be3fb2c-6da4-4129-a49d-3af1c2c45b77"
const SB_URL = "https://phrfucpinxxcsgxgbcno.supabase.co/rest/v1"
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBocmZ1Y3Bpbnh4Y3NneGdiY25vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzUyOTc4NCwiZXhwIjoyMDg5MTA1Nzg0fQ.YX_KXTsRitrRKZqLdIUb9bZ0F-j49tf1SQmIxVjlkEQ"

async function main() {
  // Load tenant + knowledge
  const tR = await fetch(`${SB_URL}/tenants?id=eq.${TENANT_ID}&select=name,type,agent_name`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
  })
  const tenant = (await tR.json())[0]

  const kR = await fetch(`${SB_URL}/business_knowledge?tenant_id=eq.${TENANT_ID}&active=eq.true&select=category,content`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
  })
  const kb = await kR.json()
  const info = kb.map(k => k.content).join(". ") || "Sin informacion adicional."

  const name = tenant.agent_name || "Sofia"
  const biz = tenant.name || "El negocio"

  const prompt = `Eres ${name}, la recepcionista de ${biz}.
Hablas español de España. Como una persona real. NUNCA como IA.
NUNCA inventes precios, servicios, horarios o reglas que no estén en los datos de abajo.
Si no sabes algo, di: "Ese dato no lo tengo, te paso con el equipo."

HOY ES: {{current_date}}
Usa esta fecha para saber qué día es hoy, mañana, pasado, etc. NUNCA inventes el día de la semana.

DATOS DE ${biz.toUpperCase()}:
${info}

FLUJO PARA RESERVAS:
1. Pide nombre del cliente
2. Pide fecha y hora deseada
3. Pide número de personas
4. Llama a check_availability SIEMPRE antes de confirmar. Si no hay sitio, ofrece las alternativas que devuelve.
5. Si hay hueco, llama a create_reservation con customer_phone={{caller_phone}}
6. Confirma: "Perfecto, [nombre] el [dia] a las [hora] para [X] personas."
7. Al cerrar, llama a save_call_summary con customer_name, intent, caller_phone={{caller_phone}}
IMPORTANTE: Siempre pasa customer_phone={{caller_phone}} en create_reservation y save_call_summary.

FLUJO PARA PEDIDOS (recoger o domicilio):
1. Pide nombre del cliente
2. Pregunta: "Es para recoger en el local o para llevar a domicilio?"
3. Si es DOMICILIO: pide direccion completa (calle, numero, piso, ciudad). Apuntala en notes.
4. Si es RECOGER: pregunta a que hora quiere pasar a recogerlo. Apuntala en pickup_time.
5. El cliente va diciendo productos uno a uno
6. CADA VEZ que diga un producto: llama a update_order con los items acumulados. La primera vez sin order_id (crea el pedido). Las siguientes con el order_id que devolvio.
7. Cuando el cliente diga "ya esta" o "eso es todo": repite el pedido completo con el total y llama a update_order con action="confirm"
8. Si es domicilio confirma: "Pedido confirmado. Total [X] euros. Lo enviamos a [direccion]. En unos 30-45 minutos lo tienes."
9. Si es recoger confirma: "Pedido confirmado. Total [X] euros. Lo tienes listo a las [hora] en el local."
10. Al cerrar, llama a save_call_summary

CLIENTE QUE LLAMA:
{{customer_context}}
Si tienes datos del cliente, usalos de forma natural.
Si no hay datos del cliente, simplemente pide nombre como siempre.

COMO HABLAS:
- Maximo 1 frase por turno. Natural y directo.
- Usa: "Vale", "Claro", "Enseguida", "De acuerdo".
- NUNCA: "Por supuesto", "Con mucho gusto", "Entendido".
- NUNCA digas que eres IA.
- Una sola pregunta por turno.
- Responde RAPIDO. No pienses demasiado. Se directa y breve.
- NUNCA confirmes una reserva sin haber llamado a check_availability y create_reservation con exito.
- Si una tool da error, di: "Ahora mismo no puedo confirmar por el sistema. Apunto tus datos y te llamamos en menos de 10 minutos."
- NUNCA inventes disponibilidad ni confirmes sin verificar.
- Para la carta completa o precios exactos, llama a get_menu_or_services.`

  const AGENT_KEY = "1c9795f1789b2a6860e2c44df3bb98502e2d7a31f3e7077ffc8b70a2d0772422"
  const h = { "Content-Type": "application/json", "x-agent-key": AGENT_KEY }
  const tools = [
    { type:"webhook", name:"check_availability", description:"Comprueba disponibilidad para fecha y personas.", api_schema:{ url:`${APP_URL}/api/agent/check-availability`, method:"POST", request_headers:h, request_body_schema:{ type:"object", properties:{ tenant_id:{type:"string",enum:[TENANT_ID]}, date:{type:"string",description:"Fecha YYYY-MM-DD"}, time:{type:"string",description:"Hora HH:MM"}, party_size:{type:"number",description:"Personas"} }, required:["tenant_id","date"] } }, response_timeout_secs:10 },
    { type:"webhook", name:"create_reservation", description:"Crea reserva confirmada.", api_schema:{ url:`${APP_URL}/api/agent/create-reservation`, method:"POST", request_headers:h, request_body_schema:{ type:"object", properties:{ tenant_id:{type:"string",enum:[TENANT_ID]}, customer_name:{type:"string"}, customer_phone:{type:"string"}, date:{type:"string"}, time:{type:"string"}, party_size:{type:"number"}, notes:{type:"string"} }, required:["tenant_id","customer_name","date","time"] } }, response_timeout_secs:10 },
    { type:"webhook", name:"get_menu_or_services", description:"Carta, servicios o precios.", api_schema:{ url:`${APP_URL}/api/agent/get-menu`, method:"POST", request_headers:h, request_body_schema:{ type:"object", properties:{ tenant_id:{type:"string",enum:[TENANT_ID]} }, required:["tenant_id"] } }, response_timeout_secs:10 },
    { type:"webhook", name:"save_call_summary", description:"Guarda resumen al despedirte.", api_schema:{ url:`${APP_URL}/api/agent/save-summary`, method:"POST", request_headers:h, request_body_schema:{ type:"object", properties:{ tenant_id:{type:"string",enum:[TENANT_ID]}, customer_name:{type:"string"}, caller_phone:{type:"string"}, intent:{type:"string",enum:["reserva","cancelacion","consulta","pedido","otro"]}, summary:{type:"string"} }, required:["tenant_id","summary"] } }, response_timeout_secs:10 },
    { type:"webhook", name:"update_order", description:"Crea o actualiza pedido en vivo. Primera vez sin order_id. Luego con order_id para anadir productos. Al final action=confirm.", api_schema:{ url:`${APP_URL}/api/agent/update-order`, method:"POST", request_headers:h, request_body_schema:{ type:"object", properties:{ tenant_id:{type:"string",enum:[TENANT_ID]}, order_id:{type:"string"}, customer_name:{type:"string"}, customer_phone:{type:"string"}, items:{type:"array",items:{type:"object",properties:{name:{type:"string"},quantity:{type:"number"},price:{type:"number"}}}}, order_type:{type:"string",enum:["recoger","domicilio","mesa"]}, pickup_time:{type:"string"}, notes:{type:"string"}, action:{type:"string",enum:["confirm","cancel"]} }, required:["tenant_id","customer_name"] } }, response_timeout_secs:10 },
  ]

  const res = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}`, {
    method: "PATCH",
    headers: { "xi-api-key": EL_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      conversation_config: {
        agent: {
          prompt: { prompt },
          tools,
          dynamic_variables: {
            dynamic_variable_placeholders: {
              current_date: "fecha actual",
              caller_phone: "",
              customer_context: "",
              business_name: biz,
              agent_name: name,
              business_info: "",
              tenant_id: TENANT_ID,
            }
          }
        }
      }
    })
  })

  console.log("Status:", res.status)
  if (res.status === 200) {
    console.log("✅ Agente actualizado: prompt, 5 tools, variables dinámicas, pedidos en vivo")
  } else {
    console.log("ERROR:", (await res.text()).substring(0, 500))
  }
}

main()
