/**
 * RESERVO.AI — CSRF Protection
 * Double-submit cookie pattern for state-changing requests.
 * Compatible with Next.js middleware + API routes.
 */

import { NextRequest, NextResponse } from 'next/server'

const CSRF_COOKIE = 'x-csrf-token'
const CSRF_HEADER = 'x-csrf-token'
const TOKEN_LENGTH = 32

/** Generate a cryptographically random CSRF token */
function generateToken(): string {
  const bytes = new Uint8Array(TOKEN_LENGTH)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

/** Timing-safe string comparison */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  const encoder = new TextEncoder()
  const bufA = encoder.encode(a)
  const bufB = encoder.encode(b)
  let diff = 0
  for (let i = 0; i < bufA.length; i++) {
    diff |= (bufA[i] ?? 0) ^ (bufB[i] ?? 0)
  }
  return diff === 0
}

/** HTTP methods that change state and require CSRF validation */
const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** Paths exempt from CSRF (webhooks, cron, agent APIs verified separately) */
const CSRF_EXEMPT_PREFIXES = [
  '/api/voice/',
  '/api/twilio/',
  '/api/stripe/webhook',
  '/api/whatsapp/webhook',
  '/api/email/webhook',
  '/api/cron/',
  '/api/agent/',
  '/api/call',
  '/api/sms/',
  '/api/push/',
  '/api/health',
]

function isExempt(pathname: string): boolean {
  return CSRF_EXEMPT_PREFIXES.some(prefix => pathname.startsWith(prefix))
}

/**
 * Middleware: set CSRF cookie if missing, validate on state-changing API requests.
 * Returns null if validation passes, or a 403 Response if it fails.
 */
export function csrfMiddleware(request: NextRequest, response: NextResponse): Response | null {
  const { pathname } = request.nextUrl
  const method = request.method

  // Ensure CSRF cookie exists on every response
  let cookieToken = request.cookies.get(CSRF_COOKIE)?.value
  if (!cookieToken) {
    cookieToken = generateToken()
    response.cookies.set(CSRF_COOKIE, cookieToken, {
      httpOnly: false, // JS needs to read it to send as header
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    })
  }

  // Only validate state-changing methods on API routes
  if (!STATE_CHANGING_METHODS.has(method)) return null
  if (!pathname.startsWith('/api/')) return null
  if (isExempt(pathname)) return null

  // Validate: header token must match cookie token
  const headerToken = request.headers.get(CSRF_HEADER)
  if (!headerToken || !timingSafeEqual(headerToken, cookieToken)) {
    return new Response(
      JSON.stringify({ error: 'CSRF token validation failed' }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  return null
}

/**
 * Client-side helper: get CSRF token from cookie for fetch headers.
 * Usage: fetch('/api/...', { headers: { 'x-csrf-token': getCsrfToken() } })
 */
export function getCsrfToken(): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${CSRF_COOKIE}=([^;]*)`))
  return match ? match[1]! : ''
}

/**
 * Client-side helper: returns headers object with CSRF token included.
 * Usage: fetch('/api/...', { headers: csrfHeaders() })
 */
export function csrfHeaders(): Record<string, string> {
  return { [CSRF_HEADER]: getCsrfToken() }
}
