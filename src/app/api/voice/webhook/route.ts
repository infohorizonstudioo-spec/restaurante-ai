import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

/**
 * Webhook de ElevenLabs — recibe eventos de conversación y los persiste en `calls`.
 * Usa la misma tabla `calls` que ya existe en el proyecto, sin romper nada.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { event_type, conversation_id, data } = body
    const tenantId = data?.metadata?.tenant_id
    if (!tenantId) return NextResponse.json({ error: 'tenant_id requerido' }, { status: 400 })

    const admin = createAdminClient()

    switch (event_type) {
      case 'conversation_started':
        await admin.from('calls').insert({
          tenant_id:  tenantId,
          call_sid:   conversation_id,
          status:     'activa',
          intent:     'otro',
          transcript: '',
          started_at: new Date().toISOString(),
        })
        break

      case 'transcript_updated':
        await admin.from('calls')
          .update({ transcript: data?.transcript ?? '' })
          .eq('call_sid', conversation_id)
          .eq('tenant_id', tenantId)
        break

      case 'intent_detected':
        await admin.from('calls')
          .update({ intent: data?.intent ?? 'otro', summary: data?.summary ?? '' })
          .eq('call_sid', conversation_id)
          .eq('tenant_id', tenantId)
        break

      case 'conversation_ended':
        await admin.from('calls')
          .update({
            status:           'completada',
            duration_seconds: data?.duration_seconds ?? 0,
            summary:          data?.summary ?? '',
          })
          .eq('call_sid', conversation_id)
          .eq('tenant_id', tenantId)
        break
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('[voice/webhook]', e.message)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
