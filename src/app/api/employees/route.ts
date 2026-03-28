import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/api-auth'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { sanitizeName, sanitizePhone, sanitizeString } from '@/lib/sanitize'
import { logger } from '@/lib/logger'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

/**
 * GET /api/employees?active=true
 * List employees for the authenticated tenant.
 */
export async function GET(req: Request) {
  try {
    const rl = rateLimitByIp(req, RATE_LIMITS.api, 'employees:get')
    if (rl.blocked) return rl.response

    const auth = await requireAuth(req)
    if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const tenantId = auth.tenantId

    const url = new URL(req.url)
    const activeOnly = url.searchParams.get('active') !== 'false'

    let query = admin.from('employees')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true })

    if (activeOnly) query = query.eq('active', true)

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ employees: data || [] })
  } catch (e: any) {
    logger.error('employees:get failed', {}, e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/employees
 * Create a new employee.
 */
export async function POST(req: Request) {
  try {
    const rl = rateLimitByIp(req, RATE_LIMITS.api, 'employees:post')
    if (rl.blocked) return rl.response

    const auth = await requireAuth(req)
    if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const tenant_id = auth.tenantId

    const body = await req.json()
    const { name, role, phone, email } = body

    const safeName = sanitizeName(name)
    if (!safeName) return NextResponse.json({ error: 'name required' }, { status: 400 })

    const safeRole = role ? sanitizeString(role, 100) : 'camarero'
    const safePhone = phone ? sanitizePhone(phone) : null
    const safeEmail = email ? sanitizeString(email, 200) : null

    const { data, error } = await admin.from('employees').insert({
      tenant_id,
      name: safeName,
      role: safeRole,
      phone: safePhone,
      email: safeEmail,
    }).select().single()

    if (error) throw error
    return NextResponse.json({ success: true, employee: data })
  } catch (e: any) {
    logger.error('employees:post failed', {}, e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/employees
 * Update an existing employee.
 */
export async function PATCH(req: Request) {
  try {
    const rl = rateLimitByIp(req, RATE_LIMITS.api, 'employees:patch')
    if (rl.blocked) return rl.response

    const auth = await requireAuth(req)
    if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const tenant_id = auth.tenantId

    const body = await req.json()
    const { id } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const updates: any = {}
    if (body.name !== undefined) {
      const safeName = sanitizeName(body.name)
      if (!safeName) return NextResponse.json({ error: 'invalid name' }, { status: 400 })
      updates.name = safeName
    }
    if (body.role !== undefined) updates.role = sanitizeString(body.role, 100)
    if (body.phone !== undefined) updates.phone = body.phone ? sanitizePhone(body.phone) : null
    if (body.email !== undefined) updates.email = body.email ? sanitizeString(body.email, 200) : null
    if (body.active !== undefined) updates.active = !!body.active

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'no fields to update' }, { status: 400 })
    }

    const { data, error } = await admin.from('employees')
      .update(updates)
      .eq('id', id).eq('tenant_id', tenant_id)
      .select().single()

    if (error) throw error
    return NextResponse.json({ success: true, employee: data })
  } catch (e: any) {
    logger.error('employees:patch failed', {}, e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/employees
 * Soft-delete (deactivate) an employee.
 */
export async function DELETE(req: Request) {
  try {
    const rl = rateLimitByIp(req, RATE_LIMITS.api, 'employees:delete')
    if (rl.blocked) return rl.response

    const auth = await requireAuth(req)
    if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const tenant_id = auth.tenantId

    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const { data, error } = await admin.from('employees')
      .update({ active: false })
      .eq('id', id).eq('tenant_id', tenant_id)
      .select().single()

    if (error) throw error
    return NextResponse.json({ success: true, employee: data })
  } catch (e: any) {
    logger.error('employees:delete failed', {}, e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
