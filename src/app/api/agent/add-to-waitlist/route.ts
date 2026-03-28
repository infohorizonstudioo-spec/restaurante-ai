import { NextRequest, NextResponse } from "next/server"
import { validateAgentKey } from "@/lib/agent-auth"
import { addToWaitlistTool } from "@/lib/agent-tools"
import { rateLimitByIp, RATE_LIMITS } from "@/lib/rate-limit"
import { sanitizeUUID, sanitizeName, sanitizePhone, sanitizeDate, sanitizeTime, sanitizePositiveInt } from "@/lib/sanitize"
import { logger } from "@/lib/logger"
import { parseRetellBody } from "@/lib/retell-parse"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    // const rl = rateLimitByIp(req, RATE_LIMITS.agent, 'agent:add-to-waitlist')
    // if (rl.blocked) return rl.response

    if (!validateAgentKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    const rawBody = await req.json()
    const body = parseRetellBody(rawBody)

    const tenant_id = sanitizeUUID(body.tenant_id)
    const customer_name = sanitizeName(body.customer_name)
    const customer_phone = body.customer_phone ? sanitizePhone(body.customer_phone) : undefined
    const date = sanitizeDate(body.date)
    const time = body.time ? sanitizeTime(body.time) : undefined
    const party_size = body.party_size ? sanitizePositiveInt(body.party_size, 100) : undefined

    if (!tenant_id || !customer_name || !date) {
      return NextResponse.json({ error: "tenant_id, customer_name, date required" }, { status: 400 })
    }

    logger.info('agent:add-to-waitlist', { tenant_id })

    const result = await addToWaitlistTool({ tenant_id, customer_name, customer_phone, date, time, party_size })
    return NextResponse.json(result)
  } catch (err) {
    logger.error('agent:add-to-waitlist', {}, err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
