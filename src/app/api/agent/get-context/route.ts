import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = "force-dynamic"

// ============================================================
// LOGICA POR TIPO DE NEGOCIO
// Motor base comun, comportamiento diferente por sector
// ============================================================
const BUSINESS_TYPE_LOGIC: Record<string, object> = {
  restaurante: {
    sector: "restaurante",
    action_name: "reserva de mesa",
    required_fields: ["nombre", "fecha", "hora", "numero_de_personas"],
    optional_fields: ["zona_preferida", "ocasion_especial", "alergias"],
    flow: [
      "Pregunta nombre del cliente",
      "Pregunta fecha y hora deseada",
      "Pregunta numero de personas",
      "Llama a check_availability para verificar hueco real",
      "Si hay hueco confirma con el cliente",
      "Llama a create_reservation solo tras confirmacion explicita",
      "Menciona politica de cancelacion si existe en rules_var"
    ],
    catalog_label: "carta",
    catalog_instruction: "Para la carta llama a get_menu_or_services. Menciona max 3-4 platos. Oferta menu del dia si lo hay.",
    closing: "Reserva confirmada. Hasta el [fecha].",
    urgency_keywords: ["urgente", "hoy", "ahora"],
    urgency_action: "Verifica disponibilidad inmediata con check_availability"
  },
  bar: {
    sector: "bar",
    action_name: "reserva de zona o evento",
    required_fields: ["nombre", "fecha", "hora", "numero_de_personas"],
    optional_fields: ["tipo_evento", "zona_preferida"],
    flow: [
      "Pregunta nombre y tipo de evento si es grupo",
      "Pregunta fecha, hora y numero de personas",
      "Llama a check_availability",
      "Para grupos grandes anota y confirma que alguien les llama"
    ],
    catalog_label: "tapas y bebidas",
    catalog_instruction: "Para carta llama a get_menu_or_services. Solo menciona especialidades.",
    closing: "Apuntado. Hasta el [fecha]."
  },
  clinica_dental: {
    sector: "clinica_dental",
    action_name: "cita dental",
    required_fields: ["nombre_paciente", "tipo_consulta", "disponibilidad_horaria"],
    optional_fields: ["es_primera_vez", "mutua"],
    flow: [
      "Pregunta nombre del paciente",
      "Pregunta tipo de consulta: revision, limpieza, urgencia, empaste, ortodoncia",
      "Si es urgencia da prioridad maxima",
      "Pregunta disponibilidad horaria general (manana/tarde, dias)",
      "Llama a check_availability",
      "Confirma cita. NO preguntes razon ni sintomas."
    ],
    catalog_label: "servicios dentales",
    catalog_instruction: "Para servicios y precios llama a get_menu_or_services.",
    closing: "Cita confirmada para [nombre] el [fecha] a las [hora].",
    urgency_keywords: ["dolor", "urgente", "se me ha roto", "me duele"],
    urgency_action: "Trata como urgencia. Ofrece el hueco mas proximo disponible."
  },
  clinica_medica: {
    sector: "clinica_medica",
    action_name: "cita medica",
    required_fields: ["nombre_paciente", "especialidad_o_medico", "disponibilidad"],
    optional_fields: ["es_revision", "mutua"],
    flow: [
      "Pregunta nombre del paciente",
      "Pregunta con que especialidad o medico quiere cita",
      "Pregunta disponibilidad horaria",
      "Llama a check_availability",
      "Confirma cita. NO preguntes motivo medico."
    ],
    catalog_label: "especialidades",
    catalog_instruction: "Para lista de especialidades llama a get_menu_or_services.",
    closing: "Cita confirmada."
  },
  veterinaria: {
    sector: "veterinaria",
    action_name: "cita veterinaria",
    required_fields: ["nombre_dueno", "nombre_mascota", "especie", "motivo_visita"],
    optional_fields: ["raza", "edad_mascota"],
    flow: [
      "Pregunta nombre del dueno y de la mascota",
      "Pregunta especie (perro, gato, etc)",
      "Pregunta motivo de la visita brevemente",
      "Si es urgencia detecta palabras clave y prioriza",
      "Llama a check_availability",
      "Confirma cita"
    ],
    catalog_label: "servicios veterinarios",
    catalog_instruction: "Para servicios y precios llama a get_menu_or_services.",
    closing: "Cita confirmada para [mascota] el [fecha].",
    urgency_keywords: ["no respira", "accidente", "no come", "muy mal", "urgente"],
    urgency_action: "Trata como urgencia. Ofrece cita inmediata o indica ir directamente."
  },
  fisioterapia: {
    sector: "fisioterapia",
    action_name: "sesion de fisioterapia",
    required_fields: ["nombre_paciente", "zona_afectada_o_motivo", "disponibilidad"],
    optional_fields: ["es_nuevo_paciente", "medico_derivador"],
    flow: [
      "Pregunta nombre del paciente",
      "Pregunta brevemente zona o motivo (cervical, lumbar, deportivo...)",
      "Pregunta disponibilidad horaria",
      "Llama a check_availability",
      "Confirma sesion. NO des diagnostico ni consejo medico."
    ],
    catalog_label: "tratamientos",
    catalog_instruction: "Para tratamientos y precios llama a get_menu_or_services.",
    closing: "Sesion confirmada."
  },
  psicologia: {
    sector: "psicologia",
    action_name: "cita de psicologia",
    required_fields: ["nombre_paciente", "disponibilidad"],
    optional_fields: ["es_primera_vez", "modalidad"],
    flow: [
      "Pregunta nombre del paciente",
      "Pregunta disponibilidad horaria general",
      "NO preguntes motivo de consulta ni sintomas",
      "Llama a check_availability",
      "Confirma cita con discrecion total"
    ],
    catalog_label: "servicios",
    catalog_instruction: "Para info de servicios llama a get_menu_or_services. Sé discreto.",
    closing: "Cita confirmada. Hasta el [fecha].",
    crisis_keywords: ["suicidio", "hacerme dano", "no puedo mas"],
    crisis_action: "Con mucho cuidado proporciona el telefono de crisis 024 y ofrece cita urgente."
  },
  inmobiliaria: {
    sector: "inmobiliaria",
    action_name: "visita o consulta inmobiliaria",
    required_fields: ["nombre", "tipo_interes", "disponibilidad"],
    optional_fields: ["zona", "presupuesto", "tipo_inmueble"],
    flow: [
      "Pregunta nombre",
      "Pregunta si quiere comprar, vender o alquilar",
      "Pregunta zona y presupuesto orientativo si compra",
      "Anota el interes y confirma que un agente le llama en menos de 2 horas",
      "Llama a create_reservation con event_type callback"
    ],
    catalog_label: "propiedades",
    catalog_instruction: "Para propiedades disponibles llama a get_menu_or_services.",
    closing: "Perfecto, un agente te llama en menos de dos horas."
  },
  peluqueria: {
    sector: "peluqueria",
    action_name: "cita de peluqueria",
    required_fields: ["nombre", "servicio", "disponibilidad"],
    optional_fields: ["peluquero_preferido"],
    flow: [
      "Pregunta nombre",
      "Pregunta que servicio quiere: corte, tinte, mechas, tratamiento...",
      "Llama a check_availability con el servicio como party_size=1",
      "Confirma cita"
    ],
    catalog_label: "servicios y precios",
    catalog_instruction: "Para servicios y precios llama a get_menu_or_services.",
    closing: "Cita confirmada para [nombre] el [fecha] a las [hora]."
  },
  ecommerce: {
    sector: "ecommerce",
    action_name: "gestion de pedido o consulta de producto",
    required_fields: ["nombre_cliente", "numero_pedido_o_producto"],
    optional_fields: ["email"],
    flow: [
      "Pregunta nombre y numero de pedido o producto de interes",
      "Para estado de pedido: anota y confirma que revisan y llaman",
      "Para consulta de producto: llama a get_menu_or_services",
      "Llama a create_reservation con event_type=order si es pedido"
    ],
    catalog_label: "productos",
    catalog_instruction: "Para catalogo llama a get_menu_or_services.",
    closing: "Gestion registrada. Te contactamos en breve."
  },
  otro: {
    sector: "otro",
    action_name: "gestion general",
    required_fields: ["nombre", "motivo"],
    optional_fields: [],
    flow: [
      "Pregunta nombre",
      "Pregunta en que puede ayudar",
      "Usa business_context para responder",
      "Si necesita cita llama a check_availability"
    ],
    catalog_label: "servicios",
    catalog_instruction: "Para servicios llama a get_menu_or_services.",
    closing: "Gestion completada."
  }
}

