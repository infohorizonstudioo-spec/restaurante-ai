import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { timingSafeEqual } from 'crypto'
import { decayOldMemories, recordCustomerEvent, createCustomerAlert, updateCustomerScoring } from '@/lib/customer-memory'

/**
 * CRON: Mantenimiento diario de memoria.
 * 1. Decay de memorias antiguas (confidence baja, expiradas)
 * 2. Auto-detección de no-shows (reservas pasadas no completadas)
 *
 * Ejecuta a las 2:30 AM — después del cierre, antes del resumen diario (9 AM).
 *
 * vercel.json:
 * { "path": "/api/cron/memory-maintenance", "schedule": "30 2 * * *" }
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const rl = rateLimitByIp(req, RATE_LIMITS.cron, 'cron:memory-maintenance')
  if (rl.blocked) return rl.response

  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: 'not configured' }, { status: 503 })
  const expectedHeader = `Bearer ${cronSecret}`
  const a = Buffer.from(authHeader || '')
  const b = Buffer.from(expectedHeader)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    logger.security('Cron memory-maintenance: unauthorized attempt')
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: tenants } = await supabase.from('tenants').select('id')
  if (!tenants || tenants.length === 0) {
    return NextResponse.json({ ok: true, message: 'no tenants' })
  }

  let totalDecayed = 0
  let totalNoShows = 0

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  for (const tenant of tenants) {
    const tenantId = tenant.id

    // 1. Decay old memories
    try {
      const decayed = await decayOldMemories(tenantId)
      totalDecayed += decayed
    } catch (e: any) {
      logger.error(`memory-maintenance: decay error for ${tenantId}`, e)
    }

    // 2. Auto no-show detection
    // Find reservations from yesterday (or earlier) that are still confirmada/pendiente
    try {
      const { data: staleReservations } = await supabase
        .from('reservations')
        .select('id,customer_id,customer_name,date,time,people,party_size')
        .eq('tenant_id', tenantId)
        .lte('date', yesterday)
        .in('status', ['confirmada', 'confirmed', 'pendiente', 'pending'])
        .limit(100)

      for (const r of (staleReservations || [])) {
        // Mark as no-show
        await supabase.from('reservations')
          .update({ status: 'no_show' })
          .eq('id', r.id)
          .eq('tenant_id', tenantId)

        totalNoShows++

        if (!r.customer_id) continue

        const dateStr = r.date || ''
        const timeStr = (r.time || '').slice(0, 5)
        const partySize = r.people || r.party_size || 1

        // Record no-show event
        await recordCustomerEvent(tenantId, r.customer_id, {
          event_type: 'no_show',
          channel: 'system',
          summary: `No se presentó a la reserva del ${dateStr} a las ${timeStr} (${partySize}p)`,
          sentiment: 'negative',
          reservation_id: r.id,
        })

        // Check count for alert
        const { data: cust } = await supabase
          .from('customers')
          .select('no_show_count,name')
          .eq('id', r.customer_id)
          .maybeSingle()

        const noShows = cust?.no_show_count || 0
        if (noShows >= 2) {
          await createCustomerAlert(tenantId, r.customer_id, {
            alert_type: 'no_show_risk',
            severity: noShows >= 4 ? 'critical' : 'warning',
            title: `${cust?.name || r.customer_name || 'Cliente'} tiene ${noShows} no-shows`,
            body: `No se ha presentado ${noShows} veces. Considerar confirmación adicional.`,
          })
        }

        await updateCustomerScoring(tenantId, r.customer_id)
      }
    } catch (e: any) {
      logger.error(`memory-maintenance: no-show detection error for ${tenantId}`, e)
    }
  }

  logger.info(`memory-maintenance: decayed=${totalDecayed}, noShows=${totalNoShows}`)

  return NextResponse.json({
    ok: true,
    decayed: totalDecayed,
    no_shows_detected: totalNoShows,
    tenants_processed: tenants.length,
  })
}
