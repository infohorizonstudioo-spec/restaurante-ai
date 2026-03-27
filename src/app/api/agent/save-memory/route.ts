import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { validateAgentKey } from "@/lib/agent-auth"
import { rateLimitByIp, RATE_LIMITS } from "@/lib/rate-limit"
import { sanitizeUUID, sanitizeString } from "@/lib/sanitize"
import { logger } from "@/lib/logger"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const rl = rateLimitByIp(req, RATE_LIMITS.agent, 'agent:save-memory')
    if (rl.blocked) return rl.response

    if (!validateAgentKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    const body = await req.json()

    const tenant_id = sanitizeUUID(body.tenant_id)
    const memory_type = sanitizeString(body.memory_type, 50) || "pattern"
    const content = sanitizeString(body.content, 2000)
    const confidence = typeof body.confidence === 'number' && isFinite(body.confidence) ? body.confidence : 0.7
    const source = sanitizeString(body.source, 50) || "call_agent"

    if (!tenant_id || !content) {
      return NextResponse.json({ error: "tenant_id and content required" }, { status: 400 })
    }

    logger.info('agent:save-memory', { tenant_id })

    // CRITICO: memoria aislada por tenant, nunca se comparte entre negocios
    const { error } = await supabase.from("business_memory").insert({
      tenant_id,
      memory_type,
      content,
      confidence,
      source,
      active: true,
    })

    if (error) {
      logger.error('[save-memory]', { tenant_id }, error)
      return NextResponse.json({ error: "could not save memory" }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: "Memory saved for tenant " + tenant_id })
  } catch (err) {
    logger.error('agent:save-memory', {}, err)
    return NextResponse.json({ error: "internal error" }, { status: 500 })
  }
}
