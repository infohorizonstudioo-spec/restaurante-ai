export const DEFAULT_RULES = {
  max_capacity: 60,
  slot_duration: 120,
  advance_booking_hours: 24,
  large_group_min: 8,
}

export async function makeDecision(params: {
  tenantId: string
  type: string
  input: Record<string, any>
  rules?: Record<string, any>
}): Promise<{ action: string; confidence: number; reason: string }> {
  return { action: 'proceed', confidence: 0.9, reason: 'Default decision' }
}
