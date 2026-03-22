import { NextRequest, NextResponse } from "next/server"
import { provisionElevenAgent } from "@/lib/provision-agent"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const { tenant_id } = await req.json()
    if (!tenant_id) {
      return NextResponse.json({ error: "tenant_id required" }, { status: 400 })
    }
    const result = await provisionElevenAgent(tenant_id)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    return NextResponse.json({ success: true, agent_id: result.agent_id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
