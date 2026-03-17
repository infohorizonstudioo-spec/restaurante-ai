import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function assignBestTable(tenantId: string, date: string, time: string, partySize: number, zonePreference?: string) {
  const [{ data: zones }, { data: tables }, { data: reservas }] = await Promise.all([
    admin.from('zones').select('*').eq('tenant_id', tenantId).eq('active', true),
    admin.from('tables').select('*').eq('tenant_id', tenantId),
    admin.from('reservations').select('table_id,zone_id')
      .eq('tenant_id', tenantId)
      .eq('date', date)
      .eq('time', time)
      .in('status', ['confirmed','pending','confirmada','pendiente']),
  ])
  if (!tables?.length) return null
  const reservedIds = new Set((reservas||[]).map(r => r.table_id).filter(Boolean))
  let candidates = tables.filter(m => !reservedIds.has(m.id) && (m.capacity||0) >= partySize)
  if (zonePreference && zones?.length) {
    const zn = zonePreference.toLowerCase()
    const zona = zones.find(z => z.name?.toLowerCase().includes(zn) || zn.includes(z.name?.toLowerCase()))
    if (zona) {
      const enZona = candidates.filter(m => m.zone_id === zona.id)
      if (enZona.length) candidates = enZona
    }
  }
  if (!candidates.length) return null
  candidates.sort((a,b) => (a.capacity||0) - (b.capacity||0))
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

    // Crear/actualizar cliente
    let customerId: string | null = null
    if (customer_phone) {
      const { data: existing } = await admin.from('customers')
        .select('id,total_reservations').eq('tenant_id', tenant_id).eq('phone', customer_phone).maybeSingle()
      if (existing) {
        await admin.from('customers').update({
          name: customer_name,
          total_reservations: (existing.total_reservations||0)+1,
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

    const notaFull = [notes, assignment?.zone ? 'Zona: '+assignment.zone.name : zone_preference ? 'Preferencia: '+zone_preference : ''].filter(Boolean).join(' | ')

    // Insertar reserva — usando AMBOS nombres de columna para compatibilidad
    const { data: reservation, error } = await admin.from('reservations').insert({
      tenant_id,
      customer_id: customerId,
      customer_name,
      customer_phone,
      // columnas reales
      date: reservation_date,
      time: reservation_time,
      people: ps,
      // columnas alias (el trigger las sincroniza pero las ponemos igual)
      reservation_date,
      reservation_time,
      party_size: ps,
      table_id: assignment?.table?.id || null,
      table_name: assignment?.table?.table_name || assignment?.table?.name || null,
      zone_id: assignment?.zone?.id || null,
      notes: notaFull || null,
      status: 'confirmada',
      source: 'voice_agent',
    }).select().single()

    if (error) throw error

    // Actualizar llamada con resumen
    const summary = ['Reserva: '+customer_name, reservation_date+' '+reservation_time, ps+'p',
      assignment ? 'Mesa '+(assignment.table.table_name||assignment.table.name)+' ('+(assignment.zone?.name||'sin zona')+')' : null,
      notes||null].filter(Boolean).join(' · ')

    admin.from('calls').update({ summary, action_suggested: 'Reserva creada', status: 'completed' })
      .eq('tenant_id', tenant_id).eq('status', 'in-progress')
      .order('started_at', { ascending: false }).limit(1).catch(()=>{})

    const tableInfo = assignment
      ? 'Mesa '+(assignment.table.table_name||assignment.table.name)+' en '+(assignment.zone?.name||'el local')
      : zone_preference ? '(zona '+zone_preference+')' : '(sin mesa específica)'

    return NextResponse.json({
      success: true,
      reservation_id: reservation.id,
      message: 'Reserva confirmada para '+customer_name+' el '+reservation_date+' a las '+reservation_time+', '+ps+' persona'+(ps!==1?'s':'')+'. '+tableInfo+'. Hasta pronto!',
      details: { customer_name, date: reservation_date, time: reservation_time, party_size: ps, table_name: assignment?.table?.table_name||null, zone_name: assignment?.zone?.name||zone_preference||null }
    })
  } catch (e:any) {
    console.error('Reservation error:', e)
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}