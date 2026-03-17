import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/', '/login', '/registro', '/precios', '/reset']
const AUTH_ROUTES = ['/login', '/registro']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Rutas públicas - dejar pasar
  if (PUBLIC_ROUTES.some(r => pathname === r) || 
      pathname.startsWith('/api/') ||
      pathname.startsWith('/_next/') ||
      pathname.includes('.')) {
    return NextResponse.next()
  }

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

    // Si no está autenticado y va a ruta protegida -> login
    if (!user && !AUTH_ROUTES.includes(pathname)) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Si está autenticado y va a login/registro -> panel
    if (user && AUTH_ROUTES.includes(pathname)) {
      return NextResponse.redirect(new URL('/panel', request.url))
    }
  } catch(e) {
    // Si hay error de auth, dejar pasar sin redirigir
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}