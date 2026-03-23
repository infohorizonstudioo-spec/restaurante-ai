import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { tenant_id, el_key, agent_id: reqAgentId } = await req.json()
    if (!tenant_id) {
      return NextResponse.json({ error: "tenant_id required" }, { status: 400 })
    }

    // 1. Load tenant
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id, name, agent_name, type")
      .eq("id", tenant_id)
      .single()

    if (!tenant) {
      return NextResponse.json({ error: "tenant not found" }, { status: 404 })
    }

    // 2. Load business knowledge
    const { data: kb } = await supabase
      .from("business_knowledge")
      .select("category, content")
      .eq("tenant_id", tenant_id)

    // 3. Build business info for the prompt
    const info: string[] = []
    for (const k of (kb || [])) {
      info.push(k.content)
    }
    const businessInfo = info.join(". ") || "Sin informacion disponible."
    const agentName = tenant.agent_name || "Sofia"
    const businessName = tenant.name || "Restaurante"

    // 4. Build the prompt
    const today = new Date().toLocaleDateString("es-ES", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    })

    const prompt = `Hablas en espanol de Espana siempre. Jamas en ingles.

Te llamas ${agentName} y trabajas en ${businessName}. Llevas tres anios aqui.

Personalidad: eres una tia tranquila, simpatica, con sentido del humor. Si un cliente bromea o dice tonterias, le sigues el rollo con gracia sin ofenderte. Si alguien da un nombre raro o gracioso para la reserva, lo apuntas sin comentar. No eres moralista. Eres profesional pero cercana.

Como hablas: corto y natural. Una o dos frases. Dices vale, claro, venga, mira, pues, oye. No dices por supuesto ni con mucho gusto. No dices que eres IA. No inventas informacion que no tienes. Si no sabes algo dices que no lo sabes.

MUY IMPORTANTE: Solo di informacion que esta aqui abajo. No te inventes precios, platos, promociones ni nada que no aparezca en estos datos.

Datos de ${businessName}:
${businessInfo}

Hoy es ${today}.

Para reservas pregunta nombre, dia, hora y cuantos son, de una en una. Cuando tengas todo usa check_availability y si hay sitio usa create_reservation. Al acabar la llamada usa save_call_summary.
Si preguntan por la carta o precios contesta con lo que sabes. Si preguntan algo que no esta en los datos, di que no lo sabes.`

    // 5. Patch ElevenLabs agent
    const elKey = el_key || process.env.ELEVENLABS_API_KEY || "e67f7cf43ec8b8c629e6bebcbac4c4f57c5cc449d7fbfc82f254506dbbc053b0"
    const agentId = reqAgentId || process.env.ELEVENLABS_AGENT_ID || "agent_0701kkw2sdx5fp685xp6ckngf6zj"
    if (!elKey || !agentId) {
      return NextResponse.json({ error: "ELEVENLABS keys not configured. Pass el_key and agent_id in body or set env vars." }, { status: 503 })
    }

    const elRes = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
      method: "PATCH",
      headers: { "xi-api-key": elKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        conversation_config: {
          agent: {
            first_message: `Hola buenas, ${businessName}.`,
            prompt: { prompt: prompt }
          }
        }
      })
    })

    if (!elRes.ok) {
      const err = await elRes.text()
      console.error("[sync-agent] ElevenLabs error:", err)
      return NextResponse.json({ error: "ElevenLabs update failed" }, { status: 500 })
    }

    console.log("[sync-agent] updated agent for", businessName, "prompt length:", prompt.length)

    return NextResponse.json({
      success: true,
      business_name: businessName,
      agent_name: agentName,
      prompt_length: prompt.length,
      knowledge_items: (kb || []).length
    })

  } catch (e: any) {
    console.error("[sync-agent] error:", e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
