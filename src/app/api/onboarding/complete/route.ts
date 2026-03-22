import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = "force-dynamic"

// Este endpoint se llama al finalizar el onboarding.
// Recibe todos los datos del negocio y los guarda en las tablas correctas
// para que el agente funcione automáticamente.
export async function POST(req: NextRequest) {
  try {
    const {
      tenant_id,
      agent_phone,      // número Twilio del cliente ej: +34612345678
      business_name,
      business_type,
      agent_name,
      hours,            // { monday: {open, close}, ... } o texto libre
      menu,             // array de strings o texto con la carta
      services,         // array de strings con servicios
      prices,           // texto con precios
      faqs,             // texto con preguntas frecuentes
      policies,         // reglas: antelacion reservas, grupos, etc
      max_capacity,
      closed_days,
      advance_hours,
      large_group_min,
    } = await req.json()

    if (!tenant_id) {
      return NextResponse.json({ error: "tenant_id required" }, { status: 400 })
    }

    // 1. Actualizar tenant con agent_phone y datos base
    const updates: Record<string, unknown> = { onboarding_complete: true }
    if (agent_phone) updates.agent_phone = agent_phone
    if (business_name) updates.name = business_name
    if (business_type) updates.type = business_type
    if (agent_name) updates.agent_name = agent_name

    await supabase.from("tenants").update(updates).eq("id", tenant_id)

    // 2. Limpiar knowledge anterior y insertar nueva
    await supabase.from("business_knowledge").delete().eq("tenant_id", tenant_id)

    const knowledge = []
    if (hours) knowledge.push({ tenant_id, category: "horarios", content: typeof hours === "string" ? hours : JSON.stringify(hours) })
    if (menu) knowledge.push({ tenant_id, category: "menu", content: Array.isArray(menu) ? menu.join("\n") : menu })
    if (services) knowledge.push({ tenant_id, category: "servicios", content: Array.isArray(services) ? services.join("\n") : services })
    if (prices) knowledge.push({ tenant_id, category: "precios", content: prices })
    if (faqs) knowledge.push({ tenant_id, category: "faqs", content: faqs })
    if (policies) knowledge.push({ tenant_id, category: "politicas", content: policies })

    if (knowledge.length > 0) {
      await supabase.from("business_knowledge").insert(knowledge)
    }

    // 3. Limpiar rules anteriores e insertar nuevas
    await supabase.from("business_rules").delete().eq("tenant_id", tenant_id)

    const rules = []
    if (max_capacity) rules.push({ tenant_id, rule_key: "max_capacity", rule_value: String(max_capacity), description: "Aforo maximo" })
    if (closed_days) rules.push({ tenant_id, rule_key: "closed_days", rule_value: JSON.stringify(closed_days), description: "Dias cerrados" })
    if (advance_hours) rules.push({ tenant_id, rule_key: "advance_booking_hours", rule_value: String(advance_hours), description: "Horas minimas antelacion" })
    if (large_group_min) rules.push({ tenant_id, rule_key: "large_group_min", rule_value: String(large_group_min), description: "Min personas grupo especial" })
    if (hours && typeof hours === "object") {
      rules.push({ tenant_id, rule_key: "opening_hours", rule_value: JSON.stringify(hours), description: "Horarios de apertura" })
    }

    if (rules.length > 0) {
      await supabase.from("business_rules").insert(rules)
    }

    console.log("[onboarding/complete] tenant", tenant_id, "setup done. phone:", agent_phone)
    return NextResponse.json({ success: true, message: "Agente configurado correctamente" })
  } catch (err) {
    console.error("[onboarding/complete]", err)
    return NextResponse.json({ error: "internal error" }, { status: 500 })
  }
}
