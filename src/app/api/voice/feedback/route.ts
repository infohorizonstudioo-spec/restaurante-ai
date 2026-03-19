/**
 * POST /api/voice/feedback
 * 
 * Registra una corrección manual del negocio sobre una decisión del agente.
 * Alimenta el sistema de aprendizaje controlado.
 * 
 * Body:
 *   call_sid         string  — ID de la llamada corregida
 *   corrected_status string  — nuevo estado que el negocio asigna
 *   note?            string  — explicación opcional
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { recordFeedback, analyzeFeedbackPatterns } from '@/lib/business-memory'
import type { InteractionStatus } from '@/lib/agent-decision'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const VALID_STATUSES: InteractionStatus[] = [
  'confirmed', 'pending_review', 'modified',
  'cancelled', 'rejected', 'needs_human_attention', 'incomplete'
]

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { call_sid, corrected_status, note } = body

    if (!call_sid || !corrected_status) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
    }
    if (!VALID_STATUSES.includes(corrected_status)) {
      return NextResponse.json({ error: 'Estado no válido: ' + corrected_status }, { status: 400 })
    }

    // Buscar la llamada original
    const { data: call, error: callErr } = await admin
      .from('calls')
      .select('tenant_id, decision_status, decision_flags, intent')
      .eq('call_sid', call_sid)
      .maybeSingle()

    if (callErr || !call) {
      return NextResponse.json({ error: 'Llamada no encontrada' }, { status: 404 })
    }

    const original_status = (call.decision_status || 'unknown') as InteractionStatus
    const flags: string[]  = Array.isArray(call.decision_flags) ? call.decision_flags : []
    const intent: string   = call.intent || 'otro'
    const tenant_id        = call.tenant_id

    // Registrar el feedback
    await recordFeedback({ tenant_id, call_sid, original_status, corrected_status, flags, intent, note: note || undefined })

    // Actualizar el estado en la llamada
    await admin.from('calls')
      .update({ decision_status: corrected_status })
      .eq('call_sid', call_sid)
      .eq('tenant_id', tenant_id)

    // Detectar patrones acumulados para sugerir reglas
    const { suggestions } = await analyzeFeedbackPatterns(tenant_id)

    console.log('feedback | call:', call_sid.slice(0,20), '|', original_status, '->', corrected_status, '| suggestions:', suggestions.length)

    return NextResponse.json({ ok: true, call_sid, original_status, corrected_status, suggestions })
  } catch (e: any) {
    console.error('feedback route error:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
