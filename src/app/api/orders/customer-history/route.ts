import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimitByIp } from '@/lib/rate-limit'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const HISTORY_LIMIT = { limit: 10, windowSeconds: 60 }

export const dynamic = 'force-dynamic'

/**
 * GET /api/orders/customer-history?slug=X&phone=Y
 * Returns favorites and last order for a customer (by phone) at a specific restaurant.
 * Public endpoint — rate limited, no auth required.
 */
export async function GET(req: NextRequest) {
  const rl = rateLimitByIp(req, HISTORY_LIMIT, 'orders:customer-history')
  if (rl.blocked) return rl.response

  const slug = req.nextUrl.searchParams.get('slug')
  const phone = req.nextUrl.searchParams.get('phone')

  if (!slug || !phone || phone.length < 6) {
    return NextResponse.json({ favorites: [], lastOrder: null })
  }

  // Find tenant
  const { data: tenant } = await admin
    .from('tenants')
    .select('id')
    .ilike('slug', slug)
    .maybeSingle()

  if (!tenant) {
    return NextResponse.json({ favorites: [], lastOrder: null })
  }

  // Find customer by phone
  const cleanPhone = phone.replace(/[^0-9+]/g, '')
  const phoneWithPlus = cleanPhone.startsWith('+') ? cleanPhone : '+' + cleanPhone
  const phoneWithout = cleanPhone.replace(/^\+/, '')

  const { data: customer } = await admin
    .from('customers')
    .select('id, name')
    .eq('tenant_id', tenant.id)
    .or(`phone.eq.${phoneWithPlus},phone.eq.${phoneWithout},phone.eq.${cleanPhone}`)
    .maybeSingle()

  if (!customer) {
    return NextResponse.json({ favorites: [], lastOrder: null, recognized: false })
  }

  // Get last 30 days of orders for this customer
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: orders } = await admin
    .from('order_events')
    .select('items, created_at')
    .eq('tenant_id', tenant.id)
    .eq('customer_name', customer.name)
    .gte('created_at', thirtyDaysAgo)
    .not('status', 'eq', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(20)

  if (!orders || orders.length === 0) {
    return NextResponse.json({ favorites: [], lastOrder: null, recognized: true, customerName: customer.name })
  }

  // Count product frequency across all orders
  const productCount: Record<string, { name: string; count: number; lastPrice: number }> = {}
  for (const order of orders) {
    for (const item of (order.items || [])) {
      const name = item.name || ''
      if (!name) continue
      if (!productCount[name]) productCount[name] = { name, count: 0, lastPrice: item.price || 0 }
      productCount[name].count += (item.quantity || item.qty || 1)
      productCount[name].lastPrice = item.price || productCount[name].lastPrice
    }
  }

  // Top 5 favorites by frequency
  const favorites = Object.values(productCount)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map(p => ({ name: p.name, count: p.count, price: p.lastPrice }))

  // Last order items
  const lastOrderItems = (orders[0]?.items || []).map((i: any) => ({
    name: i.name,
    quantity: i.quantity || i.qty || 1,
    price: i.price || 0,
  }))

  return NextResponse.json({
    recognized: true,
    customerName: customer.name,
    favorites,
    lastOrder: lastOrderItems.length > 0 ? {
      items: lastOrderItems,
      date: orders[0].created_at,
    } : null,
  })
}
