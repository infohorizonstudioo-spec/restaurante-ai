/**
 * POST /api/channels/escalate
 * Toggle conversation between escalated/active status.
 * Used by owner to take manual control or resume AI.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { conversationId, action, tenantId } = await req.json()

    if (!conversationId || !tenantId) {
      return NextResponse.json({ error: 'Missing conversationId or tenantId' }, { status: 400 })
    }

    // Verify conversation belongs to tenant
    const { data: conv } = await supabase.from('conversations')
      .select('id, status, tenant_id')
      .eq('id', conversationId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (!conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const now = new Date().toISOString()

    if (action === 'escalate') {
      await supabase.from('conversations').update({
        status: 'escalated',
        escalated_at: now,
        updated_at: now,
      }).eq('id', conversationId)

      // Disable auto-respond for this conversation's channel config
      // so the agent doesn't respond while the owner handles it
      return NextResponse.json({ success: true, status: 'escalated' })
    }

    if (action === 'resume') {
      await supabase.from('conversations').update({
        status: 'active',
        escalated_at: null,
        escalated_reason: null,
        updated_at: now,
      }).eq('id', conversationId)

      return NextResponse.json({ success: true, status: 'active' })
    }

    if (action === 'close') {
      await supabase.from('conversations').update({
        status: 'closed',
        updated_at: now,
      }).eq('id', conversationId)

      return NextResponse.json({ success: true, status: 'closed' })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
