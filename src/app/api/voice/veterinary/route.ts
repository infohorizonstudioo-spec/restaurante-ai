/**
 * POST /api/voice/veterinary
 * Endpoint mid-call para clínicas veterinarias.
 * ElevenLabs llama esto como client_tool mientras toma datos de la mascota.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { detectVetUrgency, classifyVetConsultation, makeVetDecision } from '@/lib/vet-engine'
import { createNotification } from '@/lib/notifications'
import { getTenantMemory, getAdaptiveThresholds } from '@/lib/tenant-learning'

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
      owner_name, owner_phone,
      pet_name, pet_species = 'otro', pet_breed,
      symptoms = '', notes = '',
      service_type,
      appointment_date, appointment_time,
    } = body

    if (!call_sid || !tenant_id)
      return NextResponse.json({ ok:false, error:'call_sid y tenant_id requeridos' }, { status:400 })

    const { data: tenant } = await admin.from('tenants')
      .select('id,type').eq('id', tenant_id).maybeSingle()
    if (!tenant) return NextResponse.json({ ok:false, error:'tenant no encontrado' }, { status:404 })

    const fullText = [symptoms, notes, service_type || ''].filter(Boolean).join(' ')
    const urgency = detectVetUrgency(fullText)
    const classification = classifyVetConsultation(fullText, urgency)
    const resolvedType = service_type || classification.type

    // Usar umbrales adaptativos de la memoria del tenant
    const memory = await getTenantMemory(tenant_id).catch(() => null)
    const adaptive = memory ? getAdaptiveThresholds(memory) : null
    const effectiveConfidence = adaptive ? Math.max(classification.confidence, adaptive.confidenceThreshold) : classification.confidence

    // Verificar disponibilidad
    let hasAvailability = true
    if (appointment_date && appointment_time && action === 'confirm') {
      try {
        const { data: avail } = await admin.rpc('check_appointment_slot', {
          p_tenant_id: tenant_id, p_date: appointment_date,
          p_time: appointment_time, p_duration_mins: classification.duration,
          p_exclude_call: call_sid,
        })
        hasAvailability = (avail as any)?.available ?? true
      } catch { /* RPC might not exist */ }
    }

    const decision = makeVetDecision({
      urgency, type: resolvedType as any,
      owner_name: owner_name || null,
      pet_name: pet_name || null,
      has_availability: hasAvailability,
      confidence: classification.confidence,
    })

    let finalStatus: string
    if (action === 'escalate' || urgency.urgency_level === 'alta') finalStatus = 'escalated'
    else if (action === 'cancel') finalStatus = 'cancelled'
    else if (action === 'confirm' && decision.status === 'confirmed') finalStatus = 'confirmed'
    else if (action === 'start' || action === 'update') finalStatus = 'collecting'
    else finalStatus = decision.status

    // Guardar en reservations (tabla universal)
    if (finalStatus === 'confirmed' && appointment_date && appointment_time && owner_name) {
      try {
        await admin.rpc('create_reservation_atomic', {
          p_tenant_id: tenant_id, p_date: appointment_date, p_time: appointment_time,
          p_party_size: 1, p_customer_name: owner_name, p_customer_phone: owner_phone || '',
          p_notes: `Mascota: ${pet_name || 'sin nombre'} (${pet_species}${pet_breed?', '+pet_breed:''}) · ${resolvedType} · ${symptoms || ''}`,
        })
      } catch { /* non-critical */ }
    }

    // Upsert en consultation_events (reutilizamos tabla clínica)
    try {
      await admin.from('consultation_events').upsert({
        call_sid, tenant_id,
        consultation_type: resolvedType,
        is_urgency: urgency.is_urgency,
        urgency_level: urgency.urgency_level || null,
        patient_name: `${owner_name || 'Dueño'} — mascota: ${pet_name || '?'}`,
        patient_phone: owner_phone || null,
        symptoms: `${pet_name || ''} (${pet_species}): ${symptoms || notes || ''}`,
        appointment_date: appointment_date || null,
        appointment_time: appointment_time || null,
        duration_minutes: classification.duration,
        status: finalStatus,
      }, { onConflict: 'call_sid' })
    } catch { /* non-critical */ }

    // Notificaciones
    const petLabel = pet_name ? `${pet_name} (${pet_species})` : pet_species
    const ownerLabel = owner_name || owner_phone || 'Cliente'
    if (finalStatus === 'escalated') {
      await createNotification({ tenant_id, type:'important_alert', priority:'critical',
        title:`🚨 Urgencia veterinaria — ${petLabel}`,
        body:`Dueño: ${ownerLabel} · ${urgency.reason}`, call_sid, target_url:'/llamadas' })
    } else if (finalStatus === 'confirmed') {
      await createNotification({ tenant_id, type:'new_reservation', priority:'info',
        title:`Cita confirmada — ${petLabel}`, body:`${ownerLabel} · ${appointment_date} ${appointment_time}`,
        call_sid, target_url:'/reservas' })
    }

    console.log(`veterinary/${action} | ${finalStatus} | urgency:${urgency.is_urgency?urgency.urgency_level:'no'} | ${Date.now()-t0}ms`)
    return NextResponse.json({
      ok: true, status: finalStatus,
      is_urgency: urgency.is_urgency, urgency_level: urgency.urgency_level,
      consultation_type: resolvedType, duration_minutes: classification.duration,
      decision_reason: decision.reasoning, message: decision.response_hint,
    })
  } catch (e: any) {
    console.error('voice/veterinary error:', e.message)
    return NextResponse.json({ ok:true, error: e.message })
  }
}

export async function GET() {
  return NextResponse.json({ status:'ok', endpoint:'voice/veterinary' })
}
