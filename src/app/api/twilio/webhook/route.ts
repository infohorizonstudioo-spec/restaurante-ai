import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface CachedTenant {
  tenantId: string
  name: string
  agentName: string
  context: string
  ts: number
}

const cache: Record<string, CachedTenant> = {}
const TTL = 10 * 60 * 1000

async function buildContext(tenantId: string): Promise<string> {
  const [kbRes, rulesRes] = await Promise.all([
    supabase.from("business_knowledge").select("category,content").eq("tenant_id", tenantId),
    supabase.from("business_rules").select("rule_key,rule_value").eq("tenant_id", tenantId),
  ])
  const kb = kbRes.data || []
  const rules = rulesRes.data || []
  const parts: string[] = []
  for (const k of kb) parts.push(`${(k.category || "info").toUpperCase()}: ${k.content}`)
  for (const r of rules) {
    const v = String(r.rule_value || "")
    if (!v.startsWith("{") && !v.startsWith("[")) parts.push(`REGLA ${(r.rule_key || "").toUpperCase()}: ${v}`)
  }
  let ctx = parts.join(" | ") || "Sin contexto adicional."
  if (ctx.length > 800) ctx = ctx.slice(0, 800)
  return ctx
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const p = new URLSearchParams(body)
  const called = p.get("Called") || p.get("To") || ""
  const caller = p.get("Caller") || p.get("From") || ""

  console.log("[webhook] call", caller, "->", called)

  // Look up tenant
  const hit = cache[called]
  let tenantId = "", name = "", agentName = "", context = ""

  if (hit && Date.now() - hit.ts < TTL) {
    tenantId = hit.tenantId; name = hit.name; agentName = hit.agentName; context = hit.context
  } else {
    const { data: tenants } = await supabase
      .from("tenants")
      .select("id,name,agent_name")
      .or(`agent_phone.eq.${called},agent_phone.eq.${called.replace("+","")}`)
      .limit(1)
    const tenant = tenants?.[0]
    tenantId = tenant?.id || "7be3fb2c-6da4-4129-a49d-3af1c2c45b77"
    name = tenant?.name || "FormaNova"
    agentName = tenant?.agent_name || "Sofia"
    try { context = await buildContext(tenantId) } catch (e) { context = "" }
    cache[called] = { tenantId, name, agentName, context, ts: Date.now() }
    console.log("[webhook] db:", name)
  }

  // Proxy to ElevenLabs inbound_call - they handle WebSocket auth
  const agentId = process.env.ELEVENLABS_AGENT_ID || "agent_0701kkw2sdx5fp685xp6ckngf6zj"
  const elUrl = `https://api.elevenlabs.io/v1/convai/twilio/inbound_call?agent_id=${agentId}`
  
  console.log("[webhook] proxying to ElevenLabs:", agentId)
  
  const elRes = await fetch(elUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body,
  })
  
  const twiml = await elRes.text()
  console.log("[webhook] ElevenLabs status:", elRes.status, "len:", twiml.length)
  
  return new NextResponse(twiml, {
    headers: { "Content-Type": "text/xml" },
  })
}
