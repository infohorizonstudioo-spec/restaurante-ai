import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { validateAgentKey } from "@/lib/agent-auth"
import { parseReservationConfig, checkSlotAvailability } from "@/lib/scheduling-engine"
import { resolveTemplate } from "@/lib/templates"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    if (!validateAgentKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    const { tenant_id, customer_name, customer_phone, date, time, party_size, people, notes, service_type, order_items, zone } = await req.json()

    if (!tenant_id || !customer_name) {
      return NextResponse.json({ error: "tenant_id and customer_name required" }, { status: 400 })
    }

    const finalDate = date || new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    const finalTime = time || '20:00'
    const finalPartySize = party_size || people || 1
    const notesStr = [notes, service_type, order_items ? "Pedido: " + order_items : null].filter(Boolean).join(" | ")

    // ── PASO 1: Verificar disponibilidad ANTES de crear ──────────────────
    const [tenantRes, zonesRes, tablesRes, reservasRes] = await Promise.all([
      supabase.from("tenants").select("reservation_config,type").eq("id", tenant_id).maybeSingle(),
      supabase.from("zones").select("id,name").eq("tenant_id", tenant_id).eq("active", true),
      supabase.from("tables").select("id,zone_id,capacity,status").eq("tenant_id", tenant_id),
      supabase.from("reservations")
        .select("id,time,people,party_size,zone_id,table_id,status")
        .eq("tenant_id", tenant_id).eq("date", finalDate)
        .in("status", ["confirmada", "confirmed", "pendiente", "pending"]),
    ])

    const cfg = parseReservationConfig(tenantRes.data?.reservation_config)
    const tenantType = tenantRes.data?.type || 'otro'
    const tmpl = resolveTemplate(tenantType)
    const zones = zonesRes.data || []
    const tables = tmpl.hasSpaces ? (tablesRes.data || []) : []
    const existing = (reservasRes.data || []).map(r => ({
      time: r.time || '', people: r.people || r.party_size || 1,
      zone_id: r.zone_id, table_id: r.table_id,
    }))

    const availability = checkSlotAvailability({
      time: finalTime, date: finalDate, party_size: finalPartySize, zone_name: zone,
      cfg, existing_reservations: existing, tables, zones,
    })

    if (!availability.available) {
      // NO crear si no hay disponibilidad real
      return NextResponse.json({
        success: false,
        available: false,
        reason: availability.reason,
        message: availability.message,
        alternatives: availability.alternatives,
        suggestion: availability.alternatives.length > 0
          ? `No hay sitio a las ${finalTime}. Alternativas: ${availability.alternatives.join(', ')}.`
          : `No hay disponibilidad el ${finalDate} a las ${finalTime} para ${finalPartySize} personas.`,
      })
    }

    // ── PASO 2: Crear o recuperar cliente ─────────────────────────────────
    // Siempre crear cliente si tenemos nombre — phone es opcional
    let customerId: string | null = null
    if (customer_phone) {
      const { data: existing } = await supabase.from("customers")
        .select("id").eq("tenant_id", tenant_id).eq("phone", customer_phone).maybeSingle()
      if (existing) {
        customerId = existing.id
        await supabase.from("customers").update({ name: customer_name }).eq("id", customerId)
      } else {
        const { data: newC } = await supabase.from("customers")
          .insert({ tenant_id, name: customer_name, phone: customer_phone })
          .select("id").maybeSingle()
        customerId = newC?.id || null
      }
    } else if (customer_name) {
      // Sin teléfono pero con nombre → crear cliente igualmente
      const { data: newC } = await supabase.from("customers")
        .insert({ tenant_id, name: customer_name })
        .select("id").maybeSingle()
      customerId = newC?.id || null
    }

    // ── PASO 3: Asignar mesa (la mejor disponible) ───────────────────────
    const reservedTableIds = new Set(existing.map(r => r.table_id).filter(Boolean))
    let assignedTableId: string | null = null
    let assignedTableInfo = ''

    if (tables.length > 0) {
      let freeTables = tables.filter(t =>
        !reservedTableIds.has(t.id) &&
        (t.capacity == null || t.capacity === 0 || t.capacity >= finalPartySize) &&
        t.status !== 'bloqueada'
      )
      // Preferir mesa en zona solicitada
      if (zone) {
        const zoneObj = zones.find(z => z.name.toLowerCase().includes(zone.toLowerCase()))
        if (zoneObj) {
          const zoneTables = freeTables.filter(t => t.zone_id === zoneObj.id)
          if (zoneTables.length > 0) freeTables = zoneTables
        }
      }
      // Elegir la mesa con capacidad más ajustada (no desperdiciar mesa grande para grupo pequeño)
      freeTables.sort((a, b) => (a.capacity || 99) - (b.capacity || 99))
      if (freeTables[0]) {
        assignedTableId = freeTables[0].id
        const tableZone = zones.find(z => z.id === freeTables[0].zone_id)
        assignedTableInfo = tableZone ? ` en ${tableZone.name}` : ''
      }
    }

    // ── PASO 4: Insertar reserva ─────────────────────────────────────────
    const { data: reservation, error } = await supabase.from("reservations").insert({
      tenant_id,
      customer_id: customerId,
      customer_name,
      customer_phone: customer_phone || null,
      date: finalDate,
      time: finalTime,
      people: finalPartySize,
      table_id: assignedTableId,
      notes: notesStr || null,
      status: "confirmada",
      source: "voice_agent",
    }).select("id").maybeSingle()

    if (error) {
      return NextResponse.json({ error: "could not create reservation: " + error.message }, { status: 500 })
    }

    // ── PASO 5: Actualizar mesa a 'reservada' si aplica ──────────────────
    if (assignedTableId) {
      await supabase.from("tables").update({ status: "reservada" }).eq("id", assignedTableId)
    }

    // ── PASO 6: SMS de confirmación al cliente ──────────────────────────
    if (customer_phone) {
      const { data: tenantInfo } = await supabase.from("tenants")
        .select("name").eq("id", tenant_id).maybeSingle()
      const bizName = tenantInfo?.name || 'Tu negocio'
      const dateStr = new Date(finalDate + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
      const smsBody = `✅ ${bizName}: Hola ${customer_name}, tu reserva está confirmada para el ${dateStr} a las ${finalTime}, ${finalPartySize} persona${finalPartySize !== 1 ? 's' : ''}. ¡Te esperamos!`

      const accountSid = process.env.TWILIO_ACCOUNT_SID
      const authToken = process.env.TWILIO_AUTH_TOKEN
      const fromNumber = process.env.TWILIO_SMS_NUMBER || process.env.TWILIO_PHONE_NUMBER
      if (accountSid && authToken && fromNumber) {
        const twilioAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
        fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
          method: 'POST',
          headers: { 'Authorization': `Basic ${twilioAuth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ From: fromNumber, To: customer_phone, Body: smsBody }).toString(),
        }).catch(() => {})
      }
    }

    return NextResponse.json({
      success: true,
      reservation_id: reservation?.id || null,
      customer_name,
      date: finalDate,
      time: finalTime,
      party_size: finalPartySize,
      table: assignedTableId ? `Mesa asignada${assignedTableInfo}` : null,
      status: "confirmed",
      message: `Reserva confirmada para ${customer_name} el ${finalDate} a las ${finalTime}, ${finalPartySize} persona${finalPartySize !== 1 ? 's' : ''}${assignedTableInfo ? assignedTableInfo : ''}.`,
    })
  } catch (err) {
    return NextResponse.json({ error: "internal error" }, { status: 500 })
  }
}
