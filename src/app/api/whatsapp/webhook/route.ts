/**
 * POST /api/whatsapp/webhook
 * Receives incoming WhatsApp messages from Twilio.
 * Normalizes to IncomingMessage and calls the channel engine.
 */
import { NextRequest, NextResponse } from 'next/server'
import { processMessage } from '@/lib/channel-engine'
import { stripWhatsAppPrefix } from '@/lib/phone-utils'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    // Twilio sends form-urlencoded
    const formData = await req.formData()
    const body: Record<string, string> = {}
    formData.forEach((value, key) => { body[key] = value.toString() })

    const from = stripWhatsAppPrefix(body.From || '')
    const to = stripWhatsAppPrefix(body.To || '')
    const messageBody = body.Body || ''
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
      console.error('[whatsapp-webhook] Processing failed:', result.error)
    }

    // Always return 200 with empty TwiML — response is sent via API, not TwiML
    return new NextResponse('<Response></Response>', {
      status: 200, headers: { 'Content-Type': 'text/xml' },
    })
  } catch (err: any) {
    console.error('[whatsapp-webhook] Error:', err?.message || err)
    return new NextResponse('<Response></Response>', {
      status: 200, headers: { 'Content-Type': 'text/xml' },
    })
  }
}
