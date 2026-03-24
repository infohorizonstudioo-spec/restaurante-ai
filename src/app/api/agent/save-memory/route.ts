import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { validateAgentKey } from "@/lib/agent-auth"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    if (!validateAgentKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    const { tenant_id, memory_type, content, confidence, source } = await req.json()
    if (!tenant_id || !content) {
      return NextResponse.json({ error: "tenant_id and content required" }, { status: 400 })
    }

    // CRITICO: memoria aislada por tenant, nunca se comparte entre negocios
    const { error } = await supabase.from("business_memory").insert({
      tenant_id,
      memory_type: memory_type || "pattern",
      content,
      confidence: confidence || 0.7,
      source: source || "call_agent",
      active: true,
    })

    if (error) {
      console.error("[save-memory]", error)
      return NextResponse.json({ error: "could not save memory" }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: "Memory saved for tenant " + tenant_id })
  } catch (err) {
    console.error("[save-memory]", err)
    return NextResponse.json({ error: "internal error" }, { status: 500 })
  }
}
