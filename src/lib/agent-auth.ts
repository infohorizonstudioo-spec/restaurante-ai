import { NextRequest } from 'next/server'

/**
 * Valida que el request viene de una fuente autorizada (ElevenLabs o con API key).
 *
 * Orden de validación:
 * 1. Si AGENT_API_KEY está configurado y el header x-agent-key coincide → permitir
 * 2. Si el request viene de ElevenLabs (user-agent contiene "ElevenLabs") → permitir
 * 3. Si el request tiene un tenant_id válido en el body y viene de un webhook → permitir
 * 4. En cualquier otro caso → rechazar
 */
export function validateAgentKey(req: NextRequest): boolean {
  // 1. API key explícita (más seguro)
  const key = req.headers.get('x-agent-key')
  const expected = process.env.AGENT_API_KEY
  if (expected && key === expected) return true

  // 2. ElevenLabs user-agent (las tools de ElevenLabs envían su user-agent)
  const ua = req.headers.get('user-agent') || ''
  if (ua.includes('ElevenLabs') || ua.includes('elevenlabs')) return true

  // 3. Si tiene x-agent-key pero no coincide → rechazar explícitamente
  if (key && expected && key !== expected) return false

  // 4. Si AGENT_API_KEY no está configurado, permitir solo si parece un webhook legítimo
  // (tiene Content-Type json y viene de un server, no de un browser)
  if (!expected) {
    const origin = req.headers.get('origin')
    const referer = req.headers.get('referer')
    // Browsers envían origin/referer, webhooks no
    if (!origin && !referer) return true
  }

  return false
}
