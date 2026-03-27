import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { predictNoShows } from '@/lib/noshow-predictor'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { sanitizeDate } from '@/lib/sanitize'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const rl = rateLimitByIp(req, RATE_LIMITS.api, 'noshow-predictions')
  if (rl.blocked) return rl.response

  const auth = await requireAuth(req)
  if (!auth.ok || !auth.tenantId) return NextResponse.json({ predictions: [] })
  const url = new URL(req.url)
  const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10)
  const predictions = await predictNoShows(auth.tenantId, date)
  return NextResponse.json({ predictions })
}
