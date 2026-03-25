/**
 * RESERVO.AI — Scheduling Engine
 * Motor de decisión de franjas horarias para plantilla hostelería.
 * SOLO se usa cuando el tenant es restaurante/bar/cafetería.
 * Para otros tipos de negocio, usar el flujo estándar de disponibilidad.
 */

export interface ReservationConfig {
  reservation_slot_interval_minutes: number    // 15 | 30 | 60
  default_reservation_duration_minutes: number  // duración media en minutos
  buffer_minutes: number                        // buffer entre reservas
  max_new_reservations_per_slot: number         // máximo reservas por franja
  max_new_people_per_slot: number               // máximo personas por franja
  zone_slot_limits: Record<string, number>      // { "terraza": 2, "interior": 4 }
  service_hours?: {
    lunch_start?: string; lunch_end?: string
    dinner_start?: string; dinner_end?: string
  }
}

export const DEFAULT_CONFIG: ReservationConfig = {
  reservation_slot_interval_minutes: 30,
  default_reservation_duration_minutes: 90,
  buffer_minutes: 15,
  max_new_reservations_per_slot: 4,
  max_new_people_per_slot: 16,
  zone_slot_limits: {},
  service_hours: { lunch_start:'13:00', lunch_end:'16:00', dinner_start:'20:00', dinner_end:'23:30' }
}

export interface SlotCheckResult {
  available: boolean
  reason: SlotRejectReason | null
  alternatives: string[]           // hasta 3 franjas alternativas válidas
  slot_reservations: number        // reservas ya en esta franja
  slot_people: number              // personas ya en esta franja
  slots_remaining: number          // huecos restantes en la franja
  people_remaining: number         // personas restantes en la franja
  zone_remaining?: number          // huecos en la zona si aplica
  message: string
  trace: string[]                  // trazabilidad paso a paso
}

export type SlotRejectReason =
  | 'invalid_slot'           // hora no pertenece a un intervalo válido
  | 'outside_service_hours'  // fuera del horario de servicio
  | 'slot_full_reservations' // franja llena por número de reservas
  | 'slot_full_people'       // franja llena por número de personas
  | 'zone_full'              // zona específica sin hueco
  | 'no_table_available'     // sin mesa válida (capacidad/buffer)
  | 'buffer_conflict'        // conflicto con buffer entre reservas

export interface SlotStats {
  time: string
  reservations: number
  people: number
  max_reservations: number
  max_people: number
  zones: Record<string, { used: number; max: number }>
}

// ── Utilidades de tiempo ────────────────────────────────────────────────────

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

export function minutesToTime(m: number): string {
  const h = Math.floor(m / 60)
  const min = m % 60
  return h.toString().padStart(2,'0') + ':' + min.toString().padStart(2,'0')
}

/** Verifica si una hora pertenece a un intervalo válido */
export function isValidSlot(time: string, cfg: ReservationConfig): boolean {
  const mins = timeToMinutes(time)
  const interval = cfg.reservation_slot_interval_minutes
  if (mins % interval !== 0) return false

  // Verificar que cae dentro de horario de servicio
  if (cfg.service_hours) {
    const sh = cfg.service_hours
    const inLunch  = sh.lunch_start  && sh.lunch_end  && mins >= timeToMinutes(sh.lunch_start) && mins < timeToMinutes(sh.lunch_end)
    const inDinner = sh.dinner_start && sh.dinner_end && mins >= timeToMinutes(sh.dinner_start) && mins < timeToMinutes(sh.dinner_end)
    if (!inLunch && !inDinner) return false
  }
  return true
}

/** Genera todas las franjas válidas para una fecha */
export function generateSlots(cfg: ReservationConfig): string[] {
  const slots: string[] = []
  const interval = cfg.reservation_slot_interval_minutes
  const sh = cfg.service_hours || {}
  const periods = [
    sh.lunch_start && sh.lunch_end   ? { s: sh.lunch_start,  e: sh.lunch_end }  : null,
    sh.dinner_start && sh.dinner_end ? { s: sh.dinner_start, e: sh.dinner_end } : null,
  ].filter(Boolean) as { s: string; e: string }[]

  for (const period of periods) {
    let cur = timeToMinutes(period.s)
    const end = timeToMinutes(period.e)
    while (cur < end) {
      slots.push(minutesToTime(cur))
      cur += interval
    }
  }
  return slots
}

