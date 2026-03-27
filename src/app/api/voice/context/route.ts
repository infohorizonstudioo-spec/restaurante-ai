import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { resolveTemplate } from "@/lib/templates"
import { BUSINESS_TYPE_LOGIC } from "@/app/api/agent/get-context/route"
import { buildSmartCustomerContext, getDemandForecast } from "@/lib/smart-context"

export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Default response when no tenant found
const DEFAULTS = {
  business_name: "Restaurante",
  agent_name: "Recepcionista",
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
          // Get last 3 reservations for pattern detection
          const { data: recentRes } = await supabase
            .from('reservations')
            .select('date, time, people, status, notes')
            .eq('tenant_id', tenant.id)
            .eq('customer_phone', cleanPhone)
            .order('date', { ascending: false })
            .limit(3)

          // Get learned preferences from memory
          const { data: memories } = await supabase
            .from('business_memory')
            .select('content, memory_type')
            .eq('tenant_id', tenant.id)
            .eq('memory_type', 'preference')
            .ilike('content', `%${c.name || ''}%`)
            .limit(5)

          const parts = [`Este cliente se llama ${c.name || 'desconocido'}`]

          if (c.total_reservations && c.total_reservations >= 3) {
            parts.push(`Es habitual — ha venido ${c.total_reservations} veces`)
          } else if (c.total_reservations === 1) {
            parts.push('Ha venido una vez antes')
          }

          if (recentRes && recentRes.length > 0) {
            const lr = recentRes[0]
            parts.push(`La última vez vino el ${lr.date} a las ${(lr.time||'').slice(0,5)} para ${lr.people} personas`)

            // Detect patterns
            if (recentRes.length >= 2) {
              const samePeople = recentRes.every(r => r.people === recentRes[0].people)
              if (samePeople) parts.push(`Siempre reserva para ${recentRes[0].people}`)

              const sameTime = recentRes.filter(r => (r.time||'').slice(0,2) === (recentRes[0].time||'').slice(0,2)).length >= 2
              if (sameTime) parts.push(`Suele venir a las ${(recentRes[0].time||'').slice(0,5)}`)
            }

            // Check for allergies or special notes
            const allNotes = recentRes.map(r => r.notes || '').join(' ').toLowerCase()
            if (allNotes.includes('alergi') || allNotes.includes('celiac') || allNotes.includes('vegeta') || allNotes.includes('vegan') || allNotes.includes('intoler') || allNotes.includes('sin gluten') || allNotes.includes('sin lactosa') || allNotes.includes('halal') || allNotes.includes('kosher')) {
              parts.push('IMPORTANTE: tiene restricciones alimentarias — revisa notas de sus reservas anteriores')
            }

            // No-show history
            const noShows = recentRes.filter(r => r.status === 'no_show').length
            if (noShows >= 2) parts.push(`⚠ Ojo: no se presentó ${noShows} veces — considera pedir confirmación`)
            else if (noShows === 1) parts.push(`Nota: no se presentó 1 vez`)
          }

          // Add learned preferences
          if (memories && memories.length > 0) {
            const prefs = memories.map(m => m.content).join('. ')
            parts.push(`Preferencias detectadas: ${prefs}`)
          }

          if ((c as any).vip) parts.push('Es cliente VIP — trátalo especialmente bien')

          customerContext = parts.join('. ') + '.'
        }
      }
    }

    // ── Smart Context Engine: deep intelligence about this customer ──
    try {
      const today = new Date().toISOString().slice(0, 10)
      const [smartCtx, forecast] = await Promise.all([
        buildSmartCustomerContext(tenant.id, callerPhone, today),
        getDemandForecast(tenant.id, today),
      ])
      if (smartCtx.contextText) customerContext += smartCtx.contextText
      if (forecast) customerContext += '\n' + forecast
    } catch { /* smart context is enhancement, not critical */ }

    // Load business knowledge
    const { data: kb } = await supabase
      .from("business_knowledge")
      .select("category, content")
      .eq("tenant_id", tenant.id)

    // Build business info string
    const grouped = (kb || []).reduce((acc: Record<string,string[]>, k: any) => {
      const cat = k.category || 'general'
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(k.content)
      return acc
    }, {})
    const info = Object.entries(grouped)
      .map(([cat, items]) => `[${cat.toUpperCase()}]\n${items.join('\n')}`)
      .join('\n\n')
      .slice(0, 3000) || "Sin informacion adicional."

    // Fecha actual en español (se inyecta en cada llamada, nunca hardcodeada)
    const now = new Date()
    const currentDate = now.toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    })

    // Business type context for ElevenLabs agent
    const businessType = tenant.type || 'otro'
    const tmpl = resolveTemplate(businessType)
    const typeLogic = BUSINESS_TYPE_LOGIC[businessType] || BUSINESS_TYPE_LOGIC.otro
    const bookingTerm = tmpl.labels.reserva.toLowerCase() // "reserva" | "cita" | "sesión" | "clase"

    // Return dynamic variables for ElevenLabs
    return NextResponse.json({
      dynamic_variables: {
        business_name: tenant.name || DEFAULTS.business_name,
        agent_name: tenant.agent_name || DEFAULTS.agent_name,
        business_info: info,
        tenant_id: tenant.id,
        caller_phone: callerPhone,
        customer_context: customerContext,
        current_date: currentDate,
        business_type: businessType,
        booking_term: bookingTerm,
        action_name: (typeLogic as any).action_name || 'gestión',
      }
    })

  } catch (e: any) {
    // voice/context error
    return NextResponse.json({ dynamic_variables: DEFAULTS })
  }
}
