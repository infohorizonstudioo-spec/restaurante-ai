import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/api-auth'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { sanitizePhone, sanitizeString, sanitizeName } from '@/lib/sanitize'
import { logger } from '@/lib/logger'

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
    const rl = rateLimitByIp(req, RATE_LIMITS.agent, 'voice:outbound')
    if (rl.blocked) return rl.response

    const auth = await requireAuth(req)
    if (!auth.ok || !auth.tenantId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const phone_number = sanitizePhone(body.phone_number)
    const reason = sanitizeString(body.reason, 100)
    const customer_name = sanitizeName(body.customer_name)
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

    // Check customer's preferred language from previous calls
    let customerLang = 'es'
    if (phone_number) {
      const { data: prevCall } = await admin.from('calls')
        .select('detected_language')
        .eq('tenant_id', auth.tenantId)
        .or(`caller_phone.eq.${phone_number},from_number.eq.${phone_number}`)
        .not('detected_language', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
      if (prevCall?.[0]?.detected_language) customerLang = prevCall[0].detected_language
    }

    // Multilanguage greetings — adapt to customer's language
    const name = customer_name ? ' ' + customer_name : ''
    const greetingsByLang: Record<string, Record<string, string>> = {
      es: {
        confirm_reservation: `Hola${name}, te llamo de ${tenant.name} para confirmarte la reserva.`,
        reminder: `Hola${name}, te llamo de ${tenant.name} para recordarte tu cita.`,
        callback: `Hola${name}, te llamo de ${tenant.name}, antes me quedé a medias con tu reserva y quería confirmártela.`,
        schedule_change: `Hola${name}, te llamo de ${tenant.name} porque ha habido un cambio en el horario.`,
        general: `Hola${name}, te llamo de ${tenant.name}.`,
      },
      en: {
        confirm_reservation: `Hi${name}, I'm calling from ${tenant.name} to confirm your reservation.`,
        reminder: `Hi${name}, calling from ${tenant.name} to remind you about your appointment.`,
        callback: `Hi${name}, calling back from ${tenant.name} about your booking.`,
        schedule_change: `Hi${name}, calling from ${tenant.name} — there's been a schedule change.`,
        general: `Hi${name}, calling from ${tenant.name}.`,
      },
      fr: {
        confirm_reservation: `Bonjour${name}, je vous appelle de ${tenant.name} pour confirmer votre réservation.`,
        reminder: `Bonjour${name}, je vous appelle de ${tenant.name} pour vous rappeler votre rendez-vous.`,
        callback: `Bonjour${name}, je vous rappelle de ${tenant.name} concernant votre réservation.`,
        schedule_change: `Bonjour${name}, je vous appelle de ${tenant.name} — il y a eu un changement d'horaire.`,
        general: `Bonjour${name}, je vous appelle de ${tenant.name}.`,
      },
      de: {
        confirm_reservation: `Hallo${name}, ich rufe von ${tenant.name} an, um Ihre Reservierung zu bestätigen.`,
        reminder: `Hallo${name}, ich rufe von ${tenant.name} an, um Sie an Ihren Termin zu erinnern.`,
        callback: `Hallo${name}, ich rufe von ${tenant.name} zurück wegen Ihrer Buchung.`,
        schedule_change: `Hallo${name}, ich rufe von ${tenant.name} an — es gibt eine Terminänderung.`,
        general: `Hallo${name}, ich rufe von ${tenant.name} an.`,
      },
      pt: {
        confirm_reservation: `Olá${name}, estou ligando de ${tenant.name} para confirmar a sua reserva.`,
        reminder: `Olá${name}, estou ligando de ${tenant.name} para lembrar da sua consulta.`,
        callback: `Olá${name}, estou retornando a ligação de ${tenant.name} sobre a sua reserva.`,
        schedule_change: `Olá${name}, estou ligando de ${tenant.name} — houve uma mudança no horário.`,
        general: `Olá${name}, estou ligando de ${tenant.name}.`,
      },
      it: {
        confirm_reservation: `Ciao${name}, chiamo da ${tenant.name} per confermare la prenotazione.`,
        reminder: `Ciao${name}, chiamo da ${tenant.name} per ricordarti l'appuntamento.`,
        callback: `Ciao${name}, richiamo da ${tenant.name} per la tua prenotazione.`,
        schedule_change: `Ciao${name}, chiamo da ${tenant.name} — c'è stato un cambio di orario.`,
        general: `Ciao${name}, chiamo da ${tenant.name}.`,
      },
    }
    const langGreetings = greetingsByLang[customerLang] || greetingsByLang.es
    const firstMessage = langGreetings[reason] || langGreetings.general

    // Iniciar llamada saliente via ElevenLabs
    const controller = new AbortController()
    const fetchTimeout = setTimeout(() => controller.abort(), 30000)
    let res: Response
    try {
      res = await fetch('https://api.elevenlabs.io/v1/convai/twilio/outbound_call', {
        method: 'POST',
        headers: { 'xi-api-key': EL_KEY, 'Content-Type': 'application/json' },
        signal: controller.signal,
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
    } finally {
      clearTimeout(fetchTimeout)
    }

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
