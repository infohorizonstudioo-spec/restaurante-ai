/**
 * POST /api/voice/appointment
 * Endpoint genérico mid-call para servicios: fisioterapia, psicología,
 * academia, asesoría, seguros, peluquería, barbería.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { classifyAppointment, makeAppointmentDecision } from '@/lib/appointment-engine'
import { detectPsicoCrisis, classifyPsicoSession, makePsicoDecision } from '@/lib/psico-engine'
import { createNotification } from '@/lib/notifications'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: Request) {
  const t0 = Date.now()
  try {
    const body = await req.json().catch(() => ({}))
    const {
      action = 'update',
      call_sid, tenant_id,
      client_name, client_phone,
      service_type, notes = '', context = '',
      appointment_date, appointment_time,
      is_new_client = false, modality = 'presencial',
    } = body

    if (!call_sid || !tenant_id)
      return NextResponse.json({ ok:false, error:'call_sid y tenant_id requeridos' }, { status:400 })

    const { data: tenant } = await admin.from('tenants')
      .select('id,type').eq('id', tenant_id).maybeSingle()
    if (!tenant) return NextResponse.json({ ok:false, error:'tenant no encontrado' }, { status:404 })

    const businessType = tenant.type || 'otro'
    const fullText = [service_type || '', notes, context].filter(Boolean).join(' ')

    // Verificar disponibilidad
    let hasAvailability = true
    if (appointment_date && appointment_time && action === 'confirm') {
      try {
        const classification = classifyAppointment(fullText, businessType)
        const { data: avail } = await admin.rpc('check_appointment_slot', {
          p_tenant_id: tenant_id, p_date: appointment_date,
          p_time: appointment_time, p_duration_mins: classification.duration,
          p_exclude_call: call_sid,
        })
        hasAvailability = (avail as any)?.available ?? true
      } catch { /* RPC might not exist */ }
    }

    let decision: any
    let resolvedType: string
    let duration: number

    // Psicología — motor especializado con discreción
    if (businessType === 'psicologia') {
      const isCrisis = detectPsicoCrisis(fullText)
      const session = classifyPsicoSession(fullText)
      resolvedType = session.type
      duration = session.duration
      decision = makePsicoDecision({
        patient_name: client_name || null,
        session_type: session.type,
        has_availability: hasAvailability,
        is_crisis: isCrisis,
      })
    } else {
      // Motor genérico
      const classification = classifyAppointment(fullText, businessType)
      resolvedType = service_type || classification.type
      duration = classification.duration
      decision = makeAppointmentDecision({
        client_name: client_name || null,
        appointment_type: resolvedType as any,
        has_availability: hasAvailability,
        confidence: 0.75,
        businessType,
        extra_context: notes,
      })
    }

    let finalStatus: string
    if (action === 'cancel') finalStatus = 'cancelled'
    else if (action === 'confirm' && decision.status === 'confirmed') finalStatus = 'confirmed'
    else if (action === 'start' || action === 'update') finalStatus = 'collecting'
    else finalStatus = decision.status

    // Guardar en consultation_events
    try {
      await admin.from('consultation_events').upsert({
        call_sid, tenant_id,
        consultation_type: resolvedType,
        is_urgency: false,
        patient_name: client_name || null,
        patient_phone: client_phone || null,
        symptoms: notes || context || null,
        appointment_date: appointment_date || null,
        appointment_time: appointment_time || null,
        duration_minutes: duration,
        status: finalStatus,
      }, { onConflict: 'call_sid' })
    } catch { /* non-critical */ }

    // Crear reserva si está confirmada
    if (finalStatus === 'confirmed' && appointment_date && appointment_time && client_name) {
      try {
        await admin.rpc('create_reservation_atomic', {
          p_tenant_id: tenant_id, p_date: appointment_date, p_time: appointment_time,
          p_party_size: 1, p_customer_name: client_name, p_customer_phone: client_phone || '',
          p_notes: `${resolvedType}${notes?' · '+notes:''}${modality !== 'presencial'?' · '+modality:''}`,
        })
      } catch { /* non-critical */ }
    }

    // Notificaciones
    const clientLabel = client_name || client_phone || 'Cliente'
    if (finalStatus === 'confirmed') {
      await createNotification({ tenant_id, type:'new_reservation', priority:'info',
        title:`Cita confirmada — ${clientLabel}`,
        body:`${resolvedType} · ${appointment_date || ''} ${appointment_time || ''}`,
        call_sid, target_url:'/reservas' }).catch(() => {})
    } else if (finalStatus === 'pending_review') {
      await createNotification({ tenant_id, type:'pending_review', priority:'warning',
        title:`Cita pendiente — ${clientLabel}`, body: decision.reasoning,
        call_sid, target_url:'/llamadas' }).catch(() => {})
    }

    console.log(`appointment/${action} | ${businessType} | ${finalStatus} | ${Date.now()-t0}ms`)
    return NextResponse.json({
      ok: true, status: finalStatus,
      appointment_type: resolvedType, duration_minutes: duration,
      decision_reason: decision.reasoning, message: decision.response_hint,
    })
  } catch (e: any) {
    console.error('voice/appointment error:', e.message)
    return NextResponse.json({ ok:true, error: e.message })
  }
}

export async function GET() {
  return NextResponse.json({ status:'ok', endpoint:'voice/appointment',
    supports:['fisioterapia','psicologia','academia','asesoria','seguros','peluqueria','barberia'] })
}
