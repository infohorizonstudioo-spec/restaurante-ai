/**
 * POST /api/whatsapp/status
 * Twilio message status callback — updates message delivery status.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

const STATUS_MAP: Record<string, string> = {
  queued: 'queued',
  sent: 'sent',
  delivered: 'delivered',
  read: 'read',
  failed: 'failed',
  undelivered: 'failed',
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const messageSid = formData.get('MessageSid')?.toString()
    const messageStatus = formData.get('MessageStatus')?.toString()

    if (messageSid && messageStatus) {
      const mappedStatus = STATUS_MAP[messageStatus] || messageStatus
      await supabase.from('messages')
        .update({ status: mappedStatus })
        .eq('external_id', messageSid)
    }

    return new NextResponse('<Response></Response>', {
      status: 200, headers: { 'Content-Type': 'text/xml' },
    })
  } catch {
    return new NextResponse('<Response></Response>', {
      status: 200, headers: { 'Content-Type': 'text/xml' },
    })
  }
}
