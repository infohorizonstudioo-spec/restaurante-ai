import { NextResponse, type NextRequest } from 'next/server'

// Rutas que requieren autenticación
const PROTECTED = ['/panel', '/reservas', '/agenda', '/llamadas', '/clientes', '/mesas', '/pedidos', '/estadisticas', '/facturacion', '/configuracion', '/admin']
// Rutas solo para no autenticados
const AUTH_ONLY = ['/login', '/registro']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Obtener sesión de Supabase via cookie
  const token = request.cookies.get('sb-phrfucpinxxcsgxgbcno-auth-token')?.value
    || request.cookies.get('sb-access-token')?.value

  const isAuthed = !!token

  // Si está en ruta protegida y no hay sesión → login
  const isProtected = PROTECTED.some(p => pathname === p || pathname.startsWith(p + '/'))
  if (isProtected && !isAuthed) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  // Si ya está autenticado y va a login/registro → panel
  const isAuthOnly = AUTH_ONLY.some(p => pathname === p || pathname.startsWith(p + '/'))
  if (isAuthOnly && isAuthed) {
    const url = request.nextUrl.clone()
    url.pathname = '/panel'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|onboarding|precios|reset|registro).*)'],
}
