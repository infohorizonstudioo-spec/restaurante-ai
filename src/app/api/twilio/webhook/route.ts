import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: Request) {
  try {
    const body = await req.formData()
    const callSid    = body.get('CallSid')?.toString() || ''
    const callStatus = body.get('CallStatus')?.toString() || ''
    const callerPhone= body.get('From')?.toString() || ''
    const toPhone    = body.get('To')?.toString() || ''
    const duration   = parseInt(body.get('CallDuration')?.toString() || '0') || 0

    if (!callSid) return NextResponse.json({ ok: true })

    // Encontrar tenant por numero de agente
    const { data: tenant } = await admin.from('tenants')
      .select('id,plan,free_calls_used,free_calls_limit,plan_calls_used,plan_calls_included,subscription_status')
      .eq('agent_phone', toPhone).maybeSingle()

    if (!tenant) return NextResponse.json({ ok: true })

    const now = new Date().toISOString()

    // Bloqueo trial ANTES de registrar la llamada
    const isTrial = ['trial','free'].includes(tenant.plan)
    if (isTrial && callStatus === 'ringing') {
      const used = tenant.free_calls_used || 0
      const limit = tenant.free_calls_limit || 10
      if (used >= limit) {
        return new Response(
          '<?xml version="1.0" encoding="UTF-8"?><Response><Say language="es-ES">Lo sentimos, el periodo de prueba ha finalizado. Por favor contacte con el administrador para activar un plan.</Say><Hangup/></Response>',
          { headers: { 'Content-Type': 'text/xml' } }
        )
      }
    }

    // Mapear status de Twilio a status interno en español
    const statusMap: Record<string, string> = {
      completed:    'completada',
      failed:       'fallida',
      'no-answer':  'perdida',
      busy:         'perdida',
      canceled:     'perdida',
      ringing:      'activa',
      'in-progress':'activa',
    }
    const statusInterno = statusMap[callStatus] || 'activa'

    // Upsert la llamada (deduplicada por call_sid)
    await admin.from('calls').upsert({
      tenant_id:           tenant.id,
      call_sid:            callSid,
      caller_phone:        callerPhone,
      from_number:         callerPhone,
      to_number:           toPhone,
      status:              statusInterno,
      direction:           'inbound',
      duration_seconds:    duration > 0 ? duration : null,
      started_at:          now,
      ended_at:            callStatus === 'completed' ? now : null,
      counted_for_billing: false,
      source:              'twilio',
    }, { onConflict: 'call_sid', ignoreDuplicates: false })

    // NOTA: El billing lo gestiona el post-call webhook (/api/voice/post-call)
    // que llama Twilio al finalizar con transcripción completa.
    // NO hacer billing aquí para evitar doble conteo.

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('Twilio webhook error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
