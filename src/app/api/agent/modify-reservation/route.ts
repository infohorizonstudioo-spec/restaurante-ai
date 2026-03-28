import { NextRequest, NextResponse } from "next/server"
import { validateAgentKey } from "@/lib/agent-auth"
import { modifyReservationTool } from "@/lib/agent-tools"
import { rateLimitByIp, RATE_LIMITS } from "@/lib/rate-limit"
import { sanitizeUUID, sanitizeName, sanitizePhone, sanitizeDate, sanitizeTime, sanitizePositiveInt } from "@/lib/sanitize"
import { logger } from "@/lib/logger"
import { parseRetellBody } from "@/lib/retell-parse"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    // const rl = rateLimitByIp(req, RATE_LIMITS.agent, 'agent:modify-reservation')
    // if (rl.blocked) return rl.response

    if (!validateAgentKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    const rawBody = await req.json()
    const body = await parseRetellBody(rawBody)

    const tenant_id = sanitizeUUID(body.tenant_id)
    const customer_name = body.customer_name ? sanitizeName(body.customer_name) : undefined
    const customer_phone = body.customer_phone ? sanitizePhone(body.customer_phone) : undefined
    const new_date = body.new_date ? sanitizeDate(body.new_date) : undefined
    const new_time = body.new_time ? sanitizeTime(body.new_time) : undefined
    const new_party_size = body.new_party_size ? sanitizePositiveInt(body.new_party_size, 100) : undefined

    if (!tenant_id) return NextResponse.json({ error: "tenant_id required" }, { status: 400 })
    if (!customer_phone && !customer_name) return NextResponse.json({ error: "need phone or name" }, { status: 400 })
    if (!new_date && !new_time && !new_party_size) return NextResponse.json({ error: "need at least one change" }, { status: 400 })

    logger.info('agent:modify-reservation', { tenant_id })

    const result = await modifyReservationTool({ tenant_id, customer_name, customer_phone, new_date, new_time, new_party_size })
    return NextResponse.json(result)
  } catch (err) {
    logger.error('agent:modify-reservation', {}, err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
