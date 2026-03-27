import { describe, it, expect } from 'vitest'
import {
  timeToMinutes,
  minutesToTime,
  isValidSlot,
  generateSlots,
  hasBufferConflict,
  checkSlotAvailability,
  findAlternatives,
  getDefaultsForType,
  parseReservationConfig,
  calculateDayStats,
  DEFAULT_CONFIG,
  type ReservationConfig,
  type SlotCheckInput,
} from '../scheduling-engine'

// ── Time utilities ──────────────────────────────────────────

describe('timeToMinutes', () => {
  it('converts basic times', () => {
    expect(timeToMinutes('00:00')).toBe(0)
    expect(timeToMinutes('01:30')).toBe(90)
    expect(timeToMinutes('13:00')).toBe(780)
    expect(timeToMinutes('23:59')).toBe(1439)
  })

  it('handles missing minutes', () => {
    expect(timeToMinutes('09')).toBe(540)
  })
})

describe('minutesToTime', () => {
  it('converts minutes back to HH:MM', () => {
    expect(minutesToTime(0)).toBe('00:00')
    expect(minutesToTime(90)).toBe('01:30')
    expect(minutesToTime(780)).toBe('13:00')
    expect(minutesToTime(1439)).toBe('23:59')
  })

  it('pads single-digit hours and minutes', () => {
    expect(minutesToTime(65)).toBe('01:05')
  })
})

// ── Business type defaults ──────────────────────────────────

describe('getDefaultsForType', () => {
  it('returns restaurant defaults', () => {
    const cfg = getDefaultsForType('restaurante')
    expect(cfg.reservation_slot_interval_minutes).toBe(30)
    expect(cfg.default_reservation_duration_minutes).toBe(90)
    expect(cfg.max_new_reservations_per_slot).toBe(4)
    expect(cfg.service_hours?.lunch_start).toBe('13:00')
    expect(cfg.service_hours?.dinner_start).toBe('20:00')
  })

  it('returns clinic defaults with 15min slots', () => {
    const cfg = getDefaultsForType('clinica_dental')
    expect(cfg.reservation_slot_interval_minutes).toBe(15)
    expect(cfg.max_new_reservations_per_slot).toBe(1)
    expect(cfg.service_hours?.open).toBe('09:00')
  })

  it('returns psicologia defaults with 60min slots', () => {
    const cfg = getDefaultsForType('psicologia')
    expect(cfg.reservation_slot_interval_minutes).toBe(60)
    expect(cfg.default_reservation_duration_minutes).toBe(50)
  })

  it('returns DEFAULT_CONFIG for unknown type', () => {
    const cfg = getDefaultsForType('unknown_type')
    expect(cfg).toEqual(DEFAULT_CONFIG)
  })

  it('hotel has 24h availability', () => {
    const cfg = getDefaultsForType('hotel')
    expect(cfg.service_hours?.open).toBe('00:00')
    expect(cfg.service_hours?.close).toBe('23:59')
  })

  it('taller has closed days (Sunday)', () => {
    const cfg = getDefaultsForType('taller')
    expect(cfg.service_hours?.closed_days).toContain(0)
  })
})

// ── Slot validation ─────────────────────────────────────────

describe('isValidSlot', () => {
  const restaurantCfg = getDefaultsForType('restaurante')
  const clinicCfg = getDefaultsForType('clinica_dental')

  it('accepts valid restaurant lunch slot', () => {
    expect(isValidSlot('13:00', restaurantCfg)).toBe(true)
    expect(isValidSlot('13:30', restaurantCfg)).toBe(true)
  })

  it('rejects odd-minute slots for 30-min intervals', () => {
    expect(isValidSlot('13:15', restaurantCfg)).toBe(false)
    expect(isValidSlot('13:45', restaurantCfg)).toBe(false)
  })

  it('accepts 15-minute clinic slots', () => {
    expect(isValidSlot('09:00', clinicCfg)).toBe(true)
    expect(isValidSlot('09:15', clinicCfg)).toBe(true)
    expect(isValidSlot('09:30', clinicCfg)).toBe(true)
    expect(isValidSlot('09:45', clinicCfg)).toBe(true)
  })

  it('rejects slots outside service hours', () => {
    expect(isValidSlot('08:00', restaurantCfg)).toBe(false) // Before lunch
    expect(isValidSlot('17:00', restaurantCfg)).toBe(false) // Between lunch and dinner
  })

  it('accepts dinner slots', () => {
    expect(isValidSlot('20:00', restaurantCfg)).toBe(true)
    expect(isValidSlot('21:30', restaurantCfg)).toBe(true)
  })
})

