import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Cache: número → agente  (se invalida cada 10min o al guardar config)
const cache: Record<string, { agentId: string; tenantId: string; name: string; ts: number }> = {}
const TTL = 10 * 60 * 1000

function xml(agentId: string, tenantId: string, callerPhone: string): string {
  const e = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;")
  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Response><Connect>` +
    `<Stream url="wss://api.elevenlabs.io/v1/convai/twilio-media-stream/${agentId}">` +
    `<Parameter name="tenant_id" value="${e(tenantId)}"/>` +
    `<Parameter name="caller_phone" value="${e(callerPhone)}"/>` +
    `</Stream></Connect></Response>`
}

function reject(): NextResponse {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>`,
    { headers: { "Content-Type": "text/xml" } }
  )
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const p = new URLSearchParams(body)
  const called = p.get("Called") || p.get("To") || ""
  const caller = p.get("Caller") || p.get("From") || ""

  console.log("[webhook] call", caller, "→", called)

  // Cache hit
  const hit = cache[called]
  if (hit && Date.now() - hit.ts < TTL) {
    console.log("[webhook] cache:", hit.name, "| agent:", hit.agentId)
    // Refresca en background sin bloquear la respuesta
    supabase.from("tenants").select("id,name,el_agent_id").eq("agent_phone", called).single()
      .then(({ data: t }) => {
        if (t?.el_agent_id) cache[called] = { agentId: t.el_agent_id, tenantId: t.id, name: t.name, ts: Date.now() }
      }).catch(() => {})
    return new NextResponse(xml(hit.agentId, hit.tenantId, caller), { headers: { "Content-Type": "text/xml" } })
  }

  // Sin cache: buscar en BD (probar con y sin +)
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id,name,el_agent_id")
    .or(`agent_phone.eq.${called},agent_phone.eq.${called.replace('+','')}`)
    .limit(1)

  const tenant = tenants?.[0]

  // Fallback: si no hay tenant con ese número, usar el agente por defecto (FormaNova)
  const agentId = tenant?.el_agent_id || process.env.ELEVENLABS_AGENT_ID!
  const tenantId = tenant?.id || "7be3fb2c-6da4-4129-a49d-3af1c2c45b77"
  const name = tenant?.name || "FormaNova"

  if (!tenant) {
    console.warn("[webhook] tenant not found for:", called, "— using default agent")
  } else {
    console.log("[webhook] db:", name, "| agent:", agentId)
    cache[called] = { agentId, tenantId, name, ts: Date.now() }
  }

  return new NextResponse(xml(agentId, tenantId, caller), { headers: { "Content-Type": "text/xml" } })
}
