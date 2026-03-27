import { NextRequest } from 'next/server'
import { timingSafeEqual } from 'crypto'

/**
 * Valida que el request viene de una fuente autorizada (ElevenLabs o con API key).
 *
 * Orden de validación:
 * 1. Si AGENT_API_KEY no está configurado → DENEGAR (fail closed)
 * 2. Si el header x-agent-key coincide (timing-safe) → permitir
 * 3. Si el request viene de ElevenLabs (user-agent contiene "ElevenLabs") → permitir
 * 4. En cualquier otro caso → rechazar
 */
export function validateAgentKey(req: NextRequest): boolean {
  const expected = process.env.AGENT_API_KEY

  // 1. Si AGENT_API_KEY no está configurado → DENEGAR todas las requests (fail closed)
  if (!expected) return false

  // 2. API key explícita con comparación timing-safe
  const key = req.headers.get('x-agent-key')
  if (key) {
    try {
      const keyBuf = Buffer.from(key)
      const expectedBuf = Buffer.from(expected)
      if (keyBuf.length === expectedBuf.length && timingSafeEqual(keyBuf, expectedBuf)) {
        return true
      }
    } catch {
      return false
    }
    return false
  }

  // 3. ElevenLabs user-agent (las tools de ElevenLabs envían su user-agent)
  const ua = req.headers.get('user-agent') || ''
  if (ua.includes('ElevenLabs') || ua.includes('elevenlabs')) return true

  return false
}
