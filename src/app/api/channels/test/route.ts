/**
 * POST /api/channels/test
 * Send a test message to verify channel connectivity.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendSms, sendWhatsApp } from '@/lib/agent-tools'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { tenant_id, channel, to } = await req.json()
    if (!tenant_id || !channel || !to) {
      return NextResponse.json({ error: 'tenant_id, channel, and to required' }, { status: 400 })
    }

    const { data: tenant } = await supabase.from('tenants')
      .select('name, agent_name, email_address').eq('id', tenant_id).maybeSingle()

    const bizName = tenant?.name || 'Tu negocio'
    const agentName = tenant?.agent_name || 'Asistente'
    const testMsg = `¡Hola! Soy ${agentName} de ${bizName}. Este es un mensaje de prueba para verificar que el canal ${channel} funciona correctamente. 🎉`

    let sent = false
    if (channel === 'whatsapp') {
      sent = await sendWhatsApp(to, testMsg)
    } else if (channel === 'sms') {
      sent = await sendSms(to, testMsg)
    } else if (channel === 'email') {
      const resendKey = process.env.RESEND_API_KEY
      if (resendKey) {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: tenant?.email_address || 'noreply@reservo.ai',
            to,
            subject: `Prueba de conexión — ${bizName}`,
            text: testMsg,
          }),
        })
        sent = res.ok
      }
    }

    return NextResponse.json({
      success: sent,
      message: sent
        ? `Mensaje de prueba enviado por ${channel} a ${to}`
        : `No se pudo enviar. Verifica la configuración de ${channel}.`,
    })
  } catch (err) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
