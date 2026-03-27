import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'

// WebSocket endpoint eliminado — el audio lo gestiona ElevenLabs Conversational AI directamente.
// Este endpoint se mantiene por compatibilidad de rutas.
export async function GET(req: Request) {
  const rl = rateLimitByIp(req, RATE_LIMITS.api, 'stream')
  if (rl.blocked) return rl.response

  const auth = await requireAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status || 401 })

  return NextResponse.json({ status: 'ok', note: 'Audio handled by ElevenLabs ConvAI' })
}
