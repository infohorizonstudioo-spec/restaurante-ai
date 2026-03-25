import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { validateAgentKey } from "@/lib/agent-auth"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = "force-dynamic"

/**
 * Crea o actualiza un pedido EN VIVO durante la llamada.
 * El agente llama a esta tool cada vez que el cliente añade un producto.
 * El panel muestra el pedido construyéndose en tiempo real via Supabase Realtime.
 *
 * Flujo:
 * 1. Primera llamada (sin order_id): crea pedido con status="collecting"
 * 2. Siguientes llamadas (con order_id): actualiza items del pedido
 * 3. Última llamada (action="confirm"): cambia status a "confirmed"
 * 4. Si cancela (action="cancel"): cambia status a "cancelled"
 */
export async function POST(req: NextRequest) {
  try {
    if (!validateAgentKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

    const {
      tenant_id, order_id, call_sid, action,
      customer_name, customer_phone,
      items, // Array de { name, quantity, price }
      order_type, // "recoger" | "domicilio" | "mesa"
      pickup_time, delivery_address, notes, table_id
    } = await req.json()

    if (!tenant_id) return NextResponse.json({ error: "tenant_id required" }, { status: 400 })

    const callSid = call_sid || 'call_' + Date.now()

    // ── ACTUALIZAR pedido existente ───────────────────────────────────────
    if (order_id) {
      const updates: Record<string, any> = { updated_at: new Date().toISOString() }
      if (items) updates.items = items
      if (notes) updates.notes = notes
      if (pickup_time) updates.pickup_time = pickup_time
      if (customer_name) updates.customer_name = customer_name

      // Calcular total estimado
      if (items && Array.isArray(items)) {
        updates.total_estimate = items.reduce((s: number, i: any) => s + ((i.price || 0) * (i.quantity || 1)), 0)
      }

      if (action === 'confirm') {
        updates.status = 'confirmed'
      } else if (action === 'cancel') {
        updates.status = 'cancelled'
      }

      const { data, error } = await supabase.from("order_events")
        .update(updates)
        .eq("id", order_id)
        .eq("tenant_id", tenant_id)
        .select("id, status, items, total_estimate")
        .maybeSingle()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      return NextResponse.json({
        success: true,
        order_id: data?.id,
        status: data?.status,
        items_count: Array.isArray(data?.items) ? data.items.length : 0,
        total: data?.total_estimate || 0,
        message: action === 'confirm'
          ? `Pedido confirmado. Total: ${data?.total_estimate || 0}€.`
          : `Pedido actualizado. ${Array.isArray(data?.items) ? data.items.length : 0} productos.`,
      })
    }

    // ── CREAR nuevo pedido ────────────────────────────────────────────────
    if (!customer_name) return NextResponse.json({ error: "customer_name required for new order" }, { status: 400 })

    const orderItems = items || []
    const total = orderItems.reduce((s: number, i: any) => s + ((i.price || 0) * (i.quantity || 1)), 0)

    const { data: order, error } = await supabase.from("order_events").insert({
      tenant_id,
      call_sid: callSid,
      status: "collecting",
      order_type: order_type || "recoger",
      customer_name,
      customer_phone: customer_phone || null,
      items: orderItems,
      notes: [delivery_address ? `DIRECCIÓN: ${delivery_address}` : null, notes].filter(Boolean).join(' | ') || null,
      pickup_time: pickup_time || null,
      total_estimate: total,
      table_id: table_id || null,
    }).select("id, status").maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      success: true,
      order_id: order?.id,
      status: "collecting",
      message: `Pedido creado para ${customer_name}. Sigue añadiendo productos.`,
    })
  } catch (err) {
    return NextResponse.json({ error: "internal error" }, { status: 500 })
  }
}
