import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const { tenant_id, caller_phone, summary, outcome, reservation_id } = await req.json()
    if (!tenant_id || !summary) {
      return NextResponse.json({ error: "tenant_id and summary required" }, { status: 400 })
    }

    // Guardar en notifications para que aparezca en el panel del negocio
    const { error } = await supabase.from("notifications").insert({
      tenant_id,
      type: "call_summary",
      title: "Llamada completada",
      message: summary,
      data: {
        caller_phone: caller_phone || null,
        outcome: outcome || "completed",
        reservation_id: reservation_id || null,
        source: "phone_agent",
      },
      read: false,
    })

    if (error) {
      // Tabla notifications puede no tener todos los campos - intentar con calls si existe
      const { error: err2 } = await supabase.from("calls").insert({
        tenant_id,
        caller_phone: caller_phone || null,
        summary,
        outcome: outcome || "completed",
        reservation_id: reservation_id || null,
        call_time: new Date().toISOString(),
        source: "phone_agent",
      }).select().single()

      if (err2 && err2.code !== "42P01") {
        console.error("[save-summary]", err2)
      }
    }

    return NextResponse.json({ success: true, message: "Call summary saved" })
  } catch (err) {
    console.error("[save-summary]", err)
    return NextResponse.json({ error: "internal error" }, { status: 500 })
  }
}
