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

    // Determinar estado de decisión según intent
    const decisionMap: Record<string, string> = {
      reserva: 'confirmed',
      pedido: 'confirmed',
      cancelacion: 'cancelled',
      consulta: 'pending_review',
      otro: 'pending_review',
    }
    const decisionStatus = decisionMap[callIntent] || 'pending_review'

    // Generar flags basados en el contenido
    const flags: string[] = []
    const lowerSummary = summary.toLowerCase()
    if (/alergi|intoleranci|celiac|vegetarian|vegan/i.test(lowerSummary)) flags.push('allergy_note')
    if (/cumpleaños|aniversario|celebraci/i.test(lowerSummary)) flags.push('special_occasion')
    if (/cancel/i.test(lowerSummary)) flags.push('cancellation_request')
    if (/grupo|personas|comensales/.test(lowerSummary)) {
      const match = lowerSummary.match(/(\d+)\s*(?:persona|comensal)/i)
      if (match && parseInt(match[1]) >= 8) flags.push('large_group')
    }

    // Generar reasoning legible
    const reasoningLabel = callIntent === 'reserva' ? `Reserva gestionada correctamente`
      : callIntent === 'pedido' ? `Pedido procesado por teléfono`
      : callIntent === 'cancelacion' ? `Cliente solicitó cancelación`
      : `Consulta atendida — ${name || 'cliente'}`

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
      decision_status: decisionStatus,
      decision_confidence: callIntent === 'reserva' || callIntent === 'pedido' ? 0.9 : 0.75,
      decision_flags: flags.length > 0 ? flags : null,
      reasoning_label: reasoningLabel,
      action_required: callIntent === 'reserva' ? 'Reserva confirmada por el agente'
        : callIntent === 'pedido' ? 'Pedido en proceso'
        : callIntent === 'cancelacion' ? 'Revisar cancelación'
        : null,
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
      const intentConfidence: Record<string, number> = {
        reserva: 0.95, pedido: 0.90, cancelacion: 0.85, consulta: 0.70, otro: 0.60,
      }
      await learnFromCall({
        tenantId: tenant_id,
        memoryType: 'pattern',
        content: `${callIntent} | confirmed | ${summary.slice(0, 200)}`,
        confidence: intentConfidence[callIntent] || 0.70,
      })
    } catch {}

    return NextResponse.json({ success: true, call_id: call?.id || null })
  } catch (err) {
    return NextResponse.json({ error: "internal error" }, { status: 500 })
  }
}
