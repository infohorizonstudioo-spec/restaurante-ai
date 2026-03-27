// Este endpoint redirige al post-call handler principal
// Twilio puede configurarse con /api/call como StatusCallback alternativo
import { NextResponse } from 'next/server'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'

export async function POST(req: Request) {
  const rl = rateLimitByIp(req, RATE_LIMITS.webhook, 'call')
  if (rl.blocked) return rl.response

  try {
    // Reenviar al handler principal de post-call
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (!appUrl) {
      return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL is not configured' }, { status: 500 })
    }
    const body = await req.text()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)
    try {
      var r = await fetch(
        appUrl + '/api/voice/post-call',
        { method: 'POST', headers: { 'Content-Type': req.headers.get('content-type') || 'application/x-www-form-urlencoded' }, body, signal: controller.signal }
      )
    } finally {
      clearTimeout(timeout)
    }
    const d = await r.json()
    return NextResponse.json(d)
  } catch (e: any) {
    return NextResponse.json({ ok: true })
  }
}

export async function GET(req: Request) {
  const rl = rateLimitByIp(req, RATE_LIMITS.api, 'call')
  if (rl.blocked) return rl.response

  return NextResponse.json({ status: 'ok', endpoint: 'call-handler' })
}
