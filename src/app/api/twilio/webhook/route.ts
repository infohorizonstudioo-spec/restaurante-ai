import { NextRequest, NextResponse } from "next/server"
import twilio from "twilio"
import { logger } from "@/lib/logger"
import { rateLimitByIp, RATE_LIMITS } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

// This webhook is not actively used - Twilio points directly to ElevenLabs.
// ElevenLabs calls /api/voice/context for dynamic variables.
// Kept as fallback.

export async function POST(req: NextRequest) {
  const rl = rateLimitByIp(req, RATE_LIMITS.webhook, 'twilio:webhook')
  if (rl.blocked) return rl.response

  // --- Twilio signature validation ---
  const twilioSignature = req.headers.get("x-twilio-signature")
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/twilio/webhook`

  if (!twilioSignature || !authToken) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const body = await req.text()
  const params = Object.fromEntries(new URLSearchParams(body))

  const isValid = twilio.validateRequest(authToken, twilioSignature, url, params)
  if (!isValid) {
    logger.security("Twilio webhook: invalid signature")
    return new NextResponse("Invalid signature", { status: 403 })
  }

  const p = new URLSearchParams(body)

  // Verify AccountSid matches our account
  const accountSid = params.AccountSid || p.get('AccountSid')
  if (process.env.TWILIO_ACCOUNT_SID && accountSid !== process.env.TWILIO_ACCOUNT_SID) {
    logger.security("Twilio webhook: AccountSid mismatch")
    return new NextResponse("Unauthorized", { status: 403 })
  }

  const called = p.get("Called") || p.get("To") || ""
  const caller = p.get("Caller") || p.get("From") || ""

  return new NextResponse(
    '<?xml version="1.0" encoding="UTF-8"?><Response><Say language="es-ES">Lo sentimos, no se ha podido conectar la llamada.</Say></Response>',
    { headers: { "Content-Type": "text/xml" } }
  )
}
