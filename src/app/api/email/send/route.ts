/**
 * POST /api/email/send
 * Send outbound email from dashboard.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { agentResponseEmail } from '@/lib/email-templates'
import { requireAuth } from '@/lib/api-auth'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { sanitizeEmail, sanitizeString } from '@/lib/sanitize'
import { logger } from '@/lib/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const rl = rateLimitByIp(req, RATE_LIMITS.messaging, 'email:send')
    if (rl.blocked) return rl.response

    const auth = await requireAuth(req)
    if (!auth.ok || !auth.tenantId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const tenant_id = auth.tenantId
    const body = await req.json()
    const conversation_id = body.conversation_id
    const to = sanitizeEmail(body.to)
    const subject = sanitizeString(body.subject, 200)
    const content = sanitizeString(body.content, 5000)
    if (!to || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    logger.info('Email send request', { tenantId: tenant_id, to })

    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) {
      return NextResponse.json({ error: 'Email not configured' }, { status: 500 })
    }

    // Get tenant info for branding
    const { data: tenant } = await supabase.from('tenants')
      .select('name, agent_name, email_address').eq('id', tenant_id).maybeSingle()

    const fromAddr = tenant?.email_address || 'noreply@reservo.ai'
    const htmlBody = agentResponseEmail({
      businessName: tenant?.name || 'Tu negocio',
      agentName: tenant?.agent_name || 'Atención al cliente',
      responseContent: content,
    })

    const controller = new AbortController()
    const fetchTimeout = setTimeout(() => controller.abort(), 30000)
    let res: Response
    try {
      res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          from: fromAddr,
          to,
          subject: subject || 'Respuesta de ' + (tenant?.name || 'tu negocio'),
          html: htmlBody,
          text: content,
        }),
      })
    } finally {
      clearTimeout(fetchTimeout)
    }

    const resData = await res.json()

    // Store in messages if conversation exists
    if (conversation_id) {
      await supabase.from('messages').insert({
        conversation_id,
        tenant_id,
        role: 'agent',
        channel: 'email',
        content,
        content_type: 'text',
        external_id: resData?.id,
        status: res.ok ? 'sent' : 'failed',
        metadata: { subject },
      })
    }

    return NextResponse.json({ success: res.ok, emailId: resData?.id })
  } catch (err) {
    logger.error('Email send failed', {}, err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
