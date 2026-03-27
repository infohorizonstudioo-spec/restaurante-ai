/**
 * RESERVO.AI — Audit Log
 * Immutable audit trail for security-critical and business-critical actions.
 * Stores in Supabase `audit_logs` table with structured metadata.
 */

import { logger } from './logger'

export type AuditAction =
  // Auth
  | 'auth.login'
  | 'auth.logout'
  | 'auth.register'
  | 'auth.password_reset'
  | 'auth.failed_login'
  // Data
  | 'reservation.create'
  | 'reservation.update'
  | 'reservation.cancel'
  | 'reservation.delete'
  | 'customer.create'
  | 'customer.update'
  | 'customer.delete'
  | 'order.create'
  | 'order.update'
  | 'order.cancel'
  // Admin
  | 'admin.user_create'
  | 'admin.user_delete'
  | 'admin.tenant_update'
  | 'admin.plan_change'
  | 'admin.role_change'
  // Agent
  | 'agent.provision'
  | 'agent.config_update'
  | 'agent.rules_update'
  // Security
  | 'security.ip_blocked'
  | 'security.rate_limited'
  | 'security.csrf_failed'
  | 'security.integrity_alert'
  // Billing
  | 'billing.checkout'
  | 'billing.payment_received'
  | 'billing.plan_upgrade'
  | 'billing.plan_downgrade'

export type AuditSeverity = 'info' | 'warn' | 'critical'

export interface AuditEntry {
  action: AuditAction
  actor_id?: string        // User ID or 'system' or 'agent'
  tenant_id?: string
  target_type?: string     // 'reservation', 'customer', 'user', etc.
  target_id?: string       // ID of the affected entity
  metadata?: Record<string, unknown>
  ip?: string
  user_agent?: string
  severity?: AuditSeverity
}

interface StoredAuditEntry extends AuditEntry {
  id: string
  created_at: string
}

// In-memory buffer for batched writes (reduces DB calls)
const BUFFER: AuditEntry[] = []
const FLUSH_INTERVAL_MS = 5_000
const MAX_BUFFER_SIZE = 50
let _flushTimer: ReturnType<typeof setInterval> | null = null

/**
 * Record an audit event. Buffered for performance, flushed periodically.
 */
export function audit(entry: AuditEntry): void {
  const severity = entry.severity || inferSeverity(entry.action)

  // Always log immediately for critical events
  if (severity === 'critical') {
    logger.security(`AUDIT [${entry.action}]`, {
      actor: entry.actor_id,
      tenant: entry.tenant_id,
      target: entry.target_id,
      ...entry.metadata,
    })
  }

  BUFFER.push({ ...entry, severity })

  // Flush if buffer is full
  if (BUFFER.length >= MAX_BUFFER_SIZE) {
    flushAuditBuffer()
  }

  // Ensure periodic flush is running
  if (!_flushTimer && typeof setInterval !== 'undefined') {
    _flushTimer = setInterval(flushAuditBuffer, FLUSH_INTERVAL_MS)
  }
}

/**
 * Flush buffered audit entries to Supabase.
 */
export async function flushAuditBuffer(): Promise<void> {
  if (BUFFER.length === 0) return

  const entries = BUFFER.splice(0, BUFFER.length)

  try {
    // Dynamic import to avoid circular dependencies
    const { createAdminClient } = await import('./supabase')
    const supabase = createAdminClient()

    const rows = entries.map(e => ({
      action: e.action,
      actor_id: e.actor_id || 'system',
      tenant_id: e.tenant_id || null,
      target_type: e.target_type || null,
      target_id: e.target_id || null,
      metadata: e.metadata || {},
      ip: e.ip || null,
      user_agent: e.user_agent || null,
      severity: e.severity || 'info',
    }))

    const { error } = await supabase.from('audit_logs').insert(rows)

    if (error) {
      // Table might not exist yet — log and don't lose entries
      logger.warn('Audit flush failed — entries logged but not persisted', {
        count: entries.length,
        error: error.message,
      })
      // Log each entry to structured logger as fallback
      entries.forEach(e => {
        logger.info(`AUDIT_FALLBACK [${e.action}]`, {
          actor: e.actor_id,
          tenant: e.tenant_id,
          target: e.target_id,
          ip: e.ip,
          ...e.metadata,
        })
      })
    }
  } catch (err) {
    // Complete failure — log to stdout so they appear in Vercel logs
    logger.error('Audit flush error', { count: entries.length }, err)
    entries.forEach(e => {
      logger.info(`AUDIT_FALLBACK [${e.action}]`, {
        actor: e.actor_id,
        tenant: e.tenant_id,
        ...e.metadata,
      })
    })
  }
}

function inferSeverity(action: AuditAction): AuditSeverity {
  if (action.startsWith('security.')) return 'critical'
  if (action.startsWith('admin.')) return 'warn'
  if (action === 'auth.failed_login') return 'warn'
  if (action.includes('delete')) return 'warn'
  return 'info'
}

/**
 * Convenience: audit from API route with request context.
 */
export function auditFromRequest(
  req: Request,
  entry: Omit<AuditEntry, 'ip' | 'user_agent'>
): void {
  audit({
    ...entry,
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        req.headers.get('x-real-ip') || undefined,
    user_agent: req.headers.get('user-agent') || undefined,
  })
}
