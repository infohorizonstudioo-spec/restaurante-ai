/**
 * SUMMARY ENGINE — Generates structured summaries for conversations, days, and clients.
 * Uses Claude Haiku for intelligent analysis. Results are stored in DB for dashboard display.
 */
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Types ──────────────────────────────────────────────────────
export interface ConversationSummary {
  intent: string
  key_data: string[]
  action_taken: string
  follow_up_needed: boolean
  follow_up_description?: string
  urgency: 'none' | 'low' | 'medium' | 'high' | 'critical'
  next_step?: string
  sentiment: 'positive' | 'neutral' | 'negative'
}

export interface DaySummary {
  date: string
  total_conversations: number
  channel_breakdown: Record<string, { count: number; resolved: number; escalated: number }>
  highlights: {
    title: string
    type: 'positive' | 'warning' | 'info'
    description: string
  }[]
  pending_actions: string[]
  busiest_hour?: string
  top_intents: { intent: string; count: number }[]
}

// ── Summarize a single conversation ────────────────────────────
export async function summarizeConversation(conversationId: string): Promise<ConversationSummary | null> {
  try {
    // Load conversation + messages
    const { data: conv } = await supabase.from('conversations')
      .select('*, customer:customers(name, phone, email)')
      .eq('id', conversationId)
      .maybeSingle()

    if (!conv) return null

    const { data: msgs } = await supabase.from('messages')
      .select('role, content, created_at, metadata')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(30)

    if (!msgs || msgs.length === 0) return null

    const transcript = msgs.map(m =>
      `[${m.role === 'customer' ? 'Cliente' : m.role === 'agent' ? 'Agente' : 'Sistema'}]: ${m.content}`
    ).join('\n')

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: `Analiza esta conversación de un negocio con un cliente. Responde SOLO JSON válido sin markdown:
{
  "intent": "que quería el cliente (ej: reservar, cancelar, consultar precios, quejarse)",
  "key_data": ["dato importante 1", "dato importante 2"],
  "action_taken": "qué se hizo (ej: reserva creada, información dada, escalado a humano)",
  "follow_up_needed": true/false,
  "follow_up_description": "qué seguimiento necesita (o null)",
  "urgency": "none|low|medium|high|critical",
  "next_step": "siguiente acción recomendada (o null)",
  "sentiment": "positive|neutral|negative"
}`,
      messages: [{ role: 'user', content: transcript }],
    })

    const text = (response.content[0]?.type === 'text' ? response.content[0]?.text : null) || '{}'
    const summary = JSON.parse(text) as ConversationSummary

    // Store summary in conversation
    await supabase.from('conversations').update({
      summary_data: summary,
      summary: `${summary.intent} — ${summary.action_taken}`,
      updated_at: new Date().toISOString(),
    }).eq('id', conversationId)

    return summary
  } catch {
    return null
  }
}

