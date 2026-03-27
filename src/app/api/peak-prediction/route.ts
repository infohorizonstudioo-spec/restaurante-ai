import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { predictDayDemand } from '@/lib/peak-predictor'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { sanitizeDate } from '@/lib/sanitize'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const rl = rateLimitByIp(req, RATE_LIMITS.api, 'peak-prediction')
  if (rl.blocked) return rl.response

  const auth = await requireAuth(req)
  if (!auth.ok || !auth.tenantId) return NextResponse.json({ forecast: [], peakHour: '', peakDemand: 0, summary: '' })
  const url = new URL(req.url)
  const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10)
  const result = await predictDayDemand(auth.tenantId, date)
  return NextResponse.json(result)
}
