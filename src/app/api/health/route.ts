/**
 * RESERVO.AI — Health Check Endpoint
 * Used by monitoring systems (UptimeRobot, etc.) and load balancers.
 * Returns status of key dependencies.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimitByIp } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: Request) {
  const rl = rateLimitByIp(req, { limit: 60, windowSeconds: 60 }, 'health')
  if (rl.blocked) return rl.response
  let allCriticalOk = true

  // Check Supabase connectivity
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { error } = await supabase.from('tenants').select('id').limit(1)
    if (error) allCriticalOk = false
  } catch {
    allCriticalOk = false
  }

  // Check required environment variables (without revealing names)
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'ANTHROPIC_API_KEY',
  ]
  const hasMissing = requiredEnvVars.some(v => !process.env[v])
  if (hasMissing) allCriticalOk = false

  return NextResponse.json({
    status: allCriticalOk ? 'ok' : 'error',
  }, {
    status: allCriticalOk ? 200 : 503,
    headers: {
      'Cache-Control': 'no-cache, no-store',
    },
  })
}
