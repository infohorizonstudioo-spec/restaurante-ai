import { createClient } from '@supabase/supabase-js'
import { NextResponse, NextRequest } from 'next/server'

// Rate limiting en memoria — máx 5 registros por IP en 15 minutos
const registrationAttempts = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 5
const RATE_WINDOW_MS = 15 * 60 * 1000

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const record = registrationAttempts.get(ip)
  if (!record || now > record.resetAt) {
    registrationAttempts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (record.count >= RATE_LIMIT) return false
  record.count++
  return true
}

export async function POST(req: NextRequest) {
  try {
    // Rate limiting por IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: 'Demasiados intentos. Espera 15 minutos.' }, { status: 429 })
    }

    const { businessName, businessType, email, password, phone, name } = await req.json()
    if (!businessName || !email || !password)
      return NextResponse.json({ error: 'Nombre, email y contraseña son obligatorios' }, { status: 400 })
    if (password.length < 8)
      return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })

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
        email, phone: phone || null,
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
      return NextResponse.json({ error: 'Internal server error' }, { status: 400 })
    }

    await admin.from('profiles').update({
      tenant_id: tenant.id,
      role: 'client',
      name: name || businessName,
      full_name: name || businessName,
      email: email.trim().toLowerCase(),
    }).eq('id', userData.user.id)
    return NextResponse.json({ success: true, tenantId: tenant.id, slug })
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}