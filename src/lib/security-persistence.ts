/**
 * Persists Security Guardian state to Supabase.
 * Called by the security patrol cron every 5 minutes.
 * Ensures Guardian state survives cold starts on Vercel.
 *
 * Uses the existing `notifications` table with a system tenant ID
 * and a special type to store/load a JSON blob of security state.
 */

import { createClient } from '@supabase/supabase-js'
import { logger } from './logger'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const SYSTEM_TENANT = '00000000-0000-0000-0000-000000000000'
const STATE_TYPE = 'security_state'
const STATE_ENTITY_ID = 'guardian_state_v1'

export interface PersistedBlockedIP {
  ip: string
  until: number
  strikes: number
}

export interface PersistedPattern {
  pattern: string
  type: string
  confidence: number
  matchCount: number
}

export interface PersistedState {
  blockedIPs: PersistedBlockedIP[]
  learnedPatterns: PersistedPattern[]
  lastUpdated: string
}

/**
 * Save current guardian state to Supabase.
 * Uses select-then-insert/update since there's no unique constraint
 * on (tenant_id, type) in the notifications table.
 */
export async function persistState(state: PersistedState): Promise<void> {
  try {
    const body = JSON.stringify(state)

    // Check if a state row already exists
    const { data: existing } = await admin.from('notifications')
      .select('id')
      .eq('tenant_id', SYSTEM_TENANT)
      .eq('type', STATE_TYPE)
      .eq('related_entity_id', STATE_ENTITY_ID)
      .maybeSingle()

    if (existing) {
      // Update existing row
      const { error } = await admin.from('notifications')
        .update({
          body,
          title: `Guardian State — ${state.blockedIPs.length} blocks, ${state.learnedPatterns.length} patterns`,
          read: true,
        })
        .eq('id', existing.id)

      if (error) {
        logger.error('Failed to update persisted security state', {}, error)
      }
    } else {
      // Insert new row
      const { error } = await admin.from('notifications')
        .insert({
          tenant_id: SYSTEM_TENANT,
          type: STATE_TYPE,
          related_entity_id: STATE_ENTITY_ID,
          title: `Guardian State — ${state.blockedIPs.length} blocks, ${state.learnedPatterns.length} patterns`,
          body,
          priority: 'info',
          action_required: false,
          read: true, // hidden from UI
          target_url: null,
        })

      if (error) {
        logger.error('Failed to insert persisted security state', {}, error)
      }
    }
  } catch (e) {
    logger.error('Security persistence error', {}, e)
  }
}

/**
 * Load guardian state from Supabase (called on cold start / patrol start).
 * Returns null if no state exists or state is too old (> 1 hour).
 */
export async function loadState(): Promise<PersistedState | null> {
  try {
    const { data, error } = await admin.from('notifications')
      .select('body')
      .eq('tenant_id', SYSTEM_TENANT)
      .eq('type', STATE_TYPE)
      .eq('related_entity_id', STATE_ENTITY_ID)
      .maybeSingle()

    if (error || !data?.body) return null

    const state = JSON.parse(data.body) as PersistedState

    // Only restore if state is recent (< 24 hours old)
    // Plan B: ventana amplia para cubrir downtime, weekends, etc.
    const lastUpdated = new Date(state.lastUpdated).getTime()
    if (Date.now() - lastUpdated > 24 * 3600_000) {
      logger.info('Security state too old (>24h), starting fresh')
      return null
    }

    return state
  } catch {
    return null
  }
}
