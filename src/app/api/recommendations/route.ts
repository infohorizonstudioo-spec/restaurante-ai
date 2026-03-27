import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getBusinessRecommendations } from '@/lib/intelligence-engine'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export async function GET(req: NextRequest) {
  const rl = rateLimitByIp(req, RATE_LIMITS.api, 'recommendations')
  if (rl.blocked) return rl.response

  const auth = await requireAuth(req)
  if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const recommendations = await getBusinessRecommendations(auth.tenantId)
  return NextResponse.json({ recommendations })
}
