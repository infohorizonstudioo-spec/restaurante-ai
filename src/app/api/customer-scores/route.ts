import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { computeAllScores } from '@/lib/customer-scoring'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.ok || !auth.tenantId) return NextResponse.json({ scores: {} })
  const scores = await computeAllScores(auth.tenantId)
  return NextResponse.json({ scores })
}
