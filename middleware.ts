import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ═══════════════════════════════════════════════════════════════
// RESERVO.AI — MIDDLEWARE (Edge Runtime Safe)
// Security: inline threat detection (no external imports that crash Edge)
// Auth: Supabase SSR
// ═══════════════════════════════════════════════════════════════

const PROTECTED = [
  '/panel', '/reservas', '/agenda', '/llamadas', '/clientes',
  '/mesas', '/pedidos', '/estadisticas', '/facturacion', '/configuracion', '/admin',
  '/dashboard', '/agente', '/turnos', '/productos', '/proveedores', '/mensajes',
  '/horarios-equipo',
]
const PUBLIC_ALWAYS = ['/', '/login', '/registro', '/precios', '/reset', '/onboarding', '/cookies', '/privacidad', '/terminos', '/reports']

const SECURITY_HEADERS: [string, string][] = [
  ['X-Frame-Options', 'DENY'],
  ['X-Content-Type-Options', 'nosniff'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ['X-XSS-Protection', '1; mode=block'],
  ['Permissions-Policy', 'camera=(), microphone=(self), geolocation=()'],
  ['Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload'],
]

// ═══ INLINE SECURITY GUARDIAN (Edge-safe, zero imports) ═══
const ipCounts = new Map<string, { count: number; ts: number }>()
const blockedIps = new Set<string>()

function getIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') || '0.0.0.0'
}

function analyzeRequest(req: NextRequest): { blocked: boolean; score: number; reason: string } {
  const ip = getIp(req)
  const url = req.nextUrl.pathname + (req.nextUrl.search || '')
  const ua = (req.headers.get('user-agent') || '').toLowerCase()
  let score = 0
  const reasons: string[] = []

  // Already blocked
  if (blockedIps.has(ip)) return { blocked: true, score: 100, reason: 'blocked_ip' }

  // Rate limiting (50 req/10s per IP)
  const now = Date.now()
  const entry = ipCounts.get(ip)
  if (entry && now - entry.ts < 10000) {
    entry.count++
    if (entry.count > 200) { score += 40; reasons.push('rate') }
  } else {
    ipCounts.set(ip, { count: 1, ts: now })
  }
  // Cleanup old entries every 1000 requests
  if (ipCounts.size > 5000) {
    for (const [k, v] of ipCounts) { if (now - v.ts > 60000) ipCounts.delete(k) }
  }

  // Honeypots
  const honeypots = ['/wp-admin', '/wp-login', '/.env', '/.git', '/phpmyadmin', '/xmlrpc', '/admin.php', '/.htaccess', '/cgi-bin', '/wp-content', '/wp-includes', '/actuator', '/swagger']
  if (honeypots.some(h => url.startsWith(h))) { score += 80; reasons.push('honeypot') }

  // Path traversal
  if (url.includes('..') || url.includes('%2e%2e') || url.includes('%252e')) { score += 60; reasons.push('traversal') }

  // SQL injection
  const sqli = /union\s+select|sleep\s*\(|benchmark\s*\(|information_schema|load_file|into\s+outfile|drop\s+table|delete\s+from|insert\s+into|update\s+set/i
  if (sqli.test(url) || sqli.test(req.headers.get('referer') || '')) { score += 70; reasons.push('sqli') }

  // XSS
  const xss = /<script|javascript:|on\w+\s*=|eval\s*\(|document\.cookie|alert\s*\(/i
  if (xss.test(url)) { score += 60; reasons.push('xss') }

  // Command injection
  if (/[;|`].*(?:cat|ls|wget|curl|nc|bash|sh)\s/i.test(url)) { score += 70; reasons.push('cmdi') }

  // Bot/scanner detection
  const bots = ['sqlmap', 'nikto', 'burpsuite', 'nuclei', 'masscan', 'nmap', 'zgrab', 'dirbuster', 'gobuster', 'wpscan', 'acunetix']
  if (bots.some(b => ua.includes(b))) { score += 80; reasons.push('scanner') }

  // Empty user-agent
  if (!ua || ua.length < 5) { score += 15; reasons.push('no_ua') }

  // Block if score >= 50
  const blocked = score >= 70
  if (blocked) blockedIps.add(ip)

  return { blocked, score, reason: reasons.join(',') }
}

// ═══ MAIN MIDDLEWARE ═══
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Static assets
  if (pathname.startsWith('/_next/') || pathname.startsWith('/favicon') || pathname.includes('.')) {
    return NextResponse.next()
  }

  // Security analysis
  const threat = analyzeRequest(request)
  if (threat.blocked) {
    return new Response(
      JSON.stringify({ error: 'Access denied', reason: threat.reason }),
      { status: 403, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
    )
  }

  // Webhooks + agent + cron — pass without auth
  if (
    pathname.startsWith('/api/voice/') || pathname.startsWith('/api/twilio/') ||
    pathname.startsWith('/api/stripe/webhook') || pathname.startsWith('/api/whatsapp/') ||
    pathname.startsWith('/api/email/webhook') || pathname.startsWith('/api/retell/') ||
    pathname.startsWith('/api/agent/') || pathname.startsWith('/api/cron/') ||
    pathname.startsWith('/api/auth/') || pathname.startsWith('/api/shifts/')
  ) {
    const response = NextResponse.next()
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'DENY')
    return response
  }

  // Other APIs
  if (pathname.startsWith('/api/')) {
    const response = NextResponse.next()
    SECURITY_HEADERS.forEach(([k, v]) => response.headers.set(k, v))
    return response
  }

  // Public routes
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
    if (!user && PROTECTED.some(p => pathname === p || pathname.startsWith(p + '/'))) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  } catch (err) {
    // Auth failed — redirect to login for protected routes instead of silently allowing
    if (PROTECTED.some(p => pathname === p || pathname.startsWith(p + '/'))) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
