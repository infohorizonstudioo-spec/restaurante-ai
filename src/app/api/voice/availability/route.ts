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
    const [{ data: zones }, { data: tables }, { data: reservas }] = await Promise.all([
      admin.from('zones').select('*').eq('tenant_id', tenant_id).eq('active', true),
      admin.from('tables').select('*').eq('tenant_id', tenant_id),
      admin.from('reservations')
        .select('table_id,zone_id,people')
        .eq('tenant_id', tenant_id)
        .eq('date', date)
        .eq('time', time)
        .in('status', ['confirmed','pending','confirmada','pendiente']),
    ])
    if (!tables?.length) {
      return NextResponse.json({ available: true, message: 'Disponible el '+date+' a las '+time+' para '+ps+' persona'+(ps!==1?'s':'')+'.', tables_available: 0, zones: [] })
    }
    const reservedIds = new Set((reservas||[]).map(r => r.table_id).filter(Boolean))
    let free = tables.filter(m => !reservedIds.has(m.id) && (m.capacity||0) >= ps)
    if (!free.length) {
      const totalOcup = reservas?.length || 0
      return NextResponse.json({ available: false, message: 'No hay disponibilidad el '+date+' a las '+time+' para '+ps+' persona'+(ps!==1?'s':'')+'. Hay '+totalOcup+' reserva'+(totalOcup!==1?'s':'')+' en ese horario.', tables_available: 0 })
    }
    let zoneInfo = ''
    if (zone_name && zones?.length) {
      const zn = zone_name.toLowerCase()
      const zona = zones.find(z => z.name?.toLowerCase().includes(zn) || zn.includes(z.name?.toLowerCase()))
      if (zona) {
        const freeInZone = free.filter(m => m.zone_id === zona.id)
        if (freeInZone.length) {
          zoneInfo = ' en '+zona.name
          free = freeInZone
        } else {
          zoneInfo = ' ('+zona.name+' sin disponibilidad, asignando otra zona)'
        }
      }
    }
    const zonasList = zones?.length ? zones.map(z => {
      const f = free.filter(m => m.zone_id === z.id).length
      return z.name+(f>0?' ('+f+' mesas)':' (lleno)')
    }).join(', ') : ''
    return NextResponse.json({
      available: true,
      message: 'Disponible el '+date+' a las '+time+' para '+ps+' persona'+(ps!==1?'s':'')+zoneInfo+'. '+free.length+' mesa'+(free.length!==1?'s':'')+' libre'+(free.length!==1?'s':'')+''+(zonasList?' — '+zonasList:'')+'.',
      tables_available: free.length,
      zones: zones?.map(z => z.name) || [],
    })
  } catch(e:any) {
    console.error('availability error:', e)
    return NextResponse.json({ available: false, message: 'Error al verificar disponibilidad.' }, { status: 500 })
  }
}