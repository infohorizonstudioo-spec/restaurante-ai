/**
 * POST /api/whatsapp/send
 * Send outbound WhatsApp message from dashboard.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendOutboundMessage } from '@/lib/channel-engine'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { tenant_id, conversation_id, to, content } = await req.json()
    if (!tenant_id || !conversation_id || !to || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const result = await sendOutboundMessage({
      tenantId: tenant_id,
      conversationId: conversation_id,
      channel: 'whatsapp',
      to,
      content,
    })

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