export async function POST(req: NextRequest) {
  try {
    const { tenant_id } = await req.json()
    if (!tenant_id) return NextResponse.json({ error: "tenant_id required" }, { status: 400 })

    const [tenantRes, knowledgeRes, rulesRes, memoryRes] = await Promise.all([
      supabase.from("tenants")
        .select("id, name, type, phone, address, agent_name, agent_config, reservation_config")
        .eq("id", tenant_id).single(),
      supabase.from("business_knowledge")
        .select("category, content").eq("tenant_id", tenant_id).eq("active", true),
      supabase.from("business_rules")
        .select("rule_key, rule_value").eq("tenant_id", tenant_id),
      supabase.from("business_memory")
        .select("memory_type, content, confidence").eq("tenant_id", tenant_id)
        .eq("active", true).gte("confidence", 0.6)
        .order("confidence", { ascending: false }).limit(15),
    ])

    if (!tenantRes.data) return NextResponse.json({ error: "tenant not found" }, { status: 404 })

    const t = tenantRes.data
    const businessType = t.type || "otro"

    // Agrupar knowledge por categoria
    const byCategory: Record<string, string[]> = {}
    for (const k of knowledgeRes.data || []) {
      if (!byCategory[k.category]) byCategory[k.category] = []
      byCategory[k.category].push(k.content)
    }

    // Mapear reglas
    const rules: Record<string, string> = {}
    for (const r of rulesRes.data || []) rules[r.rule_key] = r.rule_value

    // Memoria agrupada por tipo
    const memoryByType: Record<string, string[]> = {}
    for (const m of memoryRes.data || []) {
      if (!memoryByType[m.memory_type]) memoryByType[m.memory_type] = []
      memoryByType[m.memory_type].push(m.content)
    }

    // business_context estructurado con todas las variables
    const business_context = {
      business_name: t.name,
      business_type: businessType,
      business_information: byCategory.servicios?.join(" ") || byCategory.general?.join(" ") || "",
      services_var: byCategory.servicios || byCategory.tratamientos || byCategory.especialidades || [],
      catalog_var: byCategory.menu || byCategory.carta || byCategory.productos || byCategory.catalogo || [],
      menu_var: byCategory.menu || byCategory.carta || [],
      prices_var: byCategory.precios || [],
      hours_var: rules.opening_hours
        ? { raw: rules.opening_hours, parsed: (() => { try { return JSON.parse(rules.opening_hours) } catch { return rules.opening_hours } })() }
        : { text: byCategory.horarios?.join(" ") || "Consultar horarios con el negocio" },
      rules_var: {
        max_capacity: rules.max_capacity,
        closed_days: rules.closed_days,
        slot_duration: rules.slot_duration,
        advance_booking_hours: rules.advance_booking_hours,
        large_group_min: rules.large_group_min,
        custom: byCategory.politicas || byCategory.reglas || [],
        ...rules,
      },
      faqs_var: byCategory.faqs || byCategory.preguntas || [],
      memory_var: {
        corrections: memoryByType.correction || [],
        preferences: memoryByType.preference || [],
        patterns: memoryByType.pattern || [],
        owner_rules: memoryByType.rule || [],
      },
      agent_name: t.agent_name || "Sofia",
      phone: t.phone,
      address: t.address,
    }

    // business_type_logic del sector correspondiente
    const business_type_logic = BUSINESS_TYPE_LOGIC[businessType] || BUSINESS_TYPE_LOGIC.otro

    return NextResponse.json({
      success: true,
      business_type_logic,
      business_context,
      // Resumen compacto para el agente
      summary: "Negocio: " + t.name + " | Tipo: " + businessType + " | Logica: " + JSON.stringify(business_type_logic) + " | Contexto: " + JSON.stringify(business_context)
    })
  } catch (err) {
    console.error("[get-context]", err)
    return NextResponse.json({ error: "internal error" }, { status: 500 })
  }
    }
