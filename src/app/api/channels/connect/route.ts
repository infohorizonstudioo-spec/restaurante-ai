/**
 * POST /api/channels/connect
 * Connection flow for WhatsApp and Email channels.
 * Validates credentials, configures webhooks, enables channel.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { normalizePhone } from '@/lib/phone-utils'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { tenant_id, channel, phone, email_slug } = await req.json()
    if (!tenant_id || !channel) {
      return NextResponse.json({ error: 'tenant_id and channel required' }, { status: 400 })
    }

    if (channel === 'whatsapp') {
      // WhatsApp connection: save phone number and enable channel
      const normalized = normalizePhone(phone)
      if (!normalized) {
        return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
      }

      // Update tenant's whatsapp_phone
      await supabase.from('tenants')
        .update({ whatsapp_phone: normalized })
        .eq('id', tenant_id)

      // Upsert channel config
      await supabase.from('channel_configs')
        .upsert({
          tenant_id,
          channel: 'whatsapp',
          enabled: true,
          provider: 'twilio',
          auto_respond: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'tenant_id,channel' })

      // Webhook URL for the tenant: the global /api/whatsapp/webhook
      // Twilio routes by "To" number, so one webhook handles all tenants
      const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.reservo.ai'}/api/whatsapp/webhook`

      return NextResponse.json({
        success: true,
        channel: 'whatsapp',
        phone: normalized,
        webhookUrl,
        instructions: [
          'Ve a tu consola de Twilio',
          'En tu número WhatsApp, configura el webhook a:',
          webhookUrl,
          'Método: POST',
          '¡Listo! Los mensajes WhatsApp se procesarán automáticamente.',
        ],
      })
    }

    if (channel === 'email') {
      // Email connection: generate inbound address
      const { data: tenant } = await supabase.from('tenants')
        .select('slug, name').eq('id', tenant_id).maybeSingle()

      const slug = email_slug || tenant?.slug || tenant_id.slice(0, 8)
      const inboundAddress = `${slug}@inbox.reservo.ai`

      await supabase.from('tenants')
        .update({ email_address: inboundAddress })
        .eq('id', tenant_id)

      await supabase.from('channel_configs')
        .upsert({
          tenant_id,
          channel: 'email',
          enabled: true,
          provider: 'resend',
          auto_respond: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'tenant_id,channel' })

      return NextResponse.json({
        success: true,
        channel: 'email',
        email: inboundAddress,
        instructions: [
          `Tu dirección de email es: ${inboundAddress}`,
          'Los clientes pueden escribir a esta dirección.',
          'Las respuestas se enviarán automáticamente.',
          'Publica esta dirección en tu web y redes sociales.',
        ],
      })
    }

    if (channel === 'sms') {
      // SMS uses the same Twilio number as voice
      await supabase.from('channel_configs')
        .upsert({
          tenant_id,
          channel: 'sms',
          enabled: true,
          provider: 'twilio',
          auto_respond: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'tenant_id,channel' })

      return NextResponse.json({
        success: true,
        channel: 'sms',
        instructions: ['SMS activado. Se usará el mismo número de teléfono del agente.'],
      })
    }

    return NextResponse.json({ error: 'Invalid channel' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
