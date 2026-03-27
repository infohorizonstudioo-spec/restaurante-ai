import { NextRequest, NextResponse } from "next/server"
import { validateAgentKey } from "@/lib/agent-auth"
import { createReservationTool } from "@/lib/agent-tools"
import { rateLimitByIp, RATE_LIMITS } from "@/lib/rate-limit"
import { sanitizeUUID, sanitizeName, sanitizePhone, sanitizeDate, sanitizeTime, sanitizePositiveInt, sanitizeString } from "@/lib/sanitize"
import { logger } from "@/lib/logger"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const rl = rateLimitByIp(req, RATE_LIMITS.agent, 'agent:create-reservation')
    if (rl.blocked) return rl.response

    if (!validateAgentKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    const body = await req.json()

    const sanitized = {
      ...body,
      tenant_id: sanitizeUUID(body.tenant_id),
      customer_name: sanitizeName(body.customer_name),
      customer_phone: body.customer_phone ? sanitizePhone(body.customer_phone) : undefined,
      date: body.date ? sanitizeDate(body.date) : undefined,
      time: body.time ? sanitizeTime(body.time) : undefined,
      party_size: body.party_size ? sanitizePositiveInt(body.party_size, 100) : undefined,
      notes: body.notes ? sanitizeString(body.notes) : undefined,
    }

    if (!sanitized.tenant_id || !sanitized.customer_name) {
      return NextResponse.json({ error: "tenant_id and customer_name required" }, { status: 400 })
    }

    logger.info('agent:create-reservation', { tenant_id: sanitized.tenant_id })

    const result = await createReservationTool(sanitized)
    if (result.error && !result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    return NextResponse.json(result)
  } catch (err) {
    logger.error('agent:create-reservation', {}, err)
    return NextResponse.json({ error: "internal error" }, { status: 500 })
  }
}
