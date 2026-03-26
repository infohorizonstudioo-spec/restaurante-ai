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
 * Llamado al terminar el onboarding completo (14 pasos).
 * 1. Guarda todo en business_knowledge + business_rules + tenants
 * 2. Crea recursos físicos (tables + zones) si aplica
 * 3. Configura recordatorios y notificaciones
 * 4. Llama a provisionElevenAgent → crea el agente con sus datos reales
 * 5. El negocio queda listo para recibir llamadas
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req)
    if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const body = await req.json()
    const {
      tenant_id, agent_phone, business_name, business_type, agent_name, language,
      // Hours
      hours, horarios,
      // Services
      services, appointment_duration, reservation_duration, num_professionals, has_urgencias,
      total_tables,
      // Business description (new)
      business_description, what_you_do, what_not_to_do, important_info,
      // Contact info (new)
      phone, address, email, contact_person,
      // Rules (new)
      auto_confirm, max_auto_party, offer_alternatives, review_cases, cancellation_policy,
      advance_booking_hours, max_advance_days,
      // Channels (new)
      channels, whatsapp_phone, email_channel,
      // Notifications (new)
      notify_new_booking, notify_cancellation, notify_urgency, notify_no_show, notify_channel,
      // Reminders (new)
      reminders_enabled, reminder_intervals, reminder_channel, send_confirmation,
      // Agent personality (new)
      agent_tone, agent_autonomy,
      // Resources (new)
      resource_names, zone_names,
      // Legacy fields (backwards compat)
      menu, prices, faqs, policies,
      max_capacity, advance_hours, large_group_min,
      table_capacity, max_group,
      checkin_time, checkout_time, animal_types, meeting_types, salon_tipo, num_dentists,
    } = body

    if (!tenant_id) return NextResponse.json({ error: "tenant_id required" }, { status: 400 })
    if (tenant_id !== auth.tenantId) return NextResponse.json({ error: "unauthorized" }, { status: 403 })

    // ── 1. BUSINESS KNOWLEDGE ───────────────────────────────────────────────
    await supabase.from("business_knowledge").delete().eq("tenant_id", tenant_id)
    const knowledge: { tenant_id: string; category: string; content: string; active: boolean }[] = []

    // Hours
    if (hours || horarios) {
      knowledge.push({ tenant_id, category: "horarios", content: typeof (hours||horarios) === "string" ? (hours||horarios) : JSON.stringify(hours||horarios), active: true })
    }
    // Services
    if (services) {
      knowledge.push({ tenant_id, category: "servicios", content: Array.isArray(services) ? services.join(", ") : services, active: true })
    }
    // Business description → knowledge entries
    if (business_description) {
      knowledge.push({ tenant_id, category: "descripcion", content: business_description, active: true })
    }
    if (important_info) {
      knowledge.push({ tenant_id, category: "informacion_importante", content: important_info, active: true })
    }
    if (what_you_do) {
      knowledge.push({ tenant_id, category: "instrucciones_positivas", content: what_you_do, active: true })
    }
    if (what_not_to_do) {
      knowledge.push({ tenant_id, category: "instrucciones_negativas", content: what_not_to_do, active: true })
    }
    // Contact info as knowledge
    if (address) knowledge.push({ tenant_id, category: "direccion", content: address, active: true })
    if (phone) knowledge.push({ tenant_id, category: "telefono_negocio", content: phone, active: true })
    if (email) knowledge.push({ tenant_id, category: "email_negocio", content: email, active: true })

    // Cancellation policy
    if (cancellation_policy) {
      const policyText = { flexible: 'Cancelación flexible: hasta 2 horas antes', moderate: 'Cancelación moderada: hasta 24 horas antes', strict: 'No se admiten cancelaciones' }[cancellation_policy] || cancellation_policy
      knowledge.push({ tenant_id, category: "politicas", content: policyText, active: true })
    }

    // Agent personality
    if (agent_tone || agent_autonomy) {
      const toneText = { friendly: 'cercano y cálido', professional: 'profesional', direct: 'directo y eficiente' }[agent_tone] || 'profesional'
      const autoText = { cautious: 'prudente, consulta antes de decidir cosas importantes', balanced: 'equilibrado, gestiona lo rutinario y consulta lo especial', autonomous: 'autónomo, gestiona casi todo sin consultar' }[agent_autonomy] || 'equilibrado'
      knowledge.push({ tenant_id, category: "personalidad_agente", content: `Tono: ${toneText}. Autonomía: ${autoText}`, active: true })
    }

    // Legacy fields
    if (menu) knowledge.push({ tenant_id, category: "menu", content: Array.isArray(menu) ? menu.join("\n") : menu, active: true })
    if (prices) knowledge.push({ tenant_id, category: "precios", content: prices, active: true })
    if (faqs) knowledge.push({ tenant_id, category: "faqs", content: faqs, active: true })
    if (policies && !cancellation_policy) knowledge.push({ tenant_id, category: "politicas", content: policies, active: true })
    if (animal_types && Array.isArray(animal_types)) knowledge.push({ tenant_id, category: "servicios", content: "Animales atendidos: " + animal_types.join(", "), active: true })
    if (meeting_types && Array.isArray(meeting_types)) knowledge.push({ tenant_id, category: "servicios", content: "Modalidades: " + meeting_types.join(", "), active: true })
    if (checkin_time) knowledge.push({ tenant_id, category: "horarios", content: `Check-in: ${checkin_time}. Check-out: ${checkout_time || "12:00"}`, active: true })
    if (has_urgencias) knowledge.push({ tenant_id, category: "servicios", content: "Atendemos urgencias", active: true })
    if (salon_tipo) knowledge.push({ tenant_id, category: "servicios", content: "Tipo de salón: " + salon_tipo, active: true })

    if (knowledge.length > 0) await supabase.from("business_knowledge").insert(knowledge)

    // ── 2. BUSINESS RULES ───────────────────────────────────────────────────
    await supabase.from("business_rules").delete().eq("tenant_id", tenant_id)
    const rules: { tenant_id: string; rule_key: string; rule_value: string }[] = []

    // New rules from onboarding
    if (auto_confirm !== undefined) rules.push({ tenant_id, rule_key: "auto_confirm", rule_value: String(auto_confirm) })
    if (max_auto_party) rules.push({ tenant_id, rule_key: "max_auto_party_size", rule_value: String(max_auto_party) })
    if (offer_alternatives !== undefined) rules.push({ tenant_id, rule_key: "offer_alternatives", rule_value: String(offer_alternatives) })
    if (review_cases && Array.isArray(review_cases)) rules.push({ tenant_id, rule_key: "require_review_flags", rule_value: JSON.stringify(review_cases) })
    if (cancellation_policy) rules.push({ tenant_id, rule_key: "cancellation_policy", rule_value: cancellation_policy })
    if (advance_booking_hours !== undefined) rules.push({ tenant_id, rule_key: "advance_booking_hours", rule_value: String(advance_booking_hours) })
    if (max_advance_days) rules.push({ tenant_id, rule_key: "advance_booking_max_days", rule_value: String(max_advance_days) })

    // Capacity / scheduling rules
    if (max_capacity || max_group) rules.push({ tenant_id, rule_key: "max_capacity", rule_value: String(max_capacity || max_group) })
    if (large_group_min || max_group) rules.push({ tenant_id, rule_key: "large_group_min", rule_value: String(large_group_min || max_group) })
    if (num_professionals || num_dentists) rules.push({ tenant_id, rule_key: "num_professionals", rule_value: String(num_professionals || num_dentists) })
    if (appointment_duration || reservation_duration) rules.push({ tenant_id, rule_key: "slot_duration", rule_value: String(appointment_duration || reservation_duration) })
    if (total_tables) rules.push({ tenant_id, rule_key: "total_spaces", rule_value: String(total_tables) })
    if (table_capacity) rules.push({ tenant_id, rule_key: "space_capacity", rule_value: String(table_capacity) })

    if (rules.length > 0) await supabase.from("business_rules").insert(rules)

    // ── 3. TENANT UPDATE ────────────────────────────────────────────────────
    const updates: Record<string, unknown> = { onboarding_complete: true }
    if (agent_phone) updates.agent_phone = agent_phone
    if (business_name) updates.name = business_name
    if (business_type) updates.type = business_type
    if (agent_name) updates.agent_name = agent_name
    if (language) updates.language = language

    // Channels
    if (channels && Array.isArray(channels)) {
      updates.channels_enabled = channels
    }

    // Reservation config
    const resConfig: Record<string, unknown> = {}
    if (appointment_duration || reservation_duration) resConfig.default_reservation_duration_minutes = appointment_duration || reservation_duration
    if (total_tables) resConfig.total_spaces = total_tables
    if (table_capacity) resConfig.space_capacity = table_capacity
    if (max_group || max_auto_party) resConfig.max_group = max_group || max_auto_party
    if (num_professionals || num_dentists) resConfig.num_professionals = num_professionals || num_dentists
    if (has_urgencias) resConfig.has_urgencias = true
    if (checkin_time) resConfig.checkin_time = checkin_time
    if (checkout_time) resConfig.checkout_time = checkout_time
    if (Object.keys(resConfig).length > 0) updates.reservation_config = resConfig

    await supabase.from("tenants").update(updates).eq("id", tenant_id)

    // ── 4. CREATE RESOURCES (tables + zones) ────────────────────────────────
    if (zone_names && Array.isArray(zone_names) && zone_names.length > 0) {
      // Create zones
      const zonesToInsert = zone_names.map((name: string) => ({
        tenant_id, name, active: true,
      }))
      await supabase.from("zones").insert(zonesToInsert)
    }

    if (resource_names && Array.isArray(resource_names) && resource_names.length > 0) {
      // Get created zones for mapping
      const { data: createdZones } = await supabase.from("zones").select("id,name").eq("tenant_id", tenant_id).eq("active", true)
      const zoneMap: Record<string, string> = {}
      if (createdZones) createdZones.forEach((z: any) => { zoneMap[z.name] = z.id })

      const tablesToInsert = resource_names.map((r: { name: string; capacity: number }, i: number) => ({
        tenant_id,
        number: String(i + 1),
        name: r.name,
        capacity: r.capacity || 2,
        status: 'libre',
        shape_type: 'square',
        x_pos: 40 + (i % 6) * 120,
        y_pos: 40 + Math.floor(i / 6) * 120,
        w: 80,
        h: 70,
        rotation: 0,
      }))
      await supabase.from("tables").insert(tablesToInsert)
    }

    // ── 5. CONFIGURE REMINDERS ──────────────────────────────────────────────
    if (reminders_enabled !== undefined) {
      await supabase.from("reminder_configs").upsert({
        tenant_id,
        intervals: JSON.stringify(reminder_intervals || ['24h']),
        channel: reminder_channel || 'sms',
        enabled: reminders_enabled,
      }, { onConflict: 'tenant_id' })
    }

    // ── 6. CONFIGURE NOTIFICATIONS (alert rules) ────────────────────────────
    const alertRules: { tenant_id: string; event_type: string; enabled: boolean; priority: string; channels: string }[] = []
    if (notify_new_booking !== undefined) alertRules.push({ tenant_id, event_type: 'new_booking', enabled: notify_new_booking, priority: 'info', channels: JSON.stringify([notify_channel || 'in_app']) })
    if (notify_cancellation !== undefined) alertRules.push({ tenant_id, event_type: 'cancellation', enabled: notify_cancellation, priority: 'warning', channels: JSON.stringify([notify_channel || 'in_app']) })
    if (notify_urgency !== undefined) alertRules.push({ tenant_id, event_type: 'urgency', enabled: notify_urgency, priority: 'critical', channels: JSON.stringify([notify_channel || 'in_app']) })
    if (notify_no_show !== undefined) alertRules.push({ tenant_id, event_type: 'no_show', enabled: notify_no_show, priority: 'warning', channels: JSON.stringify([notify_channel || 'in_app']) })
    if (alertRules.length > 0) {
      await supabase.from("alert_rules").delete().eq("tenant_id", tenant_id)
      await supabase.from("alert_rules").insert(alertRules)
    }

    // ── 7. PROVISION AI AGENT ───────────────────────────────────────────────
    const provision = await provisionElevenAgent(tenant_id)

    return NextResponse.json({ success: true, agent_id: provision.agent_id })
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
