/**
 * CHANNEL ENGINE — Unified message processing pipeline.
 * Handles all text channels (WhatsApp, Email, SMS) through a single flow:
 *   1. Resolve tenant from recipient identifier
 *   2. Resolve/create customer
 *   3. Find or create conversation
 *   4. Store incoming message
 *   5. Build business context
 *   6. Call channel agent (Claude with tools)
 *   7. Store agent response
 *   8. Send response via channel provider
 *   9. Track usage
 */
import { createClient } from '@supabase/supabase-js'
import { resolveCustomer } from './customer-resolver'
import { normalizePhone } from './phone-utils'
import { buildBusinessContext, BUSINESS_TYPE_LOGIC } from '@/app/api/agent/get-context/route'
import { processWithAgent, type AgentResponse } from './channel-agent'
import { sendSms, sendWhatsApp } from './agent-tools'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Types ────────────────────────────────────────────────────
export interface IncomingMessage {
  tenantId?: string           // Pre-resolved tenant ID (if known)
  channel: 'whatsapp' | 'email' | 'sms'
  from: string                // Phone or email of sender
  to: string                  // Agent phone or email
  content: string
  contentType?: 'text' | 'image' | 'audio' | 'document' | 'location'
  externalId?: string         // Provider message ID
  metadata?: Record<string, any>  // Subject, media URLs, etc.
}

export interface ProcessResult {
  success: boolean
  conversationId?: string
  messageId?: string
  responseContent?: string
  agentResponse?: AgentResponse
  error?: string
}

// ── Plan limits ──────────────────────────────────────────────
const PLAN_LIMITS: Record<string, { messages: number; channels: string[] }> = {
  trial:      { messages: 50,   channels: ['voice'] },
  free:       { messages: 50,   channels: ['voice'] },
  starter:    { messages: 200,  channels: ['voice', 'sms'] },
  pro:        { messages: 1000, channels: ['voice', 'sms', 'whatsapp'] },
  business:   { messages: 5000, channels: ['voice', 'sms', 'whatsapp', 'email'] },
  enterprise: { messages: 99999, channels: ['voice', 'sms', 'whatsapp', 'email'] },
}

