import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimitByIp } from '@/lib/rate-limit'
import { sanitizeName } from '@/lib/sanitize'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const PAYMENT_LIMIT = { limit: 3, windowSeconds: 60 }

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const rl = rateLimitByIp(req, PAYMENT_LIMIT, 'orders:table-payment')
  if (rl.blocked) return rl.response

  const body = await req.json()
  const { slug, mesa, method, amount, customer_name } = body

  if (!slug || !mesa || !method || !amount) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (method !== 'bizum') {
    return NextResponse.json({ error: 'Unsupported payment method' }, { status: 400 })
  }

  // Find tenant
  const { data: tenant } = await admin
    .from('tenants')
    .select('id, name')
    .ilike('slug', slug)
    .maybeSingle()

  if (!tenant) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  // Find table
  const { data: table } = await admin
    .from('tables')
    .select('id')
    .eq('tenant_id', tenant.id)
    .eq('number', String(mesa))
    .maybeSingle()

  if (!table) {
    return NextResponse.json({ error: 'table not found' }, { status: 404 })
  }

  const today = new Date().toISOString().slice(0, 10)

  // Update all pending orders for this table today to bizum_pending
  await admin
    .from('order_events')
    .update({ payment_method: 'bizum_pending' })
    .eq('tenant_id', tenant.id)
    .eq('table_id', table.id)
    .gte('created_at', today + 'T00:00:00')
    .eq('payment_method', 'pending')

  // Create notification for business
  const name = sanitizeName(customer_name) || 'Cliente'
  await admin.from('notifications').insert({
    tenant_id: tenant.id,
    type: 'bizum_payment',
    title: `Bizum recibido — Mesa ${mesa}`,
    body: `${name} indica que ha enviado ${Number(amount).toFixed(2)}\u20AC por Bizum para la Mesa ${mesa}. Confirma el pago en tu app de Bizum.`,
    priority: 'warning',
    read: false,
    target_url: '/pedidos',
  })

  return NextResponse.json({ success: true })
}
