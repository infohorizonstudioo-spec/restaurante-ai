'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { PageLoader } from '@/components/ui'
import { useTenant } from '@/contexts/TenantContext'
import { C } from '@/lib/colors'
import { useToast } from '@/components/NotificationToast'

const CHANNEL_META: Record<string, { icon: string; color: string; label: string }> = {
  whatsapp: { icon: '💬', color: '#25D366', label: 'WhatsApp' },
  email:    { icon: '✉️', color: '#60A5FA', label: 'Email' },
  sms:      { icon: '📱', color: '#F0A84E', label: 'SMS' },
  voice:    { icon: '📞', color: '#2DD4BF', label: 'Llamada' },
}

const STATUS_META_KEYS: Record<string, { color: string; key: string }> = {
  active:    { color: C.green, key: 'Activa' },
  escalated: { color: C.red, key: 'Escalada' },
  closed:    { color: C.text3, key: 'Cerrada' },
  pending:   { color: C.yellow, key: 'Pendiente' },
  archived:  { color: C.text3, key: 'Archivada' },
}

type Conversation = {
  id: string; channel: string; status: string; intent?: string; summary?: string;
  from_identifier?: string; last_message_at: string; created_at: string;
  customer_id?: string; metadata?: any; priority?: string;
  escalated_at?: string; escalated_reason?: string;
  customer?: { name: string; phone?: string; email?: string }
}

type Message = {
  id: string; role: string; channel: string; content: string;
  content_type: string; status: string; created_at: string; metadata?: any
}

