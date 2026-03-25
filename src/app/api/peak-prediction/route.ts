import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { predictDayDemand } from '@/lib/peak-predictor'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.ok || !auth.tenantId) return NextResponse.json({ forecast: [], peakHour: '', peakDemand: 0, summary: '' })
  const url = new URL(req.url)
  const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10)
  const result = await predictDayDemand(auth.tenantId, date)
  return NextResponse.json(result)
}
