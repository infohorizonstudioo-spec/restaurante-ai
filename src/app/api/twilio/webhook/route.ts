import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ─────────────────────────────────────────────────────────────────────────────
// TWILIO STATUS WEBHOOK — registro temprano del estado de la llamada.
//
// ARQUITECTURA:
//   - Este webhook: registro rápido (activa, ringing, etc.) + bloqueo trial
//   - /api/voice/post-call: análisis Claude + billing (solo para 'completed')
//
// IMPORTANTE: NO hacer billing aquí. El billing lo gestiona post-call con
// deduplicación atómica (complete_call_session + process_billable_call).
// ─────────────────────────────────────────────────────────────────────────────

// Verificación de firma Twilio para evitar webhooks falsos
async function validateTwilioSignature(req: Request, body: FormData): Promise<boolean> {
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!authToken) return true // si no hay token configurado, no bloquear

  const signature = req.headers.get('x-twilio-signature') || ''
  if (!signature) return false

  const url = process.env.NEXT_PUBLIC_APP_URL + '/api/twilio/webhook'
  const params: Record<string, string> = {}
  body.forEach((v, k) => { params[k] = v.toString() })

  // Construir string a firmar: url + params ordenados alfabéticamente
  const sortedKeys = Object.keys(params).sort()
  const strToSign = url + sortedKeys.map(k => k + params[k]).join('')

  // HMAC-SHA1 con auth token
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(authToken), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(strToSign))
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)))
  return signature === expected
}

export async function POST(req: Request) {
  try {
    const body = await req.formData()

    // Validar firma Twilio
    const valid = await validateTwilioSignature(req, body)
    if (!valid) return NextResponse.json({ error: 'Firma inválida' }, { status: 403 })

    const callSid    = body.get('CallSid')?.toString()    || ''
    const callStatus = body.get('CallStatus')?.toString() || ''
    const callerPhone= body.get('From')?.toString()       || ''
    const toPhone    = body.get('To')?.toString()         || ''
    const duration   = parseInt(body.get('CallDuration')?.toString() || '0') || 0

    if (!callSid) return NextResponse.json({ ok: true })

    // Resolver tenant por número del agente
    const { data: tenant } = await admin.from('tenants')
      .select('id,plan,free_calls_used,free_calls_limit')
      .eq('agent_phone', toPhone).maybeSingle()

    if (!tenant) return NextResponse.json({ ok: true })

    // Bloqueo trial en ringing — respuesta TwiML para colgar
    const isTrial = ['trial','free'].includes((tenant as any).plan||'')
    if (isTrial && callStatus === 'ringing') {
      const used  = (tenant as any).free_calls_used  || 0
      const limit = (tenant as any).free_calls_limit || 10
      if (used >= limit) {
        return new Response(
          '<?xml version="1.0" encoding="UTF-8"?><Response><Say language="es-ES">Lo sentimos, el periodo de prueba ha finalizado. Contacte con el administrador para activar su plan.</Say><Hangup/></Response>',
          { headers: { 'Content-Type': 'text/xml' } }
        )
      }
    }

    // Si la llamada ya fue procesada por post-call (status=completada),
    // no sobrescribir — evitar race condition
    const { data: existing } = await admin.from('calls')
      .select('id,status').eq('call_sid', callSid).maybeSingle()

    if (existing && (existing as any).status === 'completada') {
      return NextResponse.json({ ok: true, skipped: 'already_completed' })
    }

    const statusMap: Record<string, string> = {
      completed:    'completada', failed:      'fallida',
      'no-answer':  'perdida',   busy:         'perdida',
      canceled:     'perdida',   ringing:      'activa',
      'in-progress':'activa',
    }
    const statusInterno = statusMap[callStatus] || 'activa'

    await admin.from('calls').upsert({
      tenant_id:           (tenant as any).id,
      call_sid:            callSid,
      caller_phone:        callerPhone,
      from_number:         callerPhone,
      to_number:           toPhone,
      status:              statusInterno,
      direction:           'inbound',
      duration_seconds:    duration > 0 ? duration : null,
      started_at:          new Date().toISOString(),
      ended_at:            callStatus === 'completed' ? new Date().toISOString() : null,
      counted_for_billing: false,
      source:              'twilio',
    }, { onConflict: 'call_sid', ignoreDuplicates: false })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('twilio/webhook error:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
