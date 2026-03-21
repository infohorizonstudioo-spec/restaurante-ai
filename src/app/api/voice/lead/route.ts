/**
 * POST /api/voice/lead
 * Endpoint mid-call para inmobiliarias.
 * Crea y actualiza leads en tiempo real durante la llamada.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { detectInmoIntent, detectOperation, makeInmoDecision } from '@/lib/inmo-engine'
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
      client_name, client_phone, client_email,
      context = '', notes = '',
      operation, zone, budget_max, property_type,
      property_ref,
      visit_date, visit_time,
    } = body

    if (!call_sid || !tenant_id)
      return NextResponse.json({ ok:false, error:'call_sid y tenant_id requeridos' }, { status:400 })

    const fullText = [context, notes, property_type || ''].filter(Boolean).join(' ')
    const intent = detectInmoIntent(fullText)
    const resolvedOp = operation || detectOperation(fullText)

    // Verificar disponibilidad para visita
    let hasAvailability = true
    if (visit_date && visit_time && action === 'confirm') {
      try {
        const { data: avail } = await admin.rpc('check_appointment_slot', {
          p_tenant_id: tenant_id, p_date: visit_date,
          p_time: visit_time, p_duration_mins: 60, p_exclude_call: call_sid,
        })
        hasAvailability = (avail as any)?.available ?? true
      } catch { /* non-critical */ }
    }

    const decision = makeInmoDecision({
      intent, client_name: client_name || null,
      client_phone: client_phone || null,
      operation: resolvedOp,
      zone, budget: budget_max, has_availability: hasAvailability,
      property_ref,
    })

    let finalStatus: string
    if (action === 'cancel') finalStatus = 'cancelled'
    else if (action === 'confirm') {
      finalStatus = decision.status === 'visit_scheduled' ? 'visit_scheduled'
        : decision.status === 'lead_created' ? 'confirmed' : decision.status
    } else if (action === 'start' || action === 'update') finalStatus = 'collecting'
    else finalStatus = decision.status === 'incomplete' ? 'collecting' : decision.status

    // Guardar en customers como lead
    let customerId: string | null = null
    if (client_name || client_phone) {
      try {
        const { data: existingCustomer } = await admin.from('customers')
          .select('id').eq('tenant_id', tenant_id)
          .eq('phone', client_phone || '').maybeSingle()

        if (existingCustomer) {
          customerId = existingCustomer.id
          await admin.from('customers').update({
            name: client_name || existingCustomer.id,
            notes: [notes, `Interés: ${intent} | ${resolvedOp} | zona: ${zone || 'no especificada'}`].filter(Boolean).join(' · '),
          }).eq('id', customerId)
        } else if (client_name || client_phone) {
          const { data: newCustomer } = await admin.from('customers').insert({
            tenant_id, name: client_name || client_phone || 'Lead',
            phone: client_phone || null, email: client_email || null,
            notes: `Interés: ${intent} | ${resolvedOp} | zona: ${zone || 'no especificada'} | budget: ${budget_max || 'no indicado'}`,
          }).select('id').single()
          customerId = newCustomer?.id || null
        }
      } catch { /* non-critical */ }
    }

    // Crear visita en reservations si se agenda
    if ((finalStatus === 'visit_scheduled' || (action === 'confirm' && visit_date)) && client_name && visit_date) {
      try {
        await admin.rpc('create_reservation_atomic', {
          p_tenant_id: tenant_id, p_date: visit_date, p_time: visit_time || '10:00',
          p_party_size: 1, p_customer_name: client_name, p_customer_phone: client_phone || '',
          p_notes: `Visita inmobiliaria · ${property_ref || 'inmueble a confirmar'} · ${resolvedOp}`,
        })
      } catch { /* non-critical */ }
    }

    // Notificaciones
    const clientLabel = client_name || client_phone || 'Lead'
    if (finalStatus === 'visit_scheduled') {
      await createNotification({ tenant_id, type:'new_reservation', priority:'warning',
        title:`Visita agendada — ${clientLabel}`, body:`${property_ref || ''} · ${visit_date || ''} ${visit_time || ''}`,
        call_sid, target_url:'/reservas' }).catch(() => {})
    } else if (finalStatus === 'confirmed' || finalStatus === 'lead_created') {
      await createNotification({ tenant_id, type:'new_reservation', priority:'info',
        title:`Nuevo lead — ${clientLabel}`,
        body:`${resolvedOp} · ${zone || 'zona no especificada'} · calidad: ${decision.lead_quality}`,
        call_sid, target_url:'/clientes' }).catch(() => {})
    }

    console.log(`lead/${action} | ${intent} | ${finalStatus} | quality:${decision.lead_quality} | ${Date.now()-t0}ms`)
    return NextResponse.json({
      ok: true, status: finalStatus,
      intent, operation: resolvedOp, lead_quality: decision.lead_quality,
      customer_id: customerId, decision_reason: decision.reasoning,
      message: decision.response_hint,
    })
  } catch (e: any) {
    console.error('voice/lead error:', e.message)
    return NextResponse.json({ ok:true, error: e.message })
  }
}

export async function GET() {
  return NextResponse.json({ status:'ok', endpoint:'voice/lead', supports:['inmobiliaria'] })
}
