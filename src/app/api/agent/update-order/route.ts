import { NextRequest, NextResponse } from "next/server"
import { validateAgentKey } from "@/lib/agent-auth"
import { updateOrderTool } from "@/lib/agent-tools"
import { rateLimitByIp, RATE_LIMITS } from "@/lib/rate-limit"
import { sanitizeUUID, sanitizeName, sanitizePhone, sanitizeString, sanitizePositiveInt } from "@/lib/sanitize"
import { logger } from "@/lib/logger"
import { parseRetellBody } from "@/lib/retell-parse"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    // const rl = rateLimitByIp(req, RATE_LIMITS.agent, 'agent:update-order')
    // if (rl.blocked) return rl.response

    if (!validateAgentKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    const rawBody = await req.json()
    const body = await parseRetellBody(rawBody)

    // Retell envía items como string JSON — parsear si es necesario
    let items = body.items
    if (typeof items === 'string') {
      try { items = JSON.parse(items) } catch { items = [] }
    }

    const sanitized: Record<string, any> = {
      ...body,
      items,
      tenant_id: sanitizeUUID(body.tenant_id),
      customer_name: body.customer_name ? sanitizeName(body.customer_name) : undefined,
      customer_phone: body.customer_phone ? sanitizePhone(body.customer_phone) : undefined,
      notes: body.notes ? sanitizeString(body.notes) : undefined,
      quantity: body.quantity ? sanitizePositiveInt(body.quantity, 1000) : undefined,
    }

    if (!sanitized.tenant_id) return NextResponse.json({ error: "tenant_id required" }, { status: 400 })

    // Si no tiene order_id, buscar pedido "collecting" existente del mismo cliente o telefono
    if (!sanitized.order_id && sanitized.tenant_id) {
      const { createClient } = await import('@supabase/supabase-js')
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
      const phone = sanitized.customer_phone || sanitized._caller_phone || ''
      const name = sanitized.customer_name || ''

      let q = sb.from('order_events').select('id').eq('tenant_id', sanitized.tenant_id).eq('status', 'collecting').order('created_at', { ascending: false }).limit(1)
      if (phone) q = q.eq('customer_phone', phone)
      else if (name) q = q.ilike('customer_name', `%${name}%`)

      const { data: existing } = await q.maybeSingle()
      if (existing) sanitized.order_id = existing.id
    }

    logger.info('agent:update-order', { tenant_id: sanitized.tenant_id, order_id: sanitized.order_id })

    const result = await updateOrderTool(sanitized as any)
    if (result.error && !result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    return NextResponse.json(result)
  } catch (err) {
    logger.error('agent:update-order', {}, err)
    return NextResponse.json({ error: "internal error" }, { status: 500 })
  }
}
