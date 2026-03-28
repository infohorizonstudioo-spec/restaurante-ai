import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    // Capture EVERYTHING
    const rawText = await req.text()
    const headers: Record<string,string> = {}
    req.headers.forEach((v,k) => headers[k] = v)

    // Save to DB for inspection
    await supabase.from('business_memory').insert({
      tenant_id: '7be3fb2c-6da4-4129-a49d-3af1c2c45b77',
      content: JSON.stringify({ raw_body: rawText, headers, url: req.url }),
      memory_type: 'debug_raw',
      active: true,
      confidence: 1,
    })

    // Try to parse and find tenant_id + date anywhere in the body
    let body: any = {}
    try { body = JSON.parse(rawText) } catch {}

    // Look everywhere for the data
    const tenant_id = body.tenant_id || body.args?.tenant_id || (body.call?.metadata?.tenant_id)
    const date = body.date || body.args?.date

    // If we have what we need, do the real thing
    if (tenant_id && date) {
      const { checkAvailabilityTool } = await import("@/lib/agent-tools")
      const result = await checkAvailabilityTool({ tenant_id, date, time: body.time || body.args?.time, party_size: body.party_size || body.args?.party_size || 2 })
      return NextResponse.json(result)
    }

    // Otherwise resolve tenant from agent_id and return available
    if (body.call?.agent_id) {
      const { data: tenant } = await supabase.from('tenants').select('id').eq('retell_agent_id', body.call.agent_id).maybeSingle()
      if (tenant) {
        const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0,10)
        const { checkAvailabilityTool } = await import("@/lib/agent-tools")
        const result = await checkAvailabilityTool({ tenant_id: tenant.id, date: tomorrow, party_size: 2 })
        return NextResponse.json(result)
      }
    }

    return NextResponse.json({ available: true, message: "Hay disponibilidad" })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
