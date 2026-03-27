/**
 * RESERVO.AI — Sanitización y validación de inputs
 * Previene XSS, SQL injection, y prompt injection.
 */

/** Elimina tags HTML y scripts */
export function stripHtml(input: string): string {
  return input
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

/** Escapa caracteres peligrosos para HTML */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

/** Sanitiza un string genérico: trim + strip HTML + limitar longitud */
export function sanitizeString(input: unknown, maxLength = 500): string {
  if (typeof input !== 'string') return ''
  return stripHtml(input).trim().slice(0, maxLength)
}

/** Sanitiza nombre de persona */
export function sanitizeName(input: unknown): string {
  if (typeof input !== 'string') return ''
  // Solo letras, espacios, guiones, apóstrofes, puntos, acentos
  return input
    .trim()
    .slice(0, 100)
    .replace(/[^\p{L}\p{M}\s\-'.]/gu, '')
}

/** Sanitiza y valida número de teléfono */
export function sanitizePhone(input: unknown): string {
  if (typeof input !== 'string') return ''
  // Solo dígitos, +, espacios, guiones, paréntesis
  const cleaned = input.replace(/[^\d+\s\-()]/g, '').trim()
  // Mínimo 7 dígitos para ser válido
  const digits = cleaned.replace(/\D/g, '')
  if (digits.length < 7 || digits.length > 15) return ''
  return cleaned
}

/** Sanitiza email */
export function sanitizeEmail(input: unknown): string {
  if (typeof input !== 'string') return ''
  const trimmed = input.trim().toLowerCase().slice(0, 254)
  const emailRegex = /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/
  return emailRegex.test(trimmed) ? trimmed : ''
}

/** Sanitiza fecha (YYYY-MM-DD) */
export function sanitizeDate(input: unknown): string {
  if (typeof input !== 'string') return ''
  const match = input.trim().match(/^(\d{4}-\d{2}-\d{2})$/)
  if (!match) return ''
  const d = new Date(match[1])
  if (isNaN(d.getTime())) return ''
  return match[1]
}

/** Sanitiza hora (HH:MM) */
export function sanitizeTime(input: unknown): string {
  if (typeof input !== 'string') return ''
  const match = input.trim().match(/^(\d{2}:\d{2})$/)
  if (!match) return ''
  const [h, m] = match[1].split(':').map(Number)
  if (h < 0 || h > 23 || m < 0 || m > 59) return ''
  return match[1]
}

/** Sanitiza un entero positivo */
export function sanitizePositiveInt(input: unknown, max = 10000): number {
  const n = typeof input === 'number' ? input : parseInt(String(input), 10)
  if (isNaN(n) || n < 0) return 0
  return Math.min(Math.floor(n), max)
}

/** Sanitiza UUID */
export function sanitizeUUID(input: unknown): string {
  if (typeof input !== 'string') return ''
  const match = input.trim().match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  return match ? match[0].toLowerCase() : ''
}

/**
 * Sanitiza texto para proteger contra prompt injection.
 * Elimina patrones comunes de inyección de prompts.
 */
export function sanitizeForLLM(input: string): string {
  if (typeof input !== 'string') return ''

  return input
    // Eliminar intentos de inyección de sistema/instrucciones
    .replace(/\b(system|assistant|human|user|instruction|override|ignore|simulate)\s*:/gi, '')
    .replace(/<\|?(system|endoftext|im_start|im_end)\|?>/gi, '')
    // Eliminar bloques de código que podrían contener instrucciones
    .replace(/```[\s\S]*?```/g, '[código eliminado]')
    // Eliminar XML tags que podrían ser parsing tokens
    .replace(/<(system-prompt|instructions?|prompt|override|context|thinking|hidden|secret)[^>]*>[\s\S]*?<\/\1>/gi, '')
    // Limitar longitud para evitar token stuffing
    .slice(0, 2000)
    .trim()
}

/**
 * Sanitiza un objeto completo recursivamente
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  maxDepth = 3,
  currentDepth = 0
): T {
  if (currentDepth >= maxDepth) return {} as T
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = sanitizeString(value)
    } else if (typeof value === 'number') {
      result[key] = isFinite(value) ? value : 0
    } else if (typeof value === 'boolean') {
      result[key] = value
    } else if (value === null || value === undefined) {
      result[key] = value
    } else if (Array.isArray(value)) {
      result[key] = value.slice(0, 100).map(item =>
        typeof item === 'object' && item !== null
          ? sanitizeObject(item as Record<string, unknown>, maxDepth, currentDepth + 1)
          : typeof item === 'string' ? sanitizeString(item) : item
      )
    } else if (typeof value === 'object') {
      result[key] = sanitizeObject(value as Record<string, unknown>, maxDepth, currentDepth + 1)
    }
  }

  return result as T
}