// ── Summarize a full day ───────────────────────────────────────
export async function summarizeDay(tenantId: string, date: string): Promise<DaySummary | null> {
  try {
    const dateStart = `${date}T00:00:00.000Z`
    const dateEnd = `${date}T23:59:59.999Z`

    // Load all conversations for the day
    const { data: convs } = await supabase.from('conversations')
      .select('id, channel, status, intent, summary, summary_data, priority, escalated_reason, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', dateStart)
      .lte('created_at', dateEnd)

    // Load calls for the day
    const { data: calls } = await supabase.from('calls')
      .select('id, status, intent, summary, duration_seconds, started_at')
      .eq('tenant_id', tenantId)
      .gte('started_at', dateStart)
      .lte('started_at', dateEnd)

    // Load reservations created today
    const { data: reservations } = await supabase.from('reservations')
      .select('id, status, source, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', dateStart)
      .lte('created_at', dateEnd)

    const conversations = convs || []
    const daysCalls = calls || []
    const daysReservations = reservations || []

    // Channel breakdown
    const channel_breakdown: DaySummary['channel_breakdown'] = {}
    for (const c of conversations) {
      if (!channel_breakdown[c.channel]) {
        channel_breakdown[c.channel] = { count: 0, resolved: 0, escalated: 0 }
      }
      channel_breakdown[c.channel].count++
      if (c.status === 'closed') channel_breakdown[c.channel].resolved++
      if (c.status === 'escalated') channel_breakdown[c.channel].escalated++
    }

    // Add voice channel from calls
    if (daysCalls.length > 0) {
      channel_breakdown['voice'] = {
        count: daysCalls.length,
        resolved: daysCalls.filter(c => c.status === 'completed').length,
        escalated: 0,
      }
    }

    // Top intents
    const intentCounts: Record<string, number> = {}
    for (const c of conversations) {
      if (c.intent) intentCounts[c.intent] = (intentCounts[c.intent] || 0) + 1
    }
    for (const c of daysCalls) {
      if (c.intent) intentCounts[c.intent] = (intentCounts[c.intent] || 0) + 1
    }
    const top_intents = Object.entries(intentCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([intent, count]) => ({ intent, count }))

    // Build highlights
    const highlights: DaySummary['highlights'] = []

    const totalInteractions = conversations.length + daysCalls.length
    if (totalInteractions > 0) {
      highlights.push({
        title: `${totalInteractions} interacciones totales`,
        type: 'info',
        description: `${conversations.length} mensajes + ${daysCalls.length} llamadas`,
      })
    }

    if (daysReservations.length > 0) {
      highlights.push({
        title: `${daysReservations.length} reservas creadas`,
        type: 'positive',
        description: `${daysReservations.filter(r => r.status === 'confirmada').length} confirmadas`,
      })
    }

    const escalated = conversations.filter(c => c.status === 'escalated')
    if (escalated.length > 0) {
      highlights.push({
        title: `${escalated.length} conversaciones escaladas`,
        type: 'warning',
        description: escalated.map(e => e.escalated_reason || 'Sin motivo').join(', '),
      })
    }

    // Pending actions from conversation summaries
    const pending_actions: string[] = []
    for (const c of conversations) {
      const sd = c.summary_data as ConversationSummary | null
      if (sd?.follow_up_needed && sd.follow_up_description) {
        pending_actions.push(sd.follow_up_description)
      }
    }

    const daySummary: DaySummary = {
      date,
      total_conversations: totalInteractions,
      channel_breakdown,
      highlights,
      pending_actions,
      top_intents,
    }

    // Store in daily_summaries
    await supabase.from('daily_summaries').upsert({
      tenant_id: tenantId,
      date,
      channel_breakdown,
      highlights,
      pending_actions,
      top_intents,
    }, { onConflict: 'tenant_id,date' })

    return daySummary
  } catch {
    return null
  }
}

// ── Summarize a client's history ───────────────────────────────
export async function summarizeClient(tenantId: string, customerId: string): Promise<any> {
  try {
    const { data: customer } = await supabase.from('customers')
      .select('*')
      .eq('id', customerId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (!customer) return null

    const { data: convs } = await supabase.from('conversations')
      .select('channel, intent, summary, summary_data, status, created_at')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(20)

    const { data: reservations } = await supabase.from('reservations')
      .select('date, time, status, people, notes')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .order('date', { ascending: false })
      .limit(10)

    return {
      customer,
      total_conversations: convs?.length || 0,
      total_reservations: reservations?.length || 0,
      recent_intents: (convs || []).map(c => c.intent).filter(Boolean),
      sentiment_history: (convs || [])
        .map(c => (c.summary_data as ConversationSummary)?.sentiment)
        .filter(Boolean),
      has_complaints: (convs || []).some(c => c.intent === 'complaint' || c.status === 'escalated'),
      recent_reservations: reservations || [],
    }
  } catch {
    return null
  }
}
