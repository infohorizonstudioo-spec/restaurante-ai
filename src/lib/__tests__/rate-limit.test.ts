import { describe, it, expect, beforeEach, vi } from 'vitest'
import { rateLimit, rateLimitCheck, rateLimitByIp, RATE_LIMITS, getClientIp } from '../rate-limit'

describe('rateLimit (legacy API)', () => {
  it('allows requests within limit', () => {
    const key = `test-legacy-${Date.now()}`
    const result = rateLimit(key, 5, 60000)
    expect(result.ok).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it('blocks after limit exceeded', () => {
    const key = `test-block-${Date.now()}`
    for (let i = 0; i < 5; i++) rateLimit(key, 5, 60000)
    const result = rateLimit(key, 5, 60000)
    expect(result.ok).toBe(false)
    expect(result.remaining).toBe(0)
  })
})

describe('rateLimitCheck', () => {
  it('allows first request', () => {
    const key = `test-new-${Date.now()}`
    const result = rateLimitCheck(key, RATE_LIMITS.api)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(29) // 30 - 1
  })

  it('blocks after exceeding limit', () => {
    const key = `test-exceed-${Date.now()}`
    for (let i = 0; i < 30; i++) {
      rateLimitCheck(key, RATE_LIMITS.api)
    }
    const result = rateLimitCheck(key, RATE_LIMITS.api)
    expect(result.allowed).toBe(false)
    expect(result.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('different keys are independent', () => {
    const key1 = `test-indep1-${Date.now()}`
    const key2 = `test-indep2-${Date.now()}`
    for (let i = 0; i < 5; i++) rateLimitCheck(key1, RATE_LIMITS.auth)
    const r1 = rateLimitCheck(key1, RATE_LIMITS.auth)
    const r2 = rateLimitCheck(key2, RATE_LIMITS.auth)
    expect(r1.allowed).toBe(false)
    expect(r2.allowed).toBe(true)
  })

  it('respects different presets', () => {
    expect(RATE_LIMITS.auth.limit).toBe(5)
    expect(RATE_LIMITS.api.limit).toBe(30)
    expect(RATE_LIMITS.webhook.limit).toBe(100)
    expect(RATE_LIMITS.messaging.limit).toBe(10)
  })
})

describe('rateLimitByIp', () => {
  it('returns blocked:false for first request', () => {
    const req = new Request('http://localhost/api/test', {
      headers: { 'x-forwarded-for': `test-ip-${Date.now()}` },
    })
    const result = rateLimitByIp(req, RATE_LIMITS.api)
    expect(result.blocked).toBe(false)
  })

  it('returns 429 response when blocked', () => {
    const ip = `test-blocked-ip-${Date.now()}`
    const req = new Request('http://localhost/api/test', {
      headers: { 'x-forwarded-for': ip },
    })
    // Exhaust the limit
    for (let i = 0; i < 5; i++) {
      rateLimitByIp(req, RATE_LIMITS.auth, 'test-429')
    }
    const result = rateLimitByIp(req, RATE_LIMITS.auth, 'test-429')
    expect(result.blocked).toBe(true)
    if (result.blocked) {
      expect(result.response.status).toBe(429)
    }
  })
})

describe('getClientIp', () => {
  it('extracts from x-forwarded-for', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    })
    expect(getClientIp(req)).toBe('1.2.3.4')
  })

  it('extracts from x-real-ip', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-real-ip': '10.0.0.1' },
    })
    expect(getClientIp(req)).toBe('10.0.0.1')
  })

  it('returns unknown when no IP header', () => {
    const req = new Request('http://localhost')
    expect(getClientIp(req)).toBe('unknown')
  })
})
