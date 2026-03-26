import { NextRequest, NextResponse } from "next/server"
import { validateAgentKey } from "@/lib/agent-auth"
import { checkAvailabilityTool } from "@/lib/agent-tools"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    if (!validateAgentKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    const { tenant_id, date, time, party_size, people, zone } = await req.json()
    if (!tenant_id || !date) return NextResponse.json({ error: "tenant_id and date required" }, { status: 400 })

    const result = await checkAvailabilityTool({
      tenant_id, date, time, party_size: party_size || people || 2, zone,
    })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: "internal error" }, { status: 500 })
  }
}
