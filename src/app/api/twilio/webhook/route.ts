import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface CachedTenant {
  agentId: string
  tenantId: string
  name: string
  agentName: string
  context: string
  ts: number
}

const cache: Record<string, CachedTenant> = {}
const TTL = 10 * 60 * 1000

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, " ").replace(/\r/g, "")
}

function twiml(agentId: string, tenantId: string, callerPhone: string, businessName: string, agentName: string, context: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Response><Connect>` +
    `<Stream url="wss://api.elevenlabs.io/v1/convai/twilio-media-stream/${agentId}">` +
    `<Parameter name="tenant_id" value="${esc(tenantId)}"/>` +
    `<Parameter name="caller_phone" value="${esc(callerPhone)}"/>` +
    `<Parameter name="business_name" value="${esc(businessName)}"/>` +
    `<Parameter name="agent_name" value="${esc(agentName)}"/>` +
    `<Parameter name="business_context" value="${esc(context)}"/>` +
    `</Stream></Connect></Response>`
}

async function buildContext(tenantId: string): Promise<string> {
  const [kbRes, rulesRes] = await Promise.all([
    supabase.from("business_knowledge").select("category,content").eq("tenant_id", tenantId),
    supabase.from("business_rules").select("rule_key,rule_value").eq("tenant_id", tenantId),
  ])
  const kb = kbRes.data || []
  const rules = rulesRes.data || []

  const parts: string[] = []
  for (const k of kb) {
    parts.push(`${(k.category || "info").toUpperCase()}: ${k.content}`)
  }
  for (const r of rules) {
    parts.push(`REGLA ${(r.rule_key || "").toUpperCase()}: ${r.rule_value}`)
  }
  return parts.join("\n") || "Sin contexto adicional."
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const p = new URLSearchParams(body)
  const called = p.get("Called") || p.get("To") || ""
  const caller = p.get("Caller") || p.get("From") || ""

  console.log("[webhook] call", caller, "->", called)

  // Cache hit
  const hit = cache[called]
  if (hit && Date.now() - hit.ts < TTL) {
    console.log("[webhook] cache:", hit.name)
    return new NextResponse(
      twiml(hit.agentId, hit.tenantId, caller, hit.name, hit.agentName, hit.context),
      { headers: { "Content-Type": "text/xml" } }
    )
  }

  // DB lookup (with and without +)
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id,name,agent_name,el_agent_id")
    .or(`agent_phone.eq.${called},agent_phone.eq.${called.replace("+","")}`)
    .limit(1)

  const tenant = tenants?.[0]
  const agentId = tenant?.el_agent_id || process.env.ELEVENLABS_AGENT_ID!
  const tenantId = tenant?.id || "7be3fb2c-6da4-4129-a49d-3af1c2c45b77"
  const name = tenant?.name || "FormaNova"
  const agentName = tenant?.agent_name || "Sofia"

  if (!tenant) {
    console.warn("[webhook] tenant not found for:", called, "- using default")
  } else {
    console.log("[webhook] db:", name, "| agent:", agentId)
  }

  // Load business context from knowledge + rules
  let context = "Sin contexto adicional."
  try {
    context = await buildContext(tenantId)
  } catch (e) {
    console.error("[webhook] context error:", e)
  }

  // Cache for next calls
  cache[called] = { agentId, tenantId, name, agentName, context, ts: Date.now() }

  return new NextResponse(
    twiml(agentId, tenantId, caller, name, agentName, context),
    { headers: { "Content-Type": "text/xml" } }
  )
}
