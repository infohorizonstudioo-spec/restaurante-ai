import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { validateEnv } from '@/lib/env'
import { analyzeRequest, isBlocked, getDeceptionResponse, record404 } from '@/lib/security-guardian'
import { getBlockPage } from '@/lib/block-page'
import { csrfMiddleware } from '@/lib/csrf-edge'
import { preloadFromRedis } from '@/lib/rate-limit'

// Validate required env vars on cold start in production
if (process.env.NODE_ENV === 'production') {
  validateEnv()
}

// Preload rate limit state from Redis on cold start (fire-and-forget)
preloadFromRedis()

// Rutas que requieren autenticación
const PROTECTED = [
  '/panel', '/reservas', '/agenda', '/llamadas', '/clientes',
  '/mesas', '/pedidos', '/estadisticas', '/facturacion', '/configuracion', '/admin',
  '/dashboard', '/agente', '/turnos', '/productos',
]
// Rutas solo para no autenticados
const AUTH_ONLY = ['/login', '/registro']
// Rutas siempre públicas (sin verificar sesión)
const PUBLIC_ALWAYS = ['/', '/precios', '/reset', '/onboarding']

// Headers de seguridad exhaustivos
const isDev = process.env.NODE_ENV === 'development'
const SECURITY_HEADERS: [string, string][] = [
  ['X-Frame-Options', 'DENY'],
  ['X-Content-Type-Options', 'nosniff'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ['X-XSS-Protection', '1; mode=block'],
  ['Permissions-Policy', 'camera=(), microphone=(self), geolocation=()'],
  ['Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload'],
  ['X-DNS-Prefetch-Control', 'off'],
  ['Content-Security-Policy', [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://js.stripe.com https://elevenlabs.io`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://api.elevenlabs.io https://api.stripe.com https://api.twilio.com https://*.sentry.io",
    "frame-src https://js.stripe.com https://elevenlabs.io",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join('; ')],
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Assets, static → siempre pasar
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // ══ SECURITY GUARDIAN — defensa autónoma en profundidad ══
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') || '0.0.0.0'

  // Fast path: IP ya bloqueada → página de bloqueo intimidante
  if (isBlocked(ip)) {
    const assessment = { score: 100, blocked: true, threats: ['blocked'], ip, action: 'block' as const, tarpitMs: 0, fingerprint: 'cached', attackPhase: 'none' as const, riskLevel: 'critical' as const }
    // APIs reciben JSON, navegadores reciben la página de bloqueo
    const accept = request.headers.get('accept') || ''
    if (accept.includes('text/html')) {
      return new NextResponse(getBlockPage(assessment), {
        status: 403,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      })
    }
    return new NextResponse(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Análisis completo del request
  const assessment = analyzeRequest(request)

  // Honeypot: servir respuesta falsa para engañar al atacante
  if (assessment.action === 'honeypot') {
    const deception = getDeceptionResponse(pathname)
    return new NextResponse(deception.body, {
      status: deception.status,
      headers: deception.headers,
    })
  }

  // Bloqueado: página intimidante para navegadores, JSON para APIs
  if (assessment.blocked) {
    const accept = request.headers.get('accept') || ''
    if (accept.includes('text/html')) {
      return new NextResponse(getBlockPage(assessment), {
        status: 403,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      })
    }
    return new NextResponse(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Tarpit: el atacante queda marcado, próximo intento será bloqueado
  if (assessment.action === 'tarpit' && assessment.tarpitMs > 0) {
    // No bloqueamos aún — dejamos pasar pero el escalamiento progresivo
    // garantiza que el siguiente intento sospechoso será bloqueado
  }

  // API webhooks → pasar sin auth (son llamadas externas verificadas internamente)
  if (
    pathname.startsWith('/api/voice/webhook') ||
    pathname.startsWith('/api/voice/inbound') ||
    pathname.startsWith('/api/twilio/webhook') ||
    pathname.startsWith('/api/stripe/webhook') ||
    pathname.startsWith('/api/whatsapp/webhook') ||
    pathname.startsWith('/api/email/webhook') ||
    pathname.startsWith('/api/cron/')
  ) {
    const response = NextResponse.next()
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('Content-Security-Policy', "default-src 'none'")
    response.headers.set('X-DNS-Prefetch-Control', 'off')
    return response
  }

  // Otras rutas API → pasar (protegidas internamente) con headers básicos + CSRF
  if (pathname.startsWith('/api/')) {
    const response = NextResponse.next()
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('Content-Security-Policy', "default-src 'none'")
    response.headers.set('X-DNS-Prefetch-Control', 'off')
    // CSRF protection for state-changing API requests
    const csrfError = csrfMiddleware(request, response)
    if (csrfError) return csrfError
    return response
  }

  // Rutas públicas → pasar sin comprobar
  if (PUBLIC_ALWAYS.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    const response = NextResponse.next()
    SECURITY_HEADERS.forEach(([k, v]) => response.headers.set(k, v))
    // Set CSRF cookie on public pages too
    csrfMiddleware(request, response)
    return response
  }

  // Para el resto, verificar sesión con @supabase/ssr (usa cookies correctamente)
  const response = NextResponse.next({ request: { headers: request.headers } })
  SECURITY_HEADERS.forEach(([k, v]) => response.headers.set(k, v))

  // Set CSRF cookie on page routes so the client has a token ready for API calls
  csrfMiddleware(request, response)

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options as any)
            )
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    const isAuthed = !!user

    const isProtected = PROTECTED.some(p => pathname === p || pathname.startsWith(p + '/'))
    const isAuthOnly  = AUTH_ONLY.some(p => pathname === p || pathname.startsWith(p + '/'))

    // Sin sesión en ruta protegida → login
    if (isProtected && !isAuthed) {
      const url = new URL('/login', request.url)
      return NextResponse.redirect(url)
    }

    // Autenticado en login/registro → panel (desactivado - React maneja la redirección)
    // if (isAuthOnly && isAuthed) {
    //   const url = new URL('/panel', request.url)
    //   return NextResponse.redirect(url)
    // }
  } catch {
    // Error de auth → dejar pasar (evitar loops)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
