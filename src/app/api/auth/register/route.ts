import { createClient } from '@supabase/supabase-js'
import { NextResponse, NextRequest } from 'next/server'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { sanitizeEmail, sanitizeName, sanitizeString, sanitizePhone } from '@/lib/sanitize'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  try {
    // Rate limiting por IP
    const rl = rateLimitByIp(req, RATE_LIMITS.auth, 'auth:register')
    if (rl.blocked) return rl.response

    const body = await req.json()
    const businessName = sanitizeString(body.businessName, 200)
    const businessType = sanitizeString(body.businessType, 50)
    const email = sanitizeEmail(body.email)
    const password = body.password
    const phone = sanitizePhone(body.phone)
    const name = sanitizeName(body.name)

    if (!businessName || !email || !password) {
      logger.warn('Register: missing fields', { email: email || 'empty' })
      return NextResponse.json({ error: 'Nombre, email y contraseña son obligatorios' }, { status: 400 })
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return NextResponse.json({ error: 'La contraseña debe tener entre 8 y 128 caracteres' }, { status: 400 })
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const slug = businessName.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      + '-' + Date.now().toString(36)

    const { data: tenant, error: tenantError } = await admin
      .from('tenants')
      .insert({
        name: businessName, slug, type: businessType || 'restaurante',
        email, phone: phone || null as string | null,
        plan: 'trial', active: true,
        free_calls_limit: 10, free_calls_used: 0,
        onboarding_complete: false, onboarding_step: 1,
      })
      .select().single()
    if (tenantError) return NextResponse.json({ error: 'Internal server error' }, { status: 400 })

    const { data: userData, error: userError } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { name: businessName, role: 'client' }
    })
    if (userError) {
      await admin.from('tenants').delete().eq('id', tenant.id)
      const msg = userError.message?.toLowerCase() || ''
      if (msg.includes('already') || msg.includes('duplicate') || msg.includes('exists') || msg.includes('unique')) {
        return NextResponse.json({ error: 'Este email ya tiene una cuenta. Inicia sesión o restablece tu contraseña.' }, { status: 409 })
      }
      logger.error('Register: createUser failed', { error: userError.message })
      return NextResponse.json({ error: 'Error al crear la cuenta. Inténtalo de nuevo.' }, { status: 400 })
    }

    await admin.from('profiles').update({
      tenant_id: tenant.id,
      role: 'client',
      name: name || businessName,
      full_name: name || businessName,
      email: email.trim().toLowerCase(),
    }).eq('id', userData.user.id)
    logger.info('Register: new tenant created', { tenantId: tenant.id, slug })
    return NextResponse.json({ success: true, tenantId: tenant.id, slug })
  } catch (e: any) {
    logger.error('Register: unexpected error', {}, e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}