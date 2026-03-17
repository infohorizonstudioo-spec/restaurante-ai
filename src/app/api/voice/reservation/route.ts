import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function assignBestTable(
  tenantId: string,
  date: string,
  time: string,
  partySize: number,
  zonePreference?: string
): Promise<{ table: any; zone: any } | null> {
  const [{ data: zones }, { data: tables }, { data: reservas }] = await Promise.all([
    admin.from('zones').select('*').eq('tenant_id', tenantId).eq('active', true),
    admin.from('tables').select('*').eq('tenant_id', tenantId),
    admin.from('reservations').select('table_id')
      .eq('tenant_id', tenantId)
      .eq('reservation_date', date)
      .eq('reservation_time', time)
      .in('status', ['confirmada', 'pendiente']),
  ])

  if (!tables || tables.length === 0) return null

  const reservedIds = new Set((reservas || []).map(r => r.table_id).filter(Boolean))
  let candidates = tables.filter(m => !reservedIds.has(m.id) && m.capacity >= partySize)

  // Priorizar zona si la pide
  if (zonePreference && zones && zones.length > 0) {
    const zn = zonePreference.toLowerCase()
    const zona = zones.find(z => z.name.toLowerCase().includes(zn) || zn.includes(z.name.toLowerCase()))
    if (zona) {
      const enZona = candidates.filter(m => m.zone_id === zona.id)
      if (enZona.length > 0) candidates = enZona
    }
  }

  if (candidates.length === 0) return null

  // Elegir la mesa con capacidad mínima suficiente (mejor ajuste)
  candidates.sort((a, b) => a.capacity - b.capacity)
  const table = candidates[0]
  const zone = zones?.find(z => z.id === table.zone_id) || null

  return { table, zone }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      tenant_id, customer_name, customer_phone = '',
      reservation_date, reservation_time, party_size,
      zone_preference = '', notes = '',
    } = body

    if (!tenant_id || !customer_name || !reservation_date || !reservation_time || !party_size) {
      return NextResponse.json({ success: false, error: 'Faltan datos obligatorios.' }, { status: 400 })
    }

    const ps = parseInt(String(party_size))

    // Intentar asignar mesa automáticamente
    const assignment = await assignBestTable(tenant_id, reservation_date, reservation_time, ps, zone_preference)

    // Crear o actualizar cliente
    let customerId: string | null = null
    if (customer_phone) {
      const { data: existing } = await admin.from('customers')
        .select('id, total_reservations').eq('tenant_id', tenant_id).eq('phone', customer_phone).maybeSingle()
      if (existing) {
        await admin.from('customers').update({
          name: customer_name,
          total_reservations: (existing.total_reservations || 0) + 1,
          last_visit: reservation_date,
        }).eq('id', existing.id)
        customerId = existing.id
      } else {
        const { data: newC } = await admin.from('customers').insert({
          tenant_id, name: customer_name, phone: customer_phone,
          total_reservations: 1, last_visit: reservation_date,
        }).select('id').single()
        customerId = newC?.id || null
      }
    }

    // Construir notas completas
    const notaCompleta = [
      notes,
      assignment?.zone ? `Zona: ${assignment.zone.name}` : zone_preference ? `Preferencia zona: ${zone_preference}` : '',
    ].filter(Boolean).join(' | ')

    // Crear reserva
    const { data: reservation, error } = await admin.from('reservations').insert({
      tenant_id,
      customer_id: customerId,
      customer_name,
      customer_phone,
      reservation_date,
      reservation_time,
      party_size: ps,
      table_id:   assignment?.table?.id || null,
      table_name: assignment?.table?.name || null,
      zone_id:    assignment?.zone?.id || null,
      notes:      notaCompleta || null,
      status:     'confirmada',
      source:     'voice_agent',
    }).select().single()

    if (error) throw error

    // Actualizar call con resumen
    const summary = [
      `Reserva: ${customer_name}`,
      `${reservation_date} a las ${reservation_time}`,
      `${ps} persona${ps !== 1 ? 's' : ''}`,
      assignment ? `Mesa ${assignment.table.name} (${assignment.zone?.name || 'sin zona'})` : null,
      notes ? `Notas: ${notes}` : null,
    ].filter(Boolean).join(' · ')

    await admin.from('calls')
      .update({ summary, action_suggested: 'Reserva creada', status: 'completed' })
      .eq('tenant_id', tenant_id)
      .eq('status', 'in-progress')
      .order('created_at', { ascending: false })
      .limit(1)
      .catch(() => {})

    // Respuesta con toda la info
    const tableInfo = assignment
      ? `Mesa ${assignment.table.name} en ${assignment.zone?.name || 'el local'}`
      : zone_preference
        ? `(sin mesa específica, zona ${zone_preference})`
        : '(sin asignación de mesa específica)'

    return NextResponse.json({
      success: true,
      reservation_id: reservation.id,
      message: `Reserva confirmada para ${customer_name} el ${reservation_date} a las ${reservation_time}, ${ps} persona${ps !== 1 ? 's' : ''}. ${tableInfo}. ¡Hasta pronto!`,
      details: {
        customer_name,
        date: reservation_date,
        time: reservation_time,
        party_size: ps,
        table_name: assignment?.table?.name || null,
        zone_name:  assignment?.zone?.name || zone_preference || null,
        notes: notes || null,
      }
    })
  } catch (e: any) {
    console.error('Reservation error:', e)
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}