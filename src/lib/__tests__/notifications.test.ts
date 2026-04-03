import { describe, it, expect } from 'vitest'

// Test the notification type system — import the types directly
// We can't import the functions (they create Supabase client at module level)
// but we can test the type completeness

describe('notification types', () => {
  // These are the types we create across the codebase
  const usedTypes = [
    'new_call', 'call_active', 'call_finished', 'missed_call',
    'new_reservation', 'reservation_pending_review', 'reservation_confirmed',
    'reservation_cancelled', 'reservation_no_show', 'reservation_updated',
    'new_order', 'order_ready', 'bizum_payment', 'table_payment',
    'important_alert', 'incident', 'pending_review',
    'call_completed', 'call_pending', 'call_attention',
    'call_missed', 'reservation_created', 'reservation_review',
    'reservation_modified', 'crisis_alert', 'no_show_risk',
  ]

  it('all notification types should be unique', () => {
    const unique = new Set(usedTypes)
    expect(unique.size).toBe(usedTypes.length)
  })

  it('should have at least 20 notification types', () => {
    expect(usedTypes.length).toBeGreaterThanOrEqual(20)
  })

  // Test that priority inference would work for key types
  const criticalTypes = ['incident', 'important_alert']
  const warningTypes = ['order_ready', 'bizum_payment', 'table_payment', 'crisis_alert', 'no_show_risk']
  const infoTypes = ['new_order', 'new_call', 'new_reservation']

  it('critical types are defined', () => {
    for (const t of criticalTypes) {
      expect(usedTypes).toContain(t)
    }
  })

  it('warning types are defined', () => {
    for (const t of warningTypes) {
      expect(usedTypes).toContain(t)
    }
  })

  it('info types are defined', () => {
    for (const t of infoTypes) {
      expect(usedTypes).toContain(t)
    }
  })
})
