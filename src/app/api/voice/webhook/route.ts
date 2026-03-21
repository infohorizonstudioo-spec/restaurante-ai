import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

// Verificación de firma HMAC-SHA256 de ElevenLabs
async function validateElevenLabsSignature(req: NextRequest, rawBody: string): Promise<boolean> {
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET
  if (!secret) return true // si no está configurado, no bloqueamos
  const signature = req.headers.get('elevenlabs-signature') || req.headers.get('x-elevenlabs-signature') || ''
  if (!signature) return false
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody))
  const expected = 'sha256=' + Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2,'0')).join('')
  return signature === expected
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()

    // Verificar firma ElevenLabs
    const valid = await validateElevenLabsSignature(req, rawBody)
    if (!valid) return NextResponse.json({ error: 'Firma inválida' }, { status: 403 })

    const body = JSON.parse(rawBody)
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
