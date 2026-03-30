'use client'

import { useState, useMemo } from 'react'

/* ── Types ─────────────────────────────────────────────────────── */

interface MenuItem {
  id: string
  name: string
  price: number
  category: string
  description?: string
  image_url?: string
  availability_type?: string
}

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
}

interface TenantInfo {
  id: string
  name: string
  type: string
  logo_url?: string
  slug: string
}

interface Props {
  tenant: TenantInfo
  items: MenuItem[]
  mesa: string | null
  slug: string
}

/* ── Design tokens (hardcoded for public page, no CSS vars) ──── */

const T = {
  bg: '#0C1018',
  surface: '#131920',
  surface2: '#1A2230',
  amber: '#F0A84E',
  amberDim: 'rgba(240,168,78,0.10)',
  amberBorder: 'rgba(240,168,78,0.25)',
  teal: '#2DD4BF',
  green: '#34D399',
  red: '#F87171',
  text: '#E8EEF6',
  text2: '#8895A7',
  text3: '#49566A',
  border: 'rgba(255,255,255,0.07)',
}

/* ── Context options ─────────────────────────────────────────── */

const CONTEXTS = [
  { key: 'comer', emoji: '\uD83C\uDF7D\uFE0F', label: 'Comer' },
  { key: 'cenar', emoji: '\uD83C\uDF19', label: 'Cenar' },
  { key: 'picoteo', emoji: '\uD83C\uDF7A', label: 'Picoteo' },
  { key: 'bebidas', emoji: '\uD83E\uDD64', label: 'Solo bebidas' },
]

/* ── Category priority by context ────────────────────────────── */

const CATEGORY_BOOST: Record<string, string[]> = {
  comer: ['Entrantes', 'Primeros', 'Segundos', 'Principales', 'Postres'],
  cenar: ['Entrantes', 'Principales', 'Segundos', 'Postres'],
  picoteo: ['Tapas', 'Raciones', 'Entrantes', 'Aperitivos', 'Snacks'],
  bebidas: ['Bebidas', 'Cervezas', 'Vinos', 'Refrescos', 'Cocktails', 'Cafes'],
}

/* ── Component ───────────────────────────────────────────────── */

