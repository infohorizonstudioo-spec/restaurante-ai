/**
 * RESERVO.AI — Callback Cron Endpoint
 *
 * Ejecuta el ciclo de callbacks:
 * 1. Genera callbacks automáticos (recordatorios, lista de espera)
 * 2. Procesa callbacks pendientes (llama al cliente via Retell)
 *
 * Llamar cada 5-10 minutos vía Vercel Cron o external cron.
 * Protegido por CRON_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server'
import { runCallbackCycle } from '@/lib/callback-engine'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Verificar cron secret
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const result = await runCallbackCycle()

    logger.info('Callback cron completed', result)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    logger.error('Callback cron failed', {}, err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

// También soportar POST para Vercel Cron
export async function POST(req: NextRequest) {
  return GET(req)
}
