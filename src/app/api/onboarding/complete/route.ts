import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { provisionElevenAgent } from "@/lib/provision-agent"
import { requireAuth } from "@/lib/api-auth"

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/onboarding/complete
 *
 * Llamado al terminar el onboarding.
 * 1. Guarda todo en business_knowledge + business_rules + tenants
 * 2. Llama a provisionElevenAgent → crea el agente con sus datos reales
 * 3. El negocio queda listo para recibir llamadas
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const {
      tenant_id, agent_phone, business_name, business_type, agent_name,
      hours, horarios, menu, services, prices, faqs, policies,
      max_capacity, advance_hours, large_group_min,
    } = await req.json()

    if (!tenant_id) {
      return NextResponse.json({ error: "tenant_id required" }, { status: 400 })
    }
    if (tenant_id !== auth.tenantId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 })
    }

    // 1. Guardar business_knowledge
    await supabase.from("business_knowledge").delete().eq("tenant_id", tenant_id)
    const knowledge = []
    if (hours || horarios) knowledge.push({ tenant_id, category: "horarios", content: typeof (hours||horarios) === "string" ? (hours||horarios) : JSON.stringify(hours||horarios) })
    if (menu) knowledge.push({ tenant_id, category: "menu", content: Array.isArray(menu) ? menu.join("\n") : menu })
    if (services) knowledge.push({ tenant_id, category: "servicios", content: Array.isArray(services) ? services.join("\n") : services })
    if (prices) knowledge.push({ tenant_id, category: "precios", content: prices })
    if (faqs) knowledge.push({ tenant_id, category: "faqs", content: faqs })
    if (policies) knowledge.push({ tenant_id, category: "politicas", content: policies })
    if (knowledge.length > 0) await supabase.from("business_knowledge").insert(knowledge)

    // 2. Guardar business_rules
    await supabase.from("business_rules").delete().eq("tenant_id", tenant_id)
    const rules = []
    if (max_capacity) rules.push({ tenant_id, rule_key: "max_capacity", rule_value: String(max_capacity) })
    if (advance_hours) rules.push({ tenant_id, rule_key: "advance_booking_hours", rule_value: String(advance_hours) })
    if (large_group_min) rules.push({ tenant_id, rule_key: "large_group_min", rule_value: String(large_group_min) })
    if (rules.length > 0) await supabase.from("business_rules").insert(rules)

    // 3. Actualizar tenant
    const updates: Record<string, unknown> = { onboarding_complete: true }
    if (agent_phone) updates.agent_phone = agent_phone
    if (business_name) updates.name = business_name
    if (business_type) updates.type = business_type
    if (agent_name) updates.agent_name = agent_name
    await supabase.from("tenants").update(updates).eq("id", tenant_id)

    // 4. Crear/actualizar agente en ElevenLabs con los datos reales
    const provision = await provisionElevenAgent(tenant_id)
    if (!provision.success) {
      // No falla el onboarding por esto — el agente se puede reprovisionar después
    }

    return NextResponse.json({ success: true, agent_id: provision.agent_id })
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
