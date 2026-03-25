import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/api-auth'
import { rateLimit, getRateLimitKey } from '@/lib/rate-limit'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export const dynamic = 'force-dynamic'

/**
 * POST /api/voice/outbound
 * Inicia una llamada saliente del agente al cliente.
 *
 * Casos de uso:
 * - Confirmar reserva pendiente
 * - Avisar de cambio de horario
 * - Recordatorio de cita
 * - Callback cuando el sistema falló
 */
export async function POST(req: NextRequest) {
  try {
    const rl = rateLimit(getRateLimitKey(req), 5, 60000)
    if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

    const auth = await requireAuth(req)
    if (!auth.ok || !auth.tenantId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const { phone_number, reason, customer_name } = await req.json()
    if (!phone_number) {
      return NextResponse.json({ error: 'phone_number required' }, { status: 400 })
    }

    // Obtener datos del tenant
    const { data: tenant } = await admin.from('tenants')
      .select('name, agent_name, agent_phone, el_agent_id')
      .eq('id', auth.tenantId)
      .maybeSingle()

    if (!tenant?.agent_phone) {
      return NextResponse.json({ error: 'Agent phone not configured' }, { status: 400 })
    }

    const agentId = tenant.el_agent_id || process.env.ELEVENLABS_AGENT_ID
    if (!agentId) {
      return NextResponse.json({ error: 'Agent not provisioned' }, { status: 400 })
    }

    const EL_KEY = process.env.ELEVENLABS_API_KEY
    if (!EL_KEY) {
      return NextResponse.json({ error: 'ElevenLabs not configured' }, { status: 503 })
    }

    // Primer mensaje personalizado según el motivo
    const greetings: Record<string, string> = {
      confirm_reservation: `Hola${customer_name ? ' ' + customer_name : ''}, te llamo de ${tenant.name} para confirmarte la reserva.`,
      reminder: `Hola${customer_name ? ' ' + customer_name : ''}, te llamo de ${tenant.name} para recordarte tu cita.`,
      callback: `Hola${customer_name ? ' ' + customer_name : ''}, te llamo de ${tenant.name}, antes me quedé a medias con tu reserva y quería confirmártela.`,
      schedule_change: `Hola${customer_name ? ' ' + customer_name : ''}, te llamo de ${tenant.name} porque ha habido un cambio en el horario.`,
      general: `Hola${customer_name ? ' ' + customer_name : ''}, te llamo de ${tenant.name}.`,
    }
    const firstMessage = greetings[reason] || greetings.general

    // Iniciar llamada saliente via ElevenLabs
    const res = await fetch('https://api.elevenlabs.io/v1/convai/twilio/outbound_call', {
      method: 'POST',
      headers: { 'xi-api-key': EL_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: agentId,
        agent_phone_number_id: tenant.agent_phone,
        to_number: phone_number,
        conversation_config_override: {
          agent: {
            first_message: firstMessage,
          }
        }
      })
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: 'Could not initiate call' }, { status: 500 })
    }

    const data = await res.json()

    return NextResponse.json({
      success: true,
      call_id: data.call_id || data.conversation_id || null,
      message: `Llamando a ${phone_number}...`,
    })
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
