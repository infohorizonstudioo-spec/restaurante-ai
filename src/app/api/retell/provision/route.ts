/**
 * RESERVO.AI — Retell Agent Provision API
 *
 * POST /api/retell/provision
 * Body: { tenant_id: string }
 *
 * Crea o actualiza el agente Retell completo para un tenant.
 */

import { NextRequest, NextResponse } from 'next/server'
import { provisionRetellAgent } from '@/lib/provision-retell'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { sanitizeUUID } from '@/lib/sanitize'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const rl = rateLimitByIp(req, RATE_LIMITS.agent, 'retell:provision')
  if (rl.blocked) return rl.response

  try {
    const body = await req.json()
    const tenantId = sanitizeUUID(body.tenant_id)

    if (!tenantId) {
      return NextResponse.json({ error: 'tenant_id required' }, { status: 400 })
    }

    // Verificar autenticación (API key o Supabase auth)
    const apiKey = req.headers.get('x-agent-key') || req.headers.get('authorization')?.replace('Bearer ', '')
    const validKey = process.env.AGENT_API_KEY || process.env.RETELL_PROVISION_KEY
    if (validKey && apiKey !== validKey) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const result = await provisionRetellAgent(tenantId)

    if (!result.success) {
      logger.error('Retell provision failed', { tenantId, error: result.error })
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      agent_id: result.agent_id,
      llm_id: result.llm_id,
    })
  } catch (err) {
    logger.error('Retell provision error', {}, err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
