import { NextRequest, NextResponse } from "next/server"
import { validateAgentKey } from "@/lib/agent-auth"
import { getMenuTool } from "@/lib/agent-tools"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    if (!validateAgentKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    const { tenant_id } = await req.json()
    if (!tenant_id) return NextResponse.json({ error: "tenant_id required" }, { status: 400 })

    const result = await getMenuTool({ tenant_id })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: "internal error" }, { status: 500 })
  }
}
