/**
 * POST /api/email/send
 * Send outbound email from dashboard.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { agentResponseEmail } from '@/lib/email-templates'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { tenant_id, conversation_id, to, subject, content } = await req.json()
    if (!tenant_id || !to || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

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
      agentName: tenant?.agent_name || 'Asistente Virtual',
      responseContent: content,
    })

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddr,
        to,
        subject: subject || 'Respuesta de ' + (tenant?.name || 'tu negocio'),
        html: htmlBody,
        text: content,
      }),
    })

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
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
