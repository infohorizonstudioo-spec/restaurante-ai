import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { validateAgentKey } from "@/lib/agent-auth"
import { resolveTemplate } from "@/lib/templates"
import { BUSINESS_TYPE_LOGIC } from "@/app/api/agent/get-context/route"
import { buildSmartCustomerContext, getDemandForecast } from "@/lib/smart-context"
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const dynamic = "force-dynamic"

/** Escape SQL LIKE wildcards to prevent pattern injection in ilike() filters */
function escapeLike(str: string): string {
  return str.replace(/[%_\\]/g, '\\$&')
}

/** Validate that a cleaned phone contains only digits and optional leading + */
function isSafePhone(phone: string): boolean {
  return /^\+?[0-9]+$/.test(phone)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Default response when no tenant found
const DEFAULTS = {
  business_name: "Tu negocio",
  agent_name: "Recepción",
  business_info: "Sin informacion disponible.",
  tenant_id: "",
}

export async function POST(req: NextRequest) {
  if (!validateAgentKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const rl = rateLimitByIp(req, RATE_LIMITS.agent, 'voice:context')
  if (rl.blocked) return rl.response

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

    // Business type context (needed early for customer recognition)
    const businessType = tenant.type || 'otro'
    const tmpl = resolveTemplate(businessType)
    const typeLogic = BUSINESS_TYPE_LOGIC[businessType] || BUSINESS_TYPE_LOGIC.otro
    const bookingTerm = tmpl.labels.reserva.toLowerCase()

    // ── Customer recognition ──────────────────────────────────────────────
    let customerContext = ''
    if (callerPhone && tenant) {
      const cleanPhone = callerPhone.replace(/[^0-9+]/g, '')
      if (cleanPhone.length >= 7 && isSafePhone(cleanPhone)) {
        const phoneWithPlus = cleanPhone.startsWith('+') ? cleanPhone : '+' + cleanPhone
        const phoneWithoutPlus = cleanPhone.replace(/^\+/, '')
        const { data: customer } = await supabase
          .from('customers')
          .select('name, phone, total_reservations')
          .eq('tenant_id', tenant.id)
          .or(`phone.eq.${phoneWithPlus},phone.eq.${phoneWithoutPlus}`)
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
            .ilike('content', `%${escapeLike(c.name || '')}%`)
            .limit(5)

          const isHospitality = ['restaurante', 'bar', 'cafeteria'].includes(businessType)
          const parts = [`CONOCES a este cliente. Se llama ${c.name || 'desconocido'}. Trátalo como a alguien que ya conoces — usa su nombre desde que sepas quién es.`]

          if (c.total_reservations && c.total_reservations >= 10) {
            parts.push(`Es SUPER habitual — lleva ${c.total_reservations} ${bookingTerm}s. Trátalo como a un amigo. Puedes ofrecerle "¿lo de siempre?"`)
          } else if (c.total_reservations && c.total_reservations >= 3) {
            parts.push(`Es habitual — lleva ${c.total_reservations} ${bookingTerm}s. Demuestra que le recuerdas.`)
          } else if (c.total_reservations === 1) {
            parts.push(`Ha venido una vez antes. Puedes decir "me suena tu nombre" si quieres.`)
          }

          if (recentRes && recentRes.length > 0) {
            const lr = recentRes[0]
            parts.push(`La última ${bookingTerm} fue el ${lr.date} a las ${(lr.time||'').slice(0,5)}${lr.people > 1 ? ` para ${lr.people} personas` : ''}`)

            // Detect patterns
            if (recentRes.length >= 2) {
              const samePeople = recentRes.every(r => r.people === recentRes[0].people)
              if (samePeople && recentRes[0].people > 1) parts.push(`Siempre pide ${bookingTerm} para ${recentRes[0].people}`)

              const sameTime = recentRes.filter(r => (r.time||'').slice(0,2) === (recentRes[0].time||'').slice(0,2)).length >= 2
              if (sameTime) parts.push(`Suele pedir hora a las ${(recentRes[0].time||'').slice(0,5)}`)
            }

            // Check for allergies or special notes (hospitality only)
            if (isHospitality) {
              const allNotes = recentRes.map(r => r.notes || '').join(' ').toLowerCase()
              if (allNotes.includes('alergi') || allNotes.includes('celiac') || allNotes.includes('vegeta') || allNotes.includes('vegan') || allNotes.includes('intoler') || allNotes.includes('sin gluten') || allNotes.includes('sin lactosa') || allNotes.includes('halal') || allNotes.includes('kosher')) {
                parts.push('IMPORTANTE: tiene restricciones alimentarias — revisa notas anteriores')
              }
            }

            // No-show history
            const noShows = recentRes.filter(r => r.status === 'no_show').length
            if (noShows >= 2) parts.push(`Ojo: no se presentó ${noShows} veces — pídele confirmación`)
            else if (noShows === 1) parts.push(`Nota: no se presentó 1 vez`)
          }

          // Add learned preferences
          if (memories && memories.length > 0) {
            const prefs = memories.map(m => m.content).join('. ')
            parts.push(`Preferencias: ${prefs}`)
          }

          if ((c as any).vip) parts.push('Es VIP — trátalo especialmente bien')

          customerContext = parts.join('. ') + '.'
        }
      }
    }

    // ── Smart Context Engine: deep intelligence about this customer ──
    try {
      const today = new Date().toISOString().slice(0, 10)
      const [smartCtx, forecast] = await Promise.all([
        buildSmartCustomerContext(tenant.id, callerPhone, today, undefined, undefined, businessType),
        getDemandForecast(tenant.id, today, businessType),
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

    // Check if customer has a preferred language from previous calls
    let preferredLanguage = 'es'
    if (callerPhone && tenant) {
      const cleanPhone = callerPhone.replace(/[^0-9+]/g, '')
      if (cleanPhone.length >= 7) {
        const { data: prevCall } = await supabase
          .from('calls')
          .select('detected_language')
          .eq('tenant_id', tenant.id)
          .or(`caller_phone.eq.${cleanPhone},from_number.eq.${cleanPhone}`)
          .not('detected_language', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
        if (prevCall?.[0]?.detected_language) {
          preferredLanguage = prevCall[0].detected_language
        }
      }
    }

    // If customer spoke a different language before, add it to context
    if (preferredLanguage !== 'es') {
      customerContext += `\nIDIOMA PREFERIDO: Este cliente habló en ${preferredLanguage.toUpperCase()} en llamadas anteriores. Respóndele en ese idioma desde el principio.`
    }

    // ── Business personality: learned patterns from this specific business ──
    let businessPersonality = ''
    try {
      const { data: bMemories } = await supabase
        .from('business_memory')
        .select('content, memory_type, confidence')
        .eq('tenant_id', tenant.id)
        .eq('active', true)
        .gte('confidence', 0.6)
        .order('confidence', { ascending: false })
        .limit(15)

      if (bMemories && bMemories.length > 0) {
        const grouped: Record<string, string[]> = {}
        for (const m of bMemories) {
          const type = m.memory_type || 'general'
          if (!grouped[type]) grouped[type] = []
          grouped[type].push(m.content)
        }
        const parts: string[] = []
        if (grouped.pattern) parts.push('PATRONES DETECTADOS: ' + grouped.pattern.join('. '))
        if (grouped.preference) parts.push('PREFERENCIAS DE CLIENTES: ' + grouped.preference.join('. '))
        if (grouped.peak) parts.push('PICOS DE DEMANDA: ' + grouped.peak.join('. '))
        if (grouped.issue) parts.push('PROBLEMAS RECURRENTES: ' + grouped.issue.join('. '))
        if (grouped.general) parts.push('NOTAS: ' + grouped.general.join('. '))
        businessPersonality = parts.join('\n')
      }
    } catch { /* non-critical */ }

    // ── Call stats for this business (gives context on how busy they are) ──
    let callStats = ''
    try {
      const today = new Date().toISOString().slice(0, 10)
      const { count: todayCalls } = await supabase
        .from('calls')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id)
        .gte('created_at', today + 'T00:00:00')

      if (todayCalls && todayCalls > 5) {
        callStats = `Hoy ya has atendido ${todayCalls} llamadas. Día movido.`
      }
    } catch { /* non-critical */ }

    if (callStats) businessPersonality += '\n' + callStats

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
        preferred_language: preferredLanguage,
        business_personality: businessPersonality,
      }
    })

  } catch (e: any) {
    // voice/context error
    return NextResponse.json({ dynamic_variables: DEFAULTS })
  }
}
