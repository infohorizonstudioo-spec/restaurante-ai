/**
 * Simple in-memory rate limiter for API routes.
 * Uses a Map with automatic cleanup.
 */
const store = new Map<string, { count: number; resetAt: number }>()

// Clean old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, val] of store) {
    if (now > val.resetAt) store.delete(key)
  }
}, 5 * 60 * 1000)

export function rateLimit(
  identifier: string,
  limit: number = 30,
  windowMs: number = 60 * 1000
): { ok: boolean; remaining: number } {
  const now = Date.now()
  const record = store.get(identifier)

  if (!record || now > record.resetAt) {
    store.set(identifier, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: limit - 1 }
  }

  if (record.count >= limit) {
    return { ok: false, remaining: 0 }
  }

  record.count++
  return { ok: true, remaining: limit - record.count }
}

export function getRateLimitKey(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown'
  return ip
}
