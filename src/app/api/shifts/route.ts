import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/api-auth'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { sanitizeString } from '@/lib/sanitize'
import { logger } from '@/lib/logger'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const VALID_SHIFT_TYPES = ['morning', 'afternoon', 'night', 'split', 'custom']
const VALID_STATUSES = ['scheduled', 'confirmed', 'started', 'ended', 'absent', 'late']

/**
 * GET /api/shifts?from=2026-03-24&to=2026-03-30&employee_id=xxx
 * Get shifts for a date range for the tenant.
 */
export async function GET(req: Request) {
  try {
    const rl = rateLimitByIp(req, RATE_LIMITS.api, 'shifts:get')
    if (rl.blocked) return rl.response

    const auth = await requireAuth(req)
    if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const tenantId = auth.tenantId

    const url = new URL(req.url)
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    const employeeId = url.searchParams.get('employee_id')

    if (!from || !to) return NextResponse.json({ error: 'from and to date params required' }, { status: 400 })

    let query = admin.from('employee_shifts')
      .select('*, employees!inner(id, name, role, phone, active)')
      .eq('tenant_id', tenantId)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })

    if (employeeId) query = query.eq('employee_id', employeeId)

    const { data, error } = await query
    if (error) throw error

    // Calculate worked hours for ended shifts
    const shifts = (data || []).map((s: any) => {
      let worked_hours: number | null = null
      if (s.clock_in && s.clock_out) {
        const diffMs = new Date(s.clock_out).getTime() - new Date(s.clock_in).getTime()
        const diffMinutes = diffMs / 60000
        worked_hours = Math.round(((diffMinutes - (s.break_minutes || 0)) / 60) * 100) / 100
        if (worked_hours < 0) worked_hours = 0
      }
      return { ...s, worked_hours }
    })

    return NextResponse.json({ shifts })
  } catch (e: any) {
    logger.error('shifts:get failed', {}, e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/shifts
 * Create or update a shift.
 * If body.id is provided, it updates; otherwise creates.
 */
export async function POST(req: Request) {
  try {
    const rl = rateLimitByIp(req, RATE_LIMITS.api, 'shifts:post')
    if (rl.blocked) return rl.response

    const auth = await requireAuth(req)
    if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const tenant_id = auth.tenantId

    const body = await req.json()
    const { id, employee_id, date, shift_type, start_time, end_time, break_minutes, status, clock_in, clock_out, notes } = body

    // Update existing shift
    if (id) {
      const updates: any = {}
      if (date !== undefined) updates.date = date
      if (shift_type !== undefined) {
        if (!VALID_SHIFT_TYPES.includes(shift_type)) {
          return NextResponse.json({ error: 'invalid shift_type' }, { status: 400 })
        }
        updates.shift_type = shift_type
      }
      if (start_time !== undefined) updates.start_time = start_time
      if (end_time !== undefined) updates.end_time = end_time
      if (break_minutes !== undefined) updates.break_minutes = Math.max(0, parseInt(String(break_minutes)) || 0)
      if (status !== undefined) {
        if (!VALID_STATUSES.includes(status)) {
          return NextResponse.json({ error: 'invalid status' }, { status: 400 })
        }
        updates.status = status
      }
      if (clock_in !== undefined) updates.clock_in = clock_in
      if (clock_out !== undefined) updates.clock_out = clock_out
      if (notes !== undefined) updates.notes = notes ? sanitizeString(notes, 500) : null

      const { data, error } = await admin.from('employee_shifts')
        .update(updates)
        .eq('id', id).eq('tenant_id', tenant_id)
        .select('*, employees!inner(id, name, role, phone, active)')
        .single()

      if (error) throw error
      return NextResponse.json({ success: true, shift: data })
    }

    // Create new shift
    if (!employee_id || !date || !shift_type || !start_time || !end_time) {
      return NextResponse.json({ error: 'employee_id, date, shift_type, start_time, end_time required' }, { status: 400 })
    }
    if (!VALID_SHIFT_TYPES.includes(shift_type)) {
      return NextResponse.json({ error: 'invalid shift_type' }, { status: 400 })
    }

    // Verify employee belongs to tenant
    const { data: emp } = await admin.from('employees')
      .select('id').eq('id', employee_id).eq('tenant_id', tenant_id).maybeSingle()
    if (!emp) return NextResponse.json({ error: 'employee not found' }, { status: 404 })

    const { data, error } = await admin.from('employee_shifts').insert({
      tenant_id,
      employee_id,
      date,
      shift_type,
      start_time,
      end_time,
      break_minutes: Math.max(0, parseInt(String(break_minutes)) || 0),
      status: status && VALID_STATUSES.includes(status) ? status : 'scheduled',
      notes: notes ? sanitizeString(notes, 500) : null,
    }).select('*, employees!inner(id, name, role, phone, active)').single()

    if (error) throw error
    return NextResponse.json({ success: true, shift: data })
  } catch (e: any) {
    logger.error('shifts:post failed', {}, e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/shifts?id=xxx
 * Remove a shift.
 */
export async function DELETE(req: Request) {
  try {
    const rl = rateLimitByIp(req, RATE_LIMITS.api, 'shifts:delete')
    if (rl.blocked) return rl.response

    const auth = await requireAuth(req)
    if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const tenant_id = auth.tenantId

    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const { error } = await admin.from('employee_shifts')
      .delete()
      .eq('id', id).eq('tenant_id', tenant_id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (e: any) {
    logger.error('shifts:delete failed', {}, e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
