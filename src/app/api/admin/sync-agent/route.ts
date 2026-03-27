import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { sanitizeUUID } from '@/lib/sanitize'
import { logger } from '@/lib/logger'

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function verifySuperadmin(req: Request): Promise<boolean> {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) return false
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return false
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  return (profile as any)?.role === 'superadmin'
}

export async function POST(req: NextRequest) {
  try {
    const rl = rateLimitByIp(req, RATE_LIMITS.admin, 'admin:sync-agent')
    if (rl.blocked) return rl.response

    // SEGURIDAD: verificar que es superadmin
    const isSuperadmin = await verifySuperadmin(req)
    if (!isSuperadmin) {
      logger.security('Unauthorized sync-agent attempt')
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const tenant_id = sanitizeUUID(body.tenant_id)
    const el_key = body.el_key
    const reqAgentId = body.agent_id
    if (!tenant_id) {
      return NextResponse.json({ error: "tenant_id required" }, { status: 400 })
    }

    // 1. Load tenant
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id, name, agent_name, type, el_agent_id")
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

HOY ES: {{current_date}}
Usa esta fecha para saber que dia es hoy, manana, pasado, etc. NUNCA inventes el dia de la semana.

CLIENTE QUE LLAMA:
{{customer_context}}
Si tienes datos del cliente (nombre, reservas previas), usalos de forma natural. Ejemplo: "Hola Juan, como la ultima vez para 4?" Si no hay datos, pide nombre como siempre.

Para reservas pregunta nombre, dia, hora y cuantos son, de una en una. Cuando tengas todo usa check_availability y si hay sitio usa create_reservation. Al acabar la llamada usa save_call_summary.
Si preguntan por la carta o precios contesta con lo que sabes. Si preguntan algo que no esta en los datos, di que no lo sabes.`

    // 5. Patch ElevenLabs agent
    const elKey = el_key || process.env.ELEVENLABS_API_KEY
    // Usar el agente específico del tenant, no uno global
    const agentId = reqAgentId || tenant.el_agent_id || process.env.ELEVENLABS_AGENT_ID
    if (!elKey || !agentId) {
      return NextResponse.json({ error: "ELEVENLABS keys not configured. Pass el_key and agent_id in body or set env vars." }, { status: 503 })
    }

    const controller = new AbortController()
    const fetchTimeout = setTimeout(() => controller.abort(), 30000)
    let elRes: Response
    try {
      elRes = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
        method: "PATCH",
        headers: { "xi-api-key": elKey, "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          conversation_config: {
            agent: {
              first_message: `Hola buenas, ${businessName}, digame.`,
              prompt: { prompt: prompt }
            }
          }
        })
      })
    } finally {
      clearTimeout(fetchTimeout)
    }

    if (!elRes.ok) {
      const err = await elRes.text()
      return NextResponse.json({ error: "ElevenLabs update failed" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      business_name: businessName,
      agent_name: agentName,
      prompt_length: prompt.length,
      knowledge_items: (kb || []).length
    })

  } catch (e: any) {
    logger.error('Admin sync-agent: error', {}, e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
