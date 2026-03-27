/**
 * POST /api/whatsapp/webhook
 * Receives incoming WhatsApp messages from Twilio.
 * Normalizes to IncomingMessage and calls the channel engine.
 */
import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { processMessage } from '@/lib/channel-engine'
import { stripWhatsAppPrefix } from '@/lib/phone-utils'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { sanitizeForLLM } from '@/lib/sanitize'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const rl = rateLimitByIp(req, RATE_LIMITS.webhook, 'whatsapp:webhook')
    if (rl.blocked) return rl.response

    // --- Twilio signature validation ---
    const twilioSignature = req.headers.get('x-twilio-signature')
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/whatsapp/webhook`

    if (!twilioSignature || !authToken) {
      logger.security('WhatsApp webhook: missing signature or auth token')
      return new NextResponse('<Response></Response>', {
        status: 401, headers: { 'Content-Type': 'text/xml' },
      })
    }

    // Clone the request body for validation (need raw text for Twilio validation)
    const rawBody = await req.text()
    const params = Object.fromEntries(new URLSearchParams(rawBody))

    const isValid = twilio.validateRequest(authToken, twilioSignature, url, params)
    if (!isValid) {
      logger.security('WhatsApp webhook: invalid signature')
      return new NextResponse('<Response></Response>', {
        status: 403, headers: { 'Content-Type': 'text/xml' },
      })
    }

    // Verify AccountSid matches our account
    const accountSid = params.AccountSid || params['AccountSid']
    if (process.env.TWILIO_ACCOUNT_SID && accountSid !== process.env.TWILIO_ACCOUNT_SID) {
      logger.security('WhatsApp webhook: AccountSid mismatch')
      return new NextResponse('<Response></Response>', {
        status: 403, headers: { 'Content-Type': 'text/xml' },
      })
    }

    // Parse validated body
    const body: Record<string, string> = params

    const from = stripWhatsAppPrefix(body.From || '')
    const to = stripWhatsAppPrefix(body.To || '')
    const messageBody = sanitizeForLLM(body.Body || '')
    const messageSid = body.MessageSid || body.SmsMessageSid || ''
    const numMedia = parseInt(body.NumMedia || '0')

    if (!from || !messageBody) {
      // Return 200 anyway — Twilio retries on non-200
      return new NextResponse('<Response></Response>', {
        status: 200, headers: { 'Content-Type': 'text/xml' },
      })
    }

    // Build metadata
    const metadata: Record<string, any> = {}
    if (body.ProfileName) metadata.profileName = body.ProfileName
    if (numMedia > 0) {
      metadata.media = []
      for (let i = 0; i < numMedia; i++) {
        metadata.media.push({
          url: body[`MediaUrl${i}`],
          contentType: body[`MediaContentType${i}`],
        })
      }
    }

    // Determine content type
    let contentType: 'text' | 'image' | 'audio' | 'document' | 'location' = 'text'
    if (numMedia > 0) {
      const mediaType = body.MediaContentType0 || ''
      if (mediaType.startsWith('image/')) contentType = 'image'
      else if (mediaType.startsWith('audio/')) contentType = 'audio'
      else contentType = 'document'
    }
    if (body.Latitude && body.Longitude) {
      contentType = 'location'
      metadata.latitude = body.Latitude
      metadata.longitude = body.Longitude
    }

    // Process through unified pipeline
    const result = await processMessage({
      channel: 'whatsapp',
      from,
      to,
      content: messageBody,
      contentType,
      externalId: messageSid,
      metadata,
    })

    if (!result.success) {
      logger.error('WhatsApp webhook processing failed', { from, error: result.error })
    }

    // Always return 200 with empty TwiML — response is sent via API, not TwiML
    return new NextResponse('<Response></Response>', {
      status: 200, headers: { 'Content-Type': 'text/xml' },
    })
  } catch (err: any) {
    logger.error('WhatsApp webhook failed', {}, err)
    return new NextResponse('<Response></Response>', {
      status: 200, headers: { 'Content-Type': 'text/xml' },
    })
  }
}
