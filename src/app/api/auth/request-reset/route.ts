/**
 * RESERVO.AI — Request Password Reset (server-side)
 * Envía el email de reset desde el servidor para garantizar que:
 * - La URL de redirect es correcta
 * - El rate limit se aplica por IP
 * - No depende de variables de entorno del cliente
 */
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { rateLimitByIp } from '@/lib/rate-limit'
import { sanitizeEmail } from '@/lib/sanitize'
import { logger } from '@/lib/logger'

export async function POST(req: Request) {
  // Rate limit estricto: 3 intentos cada 15 minutos
  const rl = rateLimitByIp(req, { limit: 3, windowSeconds: 900 }, 'auth:request-reset')
  if (rl.blocked) return rl.response

  try {
    const body = await req.json()
    const email = sanitizeEmail(body.email)

    if (!email) {
      return NextResponse.json({ error: 'Email no válido' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Usar la URL del servidor (siempre disponible, no depende del cliente)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
      || `https://${req.headers.get('host')}`

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/reset`,
    })

    if (error) {
      logger.warn('Password reset request failed', { email: email.slice(0, 3) + '***', error: error.message })
      // No revelar si el email existe o no (seguridad)
      return NextResponse.json({ success: true })
    }

    logger.info('Password reset email sent', { email: email.slice(0, 3) + '***' })

    // Siempre devolver success (no revelar si el email existe)
    return NextResponse.json({ success: true })
  } catch (e) {
    logger.error('Request reset error', {}, e)
    return NextResponse.json({ success: true }) // No revelar errores internos
  }
}
