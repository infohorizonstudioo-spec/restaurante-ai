/**
 * RESERVO.AI -- CSRF Protection (Edge-compatible)
 *
 * Double-submit cookie pattern using ONLY Web Crypto APIs.
 * No Node.js crypto, no Buffer -- runs safely in Vercel Edge Runtime.
 *
 * Flow:
 *   1. Page request  -> middleware sets `_csrf` cookie with random token
 *   2. Client JS     -> reads `_csrf` cookie, sends it as `x-csrf-token` header
 *   3. API mutation   -> middleware compares cookie vs header (timing-safe)
 */

import { NextRequest, NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CSRF_COOKIE = '_csrf'
const CSRF_HEADER = 'x-csrf-token'
const TOKEN_BYTES = 32 // 256 bits of entropy

// ---------------------------------------------------------------------------
// Token generation (Web Crypto only)
// ---------------------------------------------------------------------------

/** Generate a hex CSRF token using crypto.getRandomValues (Web API). */
function generateToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES)
  crypto.getRandomValues(bytes)
  // Convert to hex without Buffer
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    hex += (bytes[i]! >>> 0).toString(16).padStart(2, '0')
  }
  return hex
}

// ---------------------------------------------------------------------------
// Timing-safe comparison (no Node.js crypto.timingSafeEqual)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Exempt routes (webhooks, cron, agent, voice -- verified separately)
// ---------------------------------------------------------------------------

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

const CSRF_EXEMPT_PREFIXES = [
  '/api/voice/',
  '/api/twilio/',
  '/api/retell/',
  '/api/stripe/webhook',
  '/api/whatsapp/webhook',
  '/api/email/webhook',
  '/api/cron/',
  '/api/agent/',
  '/api/call',
  '/api/sms/',
  '/api/push/',
  '/api/health',
  '/api/auth/',
]

function isExempt(pathname: string): boolean {
  return CSRF_EXEMPT_PREFIXES.some(prefix => pathname.startsWith(prefix))
}

// ---------------------------------------------------------------------------
// Middleware entry point
// ---------------------------------------------------------------------------

/**
 * CSRF middleware for Next.js Edge Runtime.
 *
 * Call from middleware.ts for EVERY response:
 *   - Sets the `_csrf` cookie when missing (page + API routes).
 *   - Validates cookie vs header on state-changing API requests.
 *
 * @returns `null` when the request is valid, or a 403 `Response` on failure.
 */
export function csrfMiddleware(
  request: NextRequest,
  response: NextResponse,
): Response | null {
  const { pathname } = request.nextUrl
  const method = request.method

  // ------ 1. Ensure the CSRF cookie exists on every response ------
  let cookieToken = request.cookies.get(CSRF_COOKIE)?.value
  if (!cookieToken) {
    cookieToken = generateToken()
    response.cookies.set(CSRF_COOKIE, cookieToken, {
      httpOnly: false, // JS must read this to send it as a header
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 h
    })
  }

  // ------ 2. Only validate state-changing methods on /api/* ------
  if (!STATE_CHANGING_METHODS.has(method)) return null
  if (!pathname.startsWith('/api/')) return null
  if (isExempt(pathname)) return null

  // ------ 3. Double-submit: header must match cookie ------
  const headerToken = request.headers.get(CSRF_HEADER)
  if (!headerToken || !timingSafeEqual(headerToken, cookieToken)) {
    return new Response(
      JSON.stringify({ error: 'CSRF token validation failed' }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }

  return null
}

// ---------------------------------------------------------------------------
// Client-side helpers (re-exported so nothing else needs to import csrf.ts)
// ---------------------------------------------------------------------------

/** Read the CSRF token from the `_csrf` cookie (browser only). */
export function getCsrfToken(): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${CSRF_COOKIE}=([^;]*)`))
  return match ? match[1]! : ''
}

/** Convenience: returns a headers object ready for fetch(). */
export function csrfHeaders(): Record<string, string> {
  return { [CSRF_HEADER]: getCsrfToken() }
}
