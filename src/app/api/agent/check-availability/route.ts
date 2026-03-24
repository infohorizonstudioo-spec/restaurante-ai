import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
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

    return NextResponse.json({
      success: true,
      available: available > 0 && slots.length > 0,
      available_slots: slots.slice(0, 6),
      capacity_remaining: available,
      rules,
    })
  } catch (err) {
    return NextResponse.json({ error: "internal error" }, { status: 500 })
  }
}
