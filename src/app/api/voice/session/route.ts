import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/voice/session
//
// Webhook mid-call para actualizar el estado de una sesión activa.
// ElevenLabs / Twilio pueden llamar a este endpoint durante la llamada
// para actualizar el estado visible en el dashboard en tiempo real.
//
// Body: { call_sid, session_state, tenant_id? }
// Estados: iniciando | escuchando | procesando | respondiendo |
//          esperando_datos | finalizando | completada | error
//
// Garantías de concurrencia:
// - update_call_session_state filtra por status != 'completada'
//   → nunca sobreescribe una sesión ya cerrada
// - Múltiples llamadas simultáneas actualizan filas independientes
//   porque cada una tiene su propio call_sid
// ─────────────────────────────────────────────────────────────────────────────

const VALID_STATES = new Set([
  // Estados base
  'iniciando','escuchando','procesando','respondiendo',
  'esperando_datos','finalizando','completada','error',
  // Estados restaurante
  'tomando_reserva','tomando_pedido','confirmando_reserva',
  'confirmando_pedido','verificando_disponibilidad',
  'buscando_alternativas','pendiente_revision',
  // Estados clínica
  'tomando_cita','confirmando_cita','detectando_urgencia',
  'recogiendo_sintomas','verificando_disponibilidad_cita',
  'urgencia_detectada','derivando_urgencia',
  // Estados genérico servicio
  'tomando_datos','confirmando_datos',
])

export async function POST(req: Request) {
  try {
    const ct = req.headers.get('content-type') || ''
    let body: any = {}
    if (ct.includes('application/json')) {
      body = await req.json().catch(() => ({}))
    } else {
      const text = await req.text()
      new URLSearchParams(text).forEach((v, k) => { body[k] = v })
    }

    const callSid      = body.call_sid || body.CallSid || body.conversation_id || ''
    const sessionState = body.session_state || body.status || ''
    const tenantId     = body.tenant_id || null

    if (!callSid) return NextResponse.json({ ok: false, error: 'call_sid required' }, { status: 400 })
    if (!VALID_STATES.has(sessionState)) {
      return NextResponse.json({
        ok: false, error: 'invalid session_state: ' + sessionState,
        valid: [...VALID_STATES]
      }, { status: 400 })
    }

    // Actualización atómica — no afecta otras llamadas simultáneas
    const { data, error } = await admin.rpc('update_call_session_state', {
      p_call_sid:      callSid,
      p_session_state: sessionState,
      p_tenant_id:     tenantId || undefined,
    })

    if (error) throw error

    return NextResponse.json({ ok: true, call_sid: callSid, session_state: sessionState, result: data })
  } catch (e: any) {
    console.error('session update error:', e.message)
    return NextResponse.json({ ok: true, error: e.message }) // siempre 200 para no romper el flujo
  }
}

// GET — health check del endpoint
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'voice/session',
    valid_states: [...VALID_STATES],
    description: 'Update call session state in real-time'
  })
}
