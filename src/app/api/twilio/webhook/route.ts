import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

// Cache en memoria para tenants (se llena en el primer request, persiste en el proceso)
const tenantCache: Record<string, { name: string; type: string; agent_name: string }> = {
  "+12138753573": { name: "FormaNova", type: "restaurante", agent_name: "Sofia" }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const AGENT_ID = process.env.ELEVENLABS_AGENT_ID!

function buildTwiML(tenantId: string, businessName: string, agentName: string, callerPhone: string): string {
  const esc = (s: string) => s.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;")
  return '<?xml version="1.0" encoding="UTF-8"?>' +
    "<Response><Connect>" +
    `<Stream url="wss://api.elevenlabs.io/v1/convai/twilio-media-stream/${AGENT_ID}">` +
    `<Parameter name="tenant_id" value="${esc(tenantId)}"/>` +
    `<Parameter name="business_name" value="${esc(businessName)}"/>` +
    `<Parameter name="agent_name" value="${esc(agentName)}"/>` +
    `<Parameter name="caller_phone" value="${esc(callerPhone)}"/>` +
    "</Stream></Connect></Response>"
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const params = new URLSearchParams(body)
  const calledNumber = params.get("Called") || params.get("To") || ""
  const callerPhone = params.get("Caller") || params.get("From") || ""

  console.log("[webhook] call from", callerPhone, "to", calledNumber)

  // 1. Respuesta INMEDIATA desde cache (si existe)
  const cached = tenantCache[calledNumber]
  if (cached) {
    console.log("[webhook] cache hit:", cached.name)
    // Actualiza cache en background sin bloquear
    supabase.from("tenants").select("id,name,type,agent_name").eq("agent_phone", calledNumber).single()
      .then(({ data }) => { if (data) tenantCache[calledNumber] = { name: data.name, type: data.type, agent_name: data.agent_name || "Sofia" } })
      .catch(() => {})
    const twiml = buildTwiML("7be3fb2c-6da4-4129-a49d-3af1c2c45b77", cached.name, cached.agent_name, callerPhone)
    return new NextResponse(twiml, { headers: { "Content-Type": "text/xml" } })
  }

  // 2. Si no está en cache, busca en Supabase (con timeout de 3s)
  try {
    const timeout = new Promise<null>((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000))
    const query = supabase.from("tenants").select("id,name,type,agent_name").eq("agent_phone", calledNumber).single()
    const { data: tenant } = await Promise.race([query, timeout]) as any

    if (!tenant) {
      console.error("[webhook] tenant not found:", calledNumber)
      return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>', { headers: { "Content-Type": "text/xml" } })
    }

    // Guardar en cache para próximas llamadas
    tenantCache[calledNumber] = { name: tenant.name, type: tenant.type, agent_name: tenant.agent_name || "Sofia" }
    console.log("[webhook] db hit:", tenant.name)

    const twiml = buildTwiML(tenant.id, tenant.name, tenant.agent_name || "Sofia", callerPhone)
    return new NextResponse(twiml, { headers: { "Content-Type": "text/xml" } })
  } catch (err) {
    console.error("[webhook] error:", err)
    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>', { headers: { "Content-Type": "text/xml" } })
  }
}
