import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Rutas que requieren autenticación
const PROTECTED = [
  '/panel', '/reservas', '/agenda', '/llamadas', '/clientes',
  '/mesas', '/pedidos', '/estadisticas', '/facturacion', '/configuracion', '/admin',
  '/dashboard'
]
// Rutas solo para no autenticados
const AUTH_ONLY = ['/login', '/registro']
// Rutas siempre públicas (sin verificar sesión)
const PUBLIC_ALWAYS = ['/', '/precios', '/reset', '/onboarding']

// Headers de seguridad
const SECURITY_HEADERS: [string, string][] = [
  ['X-Frame-Options', 'DENY'],
  ['X-Content-Type-Options', 'nosniff'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ['X-XSS-Protection', '1; mode=block'],
  ['Permissions-Policy', 'camera=(), microphone=(), geolocation=()'],
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

  // API webhooks → pasar sin auth (son llamadas externas)
  if (
    pathname.startsWith('/api/voice/webhook') ||
    pathname.startsWith('/api/twilio/webhook') ||
    pathname.startsWith('/api/stripe/webhook')
  ) {
    return NextResponse.next()
  }

  // Otras rutas API → pasar (protegidas internamente)
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Rutas públicas → pasar sin comprobar
  if (PUBLIC_ALWAYS.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    const response = NextResponse.next()
    SECURITY_HEADERS.forEach(([k, v]) => response.headers.set(k, v))
    return response
  }

  // Para el resto, verificar sesión con @supabase/ssr (usa cookies correctamente)
  const response = NextResponse.next({ request: { headers: request.headers } })
  SECURITY_HEADERS.forEach(([k, v]) => response.headers.set(k, v))

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
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
