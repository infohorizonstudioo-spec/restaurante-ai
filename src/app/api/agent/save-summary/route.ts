import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { validateAgentKey } from "@/lib/agent-auth"
import { createNotification } from "@/lib/notifications"
import { learnFromCall } from "@/lib/tenant-learning"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    if (!validateAgentKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    const { tenant_id, customer_name, caller_phone, intent, summary, conversation_id } = await req.json()
    if (!tenant_id || !summary) {
      return NextResponse.json({ error: "tenant_id and summary required" }, { status: 400 })
    }

    const phone = caller_phone || null
    const name = customer_name || null
    const callIntent = intent || 'consulta'

    // ── 1. Guardar llamada en tabla calls ─────────────────────────────────
    const { data: call } = await supabase.from("calls").insert({
      tenant_id,
      caller_phone: phone,
      customer_name: name,
      status: "completada",
      intent: callIntent,
      summary,
      started_at: new Date().toISOString(),
      duration_seconds: 0,
      source: "twilio",
      decision_status: callIntent === 'reserva' ? 'confirmed' : 'completed',
      decision_confidence: 0.85,
      conversation_id: conversation_id || null,
    }).select("id").maybeSingle()

    // ── 2. Crear/actualizar cliente ───────────────────────────────────────
    if (name) {
      if (phone) {
        const { data: existing } = await supabase.from("customers")
          .select("id").eq("tenant_id", tenant_id).eq("phone", phone).maybeSingle()
        if (existing) {
          await supabase.from("customers").update({ name }).eq("id", existing.id)
        } else {
          await supabase.from("customers").insert({ tenant_id, name, phone })
        }
      } else {
        // Sin teléfono — buscar por nombre
        const { data: existing } = await supabase.from("customers")
          .select("id").eq("tenant_id", tenant_id).eq("name", name).maybeSingle()
        if (!existing) {
          await supabase.from("customers").insert({ tenant_id, name })
        }
      }
    }

    // ── 3. Notificación ───────────────────────────────────────────────────
    try {
      await createNotification({
        tenant_id,
        type: callIntent === 'reserva' ? 'reservation_created' : 'call_completed',
        title: `Llamada ${callIntent === 'reserva' ? '— reserva' : 'atendida'}${name ? ' — ' + name : ''}`,
        body: summary,
        call_sid: call?.id || undefined,
      })
    } catch {}

    // ── 4. Aprendizaje ────────────────────────────────────────────────────
    try {
      await learnFromCall({
        tenantId: tenant_id,
        memoryType: 'pattern',
        content: `${callIntent} | confirmed | ${summary.slice(0, 100)}`,
        confidence: 0.75,
      })
    } catch {}

    return NextResponse.json({ success: true, call_id: call?.id || null })
  } catch (err) {
    return NextResponse.json({ error: "internal error" }, { status: 500 })
  }
}
