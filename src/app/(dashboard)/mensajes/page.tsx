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
  const messagesEndRef = useRef<HTMLDivElement>(null)

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
          if (selected && payload.new?.conversation_id === selected.id) {
            loadMessages(selected.id)
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
      loadMessages(selected.id)
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
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <div style={{position:'relative',display:'inline-block',marginBottom:20}}>
                <div style={{width:56,height:56,borderRadius:16,background:`linear-gradient(135deg,rgba(240,168,78,0.10),rgba(240,168,78,0.04))`,border:'1px solid rgba(240,168,78,0.12)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>💬</div>
                <div style={{position:'absolute',inset:-6,borderRadius:22,border:'1px dashed rgba(240,168,78,0.12)',pointerEvents:'none'}}/>
              </div>
              <p style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:6}}>{tx('Sin conversaciones')}</p>
              <p style={{fontSize:12,color:C.text2,lineHeight:1.6}}>{tx('Los mensajes de WhatsApp, email y SMS aparecerán aquí.')}</p>
            </div>
          ) : filtered.map(conv => {
            const ch = CHANNEL_META[conv.channel] || CHANNEL_META.sms
            const stk = STATUS_META_KEYS[conv.status] || STATUS_META_KEYS.closed
            const isSelected = selected?.id === conv.id
            const customerName = conv.customer?.name || conv.from_identifier || tx('Sin contacto')

            return (
              <div key={conv.id} onClick={() => selectConversation(conv)} style={{
                padding: '14px 20px', cursor: 'pointer',
                borderBottom: `1px solid ${C.border}`,
                background: isSelected ? C.surface2 : 'transparent',
                borderLeft: isSelected ? `3px solid ${ch.color}` : '3px solid transparent',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>{ch.icon}</span>
                    <span style={{ color: C.text, fontSize: 14, fontWeight: 600 }}>{customerName}</span>
                  </div>
                  <span style={{ color: C.text3, fontSize: 11 }}>{timeAgo(conv.last_message_at)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  <span style={{ color: C.text2, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
                    {conv.status === 'escalated' ? `⚠️ ${conv.escalated_reason || tx('Escalada')}` : conv.summary || conv.intent || ch.label}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                    color: stk.color, background: stk.color + '18',
                  }}>{tx(stk.key)}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── RIGHT: Message Thread ───────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.bg }}>
        {!selected ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
            <div className="rz-card-interactive" style={{width:56,height:56,borderRadius:16,background:'rgba(255,255,255,0.03)',border:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,marginBottom:4}}>💬</div>
            <p style={{ color: C.text, fontSize: 14, fontWeight: 600 }}>{tx('Selecciona una conversación')}</p>
            <p style={{ color: C.text3, fontSize: 12 }}>{tx('Elige un mensaje del panel izquierdo para ver el hilo completo')}</p>
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
              {messages.map(msg => {
                const isAgent = msg.role === 'agent'
                const isSystem = msg.role === 'system'
                return (
                  <div key={msg.id} style={{
                    display: 'flex',
                    justifyContent: isAgent ? 'flex-end' : isSystem ? 'center' : 'flex-start',
                    marginBottom: 12,
                  }}>
                    <div style={{
                      maxWidth: '70%', padding: '10px 16px', borderRadius: 16,
                      background: isAgent ? C.amberDim : isSystem ? C.surface2 : C.surface2,
                      border: `1px solid ${isAgent ? C.amber + '30' : C.border}`,
                      borderBottomRightRadius: isAgent ? 4 : 16,
                      borderBottomLeftRadius: isAgent ? 16 : 4,
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
                      }}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {isAgent && msg.status && (
                          <span style={{ marginLeft: 6 }}>
                            {msg.status === 'delivered' ? '✓✓' : msg.status === 'read' ? '✓✓' : msg.status === 'sent' ? '✓' : msg.status === 'failed' ? '✗' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
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
