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

    // Intentar menu_items primero
    const { data: menuItems } = await supabase
      .from("menu_items")
      .select("name, description, price, category, available")
      .eq("tenant_id", tenant_id)
      .eq("available", true)
      .order("category")
      .limit(40)

    if (menuItems && menuItems.length > 0) {
      const byCategory: Record<string, { name: string; price?: number; description?: string }[]> = {}
      for (const item of menuItems) {
        const cat = item.category || "General"
        if (!byCategory[cat]) byCategory[cat] = []
        byCategory[cat].push({ name: item.name, price: item.price, description: item.description })
      }
      return NextResponse.json({ success: true, source: "menu_items", items: byCategory })
    }

    // Fallback: business_knowledge con categorias de menu/servicios
    const { data: knowledge } = await supabase
      .from("business_knowledge")
      .select("category, content")
      .eq("tenant_id", tenant_id)
      .eq("active", true)
      .in("category", ["menu", "servicios", "carta", "productos", "tratamientos", "precios"])

    const grouped: Record<string, string[]> = {}
    for (const k of knowledge || []) {
      if (!grouped[k.category]) grouped[k.category] = []
      grouped[k.category].push(k.content)
    }

    return NextResponse.json({
      success: true,
      source: "business_knowledge",
      items: grouped,
      note: Object.keys(grouped).length === 0 ? "No hay carta disponible. Indica al cliente que consulte en el local o por la web." : undefined,
    })
  } catch (err) {
    return NextResponse.json({ error: "internal error" }, { status: 500 })
  }
}
