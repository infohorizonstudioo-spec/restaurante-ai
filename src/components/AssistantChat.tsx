'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useTenant } from '@/contexts/TenantContext'
import { C } from '@/lib/colors'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  ts: Date
}

const PANEL_W = 400
const PANEL_H = 500

function getSmartChips(hour: number): string[] {
  if (hour >= 7 && hour < 12) return ['¿Cómo va la mañana?', 'Reservas de hoy', 'Stock bajo?', 'Subir precio café']
  if (hour >= 12 && hour < 16) return ['¿Cómo va el mediodía?', 'Pedidos de hoy', 'Reservas pendientes', 'Carta del día']
  if (hour >= 16 && hour < 20) return ['¿Cómo va la tarde?', 'Preparar para noche', 'Stock para mañana?', 'Llamadas perdidas']
  if (hour >= 20 || hour < 2) return ['¿Cómo va la noche?', 'Resumen del día', 'Cerrar caja', 'Reservas de mañana']
  return ['¿Cómo va hoy?', 'Reservas', 'Llamadas', 'Carta']
}

export default function AssistantChat() {
  const { tenant } = useTenant()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [chips, setChips] = useState<string[]>(() => getSmartChips(new Date().getHours()))
  const [greeted, setGreeted] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Update chips based on current hour
  useEffect(() => {
    setChips(getSmartChips(new Date().getHours()))
    const interval = setInterval(() => {
      setChips(getSmartChips(new Date().getHours()))
    }, 60_000)
    return () => clearInterval(interval)
  }, [])

  // Proactive greeting when chat opens for the first time
  useEffect(() => {
    if (open && !greeted && messages.length === 0) {
      setGreeted(true)
      const agentName = tenant?.agent_name || 'Sofía'
      setMessages([{
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `¡Hola! Soy ${agentName}. ¿En qué te ayudo? Puedo gestionar tu carta, ver reservas, consultar pedidos o lo que necesites.`,
        ts: new Date(),
      }])
    }
  }, [open, greeted, messages.length, tenant?.agent_name])

  // animate mount
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => setMounted(true))
    } else {
      setMounted(false)
    }
  }, [open])

  // auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  // focus input when opened
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 200)
    }
  }, [open])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      ts: new Date(),
    }

    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput('')
    setLoading(true)

    try {
      // Obtener sesión para auth
      const { supabase } = await import('@/lib/supabase')
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''

      const res = await fetch('/api/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
          tenant_id: tenant?.id,
        }),
      })

      if (!res.ok) throw new Error('Error del servidor')

      const data = await res.json()
      const assistantText = data?.content || data?.message || data?.response || 'Sin respuesta'

      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: assistantText,
          ts: new Date(),
        },
      ])
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Error al conectar con el asistente. Intenta de nuevo.',
          ts: new Date(),
        },
      ])
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, tenant?.id])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <>
      {/* CSS keyframes */}
      <style>{`
        @keyframes rz-chat-slide-up {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes rz-chat-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes rz-chat-dot-bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-5px); }
        }
        @keyframes rz-chat-fab-pulse {
          0%, 100% { box-shadow: 0 4px 20px rgba(240,168,78,0.25); }
          50%      { box-shadow: 0 4px 28px rgba(240,168,78,0.45); }
        }
        .rz-chat-scroll::-webkit-scrollbar { width: 4px; }
        .rz-chat-scroll::-webkit-scrollbar-track { background: transparent; }
        .rz-chat-scroll::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }
      `}</style>

      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir asistente"
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            width: 56,
            height: 56,
            borderRadius: '50%',
            border: 'none',
            cursor: 'pointer',
            background: `linear-gradient(135deg, ${C.amber}, ${C.amber2})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'rz-chat-fab-pulse 2.5s ease-in-out infinite',
            transition: 'transform 0.2s',
            zIndex: 9999,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.08)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)' }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.bg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            width: PANEL_W,
            maxWidth: 'calc(100vw - 32px)',
            height: PANEL_H,
            maxHeight: 'calc(100vh - 48px)',
            borderRadius: 16,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            background: C.surface,
            border: `1px solid ${C.border}`,
            boxShadow: `0 12px 48px rgba(0,0,0,0.5), 0 0 0 1px ${C.border}`,
            zIndex: 9999,
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.97)',
            transition: 'opacity 0.25s ease, transform 0.25s ease',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              borderBottom: `1px solid ${C.border}`,
              background: `linear-gradient(135deg, ${C.surface}, ${C.surface2})`,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: `linear-gradient(135deg, ${C.amber}, ${C.amber2})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.bg} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 8V4H8" /><rect x="2" y="2" width="20" height="8" rx="2" /><rect x="2" y="14" width="20" height="8" rx="2" /><path d="M6 18h.01" /><path d="M10 18h.01" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: C.text, letterSpacing: '-0.01em', margin: 0 }}>
                Asistente Reservo.AI
              </p>
              <p style={{ fontSize: 10, color: C.teal, fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.teal, display: 'inline-block' }} />
                En linea
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Cerrar chat"
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                background: 'transparent',
                color: C.text3,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s',
                flexShrink: 0,
              }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = C.surface2; el.style.color = C.text }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = C.text3 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18" /><path d="M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="rz-chat-scroll"
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              scrollbarWidth: 'thin',
              scrollbarColor: `${C.border} transparent`,
            }}
          >
            {messages.length === 0 && !loading && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '24px 16px', textAlign: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: C.amberDim, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.amber} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </div>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: 0 }}>
                  Preguntale lo que necesites
                </p>
                <p style={{ fontSize: 11, color: C.text3, lineHeight: 1.6, maxWidth: 260, margin: 0 }}>
                  Puedes consultar sobre reservas, configuracion, metricas o cualquier duda de tu negocio.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, justifyContent: 'center' }}>
                  {chips.map(s => (
                    <button key={s} onClick={() => { setInput(s); setTimeout(() => sendMessage(), 100) }}
                      style={{ fontSize: 11, padding: '5px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface2, color: C.text2, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
                      onMouseEnter={e => { (e.target as HTMLElement).style.borderColor = C.amber + '44'; (e.target as HTMLElement).style.color = C.amber }}
                      onMouseLeave={e => { (e.target as HTMLElement).style.borderColor = C.border; (e.target as HTMLElement).style.color = C.text2 }}
                    >{s}</button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  animation: 'rz-chat-fade-in 0.3s ease',
                  animationDelay: `${i * 0.03}s`,
                  animationFillMode: 'both',
                }}
              >
                <div
                  style={{
                    maxWidth: '82%',
                    padding: '10px 14px',
                    borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    background: msg.role === 'user'
                      ? `linear-gradient(135deg, ${C.amber}, ${C.amber2})`
                      : C.surface2,
                    color: msg.role === 'user' ? C.bg : C.text,
                    fontSize: 13,
                    lineHeight: 1.55,
                    fontWeight: msg.role === 'user' ? 500 : 400,
                    wordBreak: 'break-word',
                    border: msg.role === 'user' ? 'none' : `1px solid ${C.border}`,
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', animation: 'rz-chat-fade-in 0.3s ease' }}>
                <div
                  style={{
                    padding: '12px 18px',
                    borderRadius: '14px 14px 14px 4px',
                    background: C.surface2,
                    border: `1px solid ${C.border}`,
                    display: 'flex',
                    gap: 5,
                    alignItems: 'center',
                  }}
                >
                  {[0, 1, 2].map(n => (
                    <span
                      key={n}
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: C.text3,
                        display: 'inline-block',
                        animation: 'rz-chat-dot-bounce 1.2s ease-in-out infinite',
                        animationDelay: `${n * 0.15}s`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Input area */}
          <div
            style={{
              padding: '12px 14px',
              borderTop: `1px solid ${C.border}`,
              background: C.surface,
              display: 'flex',
              gap: 8,
              alignItems: 'flex-end',
              flexShrink: 0,
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu mensaje..."
              rows={1}
              style={{
                flex: 1,
                resize: 'none',
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                background: C.surface2,
                color: C.text,
                fontSize: 13,
                padding: '10px 14px',
                fontFamily: 'inherit',
                outline: 'none',
                lineHeight: 1.5,
                maxHeight: 80,
                transition: 'border-color 0.15s',
              }}
              onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = C.amber + '60' }}
              onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = C.border }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              aria-label="Enviar mensaje"
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                border: 'none',
                cursor: !input.trim() || loading ? 'not-allowed' : 'pointer',
                background: !input.trim() || loading
                  ? C.surface2
                  : `linear-gradient(135deg, ${C.amber}, ${C.amber2})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                flexShrink: 0,
                opacity: !input.trim() || loading ? 0.4 : 1,
              }}
              onMouseEnter={e => {
                if (input.trim() && !loading) (e.currentTarget as HTMLElement).style.transform = 'scale(1.06)'
              }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={!input.trim() || loading ? C.text3 : C.bg} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  )
}
