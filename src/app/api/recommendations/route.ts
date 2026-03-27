import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { getBusinessRecommendations } from '@/lib/intelligence-engine'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const recommendations = await getBusinessRecommendations(auth.tenantId)
  return NextResponse.json({ recommendations })
}
