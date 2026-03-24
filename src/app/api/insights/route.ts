import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { generateInsights } from '@/lib/insights-engine'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.ok || !auth.tenantId) return NextResponse.json({ insights: [] })

  const insights = await generateInsights(auth.tenantId)
  return NextResponse.json({ insights })
}
