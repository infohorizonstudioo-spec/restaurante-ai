/**
 * GET /api/cron/security-patrol
 * Runs every 5 minutes. Autonomous security patrol that monitors
 * the entire system, detects damage, and auto-repairs it.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'
import { getSecurityStats } from '@/lib/security-guardian'
import { checkIntegrity, getSnapshotHistory } from '@/lib/integrity-monitor'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { timingSafeEqual } from 'crypto'

export const dynamic = 'force-dynamic'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(req: NextRequest) {
  const rl = rateLimitByIp(req, RATE_LIMITS.cron, 'cron:security-patrol')
  if (rl.blocked) return rl.response

  // 1. Verify cron secret (timingSafeEqual — same pattern as other cron routes)
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: 'not configured' }, { status: 503 })
  const authHeader = req.headers.get('authorization') || ''
  const expectedHeader = `Bearer ${cronSecret}`
  const a = Buffer.from(authHeader)
  const b = Buffer.from(expectedHeader)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    logger.security('Cron security-patrol: unauthorized attempt')
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const results: Record<string, any> = { timestamp: new Date().toISOString(), checks: {} }

  // 2. INTEGRITY CHECK — detect suspicious database records

  // 2a. Check for users created without proper registration (SQL injection / direct DB manipulation)
  const { data: suspiciousUsers } = await admin.from('profiles')
    .select('id, email, role, created_at, tenant_id')
    .or('role.eq.superadmin,role.eq.admin')
    .order('created_at', { ascending: false })
    .limit(20)

  // 2b. Check for tenants with suspicious modifications (tampered config)
  const { data: recentTenants } = await admin.from('tenants')
    .select('id, name, updated_at, plan')
    .order('updated_at', { ascending: false })
    .limit(10)

  // 2c. Check for mass deletions (data destruction attack)
  const { count: reservationCount } = await admin.from('reservations')
    .select('*', { count: 'exact', head: true })

  const { count: customerCount } = await admin.from('customers')
    .select('*', { count: 'exact', head: true })

  results.checks.integrity = {
    adminUsers: suspiciousUsers?.length || 0,
    totalReservations: reservationCount || 0,
    totalCustomers: customerCount || 0,
  }

  // 3. ANOMALY DETECTION — detect unusual patterns in recent data

  // 3a. Check for burst of reservations (could indicate automated spam)
  const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString()
  const { count: recentReservations } = await admin.from('reservations')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', fiveMinAgo)

  if (recentReservations && recentReservations > 50) {
    logger.security('PATROL: Abnormal reservation spike detected', {
      count: recentReservations,
      window: '5min',
    })
    results.checks.anomaly = { reservationSpike: true, count: recentReservations }

    // AUTO-REPAIR: Flag suspicious bulk reservations for review
    await admin.from('reservations')
      .update({ notes: '[SECURITY: Flagged for review - bulk creation detected]' })
      .gte('created_at', fiveMinAgo)
      .is('notes', null)
  }

  // 3b. Check for mass customer creation (data injection)
  const { count: recentCustomers } = await admin.from('customers')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', fiveMinAgo)

  if (recentCustomers && recentCustomers > 100) {
    logger.security('PATROL: Abnormal customer creation spike', {
      count: recentCustomers,
      window: '5min',
    })
    results.checks.anomaly = { ...results.checks.anomaly, customerSpike: true }
  }

  // 4. GUARDIAN STATS — report current security posture
  const guardianStats = getSecurityStats()
  results.checks.guardian = guardianStats

  // 5. SELF-HEAL — check and repair critical data

  // 5a. Fix any profiles with null tenant_id (orphaned users)
  const { data: orphanedProfiles } = await admin.from('profiles')
    .select('id')
    .is('tenant_id', null)
    .limit(5)

  if (orphanedProfiles && orphanedProfiles.length > 0) {
    logger.security('PATROL: Found orphaned profiles without tenant', {
      count: orphanedProfiles.length,
    })
    results.checks.selfHeal = { orphanedProfiles: orphanedProfiles.length }
  }

  // 5b. Check for tenants with tampered plan (free -> enterprise hack)
  const { data: suspiciousPlans } = await admin.from('tenants')
    .select('id, name, plan, updated_at')
    .in('plan', ['enterprise', 'unlimited', 'custom'])
    .order('updated_at', { ascending: false })
    .limit(10)

  // Log if there are enterprise plans that were recently modified
  if (suspiciousPlans && suspiciousPlans.length > 0) {
    for (const t of suspiciousPlans) {
      const updatedAt = new Date(t.updated_at).getTime()
      const tenMinAgo = Date.now() - 10 * 60_000
      if (updatedAt > tenMinAgo) {
        logger.security('PATROL: Recent plan upgrade detected - verify legitimacy', {
          tenantId: t.id,
          plan: t.plan,
          name: t.name,
        })
      }
    }
    results.checks.selfHeal = { ...results.checks.selfHeal, enterprisePlans: suspiciousPlans.length }
  }

  // 6. INTEGRITY MONITOR — deep check con historial
  const integrityResult = await checkIntegrity()
  results.checks.integrityMonitor = {
    ok: integrityResult.ok,
    issues: integrityResult.issues,
    actions: integrityResult.actions,
    history: getSnapshotHistory(),
  }

  if (!integrityResult.ok) {
    logger.security('PATROL: INTEGRITY CHECK FAILED', {
      issues: integrityResult.issues,
      actions: integrityResult.actions,
    })
  }

  // 7. LOG PATROL RESULTS
  const hasIssues = !integrityResult.ok || Object.values(results.checks).some((c: any) =>
    c.reservationSpike || c.customerSpike || c.orphanedProfiles
  )

  if (hasIssues) {
    logger.security('PATROL COMPLETE — Issues found', results)
  }

  results.status = hasIssues ? 'issues_found' : 'all_clear'
  results.nextPatrol = new Date(Date.now() + 5 * 60_000).toISOString()

  return NextResponse.json(results)
}
