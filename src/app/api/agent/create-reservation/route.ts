import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const { tenant_id, customer_name, customer_phone, date, time, party_size, people, notes, event_type, service_type, order_items } = await req.json()

    if (!tenant_id || !customer_name) {
      return NextResponse.json({ error: "tenant_id and customer_name required" }, { status: 400 })
    }

    const finalPartySize = party_size || people || 1

    // Crear o recuperar cliente
    let customerId: string | null = null
    if (customer_phone) {
      const { data: existing } = await supabase.from("customers")
        .select("id").eq("tenant_id", tenant_id).eq("phone", customer_phone).single()
      if (existing) {
        customerId = existing.id
        await supabase.from("customers").update({ name: customer_name }).eq("id", customerId)
      } else {
        const { data: newC } = await supabase.from("customers")
          .insert({ tenant_id, name: customer_name, phone: customer_phone })
          .select("id").single()
        customerId = newC?.id || null
      }
    }

    const reservationTime = date && time ? date + "T" + time + ":00" : null
    const notesStr = [notes, service_type, order_items ? "Pedido: " + order_items : null].filter(Boolean).join(" | ")

    const { data: reservation, error } = await supabase.from("reservations").insert({
      tenant_id,
      customer_id: customerId,
      customer_name,
      customer_phone: customer_phone || null,
      reservation_time: reservationTime,
      party_size: finalPartySize,
      notes: notesStr || null,
      status: "confirmed",
      source: "phone_agent",
    }).select("id, reservation_time, status").single()

    if (error) {
      // DB error creating reservation
      return NextResponse.json({ error: "could not create reservation" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      reservation_id: reservation.id,
      customer_name,
      datetime: reservationTime,
      party_size: finalPartySize,
      status: "confirmed",
      message: "Reserva confirmada para " + customer_name + (date ? " el " + date : "") + (time ? " a las " + time : ""),
    })
  } catch (err) {
    return NextResponse.json({ error: "internal error" }, { status: 500 })
  }
}
