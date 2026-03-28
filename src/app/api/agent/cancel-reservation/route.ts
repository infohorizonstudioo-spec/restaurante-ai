import { NextRequest, NextResponse } from "next/server"
import { validateAgentKey } from "@/lib/agent-auth"
import { cancelReservationTool } from "@/lib/agent-tools"
import { rateLimitByIp, RATE_LIMITS } from "@/lib/rate-limit"
import { sanitizeUUID, sanitizeName, sanitizePhone, sanitizeDate } from "@/lib/sanitize"
import { logger } from "@/lib/logger"
import { parseRetellBody } from "@/lib/retell-parse"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const rl = rateLimitByIp(req, RATE_LIMITS.agent, 'agent:cancel-reservation')
    if (rl.blocked) return rl.response

    if (!validateAgentKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    const rawBody = await req.json()
    const body = parseRetellBody(rawBody)

    const tenant_id = sanitizeUUID(body.tenant_id)
    const customer_name = body.customer_name ? sanitizeName(body.customer_name) : undefined
    const customer_phone = body.customer_phone ? sanitizePhone(body.customer_phone) : undefined
    const date = body.date ? sanitizeDate(body.date) : undefined

    if (!tenant_id) return NextResponse.json({ error: "tenant_id required" }, { status: 400 })
    if (!customer_phone && !customer_name) return NextResponse.json({ error: "customer_phone or customer_name required" }, { status: 400 })

    logger.info('agent:cancel-reservation', { tenant_id })

    const result = await cancelReservationTool({ tenant_id, customer_name, customer_phone, date })
    return NextResponse.json(result)
  } catch (err) {
    logger.error('agent:cancel-reservation', {}, err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
