import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { validateAgentKey } from "@/lib/agent-auth"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = "force-dynamic"

/**
 * POST /api/agent/cancel-reservation
 * Finds and cancels a customer's reservation by phone or name + date.
 * Also notifies waitlisted customers if any.
 */
export async function POST(req: NextRequest) {
  try {
    if (!validateAgentKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    const { tenant_id, customer_name, customer_phone, date } = await req.json()
    if (!tenant_id) return NextResponse.json({ error: "tenant_id required" }, { status: 400 })
    if (!customer_phone && !customer_name) return NextResponse.json({ error: "customer_phone or customer_name required" }, { status: 400 })

    // Find matching reservation(s)
    let query = supabase.from("reservations")
      .select("id, customer_name, customer_phone, date, time, people, status")
      .eq("tenant_id", tenant_id)
      .in("status", ["confirmada", "confirmed", "pendiente", "pending"])
      .order("date", { ascending: true })

    if (customer_phone) {
      query = query.eq("customer_phone", customer_phone)
    } else if (customer_name) {
      query = query.ilike("customer_name", `%${customer_name}%`)
    }

    if (date) {
      query = query.eq("date", date)
    } else {
      // If no date, search upcoming reservations
      query = query.gte("date", new Date().toISOString().slice(0, 10))
    }

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

    // If multiple matches, cancel the nearest one
    const toCancel = reservations[0]
    const time = (toCancel.time || '').slice(0, 5)
    const dateStr = new Date(toCancel.date + 'T12:00:00').toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long'
    })

    // Cancel
    await supabase.from("reservations")
      .update({ status: "cancelada" })
      .eq("id", toCancel.id)
      .eq("tenant_id", tenant_id)

    // SMS to cancelled customer
    if (toCancel.customer_phone) {
      const { data: tenantInfo } = await supabase.from("tenants").select("name").eq("id", tenant_id).maybeSingle()
      const bizName = tenantInfo?.name || 'Tu negocio'
      const smsBody = `❌ ${bizName}: ${toCancel.customer_name}, tu reserva del ${dateStr} a las ${time} ha sido cancelada. Si necesitas algo, llámanos.`

      const accountSid = process.env.TWILIO_ACCOUNT_SID
      const authToken = process.env.TWILIO_AUTH_TOKEN
      const fromNumber = process.env.TWILIO_SMS_NUMBER || process.env.TWILIO_PHONE_NUMBER
      if (accountSid && authToken && fromNumber) {
        const twilioAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
        fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
          method: 'POST',
          headers: { 'Authorization': `Basic ${twilioAuth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ From: fromNumber, To: toCancel.customer_phone, Body: smsBody }).toString(),
        }).catch(() => {})
      }
    }

    // Notify first waitlisted person for that date
    const { data: waitlisted } = await supabase.from("waitlist")
      .select("id, customer_name, customer_phone")
      .eq("tenant_id", tenant_id).eq("date", toCancel.date).eq("status", "waiting")
      .order("created_at").limit(1).maybeSingle()

    if (waitlisted?.customer_phone) {
      const accountSid = process.env.TWILIO_ACCOUNT_SID
      const authToken = process.env.TWILIO_AUTH_TOKEN
      const fromNumber = process.env.TWILIO_SMS_NUMBER || process.env.TWILIO_PHONE_NUMBER
      if (accountSid && authToken && fromNumber) {
        const { data: tenantInfo } = await supabase.from("tenants").select("name").eq("id", tenant_id).maybeSingle()
        const twilioAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
        fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
          method: 'POST',
          headers: { 'Authorization': `Basic ${twilioAuth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            From: fromNumber,
            To: waitlisted.customer_phone,
            Body: `🎉 ¡Buenas noticias, ${waitlisted.customer_name}! Ha quedado un hueco el ${dateStr}. Llámanos para confirmar tu reserva.`
          }).toString(),
        }).catch(() => {})
        await supabase.from("waitlist").update({ status: "notified" }).eq("id", waitlisted.id)
      }
    }

    // Create notification
    await supabase.from("notifications").insert({
      tenant_id,
      type: "reservation_cancelled",
      title: `Cancelación por teléfono — ${toCancel.customer_name}`,
      body: `${toCancel.customer_name} canceló su reserva del ${dateStr} a las ${time} (${toCancel.people}p)`,
      read: false,
    })

    return NextResponse.json({
      success: true,
      cancelled_id: toCancel.id,
      customer_name: toCancel.customer_name,
      date: toCancel.date,
      time,
      people: toCancel.people,
      message: `Cancelada la reserva de ${toCancel.customer_name} para el ${dateStr} a las ${time}, ${toCancel.people} personas.`,
      waitlist_notified: !!waitlisted,
    })
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
