import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/api-auth'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { sanitizeString, sanitizeName, sanitizePhone, sanitizePositiveInt } from '@/lib/sanitize'
import { logger } from '@/lib/logger'

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
    const rl = rateLimitByIp(req, RATE_LIMITS.api, 'consultations:get')
    if (rl.blocked) return rl.response

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
    const rl = rateLimitByIp(req, RATE_LIMITS.api, 'consultations:post')
    if (rl.blocked) return rl.response

    const auth = await requireAuth(req)
    if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const body = await req.json()
    const {
      patient_name, patient_phone, consultation_type,
      symptoms, is_urgency = false, duration_minutes,
      appointment_date, appointment_time, notes, call_sid,
    } = body
    const tenant_id = auth.tenantId

    const safeName = patient_name ? sanitizeName(patient_name) : null
    const safePhone = patient_phone ? sanitizePhone(patient_phone) : null
    if (!safeName && !safePhone) return NextResponse.json({ error: 'patient_name or patient_phone required' }, { status: 400 })

    const safeSymptoms = symptoms ? sanitizeString(symptoms, 2000) : null
    const safeNotes = notes ? sanitizeString(notes, 2000) : null
    const safeConsultationType = consultation_type ? sanitizeString(consultation_type, 100) : null
    const safeDuration = duration_minutes ? sanitizePositiveInt(duration_minutes, 1440) : null
    if (duration_minutes && !safeDuration) return NextResponse.json({ error: 'duration_minutes must be a positive number' }, { status: 400 })

    const { data: consultation, error } = await admin.from('consultation_events').insert({
      tenant_id,
      patient_name: safeName,
      patient_phone: safePhone,
      consultation_type: safeConsultationType,
      symptoms: safeSymptoms,
      is_urgency: !!is_urgency,
      duration_minutes: safeDuration,
      appointment_date: appointment_date || null,
      appointment_time: appointment_time || null,
      notes: safeNotes,
      call_sid: call_sid ? sanitizeString(call_sid, 100) : null,
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
    const rl = rateLimitByIp(req, RATE_LIMITS.api, 'consultations:patch')
    if (rl.blocked) return rl.response

    const auth = await requireAuth(req)
    if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    const tenant_id = auth.tenantId

    const body = await req.json()
    const { id } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

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
