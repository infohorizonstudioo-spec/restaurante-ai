import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Default response when no tenant found
const DEFAULTS = {
  business_name: "Restaurante",
  agent_name: "Sofia",
  business_info: "Sin informacion disponible.",
  tenant_id: "",
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log("[voice/context] payload:", JSON.stringify(body).slice(0, 500))

    // Extract phone numbers from ElevenLabs payload
    const agentNumber = body?.phone_call?.agent_number
      || body?.phone_call?.to
      || body?.agent_number || ""
    const callerPhone = body?.phone_call?.caller_number
      || body?.phone_call?.from
      || body?.caller_number || ""

    console.log("[voice/context] agent:", agentNumber, "caller:", callerPhone)

    // Find tenant by phone number
    let tenant = null
    if (agentNumber) {
      const clean = agentNumber.replace(/[^0-9+]/g, "")
      const { data } = await supabase
        .from("tenants")
        .select("id, name, agent_name, type")
        .or(`agent_phone.eq.${clean},agent_phone.eq.+${clean.replace("+","")}`)
        .limit(1)
      tenant = data?.[0]
    }

    if (!tenant) {
      console.log("[voice/context] no tenant found, using defaults")
      return NextResponse.json({ dynamic_variables: DEFAULTS })
    }

    console.log("[voice/context] tenant:", tenant.name, tenant.id)

    // Load business knowledge
    const { data: kb } = await supabase
      .from("business_knowledge")
      .select("category, content")
      .eq("tenant_id", tenant.id)

    // Build business info string
    const info = (kb || [])
      .map(k => k.content)
      .join(". ")
      .slice(0, 1500) || "Sin informacion adicional."

    // Return dynamic variables for ElevenLabs
    return NextResponse.json({
      dynamic_variables: {
        business_name: tenant.name || DEFAULTS.business_name,
        agent_name: tenant.agent_name || DEFAULTS.agent_name,
        business_info: info,
        tenant_id: tenant.id,
        caller_phone: callerPhone,
      }
    })

  } catch (e: any) {
    console.error("[voice/context] error:", e.message)
    return NextResponse.json({ dynamic_variables: DEFAULTS })
  }
}
