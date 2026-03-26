import { NextRequest, NextResponse } from "next/server"
import { validateAgentKey } from "@/lib/agent-auth"
import { modifyReservationTool } from "@/lib/agent-tools"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    if (!validateAgentKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    const { tenant_id, customer_name, customer_phone, new_date, new_time, new_party_size } = await req.json()
    if (!tenant_id) return NextResponse.json({ error: "tenant_id required" }, { status: 400 })
    if (!customer_phone && !customer_name) return NextResponse.json({ error: "need phone or name" }, { status: 400 })
    if (!new_date && !new_time && !new_party_size) return NextResponse.json({ error: "need at least one change" }, { status: 400 })

    const result = await modifyReservationTool({ tenant_id, customer_name, customer_phone, new_date, new_time, new_party_size })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