export default function OrderFlow({ tenant, items, mesa, slug }: Props) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [step, setStep] = useState<'context' | 'menu' | 'review' | 'done'>('context')
  const [context, setContext] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [orderNotes, setOrderNotes] = useState('')
  const [sending, setSending] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [error, setError] = useState('')

  // Group items by category, sorted by context
  const { categories, categoryNames } = useMemo(() => {
    const cats: Record<string, MenuItem[]> = {}
    for (const item of items) {
      const cat = item.category || 'Otros'
      if (!cats[cat]) cats[cat] = []
      cats[cat].push(item)
    }

    let names = Object.keys(cats)
    // Reorder based on context
    if (context && CATEGORY_BOOST[context]) {
      const boost = CATEGORY_BOOST[context]
      names.sort((a, b) => {
        const aIdx = boost.findIndex(b2 => a.toLowerCase().includes(b2.toLowerCase()))
        const bIdx = boost.findIndex(b2 => b.toLowerCase().includes(b2.toLowerCase()))
        const aScore = aIdx >= 0 ? aIdx : 999
        const bScore = bIdx >= 0 ? bIdx : 999
        return aScore - bScore
      })
    }

    return { categories: cats, categoryNames: names }
  }, [items, context])

  // Cart helpers
  const cartTotal = cart.reduce((s, c) => s + c.price * c.quantity, 0)
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0)

  function addToCart(item: MenuItem) {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id)
      if (existing) {
        return prev.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)
      }
      return [...prev, { id: item.id, name: item.name, price: item.price, quantity: 1 }]
    })
  }

  function updateQuantity(id: string, delta: number) {
    setCart(prev => {
      return prev.map(c => {
        if (c.id !== id) return c
        const newQ = c.quantity + delta
        return newQ > 0 ? { ...c, quantity: newQ } : c
      }).filter(c => c.quantity > 0)
    })
  }

  function removeFromCart(id: string) {
    setCart(prev => prev.filter(c => c.id !== id))
  }

  function getCartQty(id: string): number {
    return cart.find(c => c.id === id)?.quantity || 0
  }

  async function submitOrder() {
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/orders/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          mesa,
          items: cart,
          customer_name: customerName || undefined,
          notes: orderNotes || undefined,
          context,
        }),
      })
      if (res.ok) {
        setStep('done')
      } else {
        const d = await res.json().catch(() => ({}))
        setError(d.error || 'Error al enviar pedido')
      }
    } catch {
      setError('Error de conexion')
    }
    setSending(false)
  }

  function resetOrder() {
    setCart([])
    setStep('context')
    setContext('')
    setCustomerName('')
    setOrderNotes('')
    setError('')
  }

  // ─── Render ────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: '100vh',
      background: T.bg,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      maxWidth: 480,
      margin: '0 auto',
      position: 'relative',
    }}>
      {/* Header */}
      <div style={{
        padding: '24px 20px 16px',
        background: `linear-gradient(180deg, ${T.surface} 0%, ${T.bg} 100%)`,
        borderBottom: `1px solid ${T.border}`,
        textAlign: 'center',
      }}>
        {tenant.logo_url && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={tenant.logo_url}
            alt={tenant.name}
            style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover', marginBottom: 8 }}
          />
        )}
        <h1 style={{
          fontSize: 22, fontWeight: 800, color: T.text,
          letterSpacing: '-0.02em', margin: 0,
        }}>
          {tenant.name}
        </h1>
        {mesa && (
          <p style={{
            fontSize: 13, color: T.amber, fontWeight: 600, marginTop: 6,
            background: T.amberDim, display: 'inline-block',
            padding: '4px 14px', borderRadius: 20,
          }}>
            Mesa {mesa}
          </p>
        )}
      </div>

      {/* ─── Step 1: Context ──────────────────────────────────── */}
      {step === 'context' && (
        <div style={{ padding: '32px 20px' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: T.text, textAlign: 'center', marginBottom: 8 }}>
            Hola! Que vais a hacer hoy?
          </h2>
          <p style={{ fontSize: 14, color: T.text2, textAlign: 'center', marginBottom: 28 }}>
            Te ordenamos la carta para que encuentres lo mejor
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {CONTEXTS.map(c => (
              <button
                key={c.key}
                onClick={() => { setContext(c.key); setStep('menu') }}
                style={{
                  padding: '28px 16px',
                  borderRadius: 16,
                  background: T.surface,
                  border: `1px solid ${T.border}`,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 10,
                  transition: 'transform 0.15s, border-color 0.15s',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = T.amberBorder;
                  (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.03)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = T.border;
                  (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'
                }}
              >
                <span style={{ fontSize: 36 }}>{c.emoji}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{c.label}</span>
              </button>
            ))}
          </div>

          {/* Skip context */}
          <button
            onClick={() => setStep('menu')}
            style={{
              marginTop: 20, width: '100%', padding: '12px',
              borderRadius: 12, background: 'transparent',
              border: `1px solid ${T.border}`, color: T.text3,
              fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Ver toda la carta
          </button>
        </div>
      )}

      {/* ─── Step 2: Menu ─────────────────────────────────────── */}
      {step === 'menu' && (
        <div style={{ paddingBottom: cartCount > 0 ? 90 : 20 }}>
          {/* Category tabs */}
          {categoryNames.length > 1 && (
            <div style={{
              display: 'flex', gap: 8, padding: '14px 20px',
              overflowX: 'auto', borderBottom: `1px solid ${T.border}`,
              WebkitOverflowScrolling: 'touch',
            }}>
              {categoryNames.map(cat => {
                const isActive = activeCategory === cat
                return (
                  <button
                    key={cat}
                    onClick={() => {
                      setActiveCategory(isActive ? null : cat)
                      const el = document.getElementById(`cat-${cat.replace(/\s+/g, '-')}`)
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }}
                    style={{
                      padding: '8px 16px', borderRadius: 20,
                      background: isActive ? T.amberDim : 'transparent',
                      border: `1px solid ${isActive ? T.amberBorder : T.border}`,
                      color: isActive ? T.amber : T.text2,
                      fontSize: 13, fontWeight: 600,
                      whiteSpace: 'nowrap', flexShrink: 0,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    {cat}
                  </button>
                )
              })}
            </div>
          )}

          {/* Items */}
          <div style={{ padding: '16px 20px' }}>
            {items.length === 0 && (
              <p style={{ textAlign: 'center', color: T.text2, padding: '40px 0', fontSize: 15 }}>
                La carta se esta preparando...
              </p>
            )}

            {categoryNames.map(cat => (
              <div key={cat} id={`cat-${cat.replace(/\s+/g, '-')}`} style={{ marginBottom: 28 }}>
                <h3 style={{
                  fontSize: 16, fontWeight: 700, color: T.amber,
                  marginBottom: 12, paddingBottom: 6,
                  borderBottom: `1px solid ${T.amberBorder}`,
                }}>
                  {cat}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {categories[cat].map(item => {
                    const qty = getCartQty(item.id)
                    return (
                      <button
                        key={item.id}
                        onClick={() => addToCart(item)}
                        style={{
                          display: 'flex', gap: 12, padding: '12px 14px',
                          background: qty > 0 ? 'rgba(240,168,78,0.06)' : T.surface,
                          borderRadius: 14,
                          border: `1px solid ${qty > 0 ? T.amberBorder : T.border}`,
                          alignItems: 'center',
                          cursor: 'pointer', textAlign: 'left',
                          width: '100%', fontFamily: 'inherit',
                          transition: 'background 0.15s',
                        }}
                      >
                        {item.image_url && (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={item.image_url}
                            alt={item.name}
                            style={{
                              width: 52, height: 52, borderRadius: 10,
                              objectFit: 'cover', flexShrink: 0,
                            }}
                          />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 14, fontWeight: 600, color: T.text, margin: 0 }}>
                            {item.name}
                          </p>
                          {item.description && (
                            <p style={{
                              fontSize: 11, color: T.text2, margin: '3px 0 0',
                              lineHeight: 1.3, overflow: 'hidden',
                              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                            } as React.CSSProperties}>
                              {item.description}
                            </p>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                          <span style={{
                            fontSize: 15, fontWeight: 800, color: T.amber,
                            fontFamily: 'monospace',
                          }}>
                            {item.price.toFixed(2)}{'\u20AC'}
                          </span>
                          {qty > 0 && (
                            <span style={{
                              fontSize: 11, fontWeight: 700, color: T.bg,
                              background: T.amber, borderRadius: 10,
                              width: 22, height: 22, display: 'flex',
                              alignItems: 'center', justifyContent: 'center',
                            }}>
                              {qty}
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Floating cart bar */}
          {cartCount > 0 && (
            <div style={{
              position: 'fixed', bottom: 0, left: 0, right: 0,
              padding: '12px 20px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
              background: T.surface,
              borderTop: `1px solid ${T.border}`,
              zIndex: 100,
            }}>
              <button
                onClick={() => setStep('review')}
                style={{
                  width: '100%', maxWidth: 480, margin: '0 auto', display: 'flex',
                  alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 20px', borderRadius: 14,
                  background: 'linear-gradient(135deg, #F0A84E, #E8923A)',
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  boxShadow: '0 4px 20px rgba(240,168,78,0.35)',
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 700, color: T.bg }}>
                  {cartCount} {cartCount === 1 ? 'producto' : 'productos'}
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, color: T.bg }}>
                  Ver pedido &middot; {cartTotal.toFixed(2)}{'\u20AC'}
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── Step 3: Review ───────────────────────────────────── */}
      {step === 'review' && (
        <div style={{ padding: '20px' }}>
          <button
            onClick={() => setStep('menu')}
            style={{
              background: 'transparent', border: 'none', color: T.amber,
              fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: '4px 0',
              marginBottom: 16, fontFamily: 'inherit',
            }}
          >
            &larr; Anadir mas
          </button>

          <h2 style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 20 }}>
            Tu pedido
          </h2>

          {/* Items */}
          <div style={{
            background: T.surface, borderRadius: 16,
            border: `1px solid ${T.border}`, overflow: 'hidden',
            marginBottom: 20,
          }}>
            {cart.map((item, idx) => (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 16px',
                borderBottom: idx < cart.length - 1 ? `1px solid ${T.border}` : 'none',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: T.text, margin: 0 }}>
                    {item.name}
                  </p>
                  <p style={{ fontSize: 12, color: T.text3, margin: '2px 0 0' }}>
                    {item.price.toFixed(2)}{'\u20AC'} / ud.
                  </p>
                </div>

                {/* Quantity controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={() => item.quantity === 1 ? removeFromCart(item.id) : updateQuantity(item.id, -1)}
                    style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: item.quantity === 1 ? 'rgba(248,113,113,0.1)' : T.surface2,
                      border: `1px solid ${item.quantity === 1 ? 'rgba(248,113,113,0.3)' : T.border}`,
                      color: item.quantity === 1 ? T.red : T.text,
                      fontSize: 16, cursor: 'pointer', fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {item.quantity === 1 ? '\u00D7' : '\u2212'}
                  </button>
                  <span style={{
                    fontSize: 15, fontWeight: 700, color: T.text,
                    width: 24, textAlign: 'center',
                  }}>
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(item.id, 1)}
                    style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: T.amberDim,
                      border: `1px solid ${T.amberBorder}`,
                      color: T.amber,
                      fontSize: 16, cursor: 'pointer', fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    +
                  </button>
                </div>

                {/* Subtotal */}
                <span style={{
                  fontSize: 14, fontWeight: 800, color: T.amber,
                  fontFamily: 'monospace', width: 60, textAlign: 'right', flexShrink: 0,
                }}>
                  {(item.price * item.quantity).toFixed(2)}{'\u20AC'}
                </span>
              </div>
            ))}
          </div>

          {/* Optional fields */}
          <div style={{
            background: T.surface, borderRadius: 16,
            border: `1px solid ${T.border}`, padding: '16px',
            marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: T.text2, marginBottom: 6, display: 'block' }}>
                Tu nombre (opcional)
              </label>
              <input
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="Para saber a quien servir"
                maxLength={60}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 10,
                  background: T.surface2, border: `1px solid ${T.border}`,
                  color: T.text, fontSize: 14, fontFamily: 'inherit',
                  outline: 'none',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: T.text2, marginBottom: 6, display: 'block' }}>
                Notas (alergias, sin gluten, etc.)
              </label>
              <textarea
                value={orderNotes}
                onChange={e => setOrderNotes(e.target.value)}
                placeholder="Escribe aqui cualquier indicacion"
                maxLength={500}
                rows={2}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 10,
                  background: T.surface2, border: `1px solid ${T.border}`,
                  color: T.text, fontSize: 14, fontFamily: 'inherit',
                  outline: 'none', resize: 'none',
                }}
              />
            </div>
          </div>

          {/* Total */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '16px 20px', background: T.surface, borderRadius: 14,
            border: `1px solid ${T.amberBorder}`, marginBottom: 20,
          }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Total</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: T.amber, fontFamily: 'monospace' }}>
              {cartTotal.toFixed(2)}{'\u20AC'}
            </span>
          </div>

          {error && (
            <p style={{
              fontSize: 13, color: T.red, textAlign: 'center',
              marginBottom: 12, padding: '8px', background: 'rgba(248,113,113,0.08)',
              borderRadius: 8,
            }}>
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            onClick={submitOrder}
            disabled={sending || cart.length === 0}
            style={{
              width: '100%', padding: '16px',
              borderRadius: 14,
              background: sending ? T.text3 : 'linear-gradient(135deg, #F0A84E, #E8923A)',
              border: 'none', color: T.bg,
              fontSize: 16, fontWeight: 800,
              cursor: sending ? 'wait' : 'pointer',
              fontFamily: 'inherit',
              boxShadow: sending ? 'none' : '0 4px 20px rgba(240,168,78,0.35)',
              opacity: sending ? 0.7 : 1,
            }}
          >
            {sending ? 'Enviando...' : 'Confirmar pedido'}
          </button>

          <p style={{ fontSize: 11, color: T.text3, textAlign: 'center', marginTop: 10 }}>
            El pago se realiza en mesa
          </p>
        </div>
      )}

      {/* ─── Step 4: Done ─────────────────────────────────────── */}
      {step === 'done' && (
        <div style={{
          padding: '60px 20px', textAlign: 'center',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'rgba(52,211,153,0.12)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 24,
          }}>
            <span style={{ fontSize: 40 }}>{'\u2705'}</span>
          </div>

          <h2 style={{ fontSize: 24, fontWeight: 800, color: T.text, marginBottom: 8 }}>
            Pedido enviado
          </h2>
          <p style={{ fontSize: 15, color: T.text2, marginBottom: 8, lineHeight: 1.5 }}>
            Tu pedido esta en camino a cocina
          </p>
          {mesa && (
            <p style={{
              fontSize: 14, color: T.amber, fontWeight: 600,
              background: T.amberDim, display: 'inline-block',
              padding: '6px 18px', borderRadius: 20, marginBottom: 24,
            }}>
              Mesa {mesa}
            </p>
          )}

          <p style={{ fontSize: 13, color: T.text3, marginBottom: 32 }}>
            El equipo preparara tu pedido en breve.
            <br />
            El pago se realiza directamente en mesa.
          </p>

          <button
            onClick={resetOrder}
            style={{
              padding: '14px 32px', borderRadius: 14,
              background: T.amberDim,
              border: `1px solid ${T.amberBorder}`,
              color: T.amber, fontSize: 15, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Hacer otro pedido
          </button>
        </div>
      )}

      {/* Footer */}
      <div style={{
        textAlign: 'center', padding: '20px',
        borderTop: `1px solid ${T.border}`,
        color: T.text3, fontSize: 11,
        marginTop: step === 'done' ? 40 : 0,
      }}>
        Powered by Reservo.AI
      </div>
    </div>
  )
}
