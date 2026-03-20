import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkSlotAvailability, parseReservationConfig, generateSlots } from '@/lib/scheduling-engine'
import { isHosteleria } from '@/lib/templates'

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

    // Cargar tenant + config
    const { data: tenant } = await admin.from('tenants')
      .select('id,type,reservation_config').eq('id', tenant_id).maybeSingle()
    if (!tenant) {
      return NextResponse.json({ available: false, message: 'Negocio no encontrado.' }, { status: 404 })
    }

    // ── HOSTELERÍA: usar motor de franjas ──────────────────────────────────
    if (isHosteleria(tenant.type || 'otro')) {
      const cfg = parseReservationConfig(tenant.reservation_config)

      const [{ data: zonesData }, { data: tablesData }, { data: resData }] = await Promise.all([
        admin.from('zones').select('id,name').eq('tenant_id', tenant_id).eq('active', true),
        admin.from('tables').select('id,capacity,zone_id,status').eq('tenant_id', tenant_id),
        admin.from('reservations')
          .select('id,time,people,table_id')
          .eq('tenant_id', tenant_id).eq('date', date)
          .in('status', ['confirmada','confirmed','pendiente','pending']),
      ])

      const result = checkSlotAvailability({
        time: time.slice(0,5),
        date,
        party_size: ps,
        zone_name: zone_name || undefined,
        cfg,
        existing_reservations: (resData || []).map((r: any) => ({
          time: r.time?.slice(0,5) || '',
          people: r.people || 1,
          table_id: r.table_id,
        })),
        tables: tablesData || [],
        zones: zonesData || [],
      })

      return NextResponse.json({
        available: result.available,
        message: result.message,
        reason: result.reason,
        alternatives: result.alternatives,
        slot_reservations: result.slot_reservations,
        slot_people: result.slot_people,
        slots_remaining: result.slots_remaining,
        people_remaining: result.people_remaining,
        zone_remaining: result.zone_remaining,
        valid_slots: generateSlots(cfg).slice(0, 16),
        trace: result.trace,
        tables_available: result.available ? (tablesData?.length || 99) : 0,
        zones: (zonesData || []).map((z: any) => z.name),
      })
    }

    // ── OTROS NEGOCIOS: lógica estándar (sin franjas) ──────────────────────
    const [{ data: tables }, { data: existing }] = await Promise.all([
      admin.from('tables').select('*').eq('tenant_id', tenant_id),
      admin.from('reservations').select('table_id,people')
        .eq('tenant_id', tenant_id).eq('date', date).eq('time', time)
        .in('status', ['confirmada','confirmed','pendiente','pending']),
    ])

    if (!tables?.length) {
      return NextResponse.json({ available: true, message: `Disponible el ${date} a las ${time}.`, tables_available: 99 })
    }

    const reservedIds = new Set((existing||[]).map((r: any) => r.table_id).filter(Boolean))
    let free = tables.filter((t: any) => !reservedIds.has(t.id) && (t.capacity == null || t.capacity === 0 || t.capacity >= ps))

    if (!free.length) {
      const freeAny = tables.filter((t: any) => !reservedIds.has(t.id))
      const totalCap = freeAny.reduce((s: number, t: any) => s + (t.capacity||4), 0)
      if (totalCap >= ps) free = freeAny
    }

    if (!free.length) {
      return NextResponse.json({ available: false, message: `Sin disponibilidad el ${date} a las ${time}.`, tables_available: 0 })
    }

    return NextResponse.json({ available: true, message: `Disponible el ${date} a las ${time} para ${ps} personas.`, tables_available: free.length })

  } catch(e: any) {
    console.error('availability error:', e.message)
    return NextResponse.json({ available: false, message: 'Error al verificar disponibilidad.' }, { status: 500 })
  }
}
