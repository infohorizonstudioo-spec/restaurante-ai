import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export const dynamic = 'force-dynamic'

/** GET /api/caja-shifts — list shifts for today (or ?date=YYYY-MM-DD) */
export async function GET(req: NextRequest) {
  const rl = rateLimitByIp(req, RATE_LIMITS.api, 'caja-shifts:get')
  if (rl.blocked) return rl.response

  const auth = await requireAuth(req)
  if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const date = req.nextUrl.searchParams.get('date') || new Date().toISOString().slice(0, 10)
  const nextDay = new Date(date + 'T00:00:00')
  nextDay.setDate(nextDay.getDate() + 1)

  const { data, error } = await admin
    .from('caja_shifts')
    .select('*')
    .eq('tenant_id', auth.tenantId)
    .gte('opened_at', date + 'T00:00:00')
    .lt('opened_at', nextDay.toISOString().slice(0, 10) + 'T00:00:00')
    .order('opened_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ shifts: data || [] })
}

/** POST /api/caja-shifts — open a new shift */
export async function POST(req: NextRequest) {
  const rl = rateLimitByIp(req, RATE_LIMITS.api, 'caja-shifts:post')
  if (rl.blocked) return rl.response

  const auth = await requireAuth(req)
  if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { opened_by, initial_cash } = await req.json()

  if (!opened_by) return NextResponse.json({ error: 'opened_by required' }, { status: 400 })

  // Check no open shift exists
  const { data: existing } = await admin
    .from('caja_shifts')
    .select('id')
    .eq('tenant_id', auth.tenantId)
    .eq('status', 'open')
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: 'Ya hay un turno abierto. Cierra el turno actual primero.' }, { status: 409 })
  }

  const { data, error } = await admin
    .from('caja_shifts')
    .insert({
      tenant_id: auth.tenantId,
      opened_by,
      initial_cash: parseFloat(String(initial_cash)) || 0,
      status: 'open',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ shift: data })
}

/** PATCH /api/caja-shifts — close or update a shift */
export async function PATCH(req: NextRequest) {
  const rl = rateLimitByIp(req, RATE_LIMITS.api, 'caja-shifts:patch')
  if (rl.blocked) return rl.response

  const auth = await requireAuth(req)
  if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id, counted_cash, notes, total_sales, total_cash, total_card, total_other, orders_count } = body

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const updates: Record<string, any> = {}

  // If closing the shift — fetch initial_cash from DB (not client)
  if (counted_cash !== undefined) {
    const { data: currentShift } = await admin
      .from('caja_shifts')
      .select('initial_cash')
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle()
    const initialCash = currentShift?.initial_cash || 0
    const expectedCash = initialCash + (parseFloat(String(total_cash)) || 0)
    updates.counted_cash = parseFloat(String(counted_cash)) || 0
    updates.difference = (parseFloat(String(counted_cash)) || 0) - expectedCash
    updates.closed_at = new Date().toISOString()
    updates.status = 'closed'
  }

  if (notes !== undefined) updates.notes = notes
  if (total_sales !== undefined) updates.total_sales = parseFloat(String(total_sales)) || 0
  if (total_cash !== undefined) updates.total_cash = parseFloat(String(total_cash)) || 0
  if (total_card !== undefined) updates.total_card = parseFloat(String(total_card)) || 0
  if (total_other !== undefined) updates.total_other = parseFloat(String(total_other)) || 0
  if (orders_count !== undefined) updates.orders_count = parseInt(String(orders_count)) || 0

  const { data, error } = await admin
    .from('caja_shifts')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', auth.tenantId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ shift: data })
}
