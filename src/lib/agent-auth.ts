import { NextRequest } from 'next/server'
import { timingSafeEqual } from 'crypto'

/**
 * Valida que el request viene de una fuente autorizada mediante API key.
 *
 * Orden de validación:
 * 1. Si AGENT_API_KEY no está configurado → DENEGAR (fail closed)
 * 2. Si el header x-agent-key coincide (timing-safe) → permitir
 * 3. En cualquier otro caso → rechazar
 *
 * SECURITY: No se permite fallback por User-Agent ya que es trivialmente spoofable.
 * Todos los agentes (incluido ElevenLabs) deben enviar x-agent-key.
 */
export function validateAgentKey(req: NextRequest): boolean {
  const expected = process.env.AGENT_API_KEY

  // 1. Si AGENT_API_KEY no está configurado → DENEGAR todas las requests (fail closed)
  if (!expected) return false

  // 2. API key explícita con comparación timing-safe
  // Retell convierte headers con guiones a guiones bajos (x-agent-key → x_agent_key)
  const key = req.headers.get('x-agent-key') || req.headers.get('x_agent_key')
  if (!key) return false

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
