import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { validateAgentKey } from "@/lib/agent-auth"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    if (!validateAgentKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    const { tenant_id, customer_name, customer_phone, date, time, party_size, people, notes, service_type, order_items } = await req.json()

    if (!tenant_id || !customer_name) {
      return NextResponse.json({ error: "tenant_id and customer_name required" }, { status: 400 })
    }

    const finalPartySize = party_size || people || 1
    const notesStr = [notes, service_type, order_items ? "Pedido: " + order_items : null].filter(Boolean).join(" | ")

    // Usar el mismo RPC atómico que funciona en post-call y voice/reservation
    const { data: result, error } = await supabase.rpc('create_reservation_atomic', {
      p_tenant_id:      tenant_id,
      p_date:           date || new Date().toISOString().slice(0, 10),
      p_time:           time || '20:00',
      p_party_size:     finalPartySize,
      p_customer_name:  customer_name,
      p_customer_phone: customer_phone || '',
      p_notes:          notesStr || null,
    })

    if (error) {
      return NextResponse.json({ error: "could not create reservation: " + error.message }, { status: 500 })
    }

    const r = result as any

    return NextResponse.json({
      success: true,
      reservation_id: r?.reservation_id || null,
      customer_name,
      date,
      time,
      party_size: finalPartySize,
      status: "confirmed",
      message: "Reserva confirmada para " + customer_name + (date ? " el " + date : "") + (time ? " a las " + time : "") + ", " + finalPartySize + " persona" + (finalPartySize !== 1 ? "s" : ""),
    })
  } catch (err) {
    return NextResponse.json({ error: "internal error" }, { status: 500 })
  }
}
