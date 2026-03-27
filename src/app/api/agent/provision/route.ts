import { NextRequest, NextResponse } from "next/server"
import { provisionElevenAgent } from "@/lib/provision-agent"
import { requireAuth } from "@/lib/api-auth"
import { rateLimitByIp, RATE_LIMITS } from "@/lib/rate-limit"
import { sanitizeUUID } from "@/lib/sanitize"
import { logger } from "@/lib/logger"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const rl = rateLimitByIp(req, RATE_LIMITS.agent, 'agent:provision')
    if (rl.blocked) return rl.response

    const auth = await requireAuth(req)
    if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const body = await req.json()
    const tenant_id = sanitizeUUID(body.tenant_id)
    if (!tenant_id) {
      return NextResponse.json({ error: "tenant_id required" }, { status: 400 })
    }
    if (tenant_id !== auth.tenantId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 })
    }

    logger.info('agent:provision', { tenant_id })

    const result = await provisionElevenAgent(tenant_id)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    return NextResponse.json({ success: true, agent_id: result.agent_id })
  } catch (err: any) {
    logger.error('agent:provision', {}, err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
