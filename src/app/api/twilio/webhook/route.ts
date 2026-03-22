import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const AGENT_ID = process.env.ELEVENLABS_AGENT_ID!

// Cache completo por número: tenant + knowledge
const cache: Record<string, { id: string; name: string; type: string; agent_name: string; context: string; ts: number }> = {}
const CACHE_TTL = 5 * 60 * 1000 // 5 minutos

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function buildTwiML(tenantId: string, businessName: string, agentName: string, callerPhone: string, businessContext: string): string {
  return '<?xml version="1.0" encoding="UTF-8"?>' +
    "<Response><Connect>" +
    `<Stream url="wss://api.elevenlabs.io/v1/convai/twilio-media-stream/${AGENT_ID}">` +
    `<Parameter name="tenant_id" value="${esc(tenantId)}"/>` +
    `<Parameter name="business_name" value="${esc(businessName)}"/>` +
    `<Parameter name="agent_name" value="${esc(agentName)}"/>` +
    `<Parameter name="caller_phone" value="${esc(callerPhone)}"/>` +
    `<Parameter name="business_context" value="${esc(businessContext)}"/>` +
    "</Stream></Connect></Response>"
}

async function fetchTenantWithContext(phone: string) {
  // 1. Buscar tenant por número
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id,name,type,agent_name,agent_config")
    .eq("agent_phone", phone)
    .single()

  if (!tenant) return null

  // 2. Leer business_knowledge del tenant
  const { data: knowledge } = await supabase
    .from("business_knowledge")
    .select("category,content")
    .eq("tenant_id", tenant.id)
    .eq("active", true)

  // 3. Leer business_rules del tenant
  const { data: rules } = await supabase
    .from("business_rules")
    .select("rule_key,rule_value")
    .eq("tenant_id", tenant.id)

  // 4. Construir business_context como texto plano para inyectar en el prompt
  const kv: Record<string, string> = {}
  for (const k of (knowledge || [])) kv[k.category] = k.content

  const rv: Record<string, string> = {}
  for (const r of (rules || [])) rv[r.rule_key] = r.rule_value

  const parts: string[] = []
  if (kv.horarios) parts.push("HORARIOS: " + kv.horarios)
  if (kv.servicios) parts.push("SERVICIOS: " + kv.servicios)
  if (kv.menu) parts.push("CARTA: " + kv.menu)
  if (kv.precios) parts.push("PRECIOS: " + kv.precios)
  if (kv.politicas) parts.push("POLITICAS: " + kv.politicas)
  if (kv.faqs) parts.push("FAQS: " + kv.faqs)
  if (rv.max_capacity) parts.push("AFORO: " + rv.max_capacity + " personas")
  if (rv.advance_booking_hours) parts.push("RESERVAS: minimo " + rv.advance_booking_hours + "h antelacion")
  if (rv.large_group_min) parts.push("GRUPOS: mas de " + rv.large_group_min + " personas requiere llamar directamente")

  const context = parts.join(" | ")

  return {
    id: tenant.id,
    name: tenant.name,
    type: tenant.type,
    agent_name: tenant.agent_name || "Sofia",
    context,
    ts: Date.now()
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const params = new URLSearchParams(body)
  const calledNumber = params.get("Called") || params.get("To") || ""
  const callerPhone = params.get("Caller") || params.get("From") || ""

  console.log("[webhook] call from", callerPhone, "to", calledNumber)

  // Cache válido?
  const cached = cache[calledNumber]
  if (cached && (Date.now() - cached.ts) < CACHE_TTL) {
    console.log("[webhook] cache hit:", cached.name, "| context chars:", cached.context.length)
    // Refresca en background
    fetchTenantWithContext(calledNumber).then(t => { if (t) cache[calledNumber] = t }).catch(() => {})
    return new NextResponse(
      buildTwiML(cached.id, cached.name, cached.agent_name, callerPhone, cached.context),
      { headers: { "Content-Type": "text/xml" } }
    )
  }

  // Sin cache: buscar en Supabase con timeout
  try {
    const timeout = new Promise<null>((_, reject) => setTimeout(() => reject(new Error("timeout")), 4000))
    const tenant = await Promise.race([fetchTenantWithContext(calledNumber), timeout])

    if (!tenant) {
      console.error("[webhook] tenant not found:", calledNumber)
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>',
        { headers: { "Content-Type": "text/xml" } }
      )
    }

    cache[calledNumber] = tenant
    console.log("[webhook] db hit:", tenant.name, "| context:", tenant.context.slice(0, 80))

    return new NextResponse(
      buildTwiML(tenant.id, tenant.name, tenant.agent_name, callerPhone, tenant.context),
      { headers: { "Content-Type": "text/xml" } }
    )
  } catch (err) {
    console.error("[webhook] error:", err)
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>',
      { headers: { "Content-Type": "text/xml" } }
    )
  }
}