// ── Animation keyframes (injected once) ───────────────────────
const STYLE_ID = 'mensajes-animations'
function injectAnimations() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    @keyframes rz-pulse-ring { 0% { transform: scale(0.8); opacity: 1; } 100% { transform: scale(2.2); opacity: 0; } }
    @keyframes rz-bounce-dot { 0%,80%,100% { transform: translateY(0); } 40% { transform: translateY(-6px); } }
    @keyframes rz-status-fade { 0% { opacity: 0; transform: scale(0.6); } 100% { opacity: 1; transform: scale(1); } }
    @keyframes rz-msg-in { 0% { opacity: 0; transform: translateY(8px); } 100% { opacity: 1; transform: translateY(0); } }
  `
  document.head.appendChild(style)
}

export default function MensajesPage() {
  const { tenant, t, tx } = useTenant()
  const toast = useToast()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [lastMsgPreview, setLastMsgPreview] = useState<Record<string, string>>({})
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set())
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => { injectAnimations() }, [])

  const tid = tenant?.id

  // ── Load conversations ─────────────────────────────────────
  const loadConversations = useCallback(async (tenantId: string) => {
    const { data } = await supabase
      .from('conversations')
      .select('*, customer:customers(name, phone, email)')
      .eq('tenant_id', tenantId)
      .order('last_message_at', { ascending: false })
      .limit(50)
    setConversations(data || [])
    setLoading(false)
  }, [])

  // ── Load messages for conversation ─────────────────────────
  const loadMessages = useCallback(async (conversationId: string) => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(100)
    setMessages(data || [])
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }, [])

  // ── Initial load + realtime ────────────────────────────────
  useEffect(() => {
    if (!tid) return
    loadConversations(tid)

    const ch = supabase.channel('inbox-rt-' + tid)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations', filter: `tenant_id=eq.${tid}` },
        () => loadConversations(tid))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `tenant_id=eq.${tid}` },
        () => loadConversations(tid))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `tenant_id=eq.${tid}` },
        (payload: any) => {
          const convId = payload.new?.conversation_id
          if (selected && convId === selected.id) {
            loadMessages(selected.id)
          } else if (convId) {
            setUnreadIds(prev => new Set(prev).add(convId))
          }
          if (convId && payload.new?.content) {
            setLastMsgPreview(prev => ({ ...prev, [convId]: payload.new.content }))
          }
          loadConversations(tid)
        })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [tid, selected?.id, loadConversations, loadMessages])

  // ── Select conversation ────────────────────────────────────
  const selectConversation = (conv: Conversation) => {
    setSelected(conv)
    loadMessages(conv.id)
    setUnreadIds(prev => { const next = new Set(prev); next.delete(conv.id); return next })
  }

  // ── Send reply ─────────────────────────────────────────────
  const sendReply = async () => {
    if (!replyText.trim() || !selected || !tid) return
    setSending(true)

    const endpoint = selected.channel === 'whatsapp' ? '/api/whatsapp/send'
      : selected.channel === 'email' ? '/api/email/send'
      : '/api/sms/send'

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tid,
          conversation_id: selected.id,
          to: selected.from_identifier,
          content: replyText,
          subject: selected.metadata?.subject ? `Re: ${selected.metadata.subject}` : undefined,
        }),
      })
      if (!res.ok) throw new Error()
      setReplyText('')
      setIsTyping(true)
      loadMessages(selected.id)
      setTimeout(() => setIsTyping(false), 2000)
    } catch {
      toast.push({ title: tx('Error'), body: tx('No se pudo enviar el mensaje'), type: 'message', priority: 'critical', icon: '⚠️' })
    } finally {
      setSending(false)
    }
  }

  // ── Escalation actions ─────────────────────────────────────
  const handleEscalation = async (action: 'escalate' | 'resume' | 'close') => {
    if (!selected || !tid) return
    try {
      const res = await fetch('/api/channels/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: selected.id, tenantId: tid, action }),
      })
      if (!res.ok) throw new Error()
      const newStatus = action === 'escalate' ? 'escalated' : action === 'resume' ? 'active' : 'closed'
      setSelected({ ...selected, status: newStatus })
      loadConversations(tid)
    } catch {
      toast.push({ title: tx('Error'), body: tx('No se pudo completar la acción'), type: 'message', priority: 'critical', icon: '⚠️' })
    }
  }

  // ── Filter conversations ───────────────────────────────────
  const escalatedCount = conversations.filter(c => c.status === 'escalated').length
  const filtered = filter === 'all'
    ? conversations
    : filter === 'escalated'
    ? conversations.filter(c => c.status === 'escalated')
    : conversations.filter(c => c.channel === filter)

  const channelCounts = conversations.reduce((acc, c) => {
    acc[c.channel] = (acc[c.channel] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  if (!tenant) return <PageLoader />

  // ── Time formatting ────────────────────────────────────────
  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return tx('ahora mismo')
    if (mins < 60) return `${mins}m`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h`
    return `${Math.floor(hrs / 24)}d`
  }

  const dateLabel = (ts: string) => {
    const d = new Date(ts)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
    const isYesterday = d.toDateString() === yesterday.toDateString()
    if (isToday) return tx('Hoy')
    if (isYesterday) return tx('Ayer')
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
  }

  return (
    <div className="rz-panel-split rz-page-enter" style={{ display: 'flex', height: 'calc(100vh - 64px)', background: C.bg }}>
      {/* ── LEFT: Conversation List ─────────────────────────────── */}
      <div className="rz-panel-list" style={{
        width: 380, minWidth: 320, borderRight: `1px solid ${C.border}`,
        display: 'flex', flexDirection: 'column', background: C.surface,
      }}>
        {/* Header */}
        <div style={{ padding: '20px 20px 12px', borderBottom: `1px solid ${C.border}` }}>
          <h2 style={{ color: C.text, fontSize: 20, fontWeight: 700, margin: 0 }}>
            {tx('Mensajes')}
          </h2>
          <p style={{ color: C.text2, fontSize: 13, margin: '4px 0 12px' }}>
            {conversations.length} {tx('conversaciones')}
          </p>

          {/* Channel filter tabs */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { key: 'all', label: tx('Todos'), count: conversations.length },
              ...(escalatedCount > 0 ? [{ key: 'escalated', label: tx('Escaladas'), count: escalatedCount }] : []),
              ...Object.entries(CHANNEL_META).filter(([k]) => channelCounts[k]).map(([k, v]) => ({
                key: k, label: v.label, count: channelCounts[k] || 0,
              })),
            ].map(tab => (
              <button key={tab.key} onClick={() => setFilter(tab.key)} style={{
                padding: '6px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600,
                background: filter === tab.key ? C.amberDim : 'transparent',
                color: filter === tab.key ? C.amber : C.text2,
              }}>
                {tab.label} {tab.count > 0 && <span style={{ opacity: 0.7 }}>({tab.count})</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: C.text3 }}>{tx('Cargando...')}</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '60px 24px', textAlign: 'center' }}>
              <div style={{ position: 'relative', display: 'inline-block', marginBottom: 24 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 20,
                  background: 'linear-gradient(135deg, rgba(240,168,78,0.12), rgba(45,212,191,0.06))',
                  border: '1px solid rgba(240,168,78,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
                }}>💬</div>
                <div style={{
                  position: 'absolute', inset: -8, borderRadius: 26,
                  border: '1px dashed rgba(240,168,78,0.12)', pointerEvents: 'none',
                }} />
                {/* Decorative channel icons */}
                <div style={{
                  position: 'absolute', top: -6, right: -10, fontSize: 14,
                  background: C.surface, borderRadius: 8, padding: '2px 4px',
                  border: `1px solid ${C.border}`,
                }}>✉️</div>
                <div style={{
                  position: 'absolute', bottom: -6, left: -10, fontSize: 14,
                  background: C.surface, borderRadius: 8, padding: '2px 4px',
                  border: `1px solid ${C.border}`,
                }}>📱</div>
              </div>
              <p style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>
                {tx('Sin conversaciones')}
              </p>
              <p style={{ fontSize: 13, color: C.text2, lineHeight: 1.7, maxWidth: 240, margin: '0 auto' }}>
                {tx('Los mensajes de WhatsApp, email y SMS aparecerán aquí cuando lleguen.')}
              </p>
            </div>
          ) : filtered.map(conv => {
            const ch = CHANNEL_META[conv.channel] || CHANNEL_META.sms
            const stk = STATUS_META_KEYS[conv.status] || STATUS_META_KEYS.closed
            const isSelected = selected?.id === conv.id
            const isUnread = unreadIds.has(conv.id)
            const customerName = conv.customer?.name || conv.from_identifier || tx('Sin contacto')
            const preview = lastMsgPreview[conv.id] || conv.summary || conv.intent || ''
            const initials = customerName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()

            return (
              <div key={conv.id} onClick={() => selectConversation(conv)} style={{
                padding: '14px 20px', cursor: 'pointer',
                borderBottom: `1px solid ${C.border}`,
                background: isSelected ? C.surface2 : isUnread ? 'rgba(240,168,78,0.04)' : 'transparent',
                borderLeft: isSelected ? `3px solid ${ch.color}` : '3px solid transparent',
                transition: 'background 0.2s ease',
              }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  {/* Avatar with channel badge + unread pulse */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 12,
                      background: `linear-gradient(135deg, ${ch.color}22, ${ch.color}08)`,
                      border: `1px solid ${ch.color}30`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700, color: ch.color,
                    }}>
                      {initials || ch.icon}
                    </div>
                    <div style={{
                      position: 'absolute', bottom: -3, right: -3,
                      width: 18, height: 18, borderRadius: 6,
                      background: C.surface, border: `1.5px solid ${C.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10,
                    }}>{ch.icon}</div>
                    {isUnread && (
                      <div style={{ position: 'absolute', top: -2, right: -2 }}>
                        <div style={{
                          width: 10, height: 10, borderRadius: '50%',
                          background: C.amber, border: `2px solid ${C.surface}`,
                        }} />
                        <div style={{
                          position: 'absolute', inset: 0,
                          width: 10, height: 10, borderRadius: '50%',
                          background: C.amber,
                          animation: 'rz-pulse-ring 1.5s ease-out infinite',
                        }} />
                      </div>
                    )}
                  </div>
                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: C.text, fontSize: 14, fontWeight: isUnread ? 700 : 600 }}>{customerName}</span>
                      <span style={{ color: isUnread ? C.amber : C.text3, fontSize: 11, flexShrink: 0 }}>{timeAgo(conv.last_message_at)}</span>
                    </div>
                    <div style={{
                      color: isUnread ? C.text2 : C.text3, fontSize: 12, marginTop: 4,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      fontWeight: isUnread ? 500 : 400,
                    }}>
                      {conv.status === 'escalated'
                        ? `⚠️ ${conv.escalated_reason || tx('Escalada')}`
                        : preview || ch.label}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                        color: stk.color, background: stk.color + '18',
                        transition: 'color 0.3s ease, background 0.3s ease',
                      }}>{tx(stk.key)}</span>
                      {conv.priority === 'high' && (
                        <span style={{ fontSize: 10, color: C.red }}>● {tx('Alta')}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── RIGHT: Message Thread ───────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.bg }}>
        {!selected ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <div style={{
                width: 72, height: 72, borderRadius: 22,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
                border: `1px solid ${C.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
              }}>💬</div>
              <div style={{
                position: 'absolute', inset: -10, borderRadius: 30,
                border: '1px dashed rgba(255,255,255,0.05)', pointerEvents: 'none',
              }} />
            </div>
            <p style={{ color: C.text, fontSize: 16, fontWeight: 700 }}>{tx('Selecciona una conversación')}</p>
            <p style={{ color: C.text3, fontSize: 13, maxWidth: 280, textAlign: 'center', lineHeight: 1.6 }}>
              {tx('Elige un mensaje del panel izquierdo para ver el hilo completo')}
            </p>
            {conversations.length > 0 && (
              <div style={{
                marginTop: 8, display: 'flex', gap: 8,
              }}>
                {Object.entries(channelCounts).slice(0, 3).map(([ch, count]) => (
                  <span key={ch} style={{
                    fontSize: 11, padding: '4px 10px', borderRadius: 8,
                    background: C.surface2, border: `1px solid ${C.border}`, color: C.text2,
                  }}>
                    {CHANNEL_META[ch]?.icon} {count}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Conversation header */}
            <div style={{
              padding: '16px 24px', borderBottom: `1px solid ${C.border}`, background:'rgba(19,25,32,0.85)',backdropFilter:'blur(16px)',WebkitBackdropFilter:'blur(16px)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{CHANNEL_META[selected.channel]?.icon}</span>
                  <span style={{ color: C.text, fontSize: 16, fontWeight: 700 }}>
                    {selected.customer?.name || selected.from_identifier}
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                    background: (CHANNEL_META[selected.channel]?.color || C.teal) + '20',
                    color: CHANNEL_META[selected.channel]?.color || C.teal,
                  }}>
                    {CHANNEL_META[selected.channel]?.label}
                  </span>
                </div>
                <div style={{ color: C.text2, fontSize: 12, marginTop: 4 }}>
                  {selected.from_identifier}
                  {selected.intent && <span style={{ marginLeft: 12, color: C.amber }}> {selected.intent}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {selected.status === 'escalated' ? (
                  <button onClick={() => handleEscalation('resume')} style={{
                    padding: '8px 16px', borderRadius: 8, border: 'none',
                    background: C.green, color: '#000', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}>
                    {tx('Reanudar IA')}
                  </button>
                ) : selected.status === 'active' ? (
                  <button onClick={() => handleEscalation('escalate')} style={{
                    padding: '8px 16px', borderRadius: 8, border: `1px solid ${C.border}`,
                    background: 'transparent', color: C.text2, fontSize: 12, cursor: 'pointer',
                  }}>
                    {tx('Tomar control')}
                  </button>
                ) : null}
                <button onClick={() => handleEscalation(selected.status === 'closed' ? 'resume' : 'close')} style={{
                  padding: '8px 16px', borderRadius: 8, border: `1px solid ${C.border}`,
                  background: 'transparent', color: C.text2, fontSize: 12, cursor: 'pointer',
                }}>
                  {selected.status === 'closed' ? tx('Reabrir') : tx('Cerrar')}
                </button>
              </div>
            </div>

            {/* Escalation banner */}
            {selected.status === 'escalated' && (
              <div style={{
                padding: '12px 24px', background: C.redDim,
                borderBottom: `1px solid ${C.red}30`,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <span style={{ fontSize: 16 }}>⚠️</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: C.red, fontSize: 13, fontWeight: 700 }}>
                    {tx('Conversación escalada — La IA está pausada')}
                  </div>
                  {selected.escalated_reason && (
                    <div style={{ color: C.text2, fontSize: 12, marginTop: 2 }}>
                      {selected.escalated_reason}
                    </div>
                  )}
                </div>
                <button onClick={() => handleEscalation('resume')} style={{
                  padding: '6px 14px', borderRadius: 6, border: 'none',
                  background: C.green, color: '#000', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}>
                  {tx('Reanudar IA')}
                </button>
              </div>
            )}

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              {messages.map((msg, idx) => {
                const isAgent = msg.role === 'agent'
                const isSystem = msg.role === 'system'
                const prevMsg = messages[idx - 1]
                const showDateDivider = idx === 0 || (prevMsg && dateLabel(msg.created_at) !== dateLabel(prevMsg.created_at))
                const statusColor = msg.status === 'read' ? C.teal : msg.status === 'delivered' ? C.blue : msg.status === 'failed' ? C.red : C.text3

                return (
                  <div key={msg.id}>
                    {/* Date divider */}
                    {showDateDivider && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        margin: '20px 0 16px', padding: '0 8px',
                      }}>
                        <div style={{ flex: 1, height: 1, background: C.border }} />
                        <span style={{
                          fontSize: 11, fontWeight: 600, color: C.text3,
                          padding: '4px 12px', borderRadius: 10,
                          background: C.surface2, border: `1px solid ${C.border}`,
                        }}>
                          {dateLabel(msg.created_at)}
                        </span>
                        <div style={{ flex: 1, height: 1, background: C.border }} />
                      </div>
                    )}
                    {/* Bubble */}
                    <div style={{
                      display: 'flex',
                      justifyContent: isAgent ? 'flex-end' : isSystem ? 'center' : 'flex-start',
                      marginBottom: 8,
                      animation: 'rz-msg-in 0.25s ease-out',
                    }}>
                      <div style={{
                        maxWidth: '70%', padding: '10px 16px', borderRadius: 16,
                        background: isAgent ? C.amberDim : isSystem ? C.surface2 : C.surface2,
                        border: `1px solid ${isAgent ? C.amber + '30' : C.border}`,
                        borderBottomRightRadius: isAgent ? 4 : 16,
                        borderBottomLeftRadius: isAgent ? 16 : 4,
                        boxShadow: isSystem ? 'none' : `0 2px 8px rgba(0,0,0,0.18), 0 1px 2px rgba(0,0,0,0.12)`,
                      }}>
                        {isSystem && (
                          <div style={{ fontSize: 10, color: C.text3, marginBottom: 4, fontWeight: 600 }}>{tx('Sistema')}</div>
                        )}
                        <div style={{
                          color: C.text, fontSize: 14, lineHeight: 1.5,
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        }}>
                          {msg.content}
                        </div>
                        <div style={{
                          fontSize: 10, color: C.text3, marginTop: 6, textAlign: isAgent ? 'right' : 'left',
                          display: 'flex', alignItems: 'center', justifyContent: isAgent ? 'flex-end' : 'flex-start', gap: 4,
                        }}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {isAgent && msg.status && (
                            <span style={{ color: statusColor, transition: 'color 0.3s ease' }}>
                              {msg.status === 'delivered' ? '✓✓' : msg.status === 'read' ? '✓✓' : msg.status === 'sent' ? '✓' : msg.status === 'failed' ? '✗' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
              {/* Typing indicator */}
              {isTyping && (
                <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 8 }}>
                  <div style={{
                    padding: '12px 18px', borderRadius: 16, borderBottomLeftRadius: 4,
                    background: C.surface2, border: `1px solid ${C.border}`,
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{
                        width: 7, height: 7, borderRadius: '50%',
                        background: C.text3,
                        animation: `rz-bounce-dot 1.2s ease-in-out ${i * 0.15}s infinite`,
                      }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply input */}
            <div style={{
              padding: '16px 24px', borderTop: `1px solid ${C.border}`, background: C.surface,
              display: 'flex', gap: 12, alignItems: 'flex-end',
            }}>
              <textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply() } }}
                placeholder={tx('Escribe un mensaje...')}
                rows={1}
                style={{
                  flex: 1, padding: '12px 16px', borderRadius: 12,
                  background: C.surface2, border: `1px solid ${C.border}`,
                  color: C.text, fontSize: 14, resize: 'none',
                  outline: 'none', lineHeight: 1.5,
                }}
              />
              <button
                onClick={sendReply}
                disabled={!replyText.trim() || sending}
                style={{
                  padding: '12px 24px', borderRadius: 12, border: 'none',
                  background: replyText.trim() ? C.amber : C.surface3,
                  color: replyText.trim() ? '#000' : C.text3,
                  fontSize: 14, fontWeight: 700, cursor: replyText.trim() ? 'pointer' : 'default',
                  opacity: sending ? 0.5 : 1,
                }}
              >
                {tx('Enviar')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
