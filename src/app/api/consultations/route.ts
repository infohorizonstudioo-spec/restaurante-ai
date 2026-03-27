import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/api-auth'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

/**
 * GET /api/consultations?limit=50&page=0&status=collecting
 * Equivalent to /api/orders but for clinical/service business types
 */
export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req)
    if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const tenantId = auth.tenantId
    const url = new URL(req.url)
    const limit  = parseInt(url.searchParams.get('limit') || '50')
    const page   = parseInt(url.searchParams.get('page')  || '0')
    const status = url.searchParams.get('status') || null

    let query = admin.from('consultation_events')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(page * limit, (page + 1) * limit - 1)

    if (status) query = query.eq('status', status)

    const { data, error, count } = await query
    if (error) throw error
    return NextResponse.json({ consultations: data || [], total: count || 0, page, limit })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/consultations — create consultation from panel or voice agent
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      tenant_id, patient_name, patient_phone, consultation_type,
      symptoms, is_urgency = false, duration_minutes,
      appointment_date, appointment_time, notes, call_sid,
    } = body

    if (!tenant_id) return NextResponse.json({ error: 'tenant_id required' }, { status: 400 })
    if (!patient_name && !patient_phone) return NextResponse.json({ error: 'patient_name or patient_phone required' }, { status: 400 })

    const { data: consultation, error } = await admin.from('consultation_events').insert({
      tenant_id,
      patient_name: patient_name || null,
      patient_phone: patient_phone || null,
      consultation_type: consultation_type || null,
      symptoms: symptoms || null,
      is_urgency: !!is_urgency,
      duration_minutes: duration_minutes ? parseInt(String(duration_minutes)) : null,
      appointment_date: appointment_date || null,
      appointment_time: appointment_time || null,
      notes: notes || null,
      call_sid: call_sid || null,
      status: 'collecting',
    }).select().single()

    if (error) throw error
    return NextResponse.json({ success: true, consultation })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/consultations — update consultation status/details
 */
export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { id, tenant_id } = body
    if (!id || !tenant_id) return NextResponse.json({ error: 'id and tenant_id required' }, { status: 400 })

    const validStatuses = ['collecting', 'confirmed', 'completed', 'cancelled', 'escalated', 'no_show']
    if (body.status && !validStatuses.includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const updates: any = { updated_at: new Date().toISOString() }
    if (body.status) updates.status = body.status
    if (body.patient_name !== undefined) updates.patient_name = body.patient_name
    if (body.patient_phone !== undefined) updates.patient_phone = body.patient_phone
    if (body.consultation_type !== undefined) updates.consultation_type = body.consultation_type
    if (body.symptoms !== undefined) updates.symptoms = body.symptoms
    if (body.is_urgency !== undefined) updates.is_urgency = body.is_urgency
    if (body.duration_minutes !== undefined) updates.duration_minutes = body.duration_minutes
    if (body.appointment_date !== undefined) updates.appointment_date = body.appointment_date
    if (body.appointment_time !== undefined) updates.appointment_time = body.appointment_time
    if (body.notes !== undefined) updates.notes = body.notes

    const { data, error } = await admin.from('consultation_events')
      .update(updates)
      .eq('id', id).eq('tenant_id', tenant_id)
      .select().single()

    if (error) throw error
    return NextResponse.json({ success: true, consultation: data })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
