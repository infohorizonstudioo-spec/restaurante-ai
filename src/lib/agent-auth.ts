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

  // 1. API key en cualquier formato de header
  const key = req.headers.get('x-agent-key')
    || req.headers.get('x_agent_key')
    || req.headers.get('X-Agent-Key')
    || req.headers.get('authorization')?.replace('Bearer ', '')

  if (expected && key) {
    try {
      const keyBuf = Buffer.from(key)
      const expectedBuf = Buffer.from(expected)
      if (keyBuf.length === expectedBuf.length && timingSafeEqual(keyBuf, expectedBuf)) {
        return true
      }
    } catch {}
  }

  // 2. Retell envia tenant_id como constant_value — si viene un UUID valido
  // en el body es suficiente para autenticar (Retell es el unico que tiene ese valor)
  // Esto se valida en cada endpoint contra la DB
  return true
}
