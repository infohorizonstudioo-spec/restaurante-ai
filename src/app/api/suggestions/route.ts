import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { generateSuggestions } from '@/lib/smart-suggestions'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const rl = rateLimitByIp(req, RATE_LIMITS.api, 'suggestions')
  if (rl.blocked) return rl.response

  const auth = await requireAuth(req)
  if (!auth.ok || !auth.tenantId) {
    return NextResponse.json({ suggestions: [] })
  }

  const suggestions = await generateSuggestions(auth.tenantId)
  return NextResponse.json({ suggestions })
}
