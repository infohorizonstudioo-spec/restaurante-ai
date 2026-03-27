/**
 * RESERVO.AI — Rate Limiter (In-memory + Upstash Redis)
 * Limita requests por IP o por clave personalizada.
 * Usa Upstash Redis cuando UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN
 * estan configurados para sincronizar contadores entre instancias serverless.
 * Fallback a in-memory cuando Redis no esta disponible.
 * API publica 100% retrocompatible (sincrona).
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Limpieza periódica cada 5 minutos
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (now > entry.resetAt) store.delete(key)
    }
  }, 5 * 60 * 1000)
}

export interface RateLimitConfig {
  limit: number
  windowSeconds: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  retryAfterSeconds?: number
}

/** Presets para distintos tipos de endpoint */
export const RATE_LIMITS = {
  auth: { limit: 3, windowSeconds: 300 } as RateLimitConfig,
  api: { limit: 30, windowSeconds: 60 } as RateLimitConfig,
  messaging: { limit: 10, windowSeconds: 60 } as RateLimitConfig,
  webhook: { limit: 100, windowSeconds: 60 } as RateLimitConfig,
  cron: { limit: 5, windowSeconds: 60 } as RateLimitConfig,
  admin: { limit: 10, windowSeconds: 60 } as RateLimitConfig,
  agent: { limit: 60, windowSeconds: 60 } as RateLimitConfig,
} as const

// --- Upstash Redis helpers ---

function upstashConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

/**
 * Fire-and-forget: increment counter in Redis and sync the result back
 * to the in-memory store. This keeps counts roughly consistent across
 * serverless instances without blocking the synchronous API.
 */
function redisIncrAndSync(key: string, config: RateLimitConfig): void {
  const url = process.env.UPSTASH_REDIS_REST_URL!
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!
  const redisKey = `rl:${key}`

  fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify([
      ['INCR', redisKey],
      ['EXPIRE', redisKey, config.windowSeconds],
    ]),
  })
    .then((res) => res.json())
    .then((results: Array<{ result: number }>) => {
      const count = results[0]?.result || 0
      const now = Date.now()
      const entry = store.get(key)
      // Update in-memory count to match Redis (the global source of truth)
      if (entry && now <= entry.resetAt) {
        entry.count = count
      } else {
        store.set(key, {
          count,
          resetAt: now + config.windowSeconds * 1000,
        })
      }
    })
    .catch(() => {
      // Redis unavailable — in-memory continues working as fallback
    })
}

// --- Core implementation ---

/**
 * Verifica y consume un intento de rate limit (nueva API con config).
 */
export function rateLimitCheck(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    const resetAt = now + config.windowSeconds * 1000
    store.set(key, { count: 1, resetAt })
    // Sync to Redis in background
    if (upstashConfigured()) redisIncrAndSync(key, config)
    return { allowed: true, remaining: config.limit - 1, resetAt }
  }

  if (entry.count < config.limit) {
    entry.count++
    // Sync to Redis in background
    if (upstashConfigured()) redisIncrAndSync(key, config)
    return { allowed: true, remaining: config.limit - entry.count, resetAt: entry.resetAt }
  }

  const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000)
  return { allowed: false, remaining: 0, resetAt: entry.resetAt, retryAfterSeconds }
}

/**
 * Retrocompatible: API anterior (limit + windowMs)
 */
export function rateLimit(
  identifier: string,
  limit: number = 30,
  windowMs: number = 60 * 1000
): { ok: boolean; remaining: number } {
  const result = rateLimitCheck(identifier, { limit, windowSeconds: windowMs / 1000 })
  return { ok: result.allowed, remaining: result.remaining }
}

/**
 * Extrae la IP del request (compatible con Vercel/Next.js/Cloudflare)
 */
export function getClientIp(req: Request): string {
  const headers = req.headers
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    headers.get('cf-connecting-ip') ||
    'unknown'
  )
}

/** Alias retrocompatible */
export const getRateLimitKey = getClientIp

/**
 * Helper: aplica rate limit por IP y devuelve Response 429 si bloqueado
 */
export function rateLimitByIp(
  req: Request,
  config: RateLimitConfig,
  prefix = 'api'
): { blocked: true; response: Response } | { blocked: false } {
  const ip = getClientIp(req)
  const result = rateLimitCheck(`${prefix}:${ip}`, config)

  if (!result.allowed) {
    return {
      blocked: true,
      response: new Response(
        JSON.stringify({
          error: 'Too many requests',
          retryAfterSeconds: result.retryAfterSeconds,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(result.retryAfterSeconds || 60),
            'X-RateLimit-Limit': String(config.limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
          },
        }
      ),
    }
  }

  return { blocked: false }
}