/** Calcula si hay conflicto de buffer con una reserva existente */
export function hasBufferConflict(
  newTime: string,
  existingTime: string,
  cfg: ReservationConfig
): boolean {
  const newMins = timeToMinutes(newTime)
  const exMins  = timeToMinutes(existingTime)
  const dur     = cfg.default_reservation_duration_minutes
  const buf     = cfg.buffer_minutes
  // La nueva reserva entra dentro del período ocupado + buffer de la existente
  const exEnd   = exMins + dur + buf
  return newMins < exEnd && newMins >= exMins
}

// ── Motor principal de verificación de franja ───────────────────────────────

export interface SlotCheckInput {
  time: string
  date: string
  party_size: number
  zone_name?: string
  cfg: ReservationConfig
  existing_reservations: Array<{ time: string; people: number; zone_id?: string; table_id?: string }>
  tables: Array<{ id: string; capacity: number; zone_id?: string; status?: string }>
  zones: Array<{ id: string; name: string }>
}

export function checkSlotAvailability(input: SlotCheckInput, _depth = 0): SlotCheckResult {
  const { time, party_size, zone_name, cfg, existing_reservations, tables, zones } = input
  const trace: string[] = []

  // PASO 1 — ¿Es una franja válida?
  if (!isValidSlot(time, cfg)) {
    const validSlots = generateSlots(cfg)
    trace.push(`[1] Franja ${time} inválida. Intervalo: ${cfg.reservation_slot_interval_minutes}min`)
    const alts = _depth === 0 ? findAlternatives({ ...input }, 3) : []
    return {
      available: false, reason: 'invalid_slot',
      alternatives: alts, slot_reservations: 0, slot_people: 0,
      slots_remaining: 0, people_remaining: 0,
      message: `Las reservas se hacen cada ${cfg.reservation_slot_interval_minutes} minutos. Franjas disponibles: ${validSlots.slice(0,6).join(', ')}`,
      trace,
    }
  }
  trace.push(`[1] Franja ${time} válida (intervalo ${cfg.reservation_slot_interval_minutes}min) ✓`)

  // PASO 2 — Contar reservas y personas en esta franja
  const slotRes = existing_reservations.filter(r => r.time?.slice(0,5) === time.slice(0,5))
  const slotPeople = slotRes.reduce((s, r) => s + (r.people || 1), 0)
  const slotsUsed = slotRes.length
  const slotsRemaining = cfg.max_new_reservations_per_slot - slotsUsed
  const peopleRemaining = cfg.max_new_people_per_slot - slotPeople
  trace.push(`[2] Franja ${time}: ${slotsUsed}/${cfg.max_new_reservations_per_slot} reservas, ${slotPeople}/${cfg.max_new_people_per_slot} personas`)

  if (slotsRemaining <= 0) {
    trace.push(`[2] Franja llena por número de reservas`)
    return {
      available: false, reason: 'slot_full_reservations',
      alternatives: _depth === 0 ? findAlternatives(input, 3) : [],
      slot_reservations: slotsUsed, slot_people: slotPeople,
      slots_remaining: 0, people_remaining: peopleRemaining,
      message: `Las ${cfg.max_new_reservations_per_slot} reservas de las ${time} ya están ocupadas`,
      trace,
    }
  }
  trace.push(`[2] Capacidad de reservas OK (quedan ${slotsRemaining}) ✓`)

  // PASO 3 — Capacidad de personas por franja
  if (slotPeople + party_size > cfg.max_new_people_per_slot) {
    trace.push(`[3] Franja llena por personas: ${slotPeople}+${party_size} > ${cfg.max_new_people_per_slot}`)
    return {
      available: false, reason: 'slot_full_people',
      alternatives: _depth === 0 ? findAlternatives(input, 3) : [],
      slot_reservations: slotsUsed, slot_people: slotPeople,
      slots_remaining: slotsRemaining, people_remaining: peopleRemaining,
      message: `A las ${time} ya hay ${slotPeople} personas reservadas, el máximo es ${cfg.max_new_people_per_slot}`,
      trace,
    }
  }
  trace.push(`[3] Capacidad de personas OK (quedan ${peopleRemaining}) ✓`)

  // PASO 4 — Capacidad por zona si aplica
  let resolvedZoneId: string | undefined
  let zoneRemaining: number | undefined
  if (zone_name && Object.keys(cfg.zone_slot_limits).length > 0) {
    const zoneLower = zone_name.toLowerCase()
    const matchedZoneName = Object.keys(cfg.zone_slot_limits).find(k => zoneLower.includes(k.toLowerCase()) || k.toLowerCase().includes(zoneLower))
    if (matchedZoneName) {
      const zoneMax = cfg.zone_slot_limits[matchedZoneName]
      const zoneObj = zones.find(z => z.name.toLowerCase().includes(matchedZoneName.toLowerCase()))
      const zoneResCount = zoneObj ? slotRes.filter(r => {
        const resTable = tables.find(t => t.id === r.table_id)
        return resTable?.zone_id === zoneObj.id
      }).length : 0
      zoneRemaining = zoneMax - zoneResCount
      resolvedZoneId = zoneObj?.id
      trace.push(`[4] Zona "${matchedZoneName}": ${zoneResCount}/${zoneMax} reservas`)
      if (zoneRemaining <= 0) {
        trace.push(`[4] Zona llena`)
        return {
          available: false, reason: 'zone_full',
          alternatives: _depth === 0 ? findAlternatives(input, 3) : [],
          slot_reservations: slotsUsed, slot_people: slotPeople,
          slots_remaining: slotsRemaining, people_remaining: peopleRemaining,
          zone_remaining: 0,
          message: `La ${zone_name} está completa a las ${time}. ¿Prefiere interior u otra zona?`,
          trace,
        }
      }
      trace.push(`[4] Zona OK (quedan ${zoneRemaining}) ✓`)
    }
  } else {
    trace.push(`[4] Sin límite por zona ✓`)
  }

  // PASO 5 — Mesa disponible con capacidad suficiente
  // Si no hay mesas configuradas (servicios, o negocio sin plano) → saltar este paso
  if (tables.length === 0) {
    trace.push(`[5] Sin mesas configuradas — sin restricción de espacio ✓`)
  } else {
    const reservedTableIds = new Set(slotRes.map(r => r.table_id).filter(Boolean))
    const allFree = tables.filter(t => !reservedTableIds.has(t.id) && t.status !== 'bloqueada')
    let zoneFree = resolvedZoneId ? allFree.filter(t => t.zone_id === resolvedZoneId) : allFree

    // Buscar mesa individual con capacidad suficiente
    let freeTables = zoneFree.filter(t => t.capacity == null || t.capacity === 0 || t.capacity >= party_size)

    if (!freeTables.length) {
      // No hay mesa individual → buscar combinación de mesas combinables
      const combinables = zoneFree.filter(t => (t as any).combinable)
      if (combinables.length >= 2) {
        const totalCapacity = combinables.reduce((s, t) => s + (t.capacity || 2), 0)
        if (totalCapacity >= party_size) {
          trace.push(`[5] Sin mesa individual para ${party_size}p, pero ${combinables.length} mesas combinables (capacidad total: ${totalCapacity}) ✓`)
        } else {
          trace.push(`[5] Mesas combinables insuficientes: ${totalCapacity} < ${party_size}`)
          return {
            available: false, reason: 'no_table_available' as any,
            alternatives: _depth === 0 ? findAlternatives(input, 3) : [],
            slot_reservations: slotsUsed, slot_people: slotPeople,
            slots_remaining: slotsRemaining, people_remaining: peopleRemaining,
            zone_remaining: zoneRemaining,
            message: `No hay mesa con capacidad para ${party_size} personas a las ${time}`,
            trace,
          }
        }
      } else {
        // Sin mesa individual ni combinables
        // Comprobar si la capacidad total del local cubre → permitir sin mesa asignada
        const totalFreeCapacity = zoneFree.reduce((s, t) => s + (t.capacity || 2), 0)
        if (totalFreeCapacity >= party_size) {
          trace.push(`[5] Sin mesa individual para ${party_size}p, pero capacidad total libre suficiente (${totalFreeCapacity}) — se asignará manualmente ✓`)
        } else {
          trace.push(`[5] Sin mesa para ${party_size} personas (capacidad libre: ${totalFreeCapacity})`)
          return {
            available: false, reason: 'no_table_available' as any,
            alternatives: _depth === 0 ? findAlternatives(input, 3) : [],
            slot_reservations: slotsUsed, slot_people: slotPeople,
            slots_remaining: slotsRemaining, people_remaining: peopleRemaining,
            zone_remaining: zoneRemaining,
            message: `No hay mesa con capacidad para ${party_size} personas a las ${time}. La capacidad libre es de ${totalFreeCapacity} personas.`,
            trace,
          }
        }
      }
    } else {
      trace.push(`[5] ${freeTables.length} mesa(s) disponible(s) con capacidad para ${party_size}p ✓`)
    }
  }

  // PASO 6 — Conflicto de buffer (reservas previas cercanas)
  const allRes = existing_reservations
  const hasConflict = allRes.some(r => hasBufferConflict(time, r.time?.slice(0,5) || '00:00', cfg))
  if (hasConflict) {
    trace.push(`[6] Conflicto de buffer detectado`)
    return {
      available: false, reason: 'buffer_conflict',
      alternatives: _depth === 0 ? findAlternatives(input, 3) : [],
      slot_reservations: slotsUsed, slot_people: slotPeople,
      slots_remaining: slotsRemaining, people_remaining: peopleRemaining,
      zone_remaining: zoneRemaining,
      message: `La franja de las ${time} tiene conflicto por tiempo de ocupación y buffer`,
      trace,
    }
  }
  trace.push(`[6] Sin conflicto de buffer ✓`)

  return {
    available: true, reason: null,
    alternatives: [],
    slot_reservations: slotsUsed, slot_people: slotPeople,
    slots_remaining: slotsRemaining, people_remaining: peopleRemaining,
    zone_remaining: zoneRemaining,
    message: `Disponible el ${input.date} a las ${time} para ${party_size} personas. Quedan ${slotsRemaining} huecos en esta franja.`,
    trace,
  }
}

