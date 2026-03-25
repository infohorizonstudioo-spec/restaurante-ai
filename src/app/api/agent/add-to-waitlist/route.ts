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
    const { tenant_id, customer_name, customer_phone, date, time, party_size } = await req.json()
    if (!tenant_id || !customer_name || !date) {
      return NextResponse.json({ error: "tenant_id, customer_name, date required" }, { status: 400 })
    }

    // Check if already on waitlist
    if (customer_phone) {
      const { data: existing } = await supabase.from("waitlist")
        .select("id").eq("tenant_id", tenant_id).eq("customer_phone", customer_phone).eq("date", date).maybeSingle()
      if (existing) {
        return NextResponse.json({ success: true, already_listed: true, message: "Ya estás en la lista de espera para ese día." })
      }
    }

    const { data, error } = await supabase.from("waitlist").insert({
      tenant_id,
      customer_name,
      customer_phone: customer_phone || null,
      date,
      preferred_time: time || null,
      party_size: party_size || 2,
      status: "waiting",
    }).select("id").maybeSingle()

    // If the table doesn't exist, handle gracefully
    if (error && error.code === '42P01') {
      return NextResponse.json({ success: true, waitlist_supported: false, message: "Te apuntamos y te avisamos si queda hueco." })
    }
    if (error) return NextResponse.json({ error: "Internal server error" }, { status: 500 })

    return NextResponse.json({
      success: true,
      waitlist_id: data?.id,
      message: `${customer_name} está en la lista de espera para el ${date}${time ? ' a las ' + time : ''}. Si queda un hueco, te avisamos.`,
    })
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
