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
      return NextResponse.json({ available: false, message: 'Faltan datos.' }, { status: 400 })
    }
    const ps = parseInt(String(party_size))

    // Verificar que el tenant existe
    const { data: tenant } = await admin.from('tenants').select('id').eq('id', tenant_id).maybeSingle()
    if (!tenant) {
      return NextResponse.json({ available: false, message: 'Negocio no encontrado.' }, { status: 404 })
    }

    const [{ data: zones }, { data: tables }, { data: existing }] = await Promise.all([
      admin.from('zones').select('*').eq('tenant_id', tenant_id).eq('active', true),
      admin.from('tables').select('*').eq('tenant_id', tenant_id),
      admin.from('reservations').select('table_id,people')
        .eq('tenant_id', tenant_id).eq('date', date).eq('time', time)
        .in('status', ['confirmada','confirmed','pendiente','pending']),
    ])

    // Sin mesas configuradas → disponible siempre (negocio sin gestión de mesas)
    if (!tables?.length) {
      return NextResponse.json({ available: true, message: 'Disponible el ' + date + ' a las ' + time + '.', tables_available: 99 })
    }

    const reservedIds = new Set((existing||[]).map(r => r.table_id).filter(Boolean))
    // capacity null/0 = sin límite configurado → acepta cualquier tamaño
    let free = tables.filter(t => !reservedIds.has(t.id) && (t.capacity == null || t.capacity === 0 || t.capacity >= ps))

    // Si no hay mesas con suficiente capacidad individual, ver si la suma libre cubre al grupo
    if (!free.length) {
      const freeAny = tables.filter(t => !reservedIds.has(t.id))
      const totalCap = freeAny.reduce((s,t) => s + (t.capacity||4), 0)
      if (totalCap >= ps) {
        // Hay capacidad total aunque no en una sola mesa
        free = freeAny
      }
    }

    if (!free.length) {
      const ocu = existing?.length || 0
      return NextResponse.json({ available: false, message: 'No hay disponibilidad el ' + date + ' a las ' + time + ' para ' + ps + ' persona' + (ps!==1?'s':'') + '. Hay ' + ocu + ' reserva' + (ocu!==1?'s':'') + ' en ese horario.', tables_available: 0 })
    }

    let zoneInfo = ''
    if (zone_name && zones?.length) {
      const zn = zone_name.toLowerCase()
      const zona = zones.find(z => z.name?.toLowerCase().includes(zn) || zn.includes(z.name?.toLowerCase()))
      if (zona) {
        const inZone = free.filter(t => t.zone === zona.id)
        if (inZone.length) { zoneInfo = ' en ' + zona.name; free = inZone }
        else zoneInfo = ' (' + zona.name + ' sin disponibilidad, asignando otra zona)'
      }
    }

    const zonasList = zones?.length ? zones.map(z => {
      const f = free.filter(t => t.zone === z.id).length
      return z.name + (f > 0 ? ' (' + f + ' mesas)' : ' (lleno)')
    }).join(', ') : ''

    return NextResponse.json({
      available: true,
      message: 'Disponible el ' + date + ' a las ' + time + ' para ' + ps + ' persona' + (ps!==1?'s':'') + zoneInfo + '. ' + free.length + ' mesa' + (free.length!==1?'s':'') + ' libre' + (free.length!==1?'s':'') + (zonasList ? ' — ' + zonasList : '') + '.',
      tables_available: free.length,
      zones: zones?.map(z => z.name) || [],
    })
  } catch(e: any) {
    console.error('availability error:', e)
    return NextResponse.json({ available: false, message: 'Error al verificar disponibilidad.' }, { status: 500 })
  }
}