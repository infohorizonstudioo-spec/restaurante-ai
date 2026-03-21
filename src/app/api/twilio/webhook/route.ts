import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getAgentContext } from "@/lib/agent-contexts"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const params = new URLSearchParams(body)

    const calledNumber = params.get("Called") || params.get("To") || ""
    const callerPhone = params.get("Caller") || params.get("From") || ""

    console.log("[webhook] call from", callerPhone, "to", calledNumber)

    // 1. Buscar tenant por agent_phone
    const { data: tenant, error } = await supabase
      .from("tenants")
      .select("id, name, type, agent_name, agent_config")
      .eq("agent_phone", calledNumber)
      .single()

    if (error || !tenant) {
      console.error("[webhook] tenant not found | agent:", calledNumber)
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>',
        { headers: { "Content-Type": "text/xml" } }
      )
    }

    // 2. Construir variables dinamicas por tenant
    const businessName = tenant.name
    const agentName = tenant.agent_name || "Sofia"
    const tenantId = tenant.id
    const agentContext = getAgentContext(tenant.type || "otro", tenant.agent_config || {})

    console.log("[webhook] tenant found:", businessName, "| type:", tenant.type)

    // 3. Responder con TwiML Stream apuntando a ElevenLabs
    // ElevenLabs recibe los parametros via Stream y los usa como dynamic variables
    const agentId = process.env.ELEVENLABS_AGENT_ID!
    const safeContext = agentContext.replace(/[<>&"]/g, (c) =>
      ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] || c)
    )

    const twiml = '<?xml version="1.0" encoding="UTF-8"?>' +
      '<Response>' +
        '<Connect>' +
          '<Stream url="wss://api.elevenlabs.io/v1/convai/twilio-media-stream/' + agentId + '">' +
            '<Parameter name="tenant_id" value="' + tenantId + '"/>' +
            '<Parameter name="business_name" value="' + businessName + '"/>' +
            '<Parameter name="agent_name" value="' + agentName + '"/>' +
            '<Parameter name="caller_phone" value="' + callerPhone + '"/>' +
            '<Parameter name="agent_context" value="' + safeContext + '"/>' +
          '</Stream>' +
        '</Connect>' +
      '</Response>'

    return new NextResponse(twiml, {
      headers: { "Content-Type": "text/xml" },
    })
  } catch (err) {
    console.error("[webhook] error:", err)
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>',
      { headers: { "Content-Type": "text/xml" } }
    )
  }
      }