// ── Slot generation ─────────────────────────────────────────

describe('generateSlots', () => {
  it('generates restaurant slots for lunch and dinner', () => {
    const cfg = getDefaultsForType('restaurante')
    const slots = generateSlots(cfg)
    expect(slots).toContain('13:00')
    expect(slots).toContain('15:30')
    expect(slots).toContain('20:00')
    expect(slots).toContain('23:00')
    expect(slots).not.toContain('17:00') // Gap between lunch and dinner
  })

  it('generates continuous slots for clinics', () => {
    const cfg = getDefaultsForType('clinica_dental')
    const slots = generateSlots(cfg)
    expect(slots[0]).toBe('09:00')
    expect(slots).toContain('12:00')
    expect(slots).toContain('15:00')
    expect(slots[slots.length - 1]).toBe('19:45')
  })

  it('returns empty array for closed days', () => {
    const cfg = getDefaultsForType('taller')
    // Sunday = closed day 0
    const sunday = '2026-03-29' // Sunday
    const slots = generateSlots(cfg, sunday)
    expect(slots).toHaveLength(0)
  })

  it('returns slots for open days', () => {
    const cfg = getDefaultsForType('taller')
    const monday = '2026-03-30' // Monday
    const slots = generateSlots(cfg, monday)
    expect(slots.length).toBeGreaterThan(0)
  })
})

// ── Buffer conflict ─────────────────────────────────────────

describe('hasBufferConflict', () => {
  const cfg: ReservationConfig = {
    ...DEFAULT_CONFIG,
    default_reservation_duration_minutes: 90,
    buffer_minutes: 15,
  }

  it('detects same-slot conflict', () => {
    expect(hasBufferConflict('13:00', '13:00', cfg)).toBe(true)
  })

  it('detects overlap within duration + buffer', () => {
    // 13:00 reservation occupies until 13:00 + 90 + 15 = 14:45
    expect(hasBufferConflict('14:00', '13:00', cfg)).toBe(true)
  })

  it('allows slot after duration + buffer', () => {
    // 13:00 occupies until 14:45, so 15:00 is clear
    expect(hasBufferConflict('15:00', '13:00', cfg)).toBe(false)
  })

  it('detects reverse overlap', () => {
    // New at 12:00 occupies until 12:00 + 90 + 15 = 13:45 → overlaps with 13:00
    expect(hasBufferConflict('12:00', '13:00', cfg)).toBe(true)
  })

  it('allows far apart slots', () => {
    expect(hasBufferConflict('20:00', '13:00', cfg)).toBe(false)
  })
})

// ── Main slot availability check ────────────────────────────

