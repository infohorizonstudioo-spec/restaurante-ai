/**
 * AGENT TOOLS — Pure functions extracted from /api/agent/* routes.
 * Shared by voice agent (ElevenLabs) and text agent (WhatsApp/Email/SMS).
 * Each function contains the core business logic without HTTP concerns.
 */
import { createClient } from '@supabase/supabase-js'
import { parseReservationConfig, checkSlotAvailability, generateSlots } from './scheduling-engine'
import { resolveTemplate } from './templates'
import { makeDecision } from './agent-decision'
import { scheduleReminders, cancelReminders } from './reminder-engine'
import { classifyInteraction, detectConflicts, generateSummary, learnFromInteraction } from './intelligence-engine'
import { logger } from './logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Helper: send SMS via Twilio ──────────────────────────────
export async function sendSms(to: string, body: string): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_SMS_NUMBER || process.env.TWILIO_PHONE_NUMBER
  if (!accountSid || !authToken || !fromNumber || !to) return false

  try {
    const twilioAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${twilioAuth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ From: fromNumber, To: to, Body: body }).toString(),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      logger.error('Twilio SMS error', { code: err.code, message: err.message })
      return false
    }
    return true
  } catch { return false }
}

// ── Helper: send WhatsApp via Twilio ──────────────────────────
export async function sendWhatsApp(to: string, body: string): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER
  if (!accountSid || !authToken || !fromNumber || !to) return false

  try {
    const twilioAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
    const fromWa = fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`
    const toWa = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${twilioAuth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ From: fromWa, To: toWa, Body: body }).toString(),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      logger.error('Twilio WhatsApp error', { code: err.code, message: err.message })
      return false
    }
    return true
  } catch { return false }
}

// ── Helper: get business-type-aware label (reserva/cita/sesión/clase) ────
function getBookingLabel(type: string): { singular: string; plural: string } {
  const tmpl = resolveTemplate(type)
  return { singular: tmpl.labels.reserva.toLowerCase(), plural: tmpl.labels.reservas.toLowerCase() }
}

// ── Helper: format date for display ──────────────────────────
function formatDateES(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
}

// ── Helper: load tenant + availability context ───────────────
async function loadAvailabilityContext(tenantId: string, date: string, excludeReservationId?: string) {
  const [tenantRes, zonesRes, tablesRes, reservasRes] = await Promise.all([
    supabase.from('tenants').select('reservation_config,type,name').eq('id', tenantId).maybeSingle(),
    supabase.from('zones').select('id,name').eq('tenant_id', tenantId).eq('active', true),
    supabase.from('tables').select('id,zone_id,capacity,status').eq('tenant_id', tenantId),
    (() => {
      let q = supabase.from('reservations')
        .select('id,time,people,party_size,zone_id,table_id,status')
        .eq('tenant_id', tenantId).eq('date', date)
        .in('status', ['confirmada', 'confirmed', 'pendiente', 'pending'])
      if (excludeReservationId) q = q.neq('id', excludeReservationId)
      return q
    })(),
  ])

  const tenantType = tenantRes.data?.type || 'otro'
  const cfg = parseReservationConfig(tenantRes.data?.reservation_config, tenantType)
  const tmpl = resolveTemplate(tenantType)
  const zones = zonesRes.data || []
  const tables = tmpl.hasSpaces ? (tablesRes.data || []) : []
  const existing = (reservasRes.data || []).map((r: any) => ({
    time: r.time || '', people: r.people || r.party_size || 1,
    zone_id: r.zone_id, table_id: r.table_id,
  }))

  return { tenantType, tenantName: tenantRes.data?.name || '', cfg, tmpl, zones, tables, existing }
}

// ── Helper: find next available day ──────────────────────────
async function findNextAvailableDay(
  tenantId: string, fromDate: string, partySize: number,
  cfg: any, zones: any[], tables: any[]
): Promise<{ date: string; slot: string } | null> {
  const allSlots = generateSlots(cfg)
  const maxDays = Math.min(cfg.advance_booking_max_days || 14, 14)
  for (let i = 1; i <= maxDays; i++) {
    const d = new Date(fromDate + 'T12:00:00')
    d.setDate(d.getDate() + i)
    const checkDate = d.toISOString().slice(0, 10)

    // Skip closed days
    if (cfg.service_hours?.closed_days?.includes(d.getDay())) continue

    const { data: dayRes } = await supabase.from('reservations')
      .select('time,people,party_size,zone_id,table_id')
      .eq('tenant_id', tenantId).eq('date', checkDate)
      .in('status', ['confirmada', 'confirmed', 'pendiente', 'pending'])

    const existing = (dayRes || []).map((r: any) => ({
      time: r.time || '', people: r.people || r.party_size || 1,
      zone_id: r.zone_id, table_id: r.table_id,
    }))

    for (const slot of allSlots) {
      const result = checkSlotAvailability({
        time: slot, date: checkDate, party_size: partySize,
        cfg, existing_reservations: existing, tables, zones,
      })
      if (result.available) return { date: checkDate, slot }
    }
  }
  return null
}

// ═══════════════════════════════════════════════════════════════
// CHECK AVAILABILITY
// ═══════════════════════════════════════════════════════════════
export async function checkAvailabilityTool(params: {
  tenant_id: string; date: string; time?: string; party_size?: number; zone?: string
}) {
  const { tenant_id, date, time, zone } = params
  const size = params.party_size || 2
  const { cfg, zones, tables, existing } = await loadAvailabilityContext(tenant_id, date)

  if (time) {
    const result = checkSlotAvailability({
      time, date, party_size: size, zone_name: zone,
      cfg, existing_reservations: existing, tables, zones,
    })

    if (result.available) {
      // Smart tip: warn if almost full
      const capacityWarning = result.slots_remaining <= 1
        ? ' Queda muy poco — confírmalo rápido.'
        : result.slots_remaining <= 2
        ? ' Quedan pocas plazas a esa hora.'
        : ''
      return {
        success: true, available: true, message: result.message + capacityWarning,
        slot: time, slots_remaining: result.slots_remaining, people_remaining: result.people_remaining,
      }
    }

    const alternatives = result.alternatives
    let nextDayMessage = ''
    if (alternatives.length === 0) {
      const nextDay = await findNextAvailableDay(tenant_id, date, size, cfg, zones, tables)
      if (nextDay) nextDayMessage = `El día más cercano con disponibilidad es el ${formatDateES(nextDay.date)} a las ${nextDay.slot}.`
    }

    return {
      success: true, available: false, waitlist_available: true,
      reason: result.reason, message: result.message, alternatives, next_available_day: nextDayMessage,
      suggestion: alternatives.length > 0
        ? `No hay disponibilidad a las ${time}. Puedes ofrecerle las ${alternatives[0]}${alternatives[1] ? ' o las ' + alternatives[1] : ''}.`
        : nextDayMessage
          ? `Hoy no queda hueco. ${nextDayMessage}`
          : `Hoy no hay hueco${size > 1 ? ` para ${size}` : ''}. Sugiérele probar otro día.`,
    }
  }

  // No specific time → return all available slots
  const allSlots = generateSlots(cfg)
  const available: { slot: string; remaining: number; people_remaining: number }[] = []

  for (const slot of allSlots) {
    const result = checkSlotAvailability({
      time: slot, date, party_size: size, zone_name: zone,
      cfg, existing_reservations: existing, tables, zones,
    })
    if (result.available) {
      available.push({ slot, remaining: result.slots_remaining, people_remaining: result.people_remaining })
    }
  }

  if (available.length === 0) {
    const nextDay = await findNextAvailableDay(tenant_id, date, size, cfg, zones, tables)
    return {
      success: true, available: false, waitlist_available: true,
      message: `No queda disponibilidad${size > 1 ? ` para ${size} personas` : ''} el ${formatDateES(date)}.`,
      available_slots: [], best_slots: [],
      suggestion: nextDay
        ? `Hoy no hay hueco. El día más cercano es el ${formatDateES(nextDay.date)} a las ${nextDay.slot}.`
        : `No hay disponibilidad próximamente. Sugiérele llamar más adelante.`,
      next_available_day: nextDay ? `${formatDateES(nextDay.date)} a las ${nextDay.slot}` : null,
    }
  }

  const best = available.slice(0, 3).map(s => s.slot)
  return {
    success: true, available: true,
    available_slots: available.map(s => s.slot), best_slots: best,
    message: `Hay ${available.length} huecos disponibles. Los mejores: ${best.join(', ')}.`,
    suggestion: `Puedes ofrecerle las ${best[0]}${best[1] ? ', las ' + best[1] : ''}${best[2] ? ' o las ' + best[2] : ''}.`,
  }
}

// ═══════════════════════════════════════════════════════════════
// CREATE RESERVATION
// ═══════════════════════════════════════════════════════════════
export async function createReservationTool(params: {
  tenant_id: string; customer_name: string; customer_phone?: string;
  date?: string; time?: string; party_size?: number; people?: number;
  notes?: string; service_type?: string; order_items?: string; zone?: string;
  source?: string;
}) {
  const { tenant_id, customer_name, customer_phone, zone, service_type, order_items } = params
  const tomorrow = new Date(new Date().toISOString().slice(0, 10) + 'T12:00:00')
  tomorrow.setDate(tomorrow.getDate() + 1)
  const finalDate = params.date || tomorrow.toISOString().slice(0, 10)
  const finalTime = params.time || '20:00'
  const finalPartySize = params.party_size || params.people || 1
  if (finalPartySize < 1) return { success: false, error: 'El número de personas debe ser al menos 1' }
  if (finalPartySize > 50) return { success: false, error: 'Para grupos de más de 50 personas, contacta directamente con el negocio' }
  const notesStr = [params.notes, service_type, order_items ? "Pedido: " + order_items : null].filter(Boolean).join(' | ')
  const source = params.source || 'voice_agent'

  // 1. Check availability
  const { tenantType, cfg, tmpl, zones, tables, existing, tenantName } = await loadAvailabilityContext(tenant_id, finalDate)

  const availability = checkSlotAvailability({
    time: finalTime, date: finalDate, party_size: finalPartySize, zone_name: zone,
    cfg, existing_reservations: existing, tables, zones,
  })

  if (!availability.available) {
    return {
      success: false, available: false,
      reason: availability.reason, message: availability.message,
      alternatives: availability.alternatives,
      suggestion: availability.alternatives.length > 0
        ? `No hay disponibilidad a las ${finalTime}. Alternativas: ${availability.alternatives.join(', ')}.`
        : `No hay disponibilidad el ${finalDate} a las ${finalTime}${finalPartySize > 1 ? ` para ${finalPartySize} personas` : ''}.`,
    }
  }

  // 2. Check for duplicate
  if (customer_phone) {
    const { data: dup } = await supabase.from('reservations')
      .select('id').eq('tenant_id', tenant_id).eq('customer_phone', customer_phone)
      .eq('date', finalDate).eq('time', finalTime)
      .in('status', ['confirmada', 'confirmed', 'pendiente', 'pending'])
      .maybeSingle()
    if (dup) {
      return {
        success: true, already_exists: true, reservation_id: dup.id,
        message: `Ya tienes una reserva para el ${finalDate} a las ${finalTime}. No hace falta otra.`,
      }
    }
  }

  // 2b. Detect conflicts
  const conflicts = await detectConflicts({ tenant_id, customer_phone, customer_name, date: finalDate, time: finalTime, party_size: finalPartySize })
  if (conflicts.conflicts.some(c => c.severity === 'critical')) {
    const critical = conflicts.conflicts.find(c => c.severity === 'critical')!
    return { success: false, conflict: true, message: critical.description, suggestion: critical.suggested_action }
  }

  // 3. Upsert customer
  let customerId: string | null = null
  if (customer_phone) {
    const { data: ex } = await supabase.from('customers')
      .select('id').eq('tenant_id', tenant_id).eq('phone', customer_phone).maybeSingle()
    if (ex) {
      customerId = ex.id
      await supabase.from('customers').update({ name: customer_name }).eq('id', customerId)
    } else {
      const { data: newC } = await supabase.from('customers')
        .insert({ tenant_id, name: customer_name, phone: customer_phone }).select('id').maybeSingle()
      customerId = newC?.id || null
    }
  } else if (customer_name) {
    const { data: newC } = await supabase.from('customers')
      .insert({ tenant_id, name: customer_name }).select('id').maybeSingle()
    customerId = newC?.id || null
  }

  // 4. Assign best table
  const reservedTableIds = new Set(existing.map(r => r.table_id).filter(Boolean))
  let assignedTableId: string | null = null
  let assignedTableInfo = ''

  if (tables.length > 0) {
    let freeTables = tables.filter((t: any) =>
      !reservedTableIds.has(t.id) &&
      (t.capacity == null || t.capacity === 0 || t.capacity >= finalPartySize) &&
      t.status !== 'bloqueada'
    )
    if (zone) {
      const zoneObj = zones.find((z: any) => z.name.toLowerCase().includes(zone.toLowerCase()))
      if (zoneObj) {
        const zoneTables = freeTables.filter((t: any) => t.zone_id === zoneObj.id)
        if (zoneTables.length > 0) freeTables = zoneTables
      }
    }
    freeTables.sort((a: any, b: any) => (a.capacity || 99) - (b.capacity || 99))
    if (freeTables[0]) {
      assignedTableId = freeTables[0].id
      const tableZone = zones.find((z: any) => z.id === freeTables[0].zone_id)
      assignedTableInfo = tableZone ? ` en ${tableZone.name}` : ''
    }
  }

  // 5. Run decision engine — per-type logic decides auto-confirm vs needs-review
  const decision = await makeDecision({
    tenantId: tenant_id,
    type: tenantType,
    input: {
      party_size: finalPartySize,
      date: finalDate,
      time: finalTime,
      notes: notesStr,
      customer_name,
      customer_phone,
    },
  })

  // Crisis handling (psicologia) — don't create reservation, flag immediately
  if (decision.action === 'crisis') {
    await supabase.from('notifications').insert({
      tenant_id, type: 'crisis_alert',
      title: `⚠️ ALERTA — ${customer_name}`,
      body: decision.reason,
      read: false,
    })
    return {
      success: true, crisis: true,
      message: decision.reason,
      flags: decision.flags,
    }
  }

  // Reject — date too far, past date, etc.
  if (decision.action === 'reject') {
    return {
      success: false, rejected: true,
      reason: decision.reason,
      flags: decision.flags,
      message: decision.reason,
    }
  }

  const finalStatus = decision.status === 'confirmed' ? 'confirmada' : 'pendiente'

  // 6. Insert reservation with decision-based status
  const { data: reservation, error } = await supabase.from('reservations').insert({
    tenant_id, customer_id: customerId, customer_name,
    customer_phone: customer_phone || null,
    date: finalDate, time: finalTime, people: finalPartySize,
    table_id: assignedTableId, notes: notesStr || null,
    status: finalStatus, source,
  }).select('id').maybeSingle()

  if (error) return { success: false, error: 'could not create reservation: ' + error.message }

  // 7. Update table status
  if (assignedTableId) {
    await supabase.from('tables').update({ status: 'reservada' }).eq('id', assignedTableId)
  }

  // 8. Notification for owner if needs review
  if (decision.action === 'needs_review') {
    await supabase.from('notifications').insert({
      tenant_id, type: 'reservation_review',
      title: `📋 Revisar — ${customer_name} (${finalPartySize}p)`,
      body: `${decision.reason} | ${formatDateES(finalDate)} a las ${finalTime}`,
      read: false,
    })
  }

  // 9. SMS confirmation — con terminología adaptada al tipo de negocio
  const bLabel = getBookingLabel(tenantType)
  if (customer_phone) {
    const bizName = tenantName || 'Tu negocio'
    const dateStr = formatDateES(finalDate)
    const smsBody = finalStatus === 'confirmada'
      ? `${bizName}: Hola ${customer_name}, confirmada tu ${bLabel.singular} para el ${dateStr} a las ${finalTime}${finalPartySize > 1 ? `, ${finalPartySize} personas` : ''}. ¡Te esperamos!`
      : `${bizName}: Hola ${customer_name}, tu ${bLabel.singular} para el ${dateStr} a las ${finalTime}${finalPartySize > 1 ? ` (${finalPartySize}p)` : ''} está pendiente de confirmación. Te avisamos enseguida.`
    sendSms(customer_phone, smsBody).catch(() => {})
  }

  // Schedule reminders
  if (reservation?.id) {
    scheduleReminders(reservation.id).catch(() => {})
  }

  // Learn from this interaction
  const classification = classifyInteraction({
    text: notesStr, party_size: finalPartySize,
    business_type: tenantType, business_rules: {},
  })
  learnFromInteraction({
    tenant_id, type: 'reserva', classification,
    customer_phone, outcome: 'success',
  }).catch(() => {}) // non-blocking

  return {
    success: true, reservation_id: reservation?.id || null,
    customer_name, date: finalDate, time: finalTime, party_size: finalPartySize,
    table: assignedTableId ? `${tmpl.labels.unit?.singular || 'Espacio'} asignado${assignedTableInfo}` : null,
    status: finalStatus === 'confirmada' ? 'confirmed' : 'pending_review',
    decision_flags: decision.flags,
    decision_confidence: decision.confidence,
    message: finalStatus === 'confirmada'
      ? `${bLabel.singular.charAt(0).toUpperCase() + bLabel.singular.slice(1)} confirmada para ${customer_name} el ${finalDate} a las ${finalTime}${finalPartySize > 1 ? `, ${finalPartySize} personas` : ''}${assignedTableInfo}.`
      : `${bLabel.singular.charAt(0).toUpperCase() + bLabel.singular.slice(1)} registrada para ${customer_name} el ${finalDate} a las ${finalTime}${finalPartySize > 1 ? `, ${finalPartySize} personas` : ''}. Pendiente de confirmación.`,
  }
}

// ═══════════════════════════════════════════════════════════════
// CANCEL RESERVATION
// ═══════════════════════════════════════════════════════════════
export async function cancelReservationTool(params: {
  tenant_id: string; customer_name?: string; customer_phone?: string; date?: string
}) {
  const { tenant_id, customer_name, customer_phone, date } = params
  if (!customer_phone && !customer_name) {
    return { success: false, error: 'customer_phone or customer_name required' }
  }

  // Get tenant type for dynamic labels
  const { data: tenantData } = await supabase.from('tenants').select('type').eq('id', tenant_id).maybeSingle()
  const bLabel = getBookingLabel(tenantData?.type || 'otro')

  let query = supabase.from('reservations')
    .select('id, customer_name, customer_phone, date, time, people, status, table_id')
    .eq('tenant_id', tenant_id)
    .in('status', ['confirmada', 'confirmed', 'pendiente', 'pending'])
    .order('date', { ascending: true })

  if (customer_phone) query = query.eq('customer_phone', customer_phone)
  else if (customer_name) query = query.ilike('customer_name', `%${customer_name}%`)

  if (date) query = query.eq('date', date)
  else query = query.gte('date', new Date().toISOString().slice(0, 10))

  const { data: reservations } = await query.limit(5)

  if (!reservations || reservations.length === 0) {
    return {
      success: false, found: false,
      message: customer_phone
        ? `No encuentro ninguna ${bLabel.singular} activa con ese teléfono.`
        : `No encuentro ninguna ${bLabel.singular} a nombre de ${customer_name}.`,
      suggestion: 'Pregúntale si puede dar más datos: nombre, fecha, o teléfono con el que reservó.',
    }
  }

  const toCancel = reservations[0]
  const time = (toCancel.time || '').slice(0, 5)
  const dateStr = formatDateES(toCancel.date)

  await supabase.from('reservations')
    .update({ status: 'cancelada' })
    .eq('id', toCancel.id).eq('tenant_id', tenant_id)

  // Free the table if one was assigned
  if (toCancel.table_id) {
    await supabase.from('tables').update({ status: 'libre' }).eq('id', toCancel.table_id)
  }

  // Get business name for SMS
  const { data: tenantInfo } = await supabase.from('tenants').select('name').eq('id', tenant_id).maybeSingle()
  const bizName = tenantInfo?.name || 'Tu negocio'

  // SMS to cancelled customer
  if (toCancel.customer_phone) {
    sendSms(toCancel.customer_phone, `${bizName}: ${toCancel.customer_name}, tu ${bLabel.singular} del ${dateStr} a las ${time} queda cancelada. Cualquier cosa, llámanos.`).catch(() => {})
  }

  // Notify waitlist
  const { data: waitlisted } = await supabase.from('waitlist')
    .select('id, customer_name, customer_phone')
    .eq('tenant_id', tenant_id).eq('date', toCancel.date).eq('status', 'waiting')
    .order('created_at').limit(1).maybeSingle()

  if (waitlisted?.customer_phone) {
    sendSms(waitlisted.customer_phone, `${bizName}: ${waitlisted.customer_name}, ha quedado hueco el ${dateStr}. Llámanos para confirmar tu ${bLabel.singular}.`).catch(() => {})
    await supabase.from('waitlist').update({ status: 'notified' }).eq('id', waitlisted.id)
  }

  // Notification
  await supabase.from('notifications').insert({
    tenant_id, type: 'reservation_cancelled',
    title: `Cancelación — ${toCancel.customer_name}`,
    body: `${toCancel.customer_name} canceló su ${bLabel.singular} del ${dateStr} a las ${time} (${toCancel.people}p)`,
    read: false,
  })

  // Cancel scheduled reminders
  cancelReminders(toCancel.id).catch(() => {})

  return {
    success: true, cancelled_id: toCancel.id,
    customer_name: toCancel.customer_name, date: toCancel.date, time, people: toCancel.people,
    message: `Cancelada la ${bLabel.singular} de ${toCancel.customer_name} para el ${dateStr} a las ${time}${toCancel.people > 1 ? `, ${toCancel.people} personas` : ''}.`,
    waitlist_notified: !!waitlisted,
  }
}

// ═══════════════════════════════════════════════════════════════
// MODIFY RESERVATION
// ═══════════════════════════════════════════════════════════════
export async function modifyReservationTool(params: {
  tenant_id: string; customer_name?: string; customer_phone?: string;
  new_date?: string; new_time?: string; new_party_size?: number
}) {
  const { tenant_id, customer_name, customer_phone, new_date, new_time, new_party_size } = params
  if (!customer_phone && !customer_name) return { success: false, error: 'need phone or name' }
  if (!new_date && !new_time && !new_party_size) return { success: false, error: 'need at least one change' }

  const { data: tenantData } = await supabase.from('tenants').select('type').eq('id', tenant_id).maybeSingle()
  const bLabel = getBookingLabel(tenantData?.type || 'otro')

  let query = supabase.from('reservations')
    .select('id, customer_name, customer_phone, date, time, people, status, tenant_id, table_id')
    .eq('tenant_id', tenant_id)
    .in('status', ['confirmada', 'confirmed', 'pendiente', 'pending'])
    .gte('date', new Date().toISOString().slice(0, 10))
    .order('date', { ascending: true })

  if (customer_phone) query = query.eq('customer_phone', customer_phone)
  else if (customer_name) query = query.ilike('customer_name', `%${customer_name}%`)

  const { data: reservations } = await query.limit(5)
  if (!reservations || reservations.length === 0) {
    return {
      success: false, found: false,
      message: customer_phone
        ? `No encuentro ninguna ${bLabel.singular} activa con el teléfono ${customer_phone}.`
        : `No encuentro ninguna ${bLabel.singular} a nombre de ${customer_name}.`,
      suggestion: 'Pregúntale si puede dar más datos.',
    }
  }

  const original = reservations[0]
  const finalDate = new_date || original.date
  const finalTime = new_time || (original.time || '').slice(0, 5)
  const finalPeople = new_party_size || original.people || 2

  // Check availability for new slot
  const { cfg, zones, tables, existing, tenantName } = await loadAvailabilityContext(tenant_id, finalDate, original.id)

  const availability = checkSlotAvailability({
    time: finalTime, date: finalDate, party_size: finalPeople,
    cfg, existing_reservations: existing, tables, zones,
  })

  if (!availability.available) {
    return {
      success: false, available: false, message: availability.message,
      alternatives: availability.alternatives,
      suggestion: availability.alternatives.length > 0
        ? `No hay disponibilidad a las ${finalTime}. Alternativas: ${availability.alternatives.join(', ')}.`
        : `No hay disponibilidad el ${finalDate} a las ${finalTime}${finalPeople > 1 ? ` para ${finalPeople} personas` : ''}.`,
    }
  }

  // Re-run decision engine for the modified reservation
  const { tenantType } = await loadAvailabilityContext(tenant_id, finalDate)
  const decisionResult = await makeDecision({
    tenantId: tenant_id,
    type: tenantType,
    input: {
      party_size: finalPeople,
      date: finalDate,
      time: finalTime,
      notes: '',
      is_new_customer: false,
    },
  })
  const newStatus = decisionResult.status === 'confirmed' ? 'confirmada'
    : decisionResult.status === 'rejected' ? 'cancelada'
    : 'pendiente'

  await supabase.from('reservations').update({
    date: finalDate, time: finalTime, people: finalPeople, status: newStatus,
  }).eq('id', original.id).eq('tenant_id', tenant_id)

  // Free old table if date/time changed
  if (original.table_id && (finalDate !== original.date || finalTime !== (original.time||'').slice(0,5))) {
    await supabase.from('tables').update({ status: 'libre' }).eq('id', original.table_id)
  }

  const oldTime = (original.time || '').slice(0, 5)
  const oldDateStr = formatDateES(original.date)
  const newDateStr = formatDateES(finalDate)

  await supabase.from('notifications').insert({
    tenant_id, type: 'reservation_modified',
    title: `Modificación — ${original.customer_name}`,
    body: `${original.customer_name} cambió su ${bLabel.singular} del ${oldDateStr} ${oldTime} → ${newDateStr} ${finalTime}${finalPeople > 1 ? ` (${finalPeople}p)` : ''}`,
    read: false,
  })

  const phone = original.customer_phone || customer_phone
  if (phone) {
    const bizName = tenantName || 'Tu negocio'
    sendSms(phone, `${bizName}: Hola ${original.customer_name}, tu ${bLabel.singular} queda cambiada: ${newDateStr} a las ${finalTime}${finalPeople > 1 ? `, ${finalPeople} personas` : ''}. ¡Te esperamos!`).catch(() => {})
  }

  // Re-schedule reminders
  cancelReminders(original.id).catch(() => {})
  scheduleReminders(original.id).catch(() => {})

  return {
    success: true, reservation_id: original.id, customer_name: original.customer_name,
    old: { date: original.date, time: oldTime, people: original.people },
    new: { date: finalDate, time: finalTime, people: finalPeople },
    message: `${bLabel.singular.charAt(0).toUpperCase() + bLabel.singular.slice(1)} modificada: ${original.customer_name}, ahora el ${newDateStr} a las ${finalTime}${finalPeople > 1 ? `, ${finalPeople} personas` : ''}.`,
  }
}

// ═══════════════════════════════════════════════════════════════
// GET MENU / SERVICES
// ═══════════════════════════════════════════════════════════════
export async function getMenuTool(params: { tenant_id: string }) {
  const { tenant_id } = params

  const { data: menuItems } = await supabase
    .from('menu_items').select('name, description, price, category, available')
    .eq('tenant_id', tenant_id).eq('available', true)
    .order('category').limit(40)

  if (menuItems && menuItems.length > 0) {
    const byCategory: Record<string, { name: string; price?: number; description?: string }[]> = {}
    for (const item of menuItems) {
      const cat = item.category || 'General'
      if (!byCategory[cat]) byCategory[cat] = []
      byCategory[cat].push({ name: item.name, price: item.price, description: item.description })
    }
    return { success: true, source: 'menu_items', items: byCategory }
  }

  const { data: knowledge } = await supabase
    .from('business_knowledge').select('category, content')
    .eq('tenant_id', tenant_id).eq('active', true)
    .in('category', ['menu', 'servicios', 'carta', 'productos', 'tratamientos', 'precios'])

  const grouped: Record<string, string[]> = {}
  for (const k of knowledge || []) {
    if (!grouped[k.category]) grouped[k.category] = []
    grouped[k.category].push(k.content)
  }

  return {
    success: true, source: 'business_knowledge', items: grouped,
    note: Object.keys(grouped).length === 0
      ? 'No hay información de servicios disponible. Sugiérele que contacte directamente con el negocio.' : undefined,
  }
}

// ═══════════════════════════════════════════════════════════════
// UPDATE ORDER
// ═══════════════════════════════════════════════════════════════
export async function updateOrderTool(params: {
  tenant_id: string; order_id?: string; call_sid?: string; action?: string;
  customer_name?: string; customer_phone?: string;
  items?: { name: string; quantity: number; price: number }[];
  order_type?: string; pickup_time?: string; delivery_address?: string;
  notes?: string; table_id?: string;
}) {
  const { tenant_id, order_id, action, customer_name, customer_phone, items, order_type, pickup_time, delivery_address, notes, table_id } = params
  const callSid = params.call_sid || 'channel_' + Date.now()

  if (order_id) {
    const updates: Record<string, any> = { updated_at: new Date().toISOString() }
    if (items) updates.items = items
    if (notes) updates.notes = notes
    if (pickup_time) updates.pickup_time = pickup_time
    if (customer_name) updates.customer_name = customer_name
    if (items && Array.isArray(items)) {
      updates.total_estimate = items.reduce((s, i) => s + ((i.price || 0) * (i.quantity || 1)), 0)
    }
    if (action === 'confirm') updates.status = 'confirmed'
    else if (action === 'cancel') updates.status = 'cancelled'

    const { data, error } = await supabase.from('order_events')
      .update(updates).eq('id', order_id).eq('tenant_id', tenant_id)
      .select('id, status, items, total_estimate').maybeSingle()

    if (error) return { success: false, error: 'could not update order' }

    if (action === 'confirm' && customer_phone) {
      const { data: tenantInfo } = await supabase.from('tenants').select('name').eq('id', tenant_id).maybeSingle()
      const bizName = tenantInfo?.name || 'Tu negocio'
      const total = data?.total_estimate || 0
      const orderT = order_type || 'recoger'
      const smsBody = orderT === 'domicilio'
        ? `${bizName}: Hola ${customer_name}, tu pedido (${total.toFixed(2)}€) a domicilio está confirmado. Lo preparamos ya.`
        : `${bizName}: Hola ${customer_name}, tu pedido (${total.toFixed(2)}€) está confirmado. Te avisamos cuando esté listo.`
      sendSms(customer_phone, smsBody).catch(() => {})
    }

    return {
      success: true, order_id: data?.id, status: data?.status,
      items_count: Array.isArray(data?.items) ? data.items.length : 0,
      total: data?.total_estimate || 0,
      message: action === 'confirm'
        ? `Pedido confirmado. Total: ${data?.total_estimate || 0}€.`
        : `Pedido actualizado. ${Array.isArray(data?.items) ? data.items.length : 0} productos.`,
    }
  }

  // Create new order
  if (!customer_name) return { success: false, error: 'customer_name required for new order' }

  const orderItems = items || []
  const total = orderItems.reduce((s, i) => s + ((i.price || 0) * (i.quantity || 1)), 0)

  const { data: order, error } = await supabase.from('order_events').insert({
    tenant_id, call_sid: callSid, status: 'collecting',
    order_type: order_type || 'recoger', customer_name,
    customer_phone: customer_phone || null, items: orderItems,
    notes: [delivery_address ? `DIRECCIÓN: ${delivery_address}` : null, notes].filter(Boolean).join(' | ') || null,
    pickup_time: pickup_time || null, total_estimate: total,
    table_id: table_id || null,
  }).select('id, status').maybeSingle()

  if (error) return { success: false, error: 'could not create order' }

  return {
    success: true, order_id: order?.id, status: 'collecting',
    message: `Pedido creado para ${customer_name}. Sigue añadiendo productos.`,
  }
}

// ═══════════════════════════════════════════════════════════════
// ADD TO WAITLIST
// ═══════════════════════════════════════════════════════════════
export async function addToWaitlistTool(params: {
  tenant_id: string; customer_name: string; customer_phone?: string;
  date: string; time?: string; party_size?: number
}) {
  const { tenant_id, customer_name, customer_phone, date, time, party_size } = params

  if (customer_phone) {
    const { data: existing } = await supabase.from('waitlist')
      .select('id').eq('tenant_id', tenant_id).eq('customer_phone', customer_phone).eq('date', date).maybeSingle()
    if (existing) {
      return { success: true, already_listed: true, message: 'Ya estás en la lista de espera para ese día.' }
    }
  }

  const { data, error } = await supabase.from('waitlist').insert({
    tenant_id, customer_name, customer_phone: customer_phone || null,
    date, preferred_time: time || null, party_size: party_size || 2, status: 'waiting',
  }).select('id').maybeSingle()

  if (error && error.code === '42P01') {
    return { success: false, waitlist_supported: false, message: 'La lista de espera no está disponible en este momento.' }
  }
  if (error) return { success: false, error: 'could not add to waitlist' }

  return {
    success: true, waitlist_id: data?.id,
    message: `${customer_name} está en la lista de espera para el ${date}${time ? ' a las ' + time : ''}. Si queda un hueco, te avisamos.`,
  }
}
