/**
 * POST /api/whatsapp/send
 * Send outbound WhatsApp message from dashboard.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendOutboundMessage } from '@/lib/channel-engine'
import { requireAuth } from '@/lib/api-auth'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { sanitizePhone, sanitizeString } from '@/lib/sanitize'
import { logger } from '@/lib/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const rl = rateLimitByIp(req, RATE_LIMITS.messaging, 'whatsapp:send')
    if (rl.blocked) return rl.response

    const auth = await requireAuth(req)
    if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const body = await req.json()
    const conversation_id = body.conversation_id
    const to = sanitizePhone(body.to)
    const content = sanitizeString(body.content, 4096)
    if (!conversation_id || !to || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    logger.info('WhatsApp send request', { tenantId: auth.tenantId, to })

    const result = await sendOutboundMessage({
      tenantId: auth.tenantId,
      conversationId: conversation_id,
      channel: 'whatsapp',
      to,
      content,
    })

    return NextResponse.json(result)
  } catch (err) {
    logger.error('WhatsApp send failed', {}, err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
