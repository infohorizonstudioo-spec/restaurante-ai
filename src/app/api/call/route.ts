// Este endpoint redirige al post-call handler principal
// Twilio puede configurarse con /api/call como StatusCallback alternativo
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    // Reenviar al handler principal de post-call
    const body = await req.text()
    const r = await fetch(
      (process.env.NEXT_PUBLIC_APP_URL || 'https://restaurante-ai.vercel.app') + '/api/voice/post-call',
      { method: 'POST', headers: { 'Content-Type': req.headers.get('content-type') || 'application/x-www-form-urlencoded' }, body }
    )
    const d = await r.json()
    return NextResponse.json(d)
  } catch (e: any) {
    return NextResponse.json({ ok: true })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: 'call-handler' })
}
