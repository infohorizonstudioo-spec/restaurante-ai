import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { validateAgentKey } from '@/lib/agent-auth'
import { sanitizeString, sanitizeName, sanitizePhone, sanitizeDate, sanitizeTime, sanitizePositiveInt, sanitizeUUID } from '@/lib/sanitize'
import { logger } from '@/lib/logger'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ─────────────────────────────────────────────────────────────────────────────
// create_reservation_atomic hace TODO en una transacción:
//   1. SELECT FOR UPDATE SKIP LOCKED → bloquea la mesa
//   2. INSERT reservations → mientras el lock está activo
//
// Esto garantiza que 5 llamadas simultáneas a las 21:00 obtengan
// 5 mesas distintas. El lock se libera al hacer commit, no antes.
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const rl = rateLimitByIp(req, RATE_LIMITS.agent, 'voice:reservation')
    if (rl.blocked) return rl.response

    if (!validateAgentKey(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const body = await req.json()
    const tenant_id = sanitizeUUID(body.tenant_id)
    const customer_name = sanitizeName(body.customer_name) || body.customer_name
    const customer_phone = sanitizePhone(body.customer_phone) || ''
    const reservation_date = sanitizeDate(body.reservation_date) || body.reservation_date
    const reservation_time = sanitizeTime(body.reservation_time) || body.reservation_time
    const party_size = body.party_size
    const zone_preference = sanitizeString(body.zone_preference || '', 100)
    const notes = sanitizeString(body.notes || '', 500)

    if (!tenant_id || !customer_name || !reservation_date || !reservation_time || !party_size) {
      return NextResponse.json({ success: false, error: 'Faltan datos obligatorios.' }, { status: 400 })
    }
    const ps = parseInt(String(party_size))

    // Upsert cliente — independiente de la transacción de mesa
    let customerId: string | null = null
    if (customer_phone) {
      const { data: existing } = await admin.from('customers')
        .select('id,total_reservations')
        .eq('tenant_id', tenant_id).eq('phone', customer_phone).maybeSingle()
      if (existing) {
        await admin.from('customers').update({
          name: customer_name,
          total_reservations: ((existing as any).total_reservations || 0) + 1,
          last_visit: reservation_date,
        }).eq('id', (existing as any).id)
        customerId = (existing as any).id
      } else {
        const { data: nc } = await admin.from('customers').insert({
          tenant_id, name: customer_name, phone: customer_phone,
          total_reservations: 1, last_visit: reservation_date,
        }).select('id').single()
        customerId = (nc as any)?.id || null
      }
    }

    // Una sola RPC atómica: asigna mesa + inserta reserva en la misma TX
    const { data: result, error } = await admin.rpc('create_reservation_atomic', {
      p_tenant_id:      tenant_id,
      p_date:           reservation_date,
      p_time:           reservation_time,
      p_party_size:     ps,
      p_customer_name:  customer_name,
      p_customer_phone: customer_phone || '',
      p_customer_id:    customerId || null,
      p_zone_pref:      zone_preference || null,
      p_notes:          notes || null,
    })

    if (error) throw error

    const r = result as any
    const tableInfo = r.table_number
      ? 'Mesa ' + r.table_number + (r.zone_name ? ' en ' + r.zone_name : '')
      : (zone_preference ? 'zona ' + zone_preference : '')

    return NextResponse.json({
      success: true,
      reservation_id: r.reservation_id,
      message: 'Reserva confirmada para ' + customer_name + ' el ' + reservation_date
        + ' a las ' + reservation_time + ', ' + ps + ' persona' + (ps !== 1 ? 's' : '')
        + (tableInfo ? '. ' + tableInfo : '') + '. ¡Hasta pronto!',
      details: {
        customer_name,
        date:         reservation_date,
        time:         reservation_time,
        party_size:   ps,
        table_number: r.table_number || null,
        zone_name:    r.zone_name || zone_preference || null,
      }
    })
  } catch (e: any) {
    logger.error('Voice reservation error', {}, e)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
