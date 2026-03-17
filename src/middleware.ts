import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Rutas completamente públicas — nunca redirigir
const PUBLIC_ROUTES = [
  '/', '/login', '/registro', '/precios', '/reset',
  '/precios/success',
]

// Rutas de auth — si estás logueado, te mando al panel
const AUTH_ROUTES = ['/login', '/registro']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // API, archivos estáticos, assets → dejar pasar siempre
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Rutas públicas → pasar sin comprobar sesión
  if (PUBLIC_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    return NextResponse.next()
  }

  // Para rutas protegidas, comprobar sesión
  const response = NextResponse.next({
    request: { headers: request.headers },
  })

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    // Sin sesión en ruta protegida → login
    if (!user) {
      const url = new URL('/login', request.url)
      // No añadir redirect param para evitar loops
      return NextResponse.redirect(url)
    }
  } catch {
    // Error de auth → dejar pasar (mejor UX que un loop)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}