import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveTemplate } from '@/lib/templates'
import { requireAuth } from '@/lib/api-auth'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { sanitizeString, sanitizeName, sanitizePhone, sanitizePositiveInt } from '@/lib/sanitize'
import { logger } from '@/lib/logger'
import { notifyOrderCreated } from '@/lib/harmonize-engine'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// GET /api/orders?limit=50&page=0
export async function GET(req: Request) {
  try {
    const rl = rateLimitByIp(req, RATE_LIMITS.api, 'orders:get')
    if (rl.blocked) return rl.response

    const auth = await requireAuth(req)
    if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const tenantId = auth.tenantId
    const url = new URL(req.url)
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50'), 1), 100)
    const page  = Math.min(Math.max(parseInt(url.searchParams.get('page')  || '0'), 0), 1000)

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
    const rl = rateLimitByIp(req, RATE_LIMITS.api, 'orders:post')
    if (rl.blocked) return rl.response

    const auth = await requireAuth(req)
    if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const tenant_id = auth.tenantId

    const body = await req.json()
    const { customer_name, customer_phone, order_type = 'mesa', notes, items = [], total_estimate = 0 } = body

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

    const safeName = sanitizeName(customer_name)
    const safePhone = customer_phone ? sanitizePhone(customer_phone) : null
    const safeNotes = notes ? sanitizeString(notes, 1000) : null

    if (!safeName) return NextResponse.json({ error: 'customer_name invalid' }, { status: 400 })

    // Map 'barra' to 'mesa' for DB constraint (valid: mesa, recoger, domicilio)
    const dbOrderType = order_type === 'barra' ? 'mesa' : order_type

    const { data: order, error } = await admin.from('order_events').insert({
      tenant_id, customer_name: safeName,
      customer_phone: safePhone,
      call_sid: 'tpv_' + Date.now().toString(36),
      order_type: dbOrderType,
      notes: order_type === 'barra' ? [safeNotes, 'Barra'].filter(Boolean).join(' | ') : safeNotes,
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
    const rl = rateLimitByIp(req, RATE_LIMITS.api, 'orders:patch')
    if (rl.blocked) return rl.response

    const auth = await requireAuth(req)
    if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const tenant_id = auth.tenantId

    const { id, status, notes } = await req.json()
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

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

    // Harmonize: notify on confirmed orders (non-blocking)
    if (status === 'confirmed' && data) {
      notifyOrderCreated(tenant_id, {
        customer_name: data.customer_name,
        items: Array.isArray(data.items) ? data.items : [],
        total: data.total_estimate || 0,
        order_type: data.order_type || 'mesa',
        source: 'panel',
      }).catch(() => {})
    }

    return NextResponse.json({ success: true, order: data })
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
