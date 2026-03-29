'use client'
import { UpgradeGate } from '@/components/UpgradeGate'
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { PageSkeleton } from '@/components/ui'
import { useTenant } from '@/contexts/TenantContext'
import { C } from '@/lib/colors'
import { getTPVLayout } from '@/lib/tpv-engine'
import type { MenuItem, TPVLayout, SaleRecord } from '@/lib/tpv-engine'

/* ── CSS injected once ──────────────────────────────────────────────── */
const TPV_STYLES = `
.tpv-product {
  transition: all 0.12s;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.tpv-product:active {
  transform: scale(0.95);
  opacity: 0.8;
}
.tpv-flash {
  animation: tpv-pulse 0.3s ease-out;
}
@keyframes tpv-pulse {
  0% { box-shadow: 0 0 0 0 rgba(240,168,78,0.5); }
  100% { box-shadow: 0 0 0 12px rgba(240,168,78,0); }
}
`

/* ── Types ──────────────────────────────────────────────────────────── */
interface TPVItem {
  id: string
  name: string
  price: number
  quantity: number
}

interface ParkedOrder {
  id: string
  customer_name: string
  items: TPVItem[]
  total_estimate: number
  created_at: string
  notes: string
  order_type: string
}

/* ── Component ─────────────────────────────────────────────────────── */
export default function TPVPage() {
  const { template } = useTenant()
  const [loading, setLoading] = useState(true)
  const [tid, setTid] = useState<string | null>(null)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [layout, setLayout] = useState<TPVLayout | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>('')
  const [search, setSearch] = useState('')
  const [order, setOrder] = useState<TPVItem[]>([])
  const [parked, setParked] = useState<ParkedOrder[]>([])
  const [parkedOpen, setParkedOpen] = useState(false)
  const [showCobrar, setShowCobrar] = useState(false)
  const [cobroType, setCobroType] = useState<'barra' | 'mesa' | 'recoger' | 'domicilio'>('barra')
  const [cobroName, setCobroName] = useState('')
  const [cobroTable, setCobroTable] = useState('')
  const [cobroNotes, setCobroNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [showCustom, setShowCustom] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customPrice, setCustomPrice] = useState('')
  const flashRef = useRef<string | null>(null)
  const stylesInjected = useRef(false)

  // Inject styles once
  useEffect(() => {
    if (stylesInjected.current) return
    stylesInjected.current = true
    const style = document.createElement('style')
    style.textContent = TPV_STYLES
    document.head.appendChild(style)
    return () => { document.head.removeChild(style) }
  }, [])

  // Load tenant + menu items
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).maybeSingle()
      if (!p?.tenant_id) return
      setTid(p.tenant_id)

      const { data: items } = await supabase
        .from('menu_items')
        .select('*')
        .eq('tenant_id', p.tenant_id)
        .eq('active', true)

      const mi: MenuItem[] = (items || []).map((i: Record<string, unknown>) => ({
        id: i.id as string,
        name: i.name as string,
        price: Number(i.price) || 0,
        category: (i.category as string) || 'Otro',
        active: true,
      }))
      setMenuItems(mi)

      // Fetch sales history for intelligent layout
      let salesHistory: SaleRecord[] = []
      try {
        const { data: { session: authSession } } = await supabase.auth.getSession()
        const histRes = await fetch('/api/tpv/sales-history', {
          headers: authSession?.access_token ? { Authorization: 'Bearer ' + authSession.access_token } : {},
        })
        if (histRes.ok) {
          const histData = await histRes.json()
          salesHistory = histData.history || []
        }
      } catch { /* sales history is optional — layout works without it */ }

      const hour = new Date().getHours()
      const lyt = getTPVLayout(mi, hour, salesHistory)
      setLayout(lyt)
      if (lyt.categories.length > 0) {
        setActiveCategory(lyt.categories[0]!.name)
      }

      setLoading(false)
    })()
  }, [])

  // Load parked orders
  const loadParked = useCallback(async (tenantId: string) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const { data } = await supabase
      .from('order_events')
      .select('id,customer_name,items,total_estimate,created_at,notes,order_type')
      .eq('tenant_id', tenantId)
      .eq('status', 'collecting')
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false })
    setParked((data || []) as unknown as ParkedOrder[])
  }, [])

  useEffect(() => {
    if (tid) loadParked(tid)
  }, [tid, loadParked])

  // Computed
  const total = useMemo(() => order.reduce((s, i) => s + i.price * i.quantity, 0), [order])

  const filteredItems = useMemo(() => {
    if (!layout) return []
    if (search.trim()) {
      const q = search.toLowerCase()
      const all: { id: string; name: string; price: number }[] = []
      for (const cat of layout.categories) {
        for (const item of cat.items) {
          if (item.name.toLowerCase().includes(q)) all.push(item)
        }
      }
      return all
    }
    const cat = layout.categories.find(c => c.name === activeCategory)
    return cat?.items || []
  }, [layout, activeCategory, search])

  // Actions
  function addItem(item: { id: string; name: string; price: number }) {
    flashRef.current = item.id
    setTimeout(() => { flashRef.current = null }, 300)
    setOrder(prev => {
      const existing = prev.find(i => i.id === item.id)
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, { id: item.id, name: item.name, price: item.price, quantity: 1 }]
    })
  }

  function addCustomItem() {
    const price = parseFloat(customPrice.replace(',', '.'))
    if (!customName.trim() || isNaN(price) || price <= 0) return
    const id = 'custom-' + Date.now()
    setOrder(prev => [...prev, { id, name: customName.trim(), price, quantity: 1 }])
    setCustomName('')
    setCustomPrice('')
    setShowCustom(false)
  }

  function updateQty(id: string, delta: number) {
    setOrder(prev => {
      return prev.map(i => {
        if (i.id !== id) return i
        const newQty = i.quantity + delta
        return newQty > 0 ? { ...i, quantity: newQty } : i
      }).filter(i => i.quantity > 0)
    })
  }

  function removeItem(id: string) {
    setOrder(prev => prev.filter(i => i.id !== id))
  }

  async function cobrar() {
    if (!tid || order.length === 0) return
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: 'Bearer ' + session.access_token } : {}),
        },
        body: JSON.stringify({
          tenant_id: tid,
          customer_name: cobroName.trim() || 'TPV',
          order_type: cobroType,
          notes: [cobroTable ? `Mesa: ${cobroTable}` : '', cobroNotes].filter(Boolean).join(' | ') || 'TPV',
          items: order.map(i => ({ name: i.name, qty: i.quantity, price: i.price })),
          total_estimate: total,
        }),
      })

      if (res.ok) {
        // Now update status to confirmed
        const d = await res.json()
        if (d.order?.id) {
          await fetch('/api/orders', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              ...(session?.access_token ? { Authorization: 'Bearer ' + session.access_token } : {}),
            },
            body: JSON.stringify({ id: d.order.id, tenant_id: tid, status: 'confirmed' }),
          })

          // Harmonize: sync stock, notifications, and operational state
          fetch('/api/harmonize/order-created', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(session?.access_token ? { Authorization: 'Bearer ' + session.access_token } : {}),
            },
            body: JSON.stringify({ order_id: d.order.id }),
          }).catch(() => {})
        }
      }

      setOrder([])
      setShowCobrar(false)
      setCobroName('')
      setCobroTable('')
      setCobroNotes('')
      setCobroType('barra')
    } finally {
      setSaving(false)
    }
  }

  async function aparcar() {
    if (!tid || order.length === 0) return
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: 'Bearer ' + session.access_token } : {}),
        },
        body: JSON.stringify({
          tenant_id: tid,
          customer_name: 'TPV - aparcado',
          order_type: 'barra',
          notes: 'TPV - aparcado',
          items: order.map(i => ({ name: i.name, qty: i.quantity, price: i.price })),
          total_estimate: total,
        }),
      })
      setOrder([])
      if (tid) loadParked(tid)
    } finally {
      setSaving(false)
    }
  }

  function loadParkedOrder(po: ParkedOrder) {
    const items: TPVItem[] = Array.isArray(po.items)
      ? (po.items as unknown as { name: string; qty?: number; quantity?: number; price: number }[]).map((i, idx) => ({
          id: 'parked-' + idx + '-' + Date.now(),
          name: i.name,
          price: Number(i.price) || 0,
          quantity: Number(i.qty || i.quantity) || 1,
        }))
      : []
    setOrder(items)
    setParkedOpen(false)
    // Delete the parked order
    if (tid) {
      supabase.from('order_events').delete().eq('id', po.id).eq('tenant_id', tid).then(() => {
        loadParked(tid)
      })
    }
  }

  function cancelar() {
    setOrder([])
  }

  if (loading) return <PageSkeleton variant="cards" />

  if (template && !template.hasOrders) {
    return (
      <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 8 }}>Modulo no disponible</h2>
          <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6 }}>El TPV esta disponible para negocios de hosteleria.</p>
        </div>
      </div>
    )
  }

  return (
    <UpgradeGate feature="pedidos">
      <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

        {/* ── Main layout ─────────────────────────────────────────── */}
        <div style={{
          display: 'flex', flex: 1, gap: 0,
          flexDirection: 'row',
        }}>

          {/* ── LEFT: Product grid ──────────────────────────────────── */}
          <div style={{ flex: '0 0 65%', maxWidth: '65%', display: 'flex', flexDirection: 'column', borderRight: `1px solid ${C.border}` }}
               className="tpv-left">

            {/* Search bar */}
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar producto..."
                  style={{
                    width: '100%', padding: '12px 16px 12px 40px',
                    background: C.surface2, border: `1px solid ${C.border}`,
                    borderRadius: 12, color: C.text, fontSize: 15,
                    outline: 'none', fontFamily: 'inherit',
                  }}
                />
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: C.text3 }}>
                  🔍
                </span>
              </div>
              <button
                onClick={() => setShowCustom(true)}
                style={{
                  padding: '12px 16px', background: C.surface2,
                  border: `1px solid ${C.border}`, borderRadius: 12,
                  color: C.text2, fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
                }}
              >
                + Precio manual
              </button>
            </div>

            {/* Category tabs */}
            {!search.trim() && layout && (
              <div style={{
                display: 'flex', gap: 6, padding: '10px 16px',
                overflowX: 'auto', borderBottom: `1px solid ${C.border}`,
                WebkitOverflowScrolling: 'touch',
              }}>
                {layout.categories.map(cat => (
                  <button
                    key={cat.name}
                    onClick={() => setActiveCategory(cat.name)}
                    style={{
                      padding: '10px 20px', borderRadius: 10,
                      border: 'none', cursor: 'pointer',
                      fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap',
                      fontFamily: 'inherit',
                      background: activeCategory === cat.name
                        ? `linear-gradient(135deg, ${C.amber}, #E8923A)`
                        : C.surface2,
                      color: activeCategory === cat.name ? '#0C1018' : C.text2,
                      boxShadow: activeCategory === cat.name ? '0 2px 12px rgba(240,168,78,0.25)' : 'none',
                    }}
                  >
                    {cat.name} ({cat.items.length})
                  </button>
                ))}
              </div>
            )}

            {/* Product grid */}
            <div style={{
              flex: 1, overflow: 'auto', padding: 16,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: 10, alignContent: 'start',
            }}>
              {filteredItems.length === 0 ? (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: C.text3 }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
                  <p style={{ fontSize: 14 }}>
                    {search.trim() ? 'Sin resultados' : 'Sin productos en esta categoria'}
                  </p>
                </div>
              ) : (
                filteredItems.map(item => (
                  <button
                    key={item.id}
                    className={`tpv-product ${flashRef.current === item.id ? 'tpv-flash' : ''}`}
                    onClick={() => addItem(item)}
                    style={{
                      background: C.surface,
                      border: `1px solid ${C.border}`,
                      borderRadius: 14,
                      padding: '20px 12px',
                      cursor: 'pointer',
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                      gap: 8, minHeight: 100,
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 600, color: C.text, textAlign: 'center', lineHeight: 1.3 }}>
                      {item.name}
                    </span>
                    <span style={{
                      fontSize: 16, fontWeight: 700, color: C.amber,
                    }}>
                      {item.price.toFixed(2)}€
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* ── RIGHT: Order panel ──────────────────────────────────── */}
          <div style={{
            flex: '0 0 35%', maxWidth: '35%',
            display: 'flex', flexDirection: 'column',
            background: C.surface,
          }}
               className="tpv-right">

            {/* Parked orders */}
            {parked.length > 0 && (
              <div style={{ borderBottom: `1px solid ${C.border}` }}>
                <button
                  onClick={() => setParkedOpen(!parkedOpen)}
                  style={{
                    width: '100%', padding: '10px 16px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    fontFamily: 'inherit',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.amber }}>
                    🅿️ Pedidos aparcados ({parked.length})
                  </span>
                  <span style={{ fontSize: 12, color: C.text3 }}>{parkedOpen ? '▲' : '▼'}</span>
                </button>
                {parkedOpen && (
                  <div style={{ padding: '0 12px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {parked.map(po => {
                      const pitems = Array.isArray(po.items) ? po.items : []
                      return (
                        <button
                          key={po.id}
                          onClick={() => loadParkedOrder(po)}
                          style={{
                            background: C.surface2, border: `1px solid ${C.border}`,
                            borderRadius: 10, padding: '10px 14px',
                            cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                          }}
                        >
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                            {pitems.length} items - {(po.total_estimate || 0).toFixed(2)}€
                          </div>
                          <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>
                            {new Date(po.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Order header */}
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}` }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: 0 }}>
                Pedido actual
                {order.length > 0 && (
                  <span style={{ fontSize: 13, fontWeight: 500, color: C.text3, marginLeft: 8 }}>
                    ({order.reduce((s, i) => s + i.quantity, 0)} items)
                  </span>
                )}
              </h2>
            </div>

            {/* Order items */}
            <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
              {order.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 16px', color: C.text3 }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>🛒</div>
                  <p style={{ fontSize: 13 }}>Toca un producto para agregarlo</p>
                </div>
              ) : (
                order.map(item => (
                  <div key={item.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 16px',
                    borderBottom: `1px solid ${C.border}`,
                  }}>
                    {/* Name + unit price */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: 12, color: C.text3 }}>
                        {item.price.toFixed(2)}€
                      </div>
                    </div>

                    {/* Quantity controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button
                        onClick={() => updateQty(item.id, -1)}
                        style={{
                          width: 32, height: 32, borderRadius: 8,
                          background: C.surface2, border: `1px solid ${C.border}`,
                          color: C.text, fontSize: 16, fontWeight: 700,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: 'inherit',
                        }}
                      >
                        -
                      </button>
                      <span style={{ fontSize: 15, fontWeight: 700, color: C.text, width: 28, textAlign: 'center' }}>
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQty(item.id, 1)}
                        style={{
                          width: 32, height: 32, borderRadius: 8,
                          background: C.surface2, border: `1px solid ${C.border}`,
                          color: C.text, fontSize: 16, fontWeight: 700,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: 'inherit',
                        }}
                      >
                        +
                      </button>
                    </div>

                    {/* Subtotal */}
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.amber, minWidth: 60, textAlign: 'right' }}>
                      {(item.price * item.quantity).toFixed(2)}€
                    </span>

                    {/* Delete */}
                    <button
                      onClick={() => removeItem(item.id)}
                      style={{
                        width: 28, height: 28, borderRadius: 7,
                        background: C.redDim, border: 'none',
                        color: C.red, fontSize: 13, fontWeight: 700,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'inherit',
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Divider + total */}
            <div style={{
              borderTop: `2px solid ${C.border}`,
              padding: '16px 16px 8px',
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: C.text2 }}>TOTAL</span>
              <span style={{ fontSize: 36, fontWeight: 800, color: C.text, letterSpacing: '-0.02em' }}>
                {total.toFixed(2)}€
              </span>
            </div>

            {/* Action buttons */}
            <div style={{ padding: '8px 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={() => order.length > 0 && setShowCobrar(true)}
                disabled={order.length === 0}
                style={{
                  width: '100%', padding: '16px',
                  background: order.length > 0 ? 'linear-gradient(135deg, #F0A84E, #E8923A)' : C.surface2,
                  border: 'none', borderRadius: 14,
                  color: order.length > 0 ? '#0C1018' : C.text3,
                  fontSize: 18, fontWeight: 800,
                  cursor: order.length > 0 ? 'pointer' : 'default',
                  boxShadow: order.length > 0 ? '0 4px 20px rgba(240,168,78,0.3)' : 'none',
                  fontFamily: 'inherit',
                }}
              >
                Cobrar
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={aparcar}
                  disabled={order.length === 0 || saving}
                  style={{
                    flex: 1, padding: '12px',
                    background: 'transparent',
                    border: `1px solid ${order.length > 0 ? C.border : 'transparent'}`,
                    borderRadius: 12,
                    color: order.length > 0 ? C.text2 : C.text3,
                    fontSize: 14, fontWeight: 600,
                    cursor: order.length > 0 ? 'pointer' : 'default',
                    fontFamily: 'inherit',
                  }}
                >
                  Aparcar
                </button>
                <button
                  onClick={cancelar}
                  disabled={order.length === 0}
                  style={{
                    padding: '12px 16px',
                    background: 'transparent', border: 'none',
                    color: order.length > 0 ? C.red : C.text3,
                    fontSize: 14, fontWeight: 500,
                    cursor: order.length > 0 ? 'pointer' : 'default',
                    fontFamily: 'inherit', textDecoration: order.length > 0 ? 'underline' : 'none',
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Cobrar modal ──────────────────────────────────────────── */}
        {showCobrar && (
          <div
            onClick={() => setShowCobrar(false)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 100, padding: 20,
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 20, padding: 28, width: '100%', maxWidth: 420,
              }}
            >
              <h3 style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 4 }}>Cobrar pedido</h3>
              <p style={{ fontSize: 32, fontWeight: 800, color: C.amber, marginBottom: 20 }}>
                {total.toFixed(2)}€
              </p>

              {/* Order type */}
              <label style={{ fontSize: 13, fontWeight: 600, color: C.text2, marginBottom: 8, display: 'block' }}>
                Tipo de pedido
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
                {(['barra', 'mesa', 'recoger', 'domicilio'] as const).map(tp => {
                  const icons: Record<string, string> = { barra: '🍺', mesa: '🍽️', recoger: '🥡', domicilio: '🛵' }
                  const labels: Record<string, string> = { barra: 'Barra', mesa: 'Mesa', recoger: 'Recoger', domicilio: 'Domicilio' }
                  return (
                    <button
                      key={tp}
                      onClick={() => setCobroType(tp)}
                      style={{
                        padding: '14px 8px', borderRadius: 12,
                        border: cobroType === tp ? `2px solid ${C.amber}` : `1px solid ${C.border}`,
                        background: cobroType === tp ? C.amberDim : C.surface2,
                        color: cobroType === tp ? C.amber : C.text2,
                        fontSize: 12, fontWeight: 600,
                        cursor: 'pointer', textAlign: 'center',
                        fontFamily: 'inherit',
                      }}
                    >
                      <div style={{ fontSize: 20, marginBottom: 4 }}>{icons[tp]}</div>
                      {labels[tp]}
                    </button>
                  )
                })}
              </div>

              {/* Customer name */}
              <input
                value={cobroName}
                onChange={e => setCobroName(e.target.value)}
                placeholder="Nombre del cliente (opcional)"
                style={{
                  width: '100%', padding: '12px 14px', marginBottom: 10,
                  background: C.surface2, border: `1px solid ${C.border}`,
                  borderRadius: 10, color: C.text, fontSize: 14,
                  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              />

              {/* Table number (only for mesa) */}
              {cobroType === 'mesa' && (
                <input
                  value={cobroTable}
                  onChange={e => setCobroTable(e.target.value)}
                  placeholder="Numero de mesa"
                  style={{
                    width: '100%', padding: '12px 14px', marginBottom: 10,
                    background: C.surface2, border: `1px solid ${C.border}`,
                    borderRadius: 10, color: C.text, fontSize: 14,
                    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                  }}
                />
              )}

              {/* Notes */}
              <input
                value={cobroNotes}
                onChange={e => setCobroNotes(e.target.value)}
                placeholder="Notas (opcional)"
                style={{
                  width: '100%', padding: '12px 14px', marginBottom: 20,
                  background: C.surface2, border: `1px solid ${C.border}`,
                  borderRadius: 10, color: C.text, fontSize: 14,
                  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              />

              <button
                onClick={cobrar}
                disabled={saving}
                style={{
                  width: '100%', padding: '16px',
                  background: 'linear-gradient(135deg, #F0A84E, #E8923A)',
                  border: 'none', borderRadius: 14,
                  color: '#0C1018', fontSize: 18, fontWeight: 800,
                  cursor: saving ? 'wait' : 'pointer',
                  boxShadow: '0 4px 20px rgba(240,168,78,0.3)',
                  fontFamily: 'inherit',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? 'Procesando...' : 'Confirmar cobro'}
              </button>
            </div>
          </div>
        )}

        {/* ── Custom price modal ──────────────────────────────────── */}
        {showCustom && (
          <div
            onClick={() => setShowCustom(false)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 100, padding: 20,
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 20, padding: 28, width: '100%', maxWidth: 360,
              }}
            >
              <h3 style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 16 }}>Precio manual</h3>
              <input
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                placeholder="Nombre del producto"
                autoFocus
                style={{
                  width: '100%', padding: '12px 14px', marginBottom: 10,
                  background: C.surface2, border: `1px solid ${C.border}`,
                  borderRadius: 10, color: C.text, fontSize: 14,
                  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              />
              <input
                value={customPrice}
                onChange={e => setCustomPrice(e.target.value)}
                placeholder="Precio (€)"
                type="text"
                inputMode="decimal"
                style={{
                  width: '100%', padding: '12px 14px', marginBottom: 20,
                  background: C.surface2, border: `1px solid ${C.border}`,
                  borderRadius: 10, color: C.text, fontSize: 14,
                  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                }}
                onKeyDown={e => { if (e.key === 'Enter') addCustomItem() }}
              />
              <button
                onClick={addCustomItem}
                style={{
                  width: '100%', padding: '14px',
                  background: 'linear-gradient(135deg, #F0A84E, #E8923A)',
                  border: 'none', borderRadius: 12,
                  color: '#0C1018', fontSize: 15, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Agregar
              </button>
            </div>
          </div>
        )}

        {/* ── Responsive: mobile stack ──────────────────────────────── */}
        <style>{`
          @media (max-width: 768px) {
            .tpv-left { flex: 1 1 100% !important; max-width: 100% !important; border-right: none !important; min-height: 50vh; }
            .tpv-right { flex: 1 1 100% !important; max-width: 100% !important; }
            .tpv-left + .tpv-right { border-top: 2px solid ${C.border}; }
          }
          @media (max-width: 768px) {
            .tpv-left ~ .tpv-right { flex: none !important; }
          }
        `}</style>
      </div>
    </UpgradeGate>
  )
}
