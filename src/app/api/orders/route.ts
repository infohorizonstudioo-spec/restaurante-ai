import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveTemplate } from '@/lib/templates'
import { requireAuth } from '@/lib/api-auth'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// GET /api/orders?limit=50&page=0
export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req)
    if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const tenantId = auth.tenantId
    const url = new URL(req.url)
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const page  = parseInt(url.searchParams.get('page')  || '0')

    const { data, error, count } = await admin.from('order_events')
      .select('id,tenant_id,call_sid,status,order_type,customer_name,customer_phone,items,notes,pickup_time,total_estimate,table_id,created_at,updated_at', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(page * limit, (page + 1) * limit - 1)

    if (error) throw error
    return NextResponse.json({ orders: data || [], total: count || 0, page, limit })
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/orders — crear pedido desde el panel
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { tenant_id, customer_name, customer_phone, order_type = 'mesa', notes, items = [], total_estimate = 0 } = body

    if (!tenant_id) return NextResponse.json({ error: 'tenant_id required' }, { status: 400 })
    if (!customer_name) return NextResponse.json({ error: 'customer_name required' }, { status: 400 })

    // Verificar que el tenant tiene plan Pro o Business (pedidos es feature premium)
    const { data: tenant } = await admin.from('tenants').select('plan,type').eq('id', tenant_id).maybeSingle()
    const isPro = ['pro', 'business', 'enterprise'].includes((tenant as any)?.plan || '')
    if (!isPro) return NextResponse.json({ error: 'Pedidos disponible solo en plan Pro o Business' }, { status: 403 })

    // Guardia de plantilla: pedidos solo para hostelería
    const tmpl = resolveTemplate((tenant as any)?.type || 'otro')
    if (!tmpl.hasOrders) {
      return NextResponse.json({ error: 'Módulo de pedidos no disponible para este tipo de negocio' }, { status: 403 })
    }

    const { data: order, error } = await admin.from('order_events').insert({
      tenant_id, customer_name,
      customer_phone: customer_phone || null,
      order_type,
      notes: notes || null,
      items: items || [],
      total_estimate: parseFloat(String(total_estimate)) || 0,
      status: 'collecting',
    }).select().single()

    if (error) throw error
    return NextResponse.json({ success: true, order })
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/orders — actualizar estado de pedido
export async function PATCH(req: Request) {
  try {
    const { id, tenant_id, status, notes } = await req.json()
    if (!id || !tenant_id) return NextResponse.json({ error: 'id y tenant_id requeridos' }, { status: 400 })

    const validStatuses = ['collecting', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled']
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
    }

    const updates: any = { updated_at: new Date().toISOString() }
    if (status) updates.status = status
    if (notes !== undefined) updates.notes = notes

    const { data, error } = await admin.from('order_events')
      .update(updates)
      .eq('id', id).eq('tenant_id', tenant_id)
      .select().single()

    if (error) throw error
    return NextResponse.json({ success: true, order: data })
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
