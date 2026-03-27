import { NextRequest, NextResponse } from "next/server"
import { validateAgentKey } from "@/lib/agent-auth"
import { getMenuTool } from "@/lib/agent-tools"
import { rateLimitByIp, RATE_LIMITS } from "@/lib/rate-limit"
import { sanitizeUUID } from "@/lib/sanitize"
import { logger } from "@/lib/logger"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const rl = rateLimitByIp(req, RATE_LIMITS.agent, 'agent:get-menu')
    if (rl.blocked) return rl.response

    if (!validateAgentKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    const body = await req.json()

    const tenant_id = sanitizeUUID(body.tenant_id)
    if (!tenant_id) return NextResponse.json({ error: "tenant_id required" }, { status: 400 })

    logger.info('agent:get-menu', { tenant_id })

    const result = await getMenuTool({ tenant_id })
    return NextResponse.json(result)
  } catch (err) {
    logger.error('agent:get-menu', {}, err)
    return NextResponse.json({ error: "internal error" }, { status: 500 })
  }
}
