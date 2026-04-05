import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimitByIp } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const PUBLIC_RESERVE_LIMIT = { limit: 3, windowSeconds: 60 }

export async function POST(req: Request) {
  try {
    // Rate limit: 3 per minute per IP
    const rl = rateLimitByIp(req, PUBLIC_RESERVE_LIMIT, 'public-reserve')
    if (rl.blocked) return rl.response

    const body = await req.json()
    const { slug, name, phone, date, time, party_size } = body

    if (!slug || !name || !phone || !date || !time || !party_size) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
    }

    // Validate inputs
    const cleanName = String(name).trim().slice(0, 100)
    const cleanPhone = String(phone).trim().slice(0, 20)
    const cleanDate = String(date).trim().slice(0, 10)
    const cleanTime = String(time).trim().slice(0, 5)
    const cleanParty = Math.min(Math.max(parseInt(String(party_size)) || 1, 1), 50)

    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
      return NextResponse.json({ error: 'Formato de fecha invalido' }, { status: 400 })
    }
    if (!/^\d{2}:\d{2}$/.test(cleanTime)) {
      return NextResponse.json({ error: 'Formato de hora invalido' }, { status: 400 })
    }

    // Find tenant by slug (include business_hours for validation)
    const { data: tenant } = await admin
      .from('tenants')
      .select('id, name, business_hours')
      .eq('slug', slug)
      .maybeSingle()

    if (!tenant) {
      return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
    }

    // Validate time against business hours
    if (tenant.business_hours) {
      const dayNames = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab']
      const reservationDate = new Date(cleanDate + 'T12:00:00')
      const dayKey = dayNames[reservationDate.getDay()]
      const dayHours = (tenant.business_hours as Record<string, string>)[dayKey]

      if (!dayHours || dayHours === 'cerrado') {
        return NextResponse.json({ error: 'El negocio est\u00e1 cerrado ese d\u00eda' }, { status: 400 })
      }

      // Parse hours "12:00-23:00" format
      const parts = dayHours.split('-')
      if (parts.length === 2) {
        const openTime = parts[0].trim()
        const closeTime = parts[1].trim()
        if (cleanTime < openTime || cleanTime >= closeTime) {
          return NextResponse.json({ error: `Horario disponible: ${openTime} - ${closeTime}` }, { status: 400 })
        }
      }
    }

    // Validate date is not in the past
    const todayStr = new Date().toISOString().slice(0, 10)
    if (cleanDate < todayStr) {
      return NextResponse.json({ error: 'No se puede reservar en una fecha pasada' }, { status: 400 })
    }

    // Create or find customer
    let customerId: string | null = null
    const { data: existing } = await admin
      .from('customers')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('phone', cleanPhone)
      .maybeSingle()

    if (existing) {
      customerId = existing.id
    } else {
      const { data: newCust } = await admin
        .from('customers')
        .insert({ tenant_id: tenant.id, name: cleanName, phone: cleanPhone, source: 'web' })
        .select('id')
        .maybeSingle()
      customerId = newCust?.id || null
    }

    // Create reservation with status pendiente
    const { data: reservation, error } = await admin
      .from('reservations')
      .insert({
        tenant_id: tenant.id,
        customer_id: customerId,
        customer_name: cleanName,
        customer_phone: cleanPhone,
        date: cleanDate,
        time: cleanTime,
        party_size: cleanParty,
        status: 'pendiente',
        source: 'web',
        notes: 'Reserva desde enlace publico',
      })
      .select('id')
      .maybeSingle()

    if (error) {
      logger.error('Public reservation error', {}, error as any)
      return NextResponse.json({ error: 'Error al crear la reserva' }, { status: 500 })
    }

    // Create notification for the business owner
    try {
      await admin.from('notifications').insert({
        tenant_id: tenant.id,
        type: 'reservation',
        title: 'Nueva reserva web',
        body: `${cleanName} - ${cleanParty} personas - ${cleanDate} ${cleanTime}`,
        priority: 'info',
        data: { reservation_id: reservation?.id },
      })
    } catch { /* non-critical */ }

    return NextResponse.json({ ok: true, reservation_id: reservation?.id })
  } catch (e: unknown) {
    logger.error('Public reservation error', {}, e as any)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
