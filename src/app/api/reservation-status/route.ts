import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { recordCustomerEvent, createCustomerAlert, updateCustomerScoring } from '@/lib/customer-memory'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const rl = rateLimitByIp(req, RATE_LIMITS.api, 'reservation-status')
  if (rl.blocked) return rl.response

  const auth = await requireAuth(req)
  if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const tenantId = auth.tenantId
  const body = await req.json()
  const { reservation_id, status } = body

  if (!reservation_id || !status) {
    return NextResponse.json({ error: 'reservation_id and status required' }, { status: 400 })
  }

  const validStatuses = ['confirmada', 'pendiente', 'cancelada', 'completada', 'no_show']
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: 'invalid status' }, { status: 400 })
  }

  // Fetch the reservation
  const { data: reservation, error: fetchErr } = await supabase
    .from('reservations')
    .select('*')
    .eq('id', reservation_id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (fetchErr || !reservation) {
    return NextResponse.json({ error: 'reservation not found' }, { status: 404 })
  }

  // Update reservation status
  const { error: updateErr } = await supabase
    .from('reservations')
    .update({ status })
    .eq('id', reservation_id)
    .eq('tenant_id', tenantId)

  if (updateErr) {
    return NextResponse.json({ error: 'update failed: ' + updateErr.message }, { status: 500 })
  }

  const customerId = reservation.customer_id
  const customerName = reservation.customer_name || 'Sin nombre'
  const phone = reservation.customer_phone
  const dateStr = reservation.date || reservation.reservation_date || ''
  const timeStr = (reservation.time || reservation.reservation_time || '').slice(0, 5)
  const partySize = reservation.people || reservation.party_size || 1

  // Side-effects based on status
  try {
    if (status === 'completada' && customerId) {
      // Record visit — increments visit_count, sets last_visit
      await recordCustomerEvent(tenantId, customerId, {
        event_type: 'visit',
        channel: 'dashboard',
        summary: `Completó reserva del ${dateStr} a las ${timeStr} (${partySize}p)`,
        sentiment: 'positive',
        reservation_id,
      })
      await updateCustomerScoring(tenantId, customerId)
    }

    if (status === 'no_show' && customerId) {
      // Record no-show — increments no_show_count
      await recordCustomerEvent(tenantId, customerId, {
        event_type: 'no_show',
        channel: 'dashboard',
        summary: `No se presentó a la reserva del ${dateStr} a las ${timeStr} (${partySize}p)`,
        sentiment: 'negative',
        reservation_id,
      })

      // Fetch updated count to create alert
      const { data: cust } = await supabase
        .from('customers')
        .select('no_show_count,name')
        .eq('id', customerId)
        .maybeSingle()

      const noShows = cust?.no_show_count || 0
      if (noShows >= 2) {
        await createCustomerAlert(tenantId, customerId, {
          alert_type: 'no_show_risk',
          severity: noShows >= 4 ? 'critical' : 'warning',
          title: `${cust?.name || customerName} tiene ${noShows} no-shows`,
          body: `No se presentó ${noShows} veces. Considerar confirmación adicional o política de no-show.`,
        })
      }
      await updateCustomerScoring(tenantId, customerId)
    }

    if (status === 'cancelada' && customerId) {
      await recordCustomerEvent(tenantId, customerId, {
        event_type: 'reservation_cancelled',
        channel: 'dashboard',
        summary: `Canceló reserva del ${dateStr} a las ${timeStr} (${partySize}p)`,
        reservation_id,
      })
      await updateCustomerScoring(tenantId, customerId)
    }
  } catch (e: any) {
    logger.error('reservation-status side-effects error', e)
    // Don't fail the request — status already updated
  }

  // Notification
  await supabase.from('notifications').insert({
    tenant_id: tenantId,
    type: status === 'confirmada' ? 'reservation_confirmed'
      : status === 'cancelada' ? 'reservation_cancelled'
      : status === 'no_show' ? 'reservation_no_show'
      : 'reservation_updated',
    title: `Reserva ${status} — ${customerName}`,
    body: `${customerName} · ${dateStr} a las ${timeStr} · ${partySize}p`,
    read: false,
  })

  // SMS for confirmada/cancelada
  if (phone && (status === 'confirmada' || status === 'cancelada')) {
    const { data: tenantInfo } = await supabase.from('tenants').select('name').eq('id', tenantId).maybeSingle()
    const bizName = tenantInfo?.name || ''
    const prefix = bizName ? `${bizName}: ` : ''
    const smsBody = status === 'confirmada'
      ? `${prefix}${customerName}, confirmada tu reserva para el ${dateStr} a las ${timeStr}${partySize > 1 ? `, ${partySize} personas` : ''}. ¡Te esperamos!`
      : `${prefix}${customerName}, tu reserva del ${dateStr} a las ${timeStr} queda cancelada. Cualquier cosa, llámanos.`

    fetch(new URL('/api/sms/send', req.url).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': req.headers.get('Authorization') || '' },
      body: JSON.stringify({ to: phone, type: `reservation_${status}`, message: smsBody }),
    }).catch(() => {})
  }

  // Waitlist notification on cancellation
  if (status === 'cancelada' && dateStr) {
    const { data: waitlisted } = await supabase.from('waitlist')
      .select('id,customer_name,customer_phone')
      .eq('tenant_id', tenantId).eq('date', dateStr).eq('status', 'waiting')
      .order('created_at').limit(1).maybeSingle()

    if (waitlisted?.customer_phone) {
      fetch(new URL('/api/sms/send', req.url).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': req.headers.get('Authorization') || '' },
        body: JSON.stringify({
          to: waitlisted.customer_phone,
          message: `Ha quedado hueco el ${dateStr}. Llámanos para confirmar tu reserva.`,
        }),
      }).catch(() => {})
      await supabase.from('waitlist').update({ status: 'notified' }).eq('id', waitlisted.id)
    }
  }

  return NextResponse.json({ ok: true })
}
