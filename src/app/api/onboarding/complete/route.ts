import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = "force-dynamic"

const EL_KEY = process.env.ELEVENLABS_API_KEY!
const VOICE_ID = "kvVjNZvtnCv3Sl1Hr70T" // Flavia - Spanish Peninsular

function buildPrompt(data: {
  business_name: string
  agent_name: string
  business_type: string
  hours: string
  menu: string
  services: string
  prices: string
  faqs: string
  policies: string
  max_capacity: string
  advance_hours: string
  large_group_min: string
}): string {
  const lines = []
  if (data.hours) lines.push("HORARIOS: " + data.hours)
  if (data.services) lines.push("SERVICIOS: " + data.services)
  if (data.menu) lines.push("CARTA: " + data.menu)
  if (data.prices) lines.push("PRECIOS: " + data.prices)
  if (data.policies) lines.push("POLITICAS: " + data.policies)
  if (data.faqs) lines.push("FAQS: " + data.faqs)
  if (data.max_capacity) lines.push("AFORO MAXIMO: " + data.max_capacity + " personas")
  if (data.advance_hours) lines.push("RESERVAS: minimo " + data.advance_hours + "h de antelacion")
  if (data.large_group_min) lines.push("GRUPOS GRANDES: mas de " + data.large_group_min + " personas, llamar directamente")

  return `Eres ${data.agent_name}, la recepcionista de ${data.business_name}.
Hablas espanol de Espana. Como una persona real. NUNCA como IA.

${lines.join("\n")}

COMO HABLAS:
- Maximo 1 frase por turno. Directo y natural.
- "Vale", "Claro", "Enseguida", "De acuerdo".
- NUNCA: "Por supuesto", "Con mucho gusto", "Entendido".
- NUNCA digas que eres IA.
- Una sola pregunta por turno.

PARA RESERVAR - recoge en orden:
1. Nombre del cliente
2. Fecha y hora
3. Numero de personas
4. Llama a check_availability antes de confirmar
5. Si hay hueco llama a create_reservation
6. Confirma: "Perfecto, [nombre] el [dia] a las [hora] para [X] personas."

PARA CARTA O PRECIOS:
- Usa los datos de arriba directamente.
- Para carta completa llama a get_menu_or_services.

AL CERRAR:
- Llama a save_call_summary siempre.
- Cierra tu. Sin preguntar si necesitan algo mas.`
}

async function createOrUpdateElevenLabsAgent(
  tenantId: string,
  agentName: string,
  businessName: string,
  prompt: string,
  existingAgentId?: string
): Promise<string> {
  const body = {
    name: `${businessName} - Reservo.AI`,
    conversation_config: {
      agent: {
        first_message: businessName + ", buenas, dígame.",
        language: "es",
        prompt: { prompt },
      },
      tts: { voice_id: VOICE_ID }
    }
  }

  if (existingAgentId) {
    // Actualizar agente existente
    const r = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${existingAgentId}`, {
      method: "PATCH",
      headers: { "xi-api-key": EL_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
    if (r.ok) return existingAgentId
  }

  // Crear nuevo agente
  const r = await fetch("https://api.elevenlabs.io/v1/convai/agents/create", {
    method: "POST",
    headers: { "xi-api-key": EL_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  })
  const d = await r.json()
  return d.agent_id
}

export async function POST(req: NextRequest) {
  try {
    const {
      tenant_id, agent_phone, business_name, business_type, agent_name,
      hours, menu, services, prices, faqs, policies,
      max_capacity, advance_hours, large_group_min,
    } = await req.json()

    if (!tenant_id) return NextResponse.json({ error: "tenant_id required" }, { status: 400 })

    // 1. Guardar knowledge en Supabase
    await supabase.from("business_knowledge").delete().eq("tenant_id", tenant_id)
    const knowledge = []
    if (hours) knowledge.push({ tenant_id, category: "horarios", content: typeof hours === "string" ? hours : JSON.stringify(hours) })
    if (menu) knowledge.push({ tenant_id, category: "menu", content: Array.isArray(menu) ? menu.join("\n") : menu })
    if (services) knowledge.push({ tenant_id, category: "servicios", content: Array.isArray(services) ? services.join("\n") : services })
    if (prices) knowledge.push({ tenant_id, category: "precios", content: prices })
    if (faqs) knowledge.push({ tenant_id, category: "faqs", content: faqs })
    if (policies) knowledge.push({ tenant_id, category: "politicas", content: policies })
    if (knowledge.length > 0) await supabase.from("business_knowledge").insert(knowledge)

    // 2. Guardar rules en Supabase
    await supabase.from("business_rules").delete().eq("tenant_id", tenant_id)
    const rules = []
    if (max_capacity) rules.push({ tenant_id, rule_key: "max_capacity", rule_value: String(max_capacity) })
    if (advance_hours) rules.push({ tenant_id, rule_key: "advance_booking_hours", rule_value: String(advance_hours) })
    if (large_group_min) rules.push({ tenant_id, rule_key: "large_group_min", rule_value: String(large_group_min) })
    if (rules.length > 0) await supabase.from("business_rules").insert(rules)

    // 3. Obtener agent_id existente del tenant
    const { data: tenant } = await supabase.from("tenants").select("el_agent_id,name,type").eq("id", tenant_id).single()
    const existingAgentId = tenant?.el_agent_id

    // 4. Construir prompt con los datos reales
    const prompt = buildPrompt({
      business_name: business_name || tenant?.name || "El negocio",
      agent_name: agent_name || "Sofia",
      business_type: business_type || tenant?.type || "otro",
      hours: typeof hours === "string" ? hours : JSON.stringify(hours || {}),
      menu: Array.isArray(menu) ? menu.join("\n") : (menu || ""),
      services: Array.isArray(services) ? services.join("\n") : (services || ""),
      prices: prices || "",
      faqs: faqs || "",
      policies: policies || "",
      max_capacity: String(max_capacity || ""),
      advance_hours: String(advance_hours || ""),
      large_group_min: String(large_group_min || ""),
    })

    // 5. Crear o actualizar agente en ElevenLabs
    const agentId = await createOrUpdateElevenLabsAgent(
      tenant_id, agent_name || "Sofia", business_name || tenant?.name || "El negocio",
      prompt, existingAgentId
    )

    // 6. Guardar todo en el tenant
    const updates: Record<string, unknown> = {
      onboarding_complete: true,
      el_agent_id: agentId,
    }
    if (agent_phone) updates.agent_phone = agent_phone
    if (business_name) updates.name = business_name
    if (business_type) updates.type = business_type
    if (agent_name) updates.agent_name = agent_name

    await supabase.from("tenants").update(updates).eq("id", tenant_id)

    console.log("[onboarding/complete] tenant", tenant_id, "agent:", agentId, "phone:", agent_phone)
    return NextResponse.json({ success: true, agent_id: agentId })
  } catch (err) {
    console.error("[onboarding/complete]", err)
    return NextResponse.json({ error: "internal error" }, { status: 500 })
  }
}
