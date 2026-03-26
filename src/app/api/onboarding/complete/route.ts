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

    const body = await req.json()
    const {
      tenant_id, agent_phone, business_name, business_type, agent_name,
      hours, horarios, menu, services, prices, faqs, policies,
      max_capacity, advance_hours, large_group_min,
      // Campos específicos por vertical
      num_professionals, appointment_duration, has_urgencias,
      total_tables, table_capacity, max_group, reservation_duration,
      checkin_time, checkout_time, animal_types, meeting_types,
      salon_tipo, num_dentists,
    } = body

    if (!tenant_id) {
      return NextResponse.json({ error: "tenant_id required" }, { status: 400 })
    }
    if (tenant_id !== auth.tenantId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 })
    }

    // 1. Guardar business_knowledge
    await supabase.from("business_knowledge").delete().eq("tenant_id", tenant_id)
    const knowledge: { tenant_id: string; category: string; content: string; active: boolean }[] = []

    if (hours || horarios) {
      knowledge.push({ tenant_id, category: "horarios", content: typeof (hours||horarios) === "string" ? (hours||horarios) : JSON.stringify(hours||horarios), active: true })
    }
    if (menu) knowledge.push({ tenant_id, category: "menu", content: Array.isArray(menu) ? menu.join("\n") : menu, active: true })
    if (services) {
      const svcContent = Array.isArray(services) ? services.join(", ") : services
      knowledge.push({ tenant_id, category: "servicios", content: svcContent, active: true })
    }
    if (prices) knowledge.push({ tenant_id, category: "precios", content: prices, active: true })
    if (faqs) knowledge.push({ tenant_id, category: "faqs", content: faqs, active: true })
    if (policies) knowledge.push({ tenant_id, category: "politicas", content: policies, active: true })

    // Datos específicos por vertical → almacenados como knowledge adicional
    if (animal_types && Array.isArray(animal_types)) {
      knowledge.push({ tenant_id, category: "servicios", content: "Animales atendidos: " + animal_types.join(", "), active: true })
    }
    if (meeting_types && Array.isArray(meeting_types)) {
      knowledge.push({ tenant_id, category: "servicios", content: "Modalidades de reunión: " + meeting_types.join(", "), active: true })
    }
    if (checkin_time) {
      knowledge.push({ tenant_id, category: "horarios", content: "Check-in: a partir de las " + checkin_time + ". Check-out: antes de las " + (checkout_time || "12:00"), active: true })
    }
    if (has_urgencias) {
      knowledge.push({ tenant_id, category: "servicios", content: "Atendemos urgencias", active: true })
    }
    if (salon_tipo) {
      knowledge.push({ tenant_id, category: "servicios", content: "Tipo de salón: " + salon_tipo, active: true })
    }

    if (knowledge.length > 0) await supabase.from("business_knowledge").insert(knowledge)

    // 2. Guardar business_rules
    await supabase.from("business_rules").delete().eq("tenant_id", tenant_id)
    const rules: { tenant_id: string; rule_key: string; rule_value: string }[] = []

    if (max_capacity) rules.push({ tenant_id, rule_key: "max_capacity", rule_value: String(max_capacity) })
    if (advance_hours) rules.push({ tenant_id, rule_key: "advance_booking_hours", rule_value: String(advance_hours) })
    if (large_group_min || max_group) rules.push({ tenant_id, rule_key: "large_group_min", rule_value: String(large_group_min || max_group) })
    if (num_professionals) rules.push({ tenant_id, rule_key: "num_professionals", rule_value: String(num_professionals) })
    if (num_dentists) rules.push({ tenant_id, rule_key: "num_professionals", rule_value: String(num_dentists) })
    if (appointment_duration) rules.push({ tenant_id, rule_key: "slot_duration", rule_value: String(appointment_duration) })
    if (reservation_duration) rules.push({ tenant_id, rule_key: "slot_duration", rule_value: String(reservation_duration) })
    if (total_tables) rules.push({ tenant_id, rule_key: "total_spaces", rule_value: String(total_tables) })
    if (table_capacity) rules.push({ tenant_id, rule_key: "space_capacity", rule_value: String(table_capacity) })

    if (rules.length > 0) await supabase.from("business_rules").insert(rules)

    // 3. Actualizar tenant con reservation_config estructurado
    const updates: Record<string, unknown> = { onboarding_complete: true }
    if (agent_phone) updates.agent_phone = agent_phone
    if (business_name) updates.name = business_name
    if (business_type) updates.type = business_type
    if (agent_name) updates.agent_name = agent_name

    // Guardar reservation_config con datos del tipo de negocio
    const resConfig: Record<string, unknown> = {}
    if (appointment_duration || reservation_duration) resConfig.default_reservation_duration_minutes = appointment_duration || reservation_duration
    if (total_tables) resConfig.total_spaces = total_tables
    if (table_capacity) resConfig.space_capacity = table_capacity
    if (max_group) resConfig.max_group = max_group
    if (num_professionals || num_dentists) resConfig.num_professionals = num_professionals || num_dentists
    if (has_urgencias) resConfig.has_urgencias = true
    if (checkin_time) resConfig.checkin_time = checkin_time
    if (checkout_time) resConfig.checkout_time = checkout_time
    if (Object.keys(resConfig).length > 0) updates.reservation_config = resConfig

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
