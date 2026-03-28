import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Rutas que requieren autenticación
const PROTECTED = [
  '/panel', '/reservas', '/agenda', '/llamadas', '/clientes',
  '/mesas', '/pedidos', '/estadisticas', '/facturacion', '/configuracion', '/admin',
  '/dashboard', '/agente', '/turnos', '/productos', '/proveedores', '/mensajes',
]
const AUTH_ONLY = ['/login', '/registro']
const PUBLIC_ALWAYS = ['/', '/precios', '/reset', '/onboarding', '/cookies', '/privacidad', '/terminos']

// Security headers
const SECURITY_HEADERS: [string, string][] = [
  ['X-Frame-Options', 'DENY'],
  ['X-Content-Type-Options', 'nosniff'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ['X-XSS-Protection', '1; mode=block'],
  ['Permissions-Policy', 'camera=(), microphone=(self), geolocation=()'],
  ['Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload'],
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Static assets — always pass
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // API webhooks + agent + retell + cron → pass without auth (verified internally)
  if (
    pathname.startsWith('/api/voice/') ||
    pathname.startsWith('/api/twilio/') ||
    pathname.startsWith('/api/stripe/webhook') ||
    pathname.startsWith('/api/whatsapp/') ||
    pathname.startsWith('/api/email/webhook') ||
    pathname.startsWith('/api/retell/') ||
    pathname.startsWith('/api/agent/') ||
    pathname.startsWith('/api/cron/') ||
    pathname.startsWith('/api/auth/')
  ) {
    const response = NextResponse.next()
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'DENY')
    return response
  }

  // Other APIs — pass with basic headers
  if (pathname.startsWith('/api/')) {
    const response = NextResponse.next()
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'DENY')
    return response
  }

  // Public routes — pass without auth
  if (PUBLIC_ALWAYS.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    const response = NextResponse.next()
    SECURITY_HEADERS.forEach(([k, v]) => response.headers.set(k, v))
    return response
  }

  // Protected routes — check auth
  const response = NextResponse.next({ request: { headers: request.headers } })
  SECURITY_HEADERS.forEach(([k, v]) => response.headers.set(k, v))

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

    if (isProtected && !isAuthed) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  } catch {
    // Auth error → let pass
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
