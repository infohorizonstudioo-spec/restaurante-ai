/**
 * POST /api/voice/consultation
 *
 * Endpoint mid-call para clínicas — equivalente a /api/voice/order para restaurantes.
 * ElevenLabs llama esto como client_tool mientras toma datos del paciente.
 * El panel lo refleja en tiempo real vía Supabase Realtime.
 *
 * Acciones:
 *   start    — inicio, paciente en línea
 *   update   — actualizar síntomas/datos durante la llamada
 *   confirm  — cita confirmada (ha pasado check de disponibilidad)
 *   cancel   — cancelar
 *   escalate — urgencia detectada, escalar manualmente
 *
 * REGLA CRÍTICA: urgencia alta → NUNCA confirmar automáticamente.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { detectUrgency, classifyConsultation, makeClinicDecision, getDuration } from '@/lib/clinic-engine'
import { createNotification } from '@/lib/notifications'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const CLINIC_TYPES = new Set([
  'clinica_dental','clinica_medica','veterinaria','fisioterapia','psicologia'
])

export async function POST(req: Request) {
  const t0 = Date.now()
  try {
    const body = await req.json().catch(() => ({}))
    const {
      action = 'update',
      call_sid, tenant_id,
      patient_name, patient_phone,
      symptoms = '',
      notes = '',
      consultation_type,
      appointment_date, appointment_time,
      is_new_patient = false,
      doctor_name,
    } = body

    if (!call_sid || !tenant_id)
      return NextResponse.json({ ok:false, error:'call_sid y tenant_id requeridos' }, { status:400 })

    // Verificar tenant y tipo
    const { data: tenant } = await admin.from('tenants')
      .select('id,type,agent_config').eq('id', tenant_id).maybeSingle()
    if (!tenant)
      return NextResponse.json({ ok:false, error:'tenant no encontrado' }, { status:404 })

    // Motor de urgencia — analiza síntomas + notas en tiempo real
    const fullText = [symptoms, notes, patient_name || ''].filter(Boolean).join(' ')
    const urgency = detectUrgency(fullText)

    // Clasificar tipo de consulta (si no viene explícito del agente)
    const classification = classifyConsultation(fullText, urgency)
    const resolvedType = consultation_type || (urgency.is_urgency ? 'urgencia' : classification.type)

    // Duración según tipo y overrides de la clínica
    const agentCfg = (tenant.agent_config as any) || {}
    const durationOverrides = agentCfg.consultation_durations || {}
    const duration = getDuration(resolvedType as any, durationOverrides)

    // Verificar disponibilidad si hay fecha/hora
    let hasAvailability = true
    if (appointment_date && appointment_time && action === 'confirm') {
      try {
        const { data: avail } = await admin.rpc('check_appointment_slot', {
          p_tenant_id: tenant_id, p_date: appointment_date,
          p_time: appointment_time, p_duration_mins: duration, p_exclude_call: call_sid,
        })
        hasAvailability = (avail as any)?.available ?? true
      } catch { /* RPC might not exist yet — default available */ }
    }

    // Verificar si es paciente conocido
    let isKnownPatient = false
    if (patient_phone) {
      const { data: existing } = await admin.from('customers')
        .select('id').eq('tenant_id', tenant_id).eq('phone', patient_phone).maybeSingle()
      isKnownPatient = !!existing
    }

    // Motor de decisión clínico
    const clinicRules = agentCfg.clinic_rules || {}
    const confidence = urgency.is_urgency ? 0.5 : classification.confidence
    const decision = makeClinicDecision({
      urgency, classification: { ...classification, type: resolvedType as any },
      patient_name: patient_name || null,
      has_availability: hasAvailability,
      is_new_patient: is_new_patient || !isKnownPatient,
      confidence,
      rules: clinicRules,
    })

    // Override de acción respetando tipos del ClinicDecision
    let finalStatus: 'confirmed' | 'pending_review' | 'escalated' | 'incomplete' | 'cancelled' | 'collecting'
    if (action === 'escalate' || urgency.urgency_level === 'alta') {
      finalStatus = 'escalated'
    } else if (action === 'cancel') {
      finalStatus = 'cancelled'
    } else if (action === 'confirm' && decision.status === 'confirmed') {
      finalStatus = 'confirmed'
    } else if (action === 'start' || action === 'update') {
      finalStatus = 'collecting'
    } else {
      finalStatus = decision.status
    }

    // Upsert atómico
    const { data: result, error } = await admin.rpc('upsert_consultation_event', {
      p_call_sid:           call_sid,
      p_tenant_id:          tenant_id,
      p_consultation_type:  resolvedType,
      p_is_urgency:         urgency.is_urgency,
      p_urgency_level:      urgency.urgency_level || null,
      p_patient_name:       patient_name || null,
      p_patient_phone:      patient_phone || null,
      p_is_new_patient:     is_new_patient || !isKnownPatient,
      p_symptoms:           symptoms || null,
      p_notes:              notes || null,
      p_appointment_date:   appointment_date || null,
      p_appointment_time:   appointment_time || null,
      p_duration_minutes:   duration,
      p_doctor_name:        doctor_name || null,
      p_status:             finalStatus,
      p_decision_reason:    decision.reasoning,
      p_trace:              decision.trace as any,
    })
    if (error) throw error
    const consultationId = (result as any)?.consultation_event_id

    // Vincular con la llamada activa
    if (consultationId) {
      await admin.from('calls').update({ consultation_event_id: consultationId })
        .eq('call_sid', call_sid).eq('tenant_id', tenant_id)
    }

    // Notificaciones diferenciadas por situación
    if (consultationId) {
      const patientLabel = patient_name || patient_phone || 'Paciente'
      if (finalStatus === 'escalated') {
        await createNotification({
          tenant_id, type:'important_alert', priority:'critical',
          title:`🚨 Urgencia — ${patientLabel}`,
          body: urgency.reason + (patient_phone ? ` · Tel: ${patient_phone}` : ''),
          call_sid, related_entity_id: consultationId,
          target_url: '/llamadas',
        })
      } else if (finalStatus === 'confirmed') {
        await createNotification({
          tenant_id, type:'new_reservation', priority:'info',
          title:`Cita confirmada — ${patientLabel}`,
          body:`${resolvedType} · ${appointment_date || 'fecha por confirmar'} ${appointment_time || ''}`,
          call_sid, related_entity_id: consultationId,
          target_url: '/reservas',
        })
      } else if (finalStatus === 'pending_review') {
        await createNotification({
          tenant_id, type:'pending_review', priority:'warning',
          title:`Cita pendiente de revisar — ${patientLabel}`,
          body: decision.reasoning,
          call_sid, related_entity_id: consultationId,
          target_url: '/llamadas?filter=pending',
        })
      }
    }

    // Auto-crear reserva en tabla reservations si se confirma
    if (finalStatus === 'confirmed' && appointment_date && appointment_time && patient_name) {
      try {
        await admin.rpc('create_reservation_atomic', {
          p_tenant_id:     tenant_id,
          p_date:          appointment_date,
          p_time:          appointment_time,
          p_party_size:    1,
          p_customer_name: patient_name,
          p_customer_phone: patient_phone || '',
          p_notes:         `${resolvedType} · ${notes || ''} · Tel: ${patient_phone || 'no indicado'}`,
        })
      } catch { /* non-critical — la consulta ya está guardada */ }
    }

    // Respuesta para el agente de voz (natural, empática)
    const agentMessages: Record<string, string> = {
      start:    'Entendido, te tomo los datos.',
      escalated:`Entiendo que es urgente. Voy a avisar al equipo ahora mismo. ${decision.response_hint}`,
      confirmed:`${decision.response_hint}`,
      cancelled:'Cita cancelada. Si necesitas algo más, no dudes en llamar.',
      pending_review: decision.response_hint,
      collecting: patient_name ? `Anotado, ${patient_name}. ¿Algo más que deba saber?` : 'Entendido. ¿Me dices tu nombre?',
    }

    console.log(`consultation/${action} | ${finalStatus} | urgency:${urgency.is_urgency?urgency.urgency_level:'no'} | type:${resolvedType} | ${Date.now()-t0}ms`)

    return NextResponse.json({
      ok: true,
      consultation_event_id: consultationId,
      status:             finalStatus,
      consultation_type:  resolvedType,
      duration_minutes:   duration,
      is_urgency:         urgency.is_urgency,
      urgency_level:      urgency.urgency_level,
      urgency_keywords:   urgency.matched_keywords,
      decision_status:    decision.status,
      decision_reason:    decision.reasoning,
      message:            agentMessages[finalStatus] || agentMessages.collecting,
      trace:              decision.trace,
    })
  } catch (e: any) {
    console.error('voice/consultation error:', e.message)
    return NextResponse.json({ ok:true, error: e.message })
  }
}

export async function GET() {
  return NextResponse.json({
    status:'ok', endpoint:'voice/consultation',
    actions:['start','update','confirm','cancel','escalate'],
    description:'Real-time consultation building for clinics'
  })
}
