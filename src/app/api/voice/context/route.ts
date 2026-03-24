import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Default response when no tenant found
const DEFAULTS = {
  business_name: "Restaurante",
  agent_name: "Sofia",
  business_info: "Sin informacion disponible.",
  tenant_id: "",
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    // Extract phone numbers from ElevenLabs payload
    const agentNumber = body?.phone_call?.agent_number
      || body?.phone_call?.to
      || body?.agent_number || ""
    const callerPhone = body?.phone_call?.caller_number
      || body?.phone_call?.from
      || body?.caller_number || ""

    // Find tenant by phone number
    let tenant = null
    if (agentNumber) {
      const clean = agentNumber.replace(/[^0-9+]/g, "")
      if (/^\+?[0-9]{7,15}$/.test(clean)) {
        const withPlus = clean.startsWith("+") ? clean : "+" + clean
        const withoutPlus = clean.replace(/^\+/, "")
        const { data } = await supabase
          .from("tenants")
          .select("id, name, agent_name, type")
          .or(`agent_phone.eq.${withPlus},agent_phone.eq.${withoutPlus}`)
          .limit(1)
        tenant = data?.[0]
      }
    }

    if (!tenant) {
      return NextResponse.json({ dynamic_variables: DEFAULTS })
    }

    // ── Customer recognition ──────────────────────────────────────────────
    let customerContext = ''
    if (callerPhone && tenant) {
      const cleanPhone = callerPhone.replace(/[^0-9+]/g, '')
      if (cleanPhone.length >= 7) {
        const { data: customer } = await supabase
          .from('customers')
          .select('name, phone, total_reservations')
          .eq('tenant_id', tenant.id)
          .or(`phone.eq.${cleanPhone},phone.eq.+${cleanPhone.replace(/^\+/, '')}`)
          .limit(1)

        if (customer?.[0]) {
          const c = customer[0]
          // Get last reservation
          const { data: lastRes } = await supabase
            .from('reservations')
            .select('date, time, people, status')
            .eq('tenant_id', tenant.id)
            .eq('customer_phone', cleanPhone)
            .order('date', { ascending: false })
            .limit(1)

          const parts = [`Cliente conocido: ${c.name || 'sin nombre'}`]
          if (c.total_reservations) parts.push(`${c.total_reservations} reservas previas`)
          if (lastRes?.[0]) {
            const lr = lastRes[0]
            parts.push(`Última reserva: ${lr.date} a las ${(lr.time||'').slice(0,5)} para ${lr.people} personas (${lr.status})`)
          }
          customerContext = parts.join('. ') + '.'
        }
      }
    }

    // Load business knowledge
    const { data: kb } = await supabase
      .from("business_knowledge")
      .select("category, content")
      .eq("tenant_id", tenant.id)

    // Build business info string
    const info = (kb || [])
      .map(k => k.content)
      .join(". ")
      .slice(0, 1500) || "Sin informacion adicional."

    // Return dynamic variables for ElevenLabs
    return NextResponse.json({
      dynamic_variables: {
        business_name: tenant.name || DEFAULTS.business_name,
        agent_name: tenant.agent_name || DEFAULTS.agent_name,
        business_info: info,
        tenant_id: tenant.id,
        caller_phone: callerPhone,
        customer_context: customerContext,
      }
    })

  } catch (e: any) {
    // voice/context error
    return NextResponse.json({ dynamic_variables: DEFAULTS })
  }
}