describe('checkSlotAvailability', () => {
  const cfg = getDefaultsForType('restaurante')

  const baseInput: SlotCheckInput = {
    time: '13:00',
    date: '2026-03-30',
    party_size: 2,
    cfg,
    existing_reservations: [],
    tables: [],
    zones: [],
  }

  it('returns available for empty restaurant', () => {
    const result = checkSlotAvailability(baseInput)
    expect(result.available).toBe(true)
    expect(result.reason).toBeNull()
    expect(result.slot_reservations).toBe(0)
  })

  it('rejects invalid slot time', () => {
    const result = checkSlotAvailability({ ...baseInput, time: '13:15' })
    expect(result.available).toBe(false)
    expect(result.reason).toBe('invalid_slot')
  })

  it('rejects when max reservations reached', () => {
    const reservations = Array.from({ length: 4 }, () => ({
      time: '13:00', people: 2,
    }))
    const result = checkSlotAvailability({ ...baseInput, existing_reservations: reservations })
    expect(result.available).toBe(false)
    expect(result.reason).toBe('slot_full_reservations')
  })

  it('rejects when max people exceeded', () => {
    const reservations = [{ time: '13:00', people: 15 }]
    const result = checkSlotAvailability({
      ...baseInput,
      party_size: 4,
      existing_reservations: reservations,
    })
    expect(result.available).toBe(false)
    expect(result.reason).toBe('slot_full_people')
  })

  it('provides trace for debugging', () => {
    const result = checkSlotAvailability(baseInput)
    expect(result.trace).toBeDefined()
    expect(result.trace.length).toBeGreaterThan(0)
  })

  it('rejects closed day', () => {
    const tallerCfg = getDefaultsForType('taller')
    const result = checkSlotAvailability({
      ...baseInput,
      cfg: tallerCfg,
      date: '2026-03-29', // Sunday
      time: '09:00',
    })
    expect(result.available).toBe(false)
    expect(result.reason).toBe('outside_service_hours')
  })

  it('returns alternatives when slot is full', () => {
    const reservations = Array.from({ length: 4 }, () => ({
      time: '13:00', people: 2,
    }))
    const result = checkSlotAvailability({ ...baseInput, existing_reservations: reservations })
    expect(result.alternatives.length).toBeGreaterThan(0)
  })
})

// ── Alternatives ────────────────────────────────────────────

describe('findAlternatives', () => {
  const cfg = getDefaultsForType('restaurante')

  it('finds nearby available slots', () => {
    const input: SlotCheckInput = {
      time: '13:00',
      date: '2026-03-30',
      party_size: 2,
      cfg,
      existing_reservations: [],
      tables: [],
      zones: [],
    }
    const alts = findAlternatives(input, 3)
    expect(alts.length).toBeLessThanOrEqual(3)
    expect(alts).not.toContain('13:00')
  })
})

// ── Config parser ───────────────────────────────────────────

describe('parseReservationConfig', () => {
  it('returns defaults for null input', () => {
    const cfg = parseReservationConfig(null, 'restaurante')
    expect(cfg.reservation_slot_interval_minutes).toBe(30)
  })

  it('merges custom values with defaults', () => {
    const cfg = parseReservationConfig({ buffer_minutes: 20 }, 'restaurante')
    expect(cfg.buffer_minutes).toBe(20)
    expect(cfg.reservation_slot_interval_minutes).toBe(30) // default kept
  })

  it('multiplies slots for multiple professionals', () => {
    const cfg = parseReservationConfig({ num_professionals: 3 }, 'clinica_dental')
    expect(cfg.max_new_reservations_per_slot).toBe(3)
  })

  it('uses DEFAULT_CONFIG without business type', () => {
    const cfg = parseReservationConfig(null)
    expect(cfg).toEqual(DEFAULT_CONFIG)
  })
})

// ── Day stats ───────────────────────────────────────────────

describe('calculateDayStats', () => {
  it('calculates correct stats for a day', () => {
    const cfg = getDefaultsForType('restaurante')
    const reservations = [
      { time: '13:00', people: 3 },
      { time: '13:00', people: 2 },
      { time: '13:30', people: 4 },
    ]
    const stats = calculateDayStats(cfg, reservations, [], [])

    const slot13 = stats.find(s => s.time === '13:00')
    expect(slot13).toBeDefined()
    expect(slot13!.reservations).toBe(2)
    expect(slot13!.people).toBe(5)

    const slot1330 = stats.find(s => s.time === '13:30')
    expect(slot1330!.reservations).toBe(1)
    expect(slot1330!.people).toBe(4)
  })

  it('returns all valid slots even with no reservations', () => {
    const cfg = getDefaultsForType('clinica_dental')
    const stats = calculateDayStats(cfg, [], [], [])
    expect(stats.length).toBeGreaterThan(0)
    expect(stats.every(s => s.reservations === 0)).toBe(true)
  })
})
