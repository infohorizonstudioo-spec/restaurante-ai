/**
 * RESERVO.AI — Llamada saliente via Retell directo
 */
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'

const RETELL_KEY = process.env.RETELL_API_KEY || ''

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: Request) {
  const rl = rateLimitByIp(req, RATE_LIMITS.api, 'voice:outbound')
  if (rl.blocked) return rl.response

  try {
    const body = await req.json()
    const phone = body.phone || body.phone_number
    const tenantId = body.tenant_id
    const callType = body.call_type || 'callback'
    const customerName = body.customer_name || ''

    if (!tenantId || !phone) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    // Auth
    const apiKey = req.headers.get('x-agent-key') || req.headers.get('x_agent_key')
    if (apiKey !== process.env.AGENT_API_KEY) {
      const auth = await requireAuth(req)
      if (!auth.ok || auth.tenantId !== tenantId) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
    }

    const { data: tenant } = await supabase.from('tenants')
      .select('id,name,agent_phone,retell_agent_id')
      .eq('id', tenantId).single()

    if (!tenant?.retell_agent_id || !tenant?.agent_phone) {
      return NextResponse.json({ error: 'Sin agente configurado' }, { status: 400 })
    }

    // Llamada via Retell API directa
    const res = await fetch('https://api.retellai.com/v2/create-phone-call', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RETELL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from_number: tenant.agent_phone,
        to_number: phone,
        override_agent_id: tenant.retell_agent_id,
        retell_llm_dynamic_variables: {
          customer_context: callType === 'callback'
            ? `Llamada devuelta. El cliente nos llamo antes pero se corto. Saluda diciendo: Hola, te llamo de ${tenant.name}, tenemos una llamada tuya de antes, dime en que te puedo ayudar.`
            : `Llamada saliente a ${customerName}. Saluda con: Hola ${customerName}, te llamo de ${tenant.name}.`,
        },
      }),
    })

    const data = await res.json()
    if (!data.call_id) {
      logger.error('Retell outbound failed', { error: data.message })
      return NextResponse.json({ error: data.message || 'No se pudo llamar' }, { status: 500 })
    }

    // Registrar en DB
    await supabase.from('calls').insert({
      tenant_id: tenantId,
      call_sid: data.call_id,
      caller_phone: phone,
      status: 'activa',
      intent: 'devuelta',
      summary: `Devolviendo llamada a ${customerName || phone}`,
      started_at: new Date().toISOString(),
      source: 'retell',
    })

    return NextResponse.json({ success: true, call_id: data.call_id })
  } catch (err: any) {
    logger.error('Outbound error', {}, err)
    return NextResponse.json({ error: 'Error al llamar' }, { status: 500 })
  }
}
