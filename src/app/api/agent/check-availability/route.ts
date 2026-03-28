import { NextRequest, NextResponse } from "next/server"
import { validateAgentKey } from "@/lib/agent-auth"
import { checkAvailabilityTool } from "@/lib/agent-tools"
import { rateLimitByIp, RATE_LIMITS } from "@/lib/rate-limit"
import { sanitizeUUID, sanitizeDate, sanitizeTime, sanitizePositiveInt, sanitizeString } from "@/lib/sanitize"
import { logger } from "@/lib/logger"
import { parseRetellBody } from "@/lib/retell-parse"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const rl = rateLimitByIp(req, RATE_LIMITS.agent, 'agent:check-availability')
    if (rl.blocked) return rl.response

    if (!validateAgentKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    const rawBody = await req.json()
    const body = parseRetellBody(rawBody)

    const tenant_id = sanitizeUUID(body.tenant_id)
    const date = sanitizeDate(body.date)
    const time = body.time ? sanitizeTime(body.time) : undefined
    const party_size = sanitizePositiveInt(body.party_size || body.people || 2, 100)
    const zone = body.zone ? sanitizeString(body.zone, 50) : undefined

    if (!tenant_id || !date) return NextResponse.json({ error: "tenant_id and date required" }, { status: 400 })

    logger.info('agent:check-availability', { tenant_id })

    const result = await checkAvailabilityTool({
      tenant_id, date, time, party_size, zone,
    })
    return NextResponse.json(result)
  } catch (err) {
    logger.error('agent:check-availability', {}, err)
    return NextResponse.json({ error: "internal error" }, { status: 500 })
  }
}
