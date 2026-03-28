import { NextRequest, NextResponse } from "next/server"
import { validateAgentKey } from "@/lib/agent-auth"
import { updateOrderTool } from "@/lib/agent-tools"
import { rateLimitByIp, RATE_LIMITS } from "@/lib/rate-limit"
import { sanitizeUUID, sanitizeName, sanitizePhone, sanitizeString, sanitizePositiveInt } from "@/lib/sanitize"
import { logger } from "@/lib/logger"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const rl = rateLimitByIp(req, RATE_LIMITS.agent, 'agent:update-order')
    if (rl.blocked) return rl.response

    if (!validateAgentKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    const body = await req.json()

    // Retell envía items como string JSON — parsear si es necesario
    let items = body.items
    if (typeof items === 'string') {
      try { items = JSON.parse(items) } catch { items = [] }
    }

    const sanitized = {
      ...body,
      items,
      tenant_id: sanitizeUUID(body.tenant_id),
      customer_name: body.customer_name ? sanitizeName(body.customer_name) : undefined,
      customer_phone: body.customer_phone ? sanitizePhone(body.customer_phone) : undefined,
      notes: body.notes ? sanitizeString(body.notes) : undefined,
      quantity: body.quantity ? sanitizePositiveInt(body.quantity, 1000) : undefined,
    }

    if (!sanitized.tenant_id) return NextResponse.json({ error: "tenant_id required" }, { status: 400 })

    logger.info('agent:update-order', { tenant_id: sanitized.tenant_id })

    const result = await updateOrderTool(sanitized)
    if (result.error && !result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    return NextResponse.json(result)
  } catch (err) {
    logger.error('agent:update-order', {}, err)
    return NextResponse.json({ error: "internal error" }, { status: 500 })
  }
}
