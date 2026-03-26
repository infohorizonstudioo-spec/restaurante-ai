import { NextRequest, NextResponse } from "next/server"
import { validateAgentKey } from "@/lib/agent-auth"
import { updateOrderTool } from "@/lib/agent-tools"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    if (!validateAgentKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    const body = await req.json()
    if (!body.tenant_id) return NextResponse.json({ error: "tenant_id required" }, { status: 400 })

    const result = await updateOrderTool(body)
    if (result.error && !result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: "internal error" }, { status: 500 })
  }
}
