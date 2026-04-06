'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

/* ── Types ─────────────────────────────────────────────────────── */

interface MenuItem {
  id: string
  name: string
  price: number
  category: string
  description?: string
  image_url?: string
  availability_type?: string
  daily_limit?: number
  featured?: boolean
  featured_label?: string
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
  whatsapp_phone?: string
}

interface BillItem {
  name: string
  price: number
  quantity: number
  source: string
}

interface Props {
  tenant: TenantInfo
  items: MenuItem[]
  mesa: string | null
  zone: string | null
  slug: string
  dailyCounts?: Record<string, number>
  justPaid?: boolean
}

/* ── Design tokens ─────────────────────────────────────────────── */

const T = {
  bg: '#0C1018',
  surface: '#131920',
  surface2: '#1A2230',
  amber: '#F0A84E',
  amberDim: 'rgba(240,168,78,0.10)',
  amberBorder: 'rgba(240,168,78,0.25)',
  teal: '#2DD4BF',
  tealDim: 'rgba(45,212,191,0.10)',
  green: '#34D399',
  greenDim: 'rgba(52,211,153,0.10)',
  red: '#F87171',
  redDim: 'rgba(248,113,113,0.08)',
  violet: '#A78BFA',
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

const CATEGORY_BOOST: Record<string, string[]> = {
  comer: ['Entrantes', 'Primeros', 'Segundos', 'Principales', 'Postres'],
  cenar: ['Entrantes', 'Principales', 'Segundos', 'Postres'],
  picoteo: ['Tapas', 'Raciones', 'Entrantes', 'Aperitivos', 'Snacks'],
  bebidas: ['Bebidas', 'Cervezas', 'Vinos', 'Refrescos', 'Cocktails', 'Cafes'],
}

/* ── Component ───────────────────────────────────────────────── */

export default function OrderFlow({ tenant, items: initialItems, mesa, zone, slug, dailyCounts: initialCounts, justPaid }: Props) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [step, setStep] = useState<'context' | 'menu' | 'review' | 'done'>('context')
  const [context, setContext] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [orderNotes, setOrderNotes] = useState('')
  const [sending, setSending] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'carta' | 'cuenta'>(justPaid ? 'cuenta' : 'carta')

  // Live items (can update via realtime)
  const [liveItems, setLiveItems] = useState<MenuItem[]>(initialItems)
  const [liveCounts, setLiveCounts] = useState<Record<string, number>>(initialCounts || {})

  // Bill state
  const [bill, setBill] = useState<{ items: BillItem[]; total: number; paid: boolean; payment_enabled: boolean } | null>(null)
  const [billLoading, setBillLoading] = useState(false)

  // Payment state
  const [paymentLoading, setPaymentLoading] = useState(false)

  // Filter unavailable items
  const availableItems = useMemo(() => {
    return liveItems.filter(item => {
      if (item.availability_type === 'unavailable') return false
      if (item.availability_type === 'limited_daily' && item.daily_limit) {
        const used = liveCounts[item.id] || 0
        if (used >= item.daily_limit) return false
      }
      return true
    })
  }, [liveItems, liveCounts])

  // Featured items
  const featuredItems = useMemo(() =>
    availableItems.filter(i => i.featured), [availableItems])

  // Group available items by category, sorted by context
  const { categories, categoryNames } = useMemo(() => {
    const cats: Record<string, MenuItem[]> = {}
    for (const item of availableItems) {
      if (item.featured) continue // shown separately
      const cat = item.category || 'Otros'
      if (!cats[cat]) cats[cat] = []
      cats[cat].push(item)
    }
    let names = Object.keys(cats)
    if (context && CATEGORY_BOOST[context]) {
      const boost = CATEGORY_BOOST[context]
      names.sort((a, b) => {
        const aIdx = boost.findIndex(b2 => a.toLowerCase().includes(b2.toLowerCase()))
        const bIdx = boost.findIndex(b2 => b.toLowerCase().includes(b2.toLowerCase()))
        return (aIdx >= 0 ? aIdx : 999) - (bIdx >= 0 ? bIdx : 999)
      })
    }
    return { categories: cats, categoryNames: names }
  }, [availableItems, context])

  // Cart helpers
  const cartTotal = cart.reduce((s, c) => s + c.price * c.quantity, 0)
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0)

  function addToCart(item: MenuItem) {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id)
      if (existing) return prev.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)
      return [...prev, { id: item.id, name: item.name, price: item.price, quantity: 1 }]
    })
  }

  function updateQuantity(id: string, delta: number) {
    setCart(prev => prev.map(c => {
      if (c.id !== id) return c
      const newQ = c.quantity + delta
      return newQ > 0 ? { ...c, quantity: newQ } : c
    }).filter(c => c.quantity > 0))
  }

  function removeFromCart(id: string) {
    setCart(prev => prev.filter(c => c.id !== id))
  }

  function getCartQty(id: string): number {
    return cart.find(c => c.id === id)?.quantity || 0
  }

  // Load bill for table
  const loadBill = useCallback(async () => {
    if (!mesa) return
    setBillLoading(true)
    try {
      const res = await fetch(`/api/orders/table-bill?slug=${slug}&mesa=${mesa}`)
      if (res.ok) {
        const data = await res.json()
        setBill(data)
      }
    } catch { /* ignore */ }
    setBillLoading(false)
  }, [slug, mesa])

  // Load bill when switching to cuenta tab
  useEffect(() => {
    if (tab === 'cuenta' && mesa) loadBill()
  }, [tab, mesa, loadBill])

  // Supabase client for realtime (created once, reused)
  const sbRef = useRef<ReturnType<typeof createClient> | null>(null)
  if (!sbRef.current && typeof window !== 'undefined') {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (url && key) sbRef.current = createClient(url, key)
  }

  // Realtime: refresh items when menu_items change (availability toggled from kitchen/dashboard)
  useEffect(() => {
    const sb = sbRef.current
    if (!sb) return

    const ch = sb.channel('qr-menu-' + tenant.id)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'menu_items',
        filter: `tenant_id=eq.${tenant.id}`,
      }, async () => {
        const { data } = await sb.from('menu_items')
          .select('id, name, price, category, description, image_url, availability_type, daily_limit, featured, featured_label')
          .eq('tenant_id', tenant.id).eq('active', true)
          .order('category').order('sort_order')
        if (data) setLiveItems(data)
      })
      .subscribe()

    return () => { sb.removeChannel(ch) }
  }, [tenant.id])

  // Realtime: refresh bill when orders change (waiter adds items from TPV)
  useEffect(() => {
    const sb = sbRef.current
    if (!sb || !mesa) return

    const ch = sb.channel('qr-bill-' + tenant.id)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'order_events',
        filter: `tenant_id=eq.${tenant.id}`,
      }, () => { if (tab === 'cuenta') loadBill() })
      .subscribe()

    return () => { sb.removeChannel(ch) }
  }, [tenant.id, mesa, tab, loadBill])

  async function submitOrder() {
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/orders/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, mesa, items: cart, customer_name: customerName || undefined, notes: orderNotes || undefined, context }),
      })
      if (res.ok) {
        setStep('done')
      } else {
        const d = await res.json().catch(() => ({}))
        setError(d.error || 'Error al enviar pedido')
      }
    } catch {
      setError('Error de conexi\u00f3n')
    }
    setSending(false)
  }

  async function startPayment() {
    if (!mesa || !bill) return
    setPaymentLoading(true)
    try {
      const res = await fetch('/api/orders/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, mesa, customer_name: customerName || undefined }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.url) {
          window.location.href = data.url // Redirect to Stripe Checkout
          return
        }
      }
      const err = await res.json().catch(() => ({}))
      setError(err.error || 'Error al iniciar el pago')
    } catch {
      setError('Error de conexi\u00f3n')
    }
    setPaymentLoading(false)
  }

  function resetOrder() {
    setCart([])
    setStep('context')
    setContext('')
    setCustomerName('')
    setOrderNotes('')
    setError('')
  }

  // ── Render helpers ────────────────────────────────────────────

  function renderItemCard(item: MenuItem) {
    const qty = getCartQty(item.id)
    return (
      <button key={item.id} onClick={() => addToCart(item)} style={{
        display: 'flex', gap: 12, padding: '12px 14px',
        background: qty > 0 ? 'rgba(240,168,78,0.06)' : T.surface,
        borderRadius: 14, border: `1px solid ${qty > 0 ? T.amberBorder : T.border}`,
        alignItems: 'center', cursor: 'pointer', textAlign: 'left',
        width: '100%', fontFamily: 'inherit', transition: 'background 0.15s',
      }}>
        {item.image_url && (
          <img src={item.image_url} alt={item.name} style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: T.text, margin: 0 }}>{item.name}</p>
          {item.description && (
            <p style={{ fontSize: 11, color: T.text2, margin: '3px 0 0', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as React.CSSProperties}>
              {item.description}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: T.amber, fontFamily: 'monospace' }}>
            {item.price.toFixed(2)}\u20AC
          </span>
          {qty > 0 && (
            <span style={{ fontSize: 11, fontWeight: 700, color: T.bg, background: T.amber, borderRadius: 10, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {qty}
            </span>
          )}
        </div>
      </button>
    )
  }

  // ── Main render ───────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: 480, margin: '0 auto', position: 'relative' }}>

      {/* Header */}
      <div style={{ padding: '20px 20px 12px', background: `linear-gradient(180deg, ${T.surface} 0%, ${T.bg} 100%)`, borderBottom: `1px solid ${T.border}`, textAlign: 'center' }}>
        {tenant.logo_url && (
          <img src={tenant.logo_url} alt={tenant.name} style={{ width: 44, height: 44, borderRadius: 11, objectFit: 'cover', marginBottom: 6 }} />
        )}
        <h1 style={{ fontSize: 20, fontWeight: 800, color: T.text, letterSpacing: '-0.02em', margin: 0 }}>{tenant.name}</h1>
        {mesa && (
          <p style={{ fontSize: 13, color: T.amber, fontWeight: 600, marginTop: 6, background: T.amberDim, display: 'inline-block', padding: '4px 14px', borderRadius: 20 }}>
            Mesa {mesa}{zone ? ` \u00b7 ${zone}` : ''}
          </p>
        )}
      </div>

      {/* Tab bar (only when mesa exists and not in review/done) */}
      {mesa && step !== 'review' && step !== 'done' && (
        <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, background: T.surface }}>
          <button onClick={() => setTab('carta')} style={{
            flex: 1, padding: '12px', background: 'none', border: 'none', cursor: 'pointer',
            color: tab === 'carta' ? T.amber : T.text3, fontWeight: 700, fontSize: 13,
            borderBottom: tab === 'carta' ? `2px solid ${T.amber}` : '2px solid transparent',
            fontFamily: 'inherit', transition: 'all 0.15s',
          }}>Carta</button>
          <button onClick={() => setTab('cuenta')} style={{
            flex: 1, padding: '12px', background: 'none', border: 'none', cursor: 'pointer',
            color: tab === 'cuenta' ? T.amber : T.text3, fontWeight: 700, fontSize: 13,
            borderBottom: tab === 'cuenta' ? `2px solid ${T.amber}` : '2px solid transparent',
            fontFamily: 'inherit', transition: 'all 0.15s',
          }}>Tu cuenta</button>
        </div>
      )}

      {/* ─── CUENTA TAB ────────────────────────────────────── */}
      {tab === 'cuenta' && mesa && step !== 'review' && step !== 'done' && (
        <div style={{ padding: '20px' }}>
          {billLoading && !bill ? (
            <p style={{ textAlign: 'center', color: T.text3, padding: '40px 0' }}>Cargando cuenta...</p>
          ) : !bill || bill.items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <p style={{ fontSize: 40, marginBottom: 12 }}>\uD83C\uDF7D\uFE0F</p>
              <p style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 6 }}>Sin consumos a\u00fan</p>
              <p style={{ fontSize: 13, color: T.text2 }}>Los pedidos que hagas aparecer\u00e1n aqu\u00ed</p>
            </div>
          ) : (
            <>
              {/* Bill items */}
              <div style={{ background: T.surface, borderRadius: 16, border: `1px solid ${T.border}`, overflow: 'hidden', marginBottom: 16 }}>
                {bill.items.map((item, idx) => (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'center', padding: '12px 16px',
                    borderBottom: idx < bill.items.length - 1 ? `1px solid ${T.border}` : 'none',
                  }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: T.text, margin: 0 }}>{item.name}</p>
                      <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                        <span style={{ fontSize: 11, color: T.text3 }}>{item.quantity}x {item.price.toFixed(2)}\u20AC</span>
                        <span style={{ fontSize: 10, color: item.source === 'qr' ? T.teal : T.violet, background: item.source === 'qr' ? T.tealDim : 'rgba(167,139,250,0.10)', padding: '0 6px', borderRadius: 4 }}>
                          {item.source === 'qr' ? 'QR' : 'Camarero'}
                        </span>
                      </div>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 800, color: T.amber, fontFamily: 'monospace' }}>
                      {(item.price * item.quantity).toFixed(2)}\u20AC
                    </span>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '16px 20px', background: T.surface, borderRadius: 14,
                border: `1px solid ${T.amberBorder}`, marginBottom: 20,
              }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Total</span>
                <span style={{ fontSize: 24, fontWeight: 800, color: T.amber, fontFamily: 'monospace' }}>
                  {bill.total.toFixed(2)}\u20AC
                </span>
              </div>

              {/* Payment section */}
              {bill.paid ? (
                <div style={{ textAlign: 'center', padding: '20px', background: T.greenDim, borderRadius: 14, border: `1px solid rgba(52,211,153,0.25)` }}>
                  <p style={{ fontSize: 16, fontWeight: 700, color: T.green }}>\u2713 Cuenta pagada</p>
                </div>
              ) : bill.payment_enabled ? (
                <div>
                  {error && (
                    <p style={{ fontSize: 13, color: T.red, textAlign: 'center', marginBottom: 12, padding: '8px', background: T.redDim, borderRadius: 8 }}>{error}</p>
                  )}
                  <button onClick={startPayment} disabled={paymentLoading} style={{
                    width: '100%', padding: '16px', borderRadius: 14,
                    background: paymentLoading ? T.text3 : 'linear-gradient(135deg, #F0A84E, #E8923A)',
                    border: 'none', color: T.bg, fontSize: 16, fontWeight: 800,
                    cursor: paymentLoading ? 'wait' : 'pointer', fontFamily: 'inherit',
                    boxShadow: paymentLoading ? 'none' : '0 4px 20px rgba(240,168,78,0.35)',
                    opacity: paymentLoading ? 0.7 : 1, marginBottom: 10,
                  }}>
                    {paymentLoading ? 'Preparando pago...' : `Pagar ${bill.total.toFixed(2)}\u20AC`}
                  </button>
                  <p style={{ fontSize: 12, color: T.text3, textAlign: 'center' }}>
                    Pago seguro con tarjeta \u00b7 Tambi\u00e9n puedes pagar en mesa
                  </p>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '16px', background: T.surface, borderRadius: 14, border: `1px solid ${T.border}` }}>
                  <p style={{ fontSize: 14, color: T.text2 }}>El pago se realiza en mesa</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ─── CARTA TAB / STEPS ─────────────────────────────── */}
      {(tab === 'carta' || !mesa) && (
        <>
          {/* Step 1: Context */}
          {step === 'context' && (
            <div style={{ padding: '28px 20px' }}>
              {/* Barra: pedir nombre antes de seguir */}
              {!mesa && (
                <div style={{ marginBottom: 24 }}>
                  <p style={{ fontSize: 13, color: T.amber, fontWeight: 600, textAlign: 'center', marginBottom: 12, background: T.amberDim, padding: '8px 14px', borderRadius: 10, display: 'inline-block', width: '100%' }}>
                    Pedido en barra
                  </p>
                  <label style={{ fontSize: 13, fontWeight: 600, color: T.text2, marginBottom: 6, display: 'block' }}>
                    Tu nombre (para saber de qui\u00e9n es el pedido)
                  </label>
                  <input
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder="Ej: Juan, Ana, Carlos..."
                    maxLength={40}
                    autoFocus
                    style={{
                      width: '100%', padding: '12px 14px', borderRadius: 10,
                      background: T.surface, border: `1px solid ${customerName.trim() ? T.amberBorder : T.border}`,
                      color: T.text, fontSize: 15, fontFamily: 'inherit', outline: 'none',
                    }}
                  />
                </div>
              )}

              <h2 style={{ fontSize: 20, fontWeight: 700, color: T.text, textAlign: 'center', marginBottom: 6 }}>
                {mesa ? '\u00bfQu\u00e9 os apetece?' : '\u00bfQu\u00e9 te pido?'}
              </h2>
              <p style={{ fontSize: 14, color: T.text2, textAlign: 'center', marginBottom: 24 }}>
                {mesa ? 'Ordenamos la carta para vosotros' : 'Elige lo que quieras'}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {CONTEXTS.map(c => (
                  <button key={c.key} disabled={!mesa && !customerName.trim()} onClick={() => { setContext(c.key); setStep('menu') }} style={{
                    padding: '26px 16px', borderRadius: 16, background: T.surface,
                    border: `1px solid ${T.border}`, cursor: !mesa && !customerName.trim() ? 'not-allowed' : 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                    transition: 'transform 0.15s, border-color 0.15s', fontFamily: 'inherit',
                    opacity: !mesa && !customerName.trim() ? 0.4 : 1,
                  }}>
                    <span style={{ fontSize: 34 }}>{c.emoji}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{c.label}</span>
                  </button>
                ))}
              </div>
              <button disabled={!mesa && !customerName.trim()} onClick={() => setStep('menu')} style={{
                marginTop: 16, width: '100%', padding: '12px', borderRadius: 12,
                background: 'transparent', border: `1px solid ${T.border}`,
                color: T.text3, fontSize: 13, cursor: !mesa && !customerName.trim() ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', opacity: !mesa && !customerName.trim() ? 0.4 : 1,
              }}>Ver toda la carta</button>
            </div>
          )}

          {/* Step 2: Menu */}
          {step === 'menu' && (
            <div style={{ paddingBottom: cartCount > 0 ? 90 : 20 }}>
              {/* Featured section */}
              {featuredItems.length > 0 && (
                <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 16 }}>\u2B50</span>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: T.amber, margin: 0 }}>Especiales</h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {featuredItems.map(item => (
                      <div key={item.id} style={{ position: 'relative' }}>
                        {renderItemCard(item)}
                        {item.featured_label && (
                          <span style={{
                            position: 'absolute', top: 6, right: 6, fontSize: 9, fontWeight: 700,
                            color: T.amber, background: T.amberDim, padding: '2px 8px', borderRadius: 6,
                            border: `1px solid ${T.amberBorder}`,
                          }}>{item.featured_label}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
                      <button key={cat} onClick={() => {
                        setActiveCategory(isActive ? null : cat)
                        const el = document.getElementById(`cat-${cat.replace(/\s+/g, '-')}`)
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }} style={{
                        padding: '8px 16px', borderRadius: 20,
                        background: isActive ? T.amberDim : 'transparent',
                        border: `1px solid ${isActive ? T.amberBorder : T.border}`,
                        color: isActive ? T.amber : T.text2,
                        fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0,
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}>{cat}</button>
                    )
                  })}
                </div>
              )}

              {/* Items by category */}
              <div style={{ padding: '16px 20px' }}>
                {availableItems.length === 0 && (
                  <p style={{ textAlign: 'center', color: T.text2, padding: '40px 0', fontSize: 15 }}>
                    La carta se est\u00e1 preparando...
                  </p>
                )}
                {categoryNames.map(cat => (
                  <div key={cat} id={`cat-${cat.replace(/\s+/g, '-')}`} style={{ marginBottom: 28 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: T.amber, marginBottom: 12, paddingBottom: 6, borderBottom: `1px solid ${T.amberBorder}` }}>
                      {cat}
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {categories[cat].map(item => renderItemCard(item))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Floating cart bar */}
              {cartCount > 0 && (
                <div style={{
                  position: 'fixed', bottom: 0, left: 0, right: 0,
                  padding: '12px 20px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
                  background: T.surface, borderTop: `1px solid ${T.border}`, zIndex: 100,
                }}>
                  <button onClick={() => setStep('review')} style={{
                    width: '100%', maxWidth: 480, margin: '0 auto', display: 'flex',
                    alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 20px', borderRadius: 14,
                    background: 'linear-gradient(135deg, #F0A84E, #E8923A)',
                    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    boxShadow: '0 4px 20px rgba(240,168,78,0.35)',
                  }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: T.bg }}>{cartCount} {cartCount === 1 ? 'producto' : 'productos'}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: T.bg }}>Ver pedido \u00b7 {cartTotal.toFixed(2)}\u20AC</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Review */}
          {step === 'review' && (
            <div style={{ padding: '20px' }}>
              <button onClick={() => setStep('menu')} style={{
                background: 'transparent', border: 'none', color: T.amber,
                fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: '4px 0',
                marginBottom: 16, fontFamily: 'inherit',
              }}>\u2190 A\u00f1adir m\u00e1s</button>

              <h2 style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 20 }}>Tu pedido</h2>

              {/* Items */}
              <div style={{ background: T.surface, borderRadius: 16, border: `1px solid ${T.border}`, overflow: 'hidden', marginBottom: 20 }}>
                {cart.map((item, idx) => (
                  <div key={item.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                    borderBottom: idx < cart.length - 1 ? `1px solid ${T.border}` : 'none',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: T.text, margin: 0 }}>{item.name}</p>
                      <p style={{ fontSize: 12, color: T.text3, margin: '2px 0 0' }}>{item.price.toFixed(2)}\u20AC / ud.</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button onClick={() => item.quantity === 1 ? removeFromCart(item.id) : updateQuantity(item.id, -1)}
                        style={{ width: 32, height: 32, borderRadius: 8, background: item.quantity === 1 ? T.redDim : T.surface2, border: `1px solid ${item.quantity === 1 ? 'rgba(248,113,113,0.3)' : T.border}`, color: item.quantity === 1 ? T.red : T.text, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {item.quantity === 1 ? '\u00D7' : '\u2212'}
                      </button>
                      <span style={{ fontSize: 15, fontWeight: 700, color: T.text, width: 24, textAlign: 'center' }}>{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, 1)}
                        style={{ width: 32, height: 32, borderRadius: 8, background: T.amberDim, border: `1px solid ${T.amberBorder}`, color: T.amber, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 800, color: T.amber, fontFamily: 'monospace', width: 60, textAlign: 'right', flexShrink: 0 }}>
                      {(item.price * item.quantity).toFixed(2)}\u20AC
                    </span>
                  </div>
                ))}
              </div>

              {/* Optional fields */}
              <div style={{ background: T.surface, borderRadius: 16, border: `1px solid ${T.border}`, padding: '16px', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: T.text2, marginBottom: 6, display: 'block' }}>Tu nombre (opcional)</label>
                  <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Para saber a qui\u00e9n servir" maxLength={60}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: T.text2, marginBottom: 6, display: 'block' }}>Notas (alergias, sin gluten, etc.)</label>
                  <textarea value={orderNotes} onChange={e => setOrderNotes(e.target.value)} placeholder="Escribe aqu\u00ed cualquier indicaci\u00f3n" maxLength={500} rows={2}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, background: T.surface2, border: `1px solid ${T.border}`, color: T.text, fontSize: 14, fontFamily: 'inherit', outline: 'none', resize: 'none' }} />
                </div>
              </div>

              {/* Total */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: T.surface, borderRadius: 14, border: `1px solid ${T.amberBorder}`, marginBottom: 20 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Total</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: T.amber, fontFamily: 'monospace' }}>{cartTotal.toFixed(2)}\u20AC</span>
              </div>

              {error && (
                <p style={{ fontSize: 13, color: T.red, textAlign: 'center', marginBottom: 12, padding: '8px', background: T.redDim, borderRadius: 8 }}>{error}</p>
              )}

              <button onClick={submitOrder} disabled={sending || cart.length === 0} style={{
                width: '100%', padding: '16px', borderRadius: 14,
                background: sending ? T.text3 : 'linear-gradient(135deg, #F0A84E, #E8923A)',
                border: 'none', color: T.bg, fontSize: 16, fontWeight: 800,
                cursor: sending ? 'wait' : 'pointer', fontFamily: 'inherit',
                boxShadow: sending ? 'none' : '0 4px 20px rgba(240,168,78,0.35)',
                opacity: sending ? 0.7 : 1,
              }}>
                {sending ? 'Enviando...' : 'Confirmar pedido'}
              </button>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 'done' && (
            <div style={{ padding: '40px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: T.greenDim, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                <span style={{ fontSize: 36 }}>\u2705</span>
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: T.text, marginBottom: 6 }}>Pedido enviado</h2>
              <p style={{ fontSize: 14, color: T.text2, marginBottom: 16 }}>Tu pedido est\u00e1 en camino a cocina</p>

              {/* Order summary */}
              <div style={{ background: T.surface, borderRadius: 14, border: `1px solid ${T.border}`, padding: '14px 16px', marginBottom: 20, width: '100%', textAlign: 'left' }}>
                {cart.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span style={{ fontSize: 13, color: T.text }}>{item.quantity}x {item.name}</span>
                    <span style={{ fontSize: 13, color: T.amber, fontFamily: 'monospace', fontWeight: 700 }}>{(item.price * item.quantity).toFixed(2)}\u20AC</span>
                  </div>
                ))}
                <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Total</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: T.amber, fontFamily: 'monospace' }}>{cartTotal.toFixed(2)}\u20AC</span>
                </div>
              </div>

              {mesa && (
                <p style={{ fontSize: 13, color: T.amber, fontWeight: 600, background: T.amberDim, display: 'inline-block', padding: '6px 18px', borderRadius: 20, marginBottom: 20 }}>
                  Mesa {mesa}{zone ? ` \u00b7 ${zone}` : ''}
                </p>
              )}

              <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                <button onClick={resetOrder} style={{
                  flex: 1, padding: '14px', borderRadius: 14, background: T.amberDim,
                  border: `1px solid ${T.amberBorder}`, color: T.amber, fontSize: 14, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>Pedir m\u00e1s</button>
                {mesa && (
                  <button onClick={() => { setTab('cuenta'); setStep('context') }} style={{
                    flex: 1, padding: '14px', borderRadius: 14, background: T.surface,
                    border: `1px solid ${T.border}`, color: T.text, fontSize: 14, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>Ver cuenta</button>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '20px', borderTop: `1px solid ${T.border}`, color: T.text3, fontSize: 11, marginTop: step === 'done' ? 20 : 0 }}>
        Carta digital by Reservo.AI
      </div>
    </div>
  )
}
