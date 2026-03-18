import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ─────────────────────────────────────────────────────────────────────────────
// RESERVAS: asignación atómica de mesas via RPC.
//
// assign_table_atomic usa SELECT FOR UPDATE SKIP LOCKED:
// - Si 5 llamadas intentan reservar a las 21:00 simultáneamente,
//   cada una obtiene una mesa diferente sin colisión.
// - SKIP LOCKED permite que llamadas concurrentes no se bloqueen
//   entre sí — cada una salta a la siguiente mesa disponible.
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      tenant_id, customer_name, customer_phone = '',
      reservation_date, reservation_time, party_size,
      zone_preference = '', notes = ''
    } = body

    if (!tenant_id || !customer_name || !reservation_date || !reservation_time || !party_size) {
      return NextResponse.json({ success: false, error: 'Faltan datos obligatorios.' }, { status: 400 })
    }
    const ps = parseInt(String(party_size))

    // Upsert cliente — idempotente por phone
    let customerId: string | null = null
    if (customer_phone) {
      const { data: existing } = await admin.from('customers')
        .select('id,total_reservations')
        .eq('tenant_id', tenant_id).eq('phone', customer_phone).maybeSingle()
      if (existing) {
        await admin.from('customers').update({
          name: customer_name,
          total_reservations: ((existing as any).total_reservations||0) + 1,
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

    // Asignación atómica de mesa via RPC (SELECT FOR UPDATE SKIP LOCKED)
    // Garantiza que llamadas concurrentes no asignen la misma mesa
    const { data: assignment, error: aErr } = await admin.rpc('assign_table_atomic', {
      p_tenant_id:  tenant_id,
      p_date:       reservation_date,
      p_time:       reservation_time,
      p_party_size: ps,
      p_zone_pref:  zone_preference || null,
    })

    if (aErr) console.error('assign_table_atomic error:', aErr.message)

    const tableId   = (assignment as any)?.table_id   || null
    const tableNum  = (assignment as any)?.table_number || null
    const zoneId    = (assignment as any)?.zone_id     || null
    const zoneName  = (assignment as any)?.zone_name   || zone_preference || null

    const notaFull = [notes, zoneName ? 'Zona: '+zoneName : ''].filter(Boolean).join(' | ')

    const { data: reservation, error } = await admin.from('reservations').insert({
      tenant_id,
      customer_id:   customerId,
      customer_name,
      customer_phone,
      date:          reservation_date,
      time:          reservation_time,
      people:        ps,
      table_id:      tableId,
      zone_id:       zoneId,
      zone:          zoneId || null,
      notes:         notaFull || null,
      status:        'confirmada',
      source:        'voice_agent',
    }).select().single()

    if (error) throw error

    const tableInfo = tableNum
      ? 'Mesa '+tableNum+(zoneName?' en '+zoneName:'')
      : (zoneName ? 'zona '+zoneName : '')

    return NextResponse.json({
      success: true,
      reservation_id: (reservation as any).id,
      message: 'Reserva confirmada para '+customer_name+' el '+reservation_date
        +' a las '+reservation_time+', '+ps+' persona'+(ps!==1?'s':'')
        +(tableInfo?'. '+tableInfo:'')+'. Hasta pronto!',
      details: {
        customer_name,
        date:         reservation_date,
        time:         reservation_time,
        party_size:   ps,
        table_number: tableNum,
        zone_name:    zoneName,
      }
    })
  } catch (e: any) {
    console.error('Reservation error:', e.message)
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
