import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { validateAgentKey } from "@/lib/agent-auth"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    if (!validateAgentKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    const { tenant_id, date, time, party_size, people } = await req.json()
    if (!tenant_id || !date) return NextResponse.json({ error: "tenant_id and date required" }, { status: 400 })
    const size = party_size || people || 2

    const [rulesRes, existingRes] = await Promise.all([
      supabase.from("business_rules").select("rule_key, rule_value").eq("tenant_id", tenant_id),
      supabase.from("reservations")
        .select("id, reservation_time, party_size, status")
        .eq("tenant_id", tenant_id)
        .gte("reservation_time", date + "T00:00:00")
        .lte("reservation_time", date + "T23:59:59")
        .not("status", "eq", "cancelled"),
    ])

    const rules: Record<string, string> = {}
    for (const r of rulesRes.data || []) rules[r.rule_key] = r.rule_value

    const maxCapacity = parseInt(rules.max_capacity || "50")
    const bookedPeople = (existingRes.data || []).reduce((s, r) => s + (r.party_size || 0), 0)
    const available = maxCapacity - bookedPeople

    let openHours: { lunch_open?: string; lunch_close?: string; dinner_open?: string; dinner_close?: string } = {}
    try { openHours = JSON.parse(rules.opening_hours || "{}") } catch {}

    const slots: string[] = []
    const addSlots = (open: string, close: string) => {
      if (!open || !close) return
      let [h] = open.split(":").map(Number)
      const [closeH] = close.split(":").map(Number)
      while (h < closeH) {
        const slot = h.toString().padStart(2, "0") + ":00"
        const slotBooked = (existingRes.data || [])
          .filter((r) => r.reservation_time?.includes("T" + slot))
          .reduce((s, r) => s + (r.party_size || 0), 0)
        if (slotBooked + size <= maxCapacity) slots.push(slot)
        h++
      }
    }

    if (time) {
      slots.push(time)
    } else {
      addSlots(openHours.lunch_open || "", openHours.lunch_close || "")
      addSlots(openHours.dinner_open || "", openHours.dinner_close || "")
    }

    // ── Rank slots by predicted success ──────────────────────────────────
    const rankedSlots = slots.map(slot => {
      let score = 50 // base score
      const slotHour = parseInt(slot.split(':')[0])

      // Peak hours get lower score (busier = less available)
      const slotBooked = (existingRes.data || [])
        .filter((r) => r.reservation_time?.includes("T" + slot))
        .reduce((s, r) => s + (r.party_size || 0), 0)
      const occupancyRate = maxCapacity > 0 ? slotBooked / maxCapacity : 0
      score -= Math.round(occupancyRate * 30) // Less score if busy

      // Prefer dinner prime time (20:00-21:30) and lunch (13:30-14:30)
      if ((slotHour >= 20 && slotHour <= 21) || (slotHour >= 13 && slotHour <= 14)) {
        score += 10 // popular times get slight boost (customers expect them)
      }

      // Very early/late slots get penalty
      if (slotHour < 12 || slotHour > 22) score -= 15

      return { slot, score, occupancy: Math.round(occupancyRate * 100) }
    }).sort((a, b) => b.score - a.score)

    const bestSlots = rankedSlots.slice(0, 3).map(s => s.slot)
    const allSlots = rankedSlots.map(s => s.slot)

    // Build suggestion for agent
    let suggestion = ''
    if (rankedSlots.length > 0) {
      const best = rankedSlots[0]
      if (best.occupancy > 70) {
        suggestion = `El horario de las ${best.slot} está bastante lleno (${best.occupancy}% ocupado). Mejor sugerir ${rankedSlots[1]?.slot || best.slot}.`
      } else if (bestSlots.length >= 2) {
        suggestion = `Los mejores horarios son ${bestSlots[0]} y ${bestSlots[1]}.`
      }
    }

    return NextResponse.json({
      success: true,
      available: available > 0 && allSlots.length > 0,
      available_slots: allSlots.slice(0, 6),
      best_slots: bestSlots,
      suggestion,
      capacity_remaining: available,
      rules,
    })
  } catch (err) {
    return NextResponse.json({ error: "internal error" }, { status: 500 })
  }
}
