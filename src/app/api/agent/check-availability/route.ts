import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { validateAgentKey } from "@/lib/agent-auth"
import { parseReservationConfig, checkSlotAvailability, generateSlots } from "@/lib/scheduling-engine"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    if (!validateAgentKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    const { tenant_id, date, time, party_size, people, zone } = await req.json()
    if (!tenant_id || !date) return NextResponse.json({ error: "tenant_id and date required" }, { status: 400 })
    const size = party_size || people || 2

    // Cargar TODA la info del negocio en paralelo
    const [tenantRes, zonesRes, tablesRes, reservasRes] = await Promise.all([
      supabase.from("tenants").select("reservation_config,type").eq("id", tenant_id).maybeSingle(),
      supabase.from("zones").select("id,name").eq("tenant_id", tenant_id).eq("active", true),
      supabase.from("tables").select("id,zone_id,capacity,status").eq("tenant_id", tenant_id),
      supabase.from("reservations")
        .select("id,time,people,party_size,zone_id,table_id,status")
        .eq("tenant_id", tenant_id).eq("date", date)
        .in("status", ["confirmada", "confirmed", "pendiente", "pending"]),
    ])

    const cfg = parseReservationConfig(tenantRes.data?.reservation_config)
    const zones = zonesRes.data || []
    const tables = tablesRes.data || []
    const existing = (reservasRes.data || []).map(r => ({
      time: r.time || '',
      people: r.people || r.party_size || 1,
      zone_id: r.zone_id,
      table_id: r.table_id,
    }))

    // Si piden una hora específica → verificar esa franja
    if (time) {
      const result = checkSlotAvailability({
        time, date, party_size: size, zone_name: zone,
        cfg, existing_reservations: existing, tables, zones,
      })

      if (result.available) {
        return NextResponse.json({
          success: true,
          available: true,
          message: result.message,
          slot: time,
          slots_remaining: result.slots_remaining,
          people_remaining: result.people_remaining,
        })
      }

      // No disponible → devolver alternativas + próximos días
      const alternatives = result.alternatives
      let nextDayMessage = ''

      // Si no hay alternativas hoy, buscar el día más cercano
      if (alternatives.length === 0) {
        const nextDay = await findNextAvailableDay(supabase, tenant_id, date, size, cfg, zones, tables)
        if (nextDay) {
          nextDayMessage = `El día más cercano con disponibilidad es el ${formatDateES(nextDay.date)} a las ${nextDay.slot}.`
        }
      }

      return NextResponse.json({
        success: true,
        available: false,
        reason: result.reason,
        message: result.message,
        alternatives,
        next_available_day: nextDayMessage,
        suggestion: alternatives.length > 0
          ? `No hay sitio a las ${time}. Puedes ofrecerle las ${alternatives[0]}${alternatives[1] ? ' o las ' + alternatives[1] : ''}.`
          : nextDayMessage
            ? `Hoy no queda sitio. ${nextDayMessage}`
            : `Hoy no hay hueco para ${size} personas. Sugiérele probar otro día.`,
      })
    }

    // Sin hora específica → devolver todos los huecos del día rankeados
    const allSlots = generateSlots(cfg)
    const available: { slot: string; remaining: number; people_remaining: number }[] = []

    for (const slot of allSlots) {
      const result = checkSlotAvailability({
        time: slot, date, party_size: size, zone_name: zone,
        cfg, existing_reservations: existing, tables, zones,
      })
      if (result.available) {
        available.push({
          slot,
          remaining: result.slots_remaining,
          people_remaining: result.people_remaining,
        })
      }
    }

    if (available.length === 0) {
      // Hoy no hay nada → buscar el día más cercano
      const nextDay = await findNextAvailableDay(supabase, tenant_id, date, size, cfg, zones, tables)
      return NextResponse.json({
        success: true,
        available: false,
        message: `No queda disponibilidad para ${size} personas el ${formatDateES(date)}.`,
        available_slots: [],
        best_slots: [],
        suggestion: nextDay
          ? `Hoy no hay hueco. El día más cercano es el ${formatDateES(nextDay.date)} a las ${nextDay.slot}.`
          : `No hay disponibilidad próximamente. Sugiérele llamar más adelante.`,
        next_available_day: nextDay ? `${formatDateES(nextDay.date)} a las ${nextDay.slot}` : null,
      })
    }

    const best = available.slice(0, 3).map(s => s.slot)
    return NextResponse.json({
      success: true,
      available: true,
      available_slots: available.map(s => s.slot),
      best_slots: best,
      message: `Hay ${available.length} huecos disponibles. Los mejores: ${best.join(', ')}.`,
      suggestion: `Puedes ofrecerle las ${best[0]}${best[1] ? ', las ' + best[1] : ''}${best[2] ? ' o las ' + best[2] : ''}.`,
    })

  } catch (err) {
    return NextResponse.json({ error: "internal error" }, { status: 500 })
  }
}

// ── Buscar el próximo día con disponibilidad ──────────────────────────────
async function findNextAvailableDay(
  db: any, tenantId: string, fromDate: string, partySize: number,
  cfg: any, zones: any[], tables: any[]
): Promise<{ date: string; slot: string } | null> {
  const allSlots = generateSlots(cfg)

  for (let i = 1; i <= 7; i++) {
    const d = new Date(fromDate + 'T12:00:00')
    d.setDate(d.getDate() + i)
    const checkDate = d.toISOString().slice(0, 10)

    const { data: dayRes } = await db.from("reservations")
      .select("time,people,party_size,zone_id,table_id")
      .eq("tenant_id", tenantId).eq("date", checkDate)
      .in("status", ["confirmada", "confirmed", "pendiente", "pending"])

    const existing = (dayRes || []).map((r: any) => ({
      time: r.time || '', people: r.people || r.party_size || 1,
      zone_id: r.zone_id, table_id: r.table_id,
    }))

    for (const slot of allSlots) {
      const result = checkSlotAvailability({
        time: slot, date: checkDate, party_size: partySize,
        cfg, existing_reservations: existing, tables, zones,
      })
      if (result.available) return { date: checkDate, slot }
    }
  }
  return null
}

// ── Formatear fecha en español ────────────────────────────────────────────
function formatDateES(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
}
