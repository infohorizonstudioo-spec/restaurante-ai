import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// This webhook is not actively used - Twilio points directly to ElevenLabs.
// ElevenLabs calls /api/voice/context for dynamic variables.
// Kept as fallback.

export async function POST(req: NextRequest) {
  const body = await req.text()
  const p = new URLSearchParams(body)
  const called = p.get("Called") || p.get("To") || ""
  const caller = p.get("Caller") || p.get("From") || ""

  return new NextResponse(
    '<?xml version="1.0" encoding="UTF-8"?><Response><Say language="es-ES">Lo sentimos, no se ha podido conectar la llamada.</Say></Response>',
    { headers: { "Content-Type": "text/xml" } }
  )
}