// ═══════════════════════════════════════════════════════════════
// MAIN PIPELINE
// ═══════════════════════════════════════════════════════════════
export async function processMessage(msg: IncomingMessage): Promise<ProcessResult> {
  try {
    // ── 1. Resolve tenant ──────────────────────────────────────
    let tenantId = msg.tenantId
    let tenant: any = null

    if (!tenantId) {
      // Find tenant by the "to" identifier
      if (msg.channel === 'whatsapp' || msg.channel === 'sms') {
        const normalized = normalizePhone(msg.to)
        const { data } = await supabase.from('tenants')
          .select('id, name, type, plan, agent_name, language, whatsapp_phone, agent_phone, channels_enabled, plan_messages_used, plan_messages_included')
          .or(`whatsapp_phone.eq.${normalized},agent_phone.eq.${normalized}`)
          .maybeSingle()
        tenant = data
        tenantId = data?.id
      } else if (msg.channel === 'email') {
        // Extract slug from email: {slug}@inbox.reservo.ai
        const toAddr = msg.to.toLowerCase()
        const slug = toAddr.split('@')[0]
        const { data } = await supabase.from('tenants')
          .select('id, name, type, plan, agent_name, language, email_address, channels_enabled, plan_messages_used, plan_messages_included')
          .or(`email_address.eq.${toAddr},slug.eq.${slug}`)
          .maybeSingle()
        tenant = data
        tenantId = data?.id
      }
    }

    if (!tenantId) {
      return { success: false, error: 'Tenant not found for recipient: ' + msg.to }
    }

    if (!tenant) {
      const { data } = await supabase.from('tenants')
        .select('id, name, type, plan, agent_name, language, channels_enabled, plan_messages_used, plan_messages_included')
        .eq('id', tenantId).maybeSingle()
      tenant = data
    }

    if (!tenant) return { success: false, error: 'Tenant not found' }

    // ── 2. Check plan limits ───────────────────────────────────
    const limits = PLAN_LIMITS[tenant.plan] || PLAN_LIMITS.trial
    if (!limits.channels.includes(msg.channel)) {
      return { success: false, error: `Channel ${msg.channel} not available in ${tenant.plan} plan` }
    }
    if ((tenant.plan_messages_used || 0) >= limits.messages) {
      return { success: false, error: 'Message limit reached for current billing period' }
    }

    // ── 3. Check channel config ────────────────────────────────
    const { data: channelConfig } = await supabase.from('channel_configs')
      .select('*').eq('tenant_id', tenantId).eq('channel', msg.channel).maybeSingle()

    if (channelConfig && !channelConfig.enabled) {
      return { success: false, error: `Channel ${msg.channel} is disabled for this tenant` }
    }

    const autoRespond = channelConfig?.auto_respond !== false
    const responseTone = channelConfig?.response_tone || 'professional'

    // ── 4. Resolve customer ────────────────────────────────────
    const isEmail = msg.channel === 'email'
    const resolved = await resolveCustomer({
      tenantId,
      phone: !isEmail ? msg.from : undefined,
      email: isEmail ? msg.from : undefined,
      whatsappPhone: msg.channel === 'whatsapp' ? msg.from : undefined,
      channel: msg.channel,
    })

    // ── 5. Find or create conversation ─────────────────────────
    let conversation: any = null

    // Look for active conversation with same customer on same channel
    const { data: existingConv } = await supabase.from('conversations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('customer_id', resolved.customerId)
      .eq('channel', msg.channel)
      .eq('status', 'active')
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingConv) {
      conversation = existingConv
      // Update last_message_at
      await supabase.from('conversations')
        .update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', conversation.id)
    } else {
      // Create new conversation
      const { data: newConv } = await supabase.from('conversations').insert({
        tenant_id: tenantId,
        customer_id: resolved.customerId,
        channel: msg.channel,
        direction: 'inbound',
        from_identifier: msg.from,
        to_identifier: msg.to,
        external_id: msg.externalId,
        status: 'active',
        metadata: msg.metadata || {},
      }).select('*').maybeSingle()
      conversation = newConv
    }

    if (!conversation) return { success: false, error: 'Could not create conversation' }

    // ── 6. Store incoming message ──────────────────────────────
    const { data: inMsg } = await supabase.from('messages').insert({
      conversation_id: conversation.id,
      tenant_id: tenantId,
      role: 'customer',
      channel: msg.channel,
      content: msg.content,
      content_type: msg.contentType || 'text',
      external_id: msg.externalId,
      status: 'delivered',
      metadata: msg.metadata || {},
    }).select('id').maybeSingle()

    // Create notification for incoming message
    await supabase.from('notifications').insert({
      tenant_id: tenantId,
      type: msg.channel === 'whatsapp' ? 'new_whatsapp' : msg.channel === 'email' ? 'new_email' : 'new_sms',
      title: `${msg.channel === 'whatsapp' ? 'WhatsApp' : msg.channel === 'email' ? 'Email' : 'SMS'} — ${resolved.customerData.name || msg.from}`,
      body: msg.content.slice(0, 200),
      read: false,
      related_entity_id: conversation.id,
    })

    // ── 7. If auto-respond is off, stop here ───────────────────
    if (!autoRespond) {
      return {
        success: true, conversationId: conversation.id, messageId: inMsg?.id,
      }
    }

    // ── 8. Build business context ──────────────────────────────
    const ctx = await buildBusinessContext(tenantId)
    if (!ctx) return { success: false, error: 'Could not load business context' }

    // ── 9. Load conversation history ───────────────────────────
    const { data: historyData } = await supabase.from('messages')
      .select('role, content')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })
      .limit(20)

    const conversationHistory = (historyData || [])
      .filter(m => m.role !== 'system')
      .slice(0, -1) // exclude the message we just inserted
      .map(m => ({
        role: (m.role === 'customer' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content,
      }))

    // Build customer context string
    let customerContext = ''
    const cd = resolved.customerData
    if (cd.name && cd.name !== 'Cliente sin nombre') {
      customerContext += `Nombre: ${cd.name}. `
    }
    if (cd.vip) customerContext += 'Es cliente VIP. '
    if (cd.total_reservations) customerContext += `Ha hecho ${cd.total_reservations} reservas. `
    if (cd.notes) customerContext += `Notas: ${cd.notes}. `

    // ── 10. Call Claude agent ──────────────────────────────────
    const agentResponse = await processWithAgent({
      tenantId,
      channel: msg.channel,
      customerMessage: msg.content,
      conversationHistory,
      businessContext: ctx.business_context,
      businessTypeLogic: ctx.business_type_logic,
      responseTone,
      customerContext: customerContext || undefined,
      customerPhone: normalizePhone(msg.from) || undefined,
    })

    // ── 11. Store agent response ───────────────────────────────
    await supabase.from('messages').insert({
      conversation_id: conversation.id,
      tenant_id: tenantId,
      role: 'agent',
      channel: msg.channel,
      content: agentResponse.content,
      content_type: 'text',
      status: 'sent',
      metadata: {
        intent: agentResponse.intent,
        actions: agentResponse.actions.map(a => ({ type: a.type, success: a.result?.success })),
      },
    })

    // Update conversation with intent if detected
    if (agentResponse.intent) {
      await supabase.from('conversations').update({
        intent: agentResponse.intent,
        updated_at: new Date().toISOString(),
      }).eq('id', conversation.id)
    }

    // ── 12. Send response via channel ──────────────────────────
    if (msg.channel === 'whatsapp') {
      await sendWhatsApp(msg.from, agentResponse.content)
    } else if (msg.channel === 'sms') {
      await sendSms(msg.from, agentResponse.content)
    }
    // Email sending is handled by the email webhook route (uses Resend)

    // ── 13. Track usage ────────────────────────────────────────
    try {
      await supabase.rpc('process_billable_message', {
        p_tenant_id: tenantId,
        p_channel: msg.channel,
        p_conversation_id: conversation.id,
      })
    } catch {
      // Don't fail on billing errors
    }

    return {
      success: true,
      conversationId: conversation.id,
      messageId: inMsg?.id,
      responseContent: agentResponse.content,
      agentResponse,
    }
  } catch (err: any) {
    console.error('[channel-engine] Error:', err?.message || err)
    return { success: false, error: err?.message || 'Internal processing error' }
  }
}

// ═══════════════════════════════════════════════════════════════
// SEND OUTBOUND MESSAGE (from dashboard)
// ═══════════════════════════════════════════════════════════════
export async function sendOutboundMessage(params: {
  tenantId: string
  conversationId: string
  channel: 'whatsapp' | 'email' | 'sms'
  to: string
  content: string
  metadata?: Record<string, any>
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { tenantId, conversationId, channel, to, content, metadata } = params

  // Store message
  const { data: msg } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    tenant_id: tenantId,
    role: 'agent',
    channel,
    content,
    content_type: 'text',
    status: 'queued',
    metadata: metadata || {},
  }).select('id').maybeSingle()

  // Send via provider
  let sent = false
  if (channel === 'whatsapp') {
    sent = await sendWhatsApp(to, content)
  } else if (channel === 'sms') {
    sent = await sendSms(to, content)
  }
  // Email is handled separately

  // Update status
  if (msg?.id) {
    await supabase.from('messages')
      .update({ status: sent ? 'sent' : 'failed' })
      .eq('id', msg.id)
  }

  // Update conversation
  await supabase.from('conversations').update({
    last_message_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', conversationId)

  return { success: sent, messageId: msg?.id }
}
