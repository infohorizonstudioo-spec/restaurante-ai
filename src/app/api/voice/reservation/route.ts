import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function assignBestTable(tenantId: string, date: string, time: string, partySize: number, zonePreference?: string) {
  const [{ data: zones }, { data: tables }, { data: existing }] = await Promise.all([
    admin.from('zones').select('*').eq('tenant_id', tenantId).eq('active', true),
    admin.from('tables').select('*').eq('tenant_id', tenantId),
    admin.from('reservations').select('table_id,zone_id,zone')
      .eq('tenant_id', tenantId).eq('date', date).eq('time', time)
      .in('status', ['confirmada','confirmed','pendiente','pending']),
  ])
  if (!tables?.length) return null
  const reservedIds = new Set((existing||[]).map(r => r.table_id).filter(Boolean))
  let candidates = tables.filter(t => {
    const cap = t.capacity || 0
    const reserved = reservedIds.has(t.id)
    return !reserved && cap >= partySize
  })
  if (zonePreference && zones?.length) {
    const zn = zonePreference.toLowerCase()
    const zona = zones.find(z => z.name?.toLowerCase().includes(zn) || zn.includes(z.name?.toLowerCase()))
    if (zona) {
      const inZone = candidates.filter(t => t.zone === zona.id)
      if (inZone.length) candidates = inZone
    }
  }
  if (!candidates.length) return null
  candidates.sort((a, b) => (a.capacity||0) - (b.capacity||0))
  const table = candidates[0]
  const zone = zones?.find(z => z.id === table.zone) || null
  return { table, zone }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { tenant_id, customer_name, customer_phone = '',
      reservation_date, reservation_time, party_size,
      zone_preference = '', notes = '' } = body

    if (!tenant_id || !customer_name || !reservation_date || !reservation_time || !party_size) {
      return NextResponse.json({ success: false, error: 'Faltan datos obligatorios.' }, { status: 400 })
    }
    const ps = parseInt(String(party_size))

    // Crear/actualizar cliente
    let customerId: string | null = null
    if (customer_phone) {
      const { data: existing } = await admin.from('customers')
        .select('id,total_reservations').eq('tenant_id', tenant_id).eq('phone', customer_phone).maybeSingle()
      if (existing) {
        await admin.from('customers').update({
          name: customer_name,
          total_reservations: (existing.total_reservations||0) + 1,
          last_visit: reservation_date,
        }).eq('id', existing.id)
        customerId = existing.id
      } else {
        const { data: nc } = await admin.from('customers').insert({
          tenant_id, name: customer_name, phone: customer_phone,
          total_reservations: 1, last_visit: reservation_date,
        }).select('id').single()
        customerId = nc?.id || null
      }
    }

    // Asignar mesa
    const assignment = await assignBestTable(tenant_id, reservation_date, reservation_time, ps, zone_preference)

    const notaFull = [notes, assignment?.zone ? 'Zona: '+assignment.zone.name : zone_preference ? 'Preferencia: '+zone_preference : '']
      .filter(Boolean).join(' | ')

    // Insertar reserva con valores correctos de la DB
    const { data: reservation, error } = await admin.from('reservations').insert({
      tenant_id,
      customer_id:   customerId,
      customer_name,
      customer_phone,
      date:          reservation_date,
      time:          reservation_time,
      people:        ps,
      table_id:      assignment?.table?.id || null,
      zone_id:       assignment?.zone?.id || null,
      zone:          assignment?.zone?.id || (zone_preference ? zone_preference : null),
      notes:         notaFull || null,
      status:        'confirmada',
      source:        'voice_agent',
    }).select().single()

    if (error) {
      console.error('Reservation insert error:', error)
      throw error
    }

    // Actualizar call con resumen
    admin.from('calls').update({
      summary: customer_name + ' ' + reservation_date + ' ' + reservation_time + ' ' + ps + 'p' + (assignment ? ' ' + (assignment.zone?.name||'') : ''),
      action_suggested: 'Reserva creada',
      status: 'completed'
    }).eq('tenant_id', tenant_id).eq('status', 'in-progress')
      .order('started_at', { ascending: false }).limit(1).catch(() => {})

    const tableInfo = assignment
      ? 'Mesa ' + assignment.table.number + ' en ' + (assignment.zone?.name || 'el local')
      : zone_preference ? '(zona ' + zone_preference + ')' : ''

    return NextResponse.json({
      success: true,
      reservation_id: reservation.id,
      message: 'Reserva confirmada para ' + customer_name + ' el ' + reservation_date + ' a las ' + reservation_time + ', ' + ps + ' persona' + (ps !== 1 ? 's' : '') + '. ' + tableInfo + ' Hasta pronto!',
      details: { customer_name, date: reservation_date, time: reservation_time, party_size: ps, table_number: assignment?.table?.number || null, zone_name: assignment?.zone?.name || zone_preference || null }
    })
  } catch (e: any) {
    console.error('Reservation error:', e)
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}