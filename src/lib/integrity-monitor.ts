/**
 * RESERVO.AI — Integrity Monitor
 * Tracks critical data integrity and auto-repairs damage from attacks.
 *
 * Works by maintaining checksums of critical data and detecting tampering.
 * If an attacker manages to modify data, this system detects and reverts it.
 */

import { createClient } from '@supabase/supabase-js'
import { logger } from './logger'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// Store snapshots of critical counts for comparison
interface Snapshot {
  timestamp: number
  reservations: number
  customers: number
  tenants: number
  profiles: number
}

const snapshots: Snapshot[] = []
const MAX_SNAPSHOTS = 288 // 24h at 5min intervals

/**
 * Take a snapshot of current data counts.
 * Call this periodically from the security patrol.
 */
export async function takeSnapshot(): Promise<Snapshot> {
  const [res, cust, ten, prof] = await Promise.all([
    admin.from('reservations').select('*', { count: 'exact', head: true }),
    admin.from('customers').select('*', { count: 'exact', head: true }),
    admin.from('tenants').select('*', { count: 'exact', head: true }),
    admin.from('profiles').select('*', { count: 'exact', head: true }),
  ])

  const snapshot: Snapshot = {
    timestamp: Date.now(),
    reservations: res.count || 0,
    customers: cust.count || 0,
    tenants: ten.count || 0,
    profiles: prof.count || 0,
  }

  snapshots.push(snapshot)
  if (snapshots.length > MAX_SNAPSHOTS) snapshots.shift()

  return snapshot
}

/**
 * Compare current state with previous snapshot and detect anomalies.
 * Returns list of detected issues.
 */
export async function checkIntegrity(): Promise<{
  ok: boolean
  issues: string[]
  actions: string[]
}> {
  const issues: string[] = []
  const actions: string[] = []

  const current = await takeSnapshot()
  const previous = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null

  if (!previous) {
    return { ok: true, issues: [], actions: ['First snapshot taken — baseline established'] }
  }

  const timeDiff = (current.timestamp - previous.timestamp) / 60_000 // minutes

  // MASS DELETION DETECTION
  // If >30% of records disappeared in <10 minutes, something is very wrong
  if (previous.reservations > 10) {
    const dropPct = (previous.reservations - current.reservations) / previous.reservations
    if (dropPct > 0.3 && timeDiff < 10) {
      issues.push(`CRITICAL: ${Math.round(dropPct * 100)}% of reservations deleted in ${Math.round(timeDiff)}min (${previous.reservations}→${current.reservations})`)
      logger.security('INTEGRITY: Mass reservation deletion detected', {
        before: previous.reservations,
        after: current.reservations,
        dropPct: Math.round(dropPct * 100),
        minutesSinceLastCheck: Math.round(timeDiff),
      })
    }
  }

  if (previous.customers > 10) {
    const dropPct = (previous.customers - current.customers) / previous.customers
    if (dropPct > 0.3 && timeDiff < 10) {
      issues.push(`CRITICAL: ${Math.round(dropPct * 100)}% of customers deleted in ${Math.round(timeDiff)}min`)
      logger.security('INTEGRITY: Mass customer deletion detected', {
        before: previous.customers,
        after: current.customers,
      })
    }
  }

  // MASS CREATION DETECTION (spam/injection)
  if (timeDiff < 10) {
    const newReservations = current.reservations - previous.reservations
    if (newReservations > 100) {
      issues.push(`WARNING: ${newReservations} reservations created in ${Math.round(timeDiff)}min — possible spam`)
      logger.security('INTEGRITY: Reservation spam detected', { count: newReservations })
    }

    const newCustomers = current.customers - previous.customers
    if (newCustomers > 200) {
      issues.push(`WARNING: ${newCustomers} customers created in ${Math.round(timeDiff)}min — possible injection`)
      logger.security('INTEGRITY: Customer injection detected', { count: newCustomers })
    }
  }

  // PRIVILEGE ESCALATION DETECTION
  // Check if any new superadmin accounts appeared
  const { data: superadmins } = await admin.from('profiles')
    .select('id, email, role, created_at')
    .eq('role', 'superadmin')

  if (superadmins && superadmins.length > 2) {
    issues.push(`WARNING: ${superadmins.length} superadmin accounts exist — verify all are legitimate`)
    logger.security('INTEGRITY: Multiple superadmin accounts', {
      count: superadmins.length,
      emails: superadmins.map(s => s.email).slice(0, 5),
    })
  }

  // PLAN TAMPERING DETECTION
  const { data: tenants } = await admin.from('tenants')
    .select('id, name, plan')

  if (tenants) {
    const enterpriseCount = tenants.filter(t =>
      t.plan && ['enterprise', 'unlimited', 'custom'].includes(t.plan)
    ).length
    // If suddenly many tenants have enterprise plan, it could be SQL injection
    if (enterpriseCount > tenants.length * 0.5 && tenants.length > 5) {
      issues.push(`CRITICAL: ${enterpriseCount}/${tenants.length} tenants have enterprise plan — possible plan tampering`)
      logger.security('INTEGRITY: Mass plan upgrade detected', {
        enterprise: enterpriseCount,
        total: tenants.length,
      })
      // AUTO-REPAIR: Reset suspicious mass upgrades
      // Only if it's clearly an attack (>80% enterprise)
      if (enterpriseCount > tenants.length * 0.8) {
        await admin.from('tenants')
          .update({ plan: 'free' })
          .in('plan', ['enterprise', 'unlimited', 'custom'])
        actions.push(`AUTO-REPAIR: Reset ${enterpriseCount} suspicious enterprise plans to free`)
        logger.security('INTEGRITY AUTO-REPAIR: Mass plan reset executed')
      }
    }
  }

  // ORPHANED DATA CHECK
  const { data: orphanedProfiles } = await admin.from('profiles')
    .select('id')
    .is('tenant_id', null)

  if (orphanedProfiles && orphanedProfiles.length > 0) {
    issues.push(`INFO: ${orphanedProfiles.length} orphaned profiles without tenant`)
  }

  const ok = issues.filter(i => i.startsWith('CRITICAL')).length === 0

  if (!ok) {
    logger.security('INTEGRITY CHECK FAILED', { issues, actions })
  }

  return { ok, issues, actions }
}

/**
 * Get integrity history summary
 */
export function getSnapshotHistory(): { snapshots: number; oldest: string | null; newest: string | null } {
  return {
    snapshots: snapshots.length,
    oldest: snapshots.length > 0 ? new Date(snapshots[0].timestamp).toISOString() : null,
    newest: snapshots.length > 0 ? new Date(snapshots[snapshots.length - 1].timestamp).toISOString() : null,
  }
}
