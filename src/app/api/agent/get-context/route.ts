import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = "force-dynamic"

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
        .order("confidence", { ascending: false }).limit(10),
    ])

    if (!tenantRes.data) return NextResponse.json({ error: "tenant not found" }, { status: 404 })

    const t = tenantRes.data
    const knowledgeByCategory: Record<string, string[]> = {}
    for (const k of knowledgeRes.data || []) {
      if (!knowledgeByCategory[k.category]) knowledgeByCategory[k.category] = []
      knowledgeByCategory[k.category].push(k.content)
    }
    const rulesObj: Record<string, string> = {}
    for (const r of rulesRes.data || []) rulesObj[r.rule_key] = r.rule_value

    return NextResponse.json({
      success: true,
      context: {
        business_id: t.id,
        business_name: t.name,
        business_type: t.type,
        phone: t.phone,
        address: t.address,
        agent_name: t.agent_name || "Sofia",
        knowledge: knowledgeByCategory,
        rules: rulesObj,
        memory: (memoryRes.data || []).map((m) => ({ type: m.memory_type, content: m.content })),
        config: t.agent_config || {},
      }
    })
  } catch (err) {
    console.error("[get-context]", err)
    return NextResponse.json({ error: "internal error" }, { status: 500 })
  }
        }
