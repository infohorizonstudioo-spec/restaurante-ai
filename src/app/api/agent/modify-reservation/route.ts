import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { validateAgentKey } from "@/lib/agent-auth"
import { parseReservationConfig, checkSlotAvailability } from "@/lib/scheduling-engine"
import { resolveTemplate } from "@/lib/templates"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = "force-dynamic"

/**
 * POST /api/agent/modify-reservation
 * Finds a customer's reservation and updates it with new date/time/party_size.
 * Checks availability for the new slot before confirming.
 * Sends SMS with updated details.
 */
export async function POST(req: NextRequest) {
  try {
    if (!validateAgentKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    const { tenant_id, customer_name, customer_phone, new_date, new_time, new_party_size } = await req.json()
    if (!tenant_id) return NextResponse.json({ error: "tenant_id required" }, { status: 400 })
    if (!customer_phone && !customer_name) return NextResponse.json({ error: "need phone or name" }, { status: 400 })
    if (!new_date && !new_time && !new_party_size) return NextResponse.json({ error: "need at least one change" }, { status: 400 })

    // Find existing reservation
    let query = supabase.from("reservations")
      .select("id, customer_name, customer_phone, date, time, people, status, tenant_id")
      .eq("tenant_id", tenant_id)
      .in("status", ["confirmada", "confirmed", "pendiente", "pending"])
      .gte("date", new Date().toISOString().slice(0, 10))
      .order("date", { ascending: true })

    if (customer_phone) query = query.eq("customer_phone", customer_phone)
    else if (customer_name) query = query.ilike("customer_name", `%${customer_name}%`)

    const { data: reservations } = await query.limit(5)
    if (!reservations || reservations.length === 0) {
      return NextResponse.json({
        success: false,
        found: false,
        message: customer_phone
          ? `No encuentro ninguna reserva activa con el teléfono ${customer_phone}.`
          : `No encuentro ninguna reserva a nombre de ${customer_name}.`,
        suggestion: "Pregúntale si puede dar más datos: nombre, fecha, o teléfono con el que reservó."
      })
    }

    const original = reservations[0]
    const finalDate = new_date || original.date
    const finalTime = new_time || (original.time || '').slice(0, 5)
    const finalPeople = new_party_size || original.people || 2

    // Check availability for new slot
    const [tenantRes, zonesRes, tablesRes, reservasRes] = await Promise.all([
      supabase.from("tenants").select("reservation_config,type,name").eq("id", tenant_id).maybeSingle(),
      supabase.from("zones").select("id,name").eq("tenant_id", tenant_id).eq("active", true),
      supabase.from("tables").select("id,zone_id,capacity,status").eq("tenant_id", tenant_id),
      supabase.from("reservations").select("id,time,people,party_size,zone_id,table_id,status")
        .eq("tenant_id", tenant_id).eq("date", finalDate)
        .in("status", ["confirmada", "confirmed", "pendiente", "pending"])
        .neq("id", original.id), // Exclude the reservation being modified
    ])

    const cfg = parseReservationConfig(tenantRes.data?.reservation_config)
    const tmpl = resolveTemplate(tenantRes.data?.type || 'otro')
    const zones = zonesRes.data || []
    const tables = tmpl.hasSpaces ? (tablesRes.data || []) : []
    const existing = (reservasRes.data || []).map(r => ({
      time: r.time || '',
      people: r.people || r.party_size || 1,
      zone_id: r.zone_id,
      table_id: r.table_id,
    }))

    const availability = checkSlotAvailability({
      time: finalTime, date: finalDate, party_size: finalPeople,
      cfg, existing_reservations: existing, tables, zones,
    })

    if (!availability.available) {
      return NextResponse.json({
        success: false,
        available: false,
        message: availability.message,
        alternatives: availability.alternatives,
        suggestion: availability.alternatives.length > 0
          ? `No hay sitio a las ${finalTime}. Alternativas: ${availability.alternatives.join(', ')}.`
          : `No hay disponibilidad el ${finalDate} a las ${finalTime} para ${finalPeople} personas.`,
      })
    }

    // Update reservation
    await supabase.from("reservations").update({
      date: finalDate, time: finalTime, people: finalPeople,
    }).eq("id", original.id).eq("tenant_id", tenant_id)

    // Create notification
    const oldTime = (original.time || '').slice(0, 5)
    const oldDateStr = new Date(original.date + 'T12:00:00').toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long'
    })
    const newDateStr = new Date(finalDate + 'T12:00:00').toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long'
    })

    await supabase.from("notifications").insert({
      tenant_id,
      type: "reservation_modified",
      title: `Modificación por teléfono — ${original.customer_name}`,
      body: `${original.customer_name} cambió su reserva del ${oldDateStr} ${oldTime} → ${newDateStr} ${finalTime} (${finalPeople}p)`,
      read: false,
    })

    // SMS with updated details
    const phone = original.customer_phone || customer_phone
    if (phone) {
      const bizName = tenantRes.data?.name || 'Tu negocio'
      const smsBody = `${bizName}: Hola ${original.customer_name}, tu reserva ha sido modificada: ${newDateStr} a las ${finalTime}, ${finalPeople} personas. Te esperamos!`
      const accountSid = process.env.TWILIO_ACCOUNT_SID
      const authToken = process.env.TWILIO_AUTH_TOKEN
      const fromNumber = process.env.TWILIO_SMS_NUMBER || process.env.TWILIO_PHONE_NUMBER
      if (accountSid && authToken && fromNumber) {
        const twilioAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
        fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
          method: 'POST',
          headers: { 'Authorization': `Basic ${twilioAuth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ From: fromNumber, To: phone, Body: smsBody }).toString(),
        }).catch(() => {})
      }
    }

    return NextResponse.json({
      success: true,
      reservation_id: original.id,
      customer_name: original.customer_name,
      old: { date: original.date, time: oldTime, people: original.people },
      new: { date: finalDate, time: finalTime, people: finalPeople },
      message: `Reserva modificada: ${original.customer_name}, ahora el ${newDateStr} a las ${finalTime}, ${finalPeople} personas.`,
    })
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
