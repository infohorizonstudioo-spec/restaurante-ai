/**
 * RESERVO.AI — Customer Context API
 *
 * Devuelve el perfil completo de un cliente para que el agente
 * sepa exactamente cómo tratarlo. Incluye:
 * - Historial de interacciones
 * - Preferencias
 * - Alertas
 * - Sugerencias
 * - Prompt fragment listo para inyectar
 *
 * Usado por:
 * - Retell dynamic variables (al inicio de llamada)
 * - WhatsApp handler (al recibir mensaje)
 * - Dashboard (ficha del cliente)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateAgentKey } from '@/lib/agent-auth'
import { getCustomerProfile } from '@/lib/customer-memory'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { sanitizeUUID, sanitizePhone } from '@/lib/sanitize'
import { logger } from '@/lib/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const rl = rateLimitByIp(req, RATE_LIMITS.agent, 'agent:get-customer-context')
    if (rl.blocked) return rl.response

    if (!validateAgentKey(req)) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const tenantId = sanitizeUUID(body.tenant_id)
    const phone = body.phone ? sanitizePhone(body.phone) : null
    const email = body.email || null

    if (!tenantId) {
      return NextResponse.json({ error: 'tenant_id required' }, { status: 400 })
    }

    if (!phone && !email) {
      return NextResponse.json({
        found: false,
        prompt_fragment: 'Sin información previa del cliente.',
        suggestions: [],
        alerts: [],
      })
    }

    const profile = await getCustomerProfile(tenantId, phone, email)

    if (!profile) {
      return NextResponse.json({
        found: false,
        prompt_fragment: 'Sin información previa del cliente.',
        suggestions: [],
        alerts: [],
      })
    }

    return NextResponse.json({
      found: true,
      customer_id: profile.customerId,
      name: profile.name,
      is_new: profile.isNew,
      is_returning: profile.isReturning,
      is_vip: profile.isVIP,
      loyalty_tier: profile.loyaltyTier,
      loyalty_score: profile.loyaltyScore,
      visit_count: profile.visitCount,
      no_show_count: profile.noShowCount,
      late_count: profile.lateCount,
      cancel_count: profile.cancelCount,
      preferred_language: profile.preferredLanguage,
      preferred_day: profile.preferredDay,
      preferred_time: profile.preferredTime,
      risk_level: profile.riskLevel,
      tags: profile.tags,
      memories: profile.memories,
      alerts: profile.alerts,
      suggestions: profile.suggestions,
      prompt_fragment: profile.promptFragment,
    })
  } catch (err) {
    logger.error('agent:get-customer-context error', {}, err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
