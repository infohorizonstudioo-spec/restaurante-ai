import { NextRequest, NextResponse } from "next/server"
import { validateAgentKey } from "@/lib/agent-auth"
import { addToWaitlistTool } from "@/lib/agent-tools"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    if (!validateAgentKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    const { tenant_id, customer_name, customer_phone, date, time, party_size } = await req.json()
    if (!tenant_id || !customer_name || !date) {
      return NextResponse.json({ error: "tenant_id, customer_name, date required" }, { status: 400 })
    }

    const result = await addToWaitlistTool({ tenant_id, customer_name, customer_phone, date, time, party_size })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