// ── Búsqueda de alternativas válidas ────────────────────────────────────────

export function findAlternatives(input: SlotCheckInput, maxCount = 3): string[] {
  const { time, cfg } = input
  const allSlots = generateSlots(cfg)
  const requestedMins = timeToMinutes(time)

  const sorted = allSlots
    .filter(s => s !== time.slice(0,5))
    .sort((a, b) => Math.abs(timeToMinutes(a) - requestedMins) - Math.abs(timeToMinutes(b) - requestedMins))

  const valid: string[] = []
  for (const slot of sorted) {
    if (valid.length >= maxCount) break
    // _depth=1 evita recursión infinita — alternativas no buscan más alternativas
    const result = checkSlotAvailability({ ...input, time: slot }, 1)
    if (result.available) valid.push(slot)
  }
  return valid
}

// ── Calcular estadísticas de todas las franjas del día ─────────────────────

export function calculateDayStats(
  cfg: ReservationConfig,
  reservations: Array<{ time: string; people: number; zone_id?: string; table_id?: string }>,
  zones: Array<{ id: string; name: string }>,
  tables: Array<{ id: string; zone_id?: string }>
): SlotStats[] {
  const slots = generateSlots(cfg)
  return slots.map(time => {
    const slotRes = reservations.filter(r => r.time?.slice(0,5) === time)
    const people  = slotRes.reduce((s, r) => s + (r.people || 1), 0)

    const zoneStats: Record<string, { used: number; max: number }> = {}
    for (const [zoneName, max] of Object.entries(cfg.zone_slot_limits)) {
      const zone = zones.find(z => z.name.toLowerCase().includes(zoneName.toLowerCase()))
      const used = zone ? slotRes.filter(r => {
        const t = tables.find(t => t.id === r.table_id)
        return t?.zone_id === zone.id
      }).length : 0
      zoneStats[zoneName] = { used, max }
    }

    return {
      time,
      reservations: slotRes.length,
      people,
      max_reservations: cfg.max_new_reservations_per_slot,
      max_people: cfg.max_new_people_per_slot,
      zones: zoneStats,
    }
  })
}

// ── Parser de config desde JSONB de la DB ──────────────────────────────────

export function parseReservationConfig(raw: any): ReservationConfig {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_CONFIG }
  return {
    reservation_slot_interval_minutes:   raw.reservation_slot_interval_minutes   ?? DEFAULT_CONFIG.reservation_slot_interval_minutes,
    default_reservation_duration_minutes: raw.default_reservation_duration_minutes ?? DEFAULT_CONFIG.default_reservation_duration_minutes,
    buffer_minutes:                       raw.buffer_minutes                       ?? DEFAULT_CONFIG.buffer_minutes,
    max_new_reservations_per_slot:        raw.max_new_reservations_per_slot        ?? DEFAULT_CONFIG.max_new_reservations_per_slot,
    max_new_people_per_slot:              raw.max_new_people_per_slot              ?? DEFAULT_CONFIG.max_new_people_per_slot,
    zone_slot_limits:                     raw.zone_slot_limits                     ?? DEFAULT_CONFIG.zone_slot_limits,
    service_hours:                        raw.service_hours                        ?? DEFAULT_CONFIG.service_hours,
  }
}
