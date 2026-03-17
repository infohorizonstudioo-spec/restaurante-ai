import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: Request) {
  try {
    const { tenant_id, date, time, party_size, zone_name } = await req.json()

    if (!tenant_id || !date || !time || !party_size) {
      return NextResponse.json({ available: false, message: 'Faltan datos para comprobar disponibilidad.' }, { status: 400 })
    }

    // Carga zonas y mesas activas
    const [{ data: zones }, { data: tables }, { data: reservas }] = await Promise.all([
      admin.from('zones').select('*').eq('tenant_id', tenant_id).eq('active', true),
      admin.from('tables').select('*').eq('tenant_id', tenant_id),
      admin.from('reservations').select('*')
        .eq('tenant_id', tenant_id)
        .eq('reservation_date', date)
        .eq('reservation_time', time)
        .in('status', ['confirmada', 'pendiente']),
    ])

    if (!tables || tables.length === 0) {
      // Sin mesas configuradas → disponible (sin asignación específica)
      return NextResponse.json({
        available: true,
        message: `Hay disponibilidad el ${date} a las ${time} para ${party_size} personas.`,
        tables_available: [],
        zone_info: 'El local no tiene zonas configuradas aún.',
      })
    }

    // IDs de mesas ya reservadas en ese slot
    const reservedTableIds = new Set((reservas || []).map(r => r.table_id).filter(Boolean))

    // Filtra mesas libres con capacidad suficiente
    let mesasLibres = tables.filter(m =>
      !reservedTableIds.has(m.id) &&
      m.capacity >= Number(party_size)
    )

    // Si pide zona específica, filtra por zona
    let zonaFiltrada: any = null
    if (zone_name && zones && zones.length > 0) {
      const zn = zone_name.toLowerCase()
      zonaFiltrada = zones.find(z => z.name.toLowerCase().includes(zn) || zn.includes(z.name.toLowerCase()))
      if (zonaFiltrada) {
        const mesasEnZona = mesasLibres.filter(m => m.zone_id === zonaFiltrada.id)
        if (mesasEnZona.length > 0) {
          mesasLibres = mesasEnZona
        } else {
          // No hay en esa zona, informa y ofrece alternativas
          const alternativas = mesasLibres.map(m => {
            const z = zones.find(z => z.id === m.zone_id)
            return z ? z.name : 'sin zona'
          }).filter((v, i, a) => a.indexOf(v) === i)

          return NextResponse.json({
            available: mesasLibres.length > 0,
            message: mesasLibres.length > 0
              ? `No hay disponibilidad en ${zone_name} para ${party_size} personas a las ${time}, pero sí en: ${alternativas.join(', ')}. ¿Le viene bien alguna de estas zonas?`
              : `Lo siento, no hay disponibilidad para ${party_size} personas el ${date} a las ${time}.`,
            tables_available: mesasLibres.slice(0, 3).map(m => ({
              id: m.id, name: m.name, capacity: m.capacity,
              zone_name: zones.find(z => z.id === m.zone_id)?.name || null
            })),
          })
        }
      }
    }

    const available = mesasLibres.length > 0

    return NextResponse.json({
      available,
      message: available
        ? `Sí, hay disponibilidad el ${date} a las ${time} para ${party_size} personas${zonaFiltrada ? ' en ' + zonaFiltrada.name : ''}.`
        : `Lo siento, no hay disponibilidad para ${party_size} personas el ${date} a las ${time}.`,
      tables_available: mesasLibres.slice(0, 5).map(m => ({
        id: m.id, name: m.name, capacity: m.capacity,
        zone_name: zones?.find(z => z.id === m.zone_id)?.name || null,
      })),
      zones_with_availability: zones
        ? [...new Set(mesasLibres.map(m => zones.find(z => z.id === m.zone_id)?.name).filter(Boolean))]
        : [],
    })
  } catch (e: any) {
    console.error('Availability error:', e)
    return NextResponse.json({ available: false, message: 'Error al comprobar disponibilidad.' }, { status: 500 })
  }
}