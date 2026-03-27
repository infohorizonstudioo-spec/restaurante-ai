/**
 * POST /api/email/webhook
 * Receives inbound emails from Resend (or other email provider).
 * Processes through the unified channel engine.
 */
import { NextRequest, NextResponse } from 'next/server'
import { processMessage } from '@/lib/channel-engine'
import { agentResponseEmail } from '@/lib/email-templates'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Resend inbound email webhook format
    const from = body.from || body.sender || ''
    const to = Array.isArray(body.to) ? body.to[0] : (body.to || body.recipient || '')
    const subject = body.subject || ''
    const textContent = body.text || body.stripped_text || ''
    const htmlContent = body.html || ''

    if (!from || !to) {
      return NextResponse.json({ error: 'Missing from/to' }, { status: 400 })
    }

    // Use plain text content, fallback to stripping HTML
    const content = textContent || htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

    if (!content) {
      return NextResponse.json({ received: true, processed: false, reason: 'empty content' })
    }

    const metadata: Record<string, any> = {
      subject,
      messageId: body.message_id || body['Message-Id'],
      inReplyTo: body.in_reply_to || body['In-Reply-To'],
      references: body.references || body['References'],
    }

    if (body.attachments && body.attachments.length > 0) {
      metadata.attachments = body.attachments.map((a: any) => ({
        filename: a.filename || a.name,
        contentType: a.content_type || a.type,
        size: a.size,
      }))
    }

    // Process through unified pipeline
    const result = await processMessage({
      channel: 'email',
      from,
      to,
      content: subject ? `[Asunto: ${subject}]\n\n${content}` : content,
      contentType: 'text',
      externalId: body.message_id,
      metadata,
    })

    // Send email response if we have one
    if (result.success && result.responseContent) {
      const resendKey = process.env.RESEND_API_KEY
      if (resendKey) {
        // Get business name from response metadata or default
        const fromAddr = to  // Reply from the same address
        const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject || 'Tu consulta'}`

        // Build HTML email
        const htmlBody = agentResponseEmail({
          businessName: fromAddr.split('@')[0] || 'Reservo.AI',
          agentName: (result as any).agentName || 'Atención al cliente',
          responseContent: result.responseContent,
        })

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromAddr.includes('@') ? fromAddr : `noreply@reservo.ai`,
            to: from,
            subject: replySubject,
            html: htmlBody,
            text: result.responseContent,
            headers: metadata.messageId ? { 'In-Reply-To': metadata.messageId } : undefined,
          }),
        }).catch(err => console.error('[email-send] Error:', err))
      }
    }

    return NextResponse.json({ received: true, processed: result.success, conversationId: result.conversationId })
  } catch (err: any) {
    console.error('[email-webhook] Error:', err?.message || err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
