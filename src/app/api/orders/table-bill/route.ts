import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimitByIp } from '@/lib/rate-limit'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const BILL_LIMIT = { limit: 30, windowSeconds: 60 }

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const rl = rateLimitByIp(req, BILL_LIMIT, 'orders:table-bill')
  if (rl.blocked) return rl.response

  const slug = req.nextUrl.searchParams.get('slug')
  const mesa = req.nextUrl.searchParams.get('mesa')

  if (!slug || !mesa) {
    return NextResponse.json({ error: 'slug and mesa required' }, { status: 400 })
  }

  // Find tenant
  const { data: tenant } = await admin
    .from('tenants')
    .select('id, name, whatsapp_phone, stripe_connect_enabled')
    .ilike('slug', slug)
    .maybeSingle()

  if (!tenant) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  // Find table
  const { data: table } = await admin
    .from('tables')
    .select('id, zone_name')
    .eq('tenant_id', tenant.id)
    .eq('number', String(mesa))
    .maybeSingle()

  if (!table) {
    return NextResponse.json({ items: [], orders: [], total: 0, paid: false, payment_enabled: false })
  }

  const today = new Date().toISOString().slice(0, 10)

  // Get all orders for this table today (not cancelled)
  const { data: orders } = await admin
    .from('order_events')
    .select('id, items, total_estimate, payment_method, status, customer_name, created_at, call_sid')
    .eq('tenant_id', tenant.id)
    .eq('table_id', table.id)
    .gte('created_at', today + 'T00:00:00')
    .not('status', 'eq', 'cancelled')
    .order('created_at', { ascending: true })

  if (!orders || orders.length === 0) {
    return NextResponse.json({ items: [], orders: [], total: 0, paid: false, bizum_phone: tenant.whatsapp_phone || null })
  }

  // Aggregate all items across orders
  const itemMap: Record<string, { name: string; price: number; quantity: number; source: string }> = {}
  for (const order of orders) {
    const source = (order.call_sid || '').startsWith('qr_') ? 'qr' : 'tpv'
    const orderItems = order.items || []
    for (const item of orderItems) {
      const key = `${item.name}_${item.price}`
      if (itemMap[key]) {
        itemMap[key].quantity += (item.quantity || item.qty || 1)
      } else {
        itemMap[key] = {
          name: item.name,
          price: item.price || 0,
          quantity: item.quantity || item.qty || 1,
          source,
        }
      }
    }
  }

  const allItems = Object.values(itemMap)
  const total = allItems.reduce((s, i) => s + i.price * i.quantity, 0)
  const allPaid = orders.every(o => o.payment_method === 'bizum_confirmed' || o.payment_method === 'card' || o.payment_method === 'cash')
  const bizumPending = orders.some(o => o.payment_method === 'bizum_pending')

  return NextResponse.json({
    items: allItems,
    orders: orders.map(o => ({
      id: o.id,
      total: o.total_estimate,
      status: o.status,
      payment: o.payment_method,
      source: (o.call_sid || '').startsWith('qr_') ? 'qr' : 'tpv',
      time: o.created_at,
    })),
    total: Math.round(total * 100) / 100,
    paid: allPaid,
    payment_enabled: tenant.stripe_connect_enabled || false,
  })
}
