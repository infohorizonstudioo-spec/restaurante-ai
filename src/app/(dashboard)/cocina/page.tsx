'use client'
import { UpgradeGate } from '@/components/UpgradeGate'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { PageSkeleton } from '@/components/ui'
import { useTenant } from '@/contexts/TenantContext'
import { C } from '@/lib/colors'
import { generateKitchenTicket, printTicket, parseOrderNotes } from '@/lib/kitchen-ticket'

/* ── Types ───────────────────────────────────────────────────────── */
interface KDSOrder {
  id: string
  status: string
  order_type: string
  customer_name: string
  items: any[]
  notes: string | null
  table_id: string | null
  created_at: string
  updated_at: string
}

interface TableInfo {
  id: string
  number: string
  name?: string
  zone_name?: string
}

/* ── Time helpers ────────────────────────────────────────────────── */
function minutesAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
}

function formatTimer(mins: number): string {
  if (mins < 1) return '<1 min'
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h ${m}m`
}

function urgencyColor(mins: number): { bg: string; border: string; text: string } {
  if (mins >= 10) return { bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.35)', text: C.red }
  if (mins >= 5) return { bg: 'rgba(240,168,78,0.10)', border: 'rgba(240,168,78,0.35)', text: C.amber }
  return { bg: C.surface2, border: C.border, text: C.text3 }
}

/* ── Sound — kitchen chime via Web Audio API ─────────────────────── */
function playKitchenChime() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()

    // Two-tone chime: C5 → E5 (professional kitchen bell sound)
    const freqs = [523, 659]
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.15)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.6)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime + i * 0.15)
      osc.stop(ctx.currentTime + i * 0.15 + 0.6)
    })

    // Close context after sounds finish
    setTimeout(() => ctx.close().catch(() => {}), 1500)
  } catch { /* ignore if audio not available */ }
}

/* ── Main component ──────────────────────────────────────────────── */
export default function CocinaPage() {
  const { tenant, template, t, tx } = useTenant()
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<KDSOrder[]>([])
  const [updating, setUpdating] = useState<string | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [tableMap, setTableMap] = useState<Record<string, TableInfo>>({})
  const containerRef = useRef<HTMLDivElement>(null)
  const prevOrderCount = useRef(0)

  const tenantId = tenant?.id
  const isHospitality = ['restaurante', 'bar', 'cafeteria'].includes(tenant?.type || '')

  /* ── Play sound on new order ────────────────────────────────── */
  function playSound() {
    playKitchenChime()
  }

  /* ── Load tables map ────────────────────────────────────────── */
  useEffect(() => {
    if (!tenantId) return
    ;(async () => {
      const { data } = await supabase
        .from('tables')
        .select('id,number,name,zone_name')
        .eq('tenant_id', tenantId)
      if (data) {
        const map: Record<string, TableInfo> = {}
        for (const t of data) map[t.id] = t
        setTableMap(map)
      }
    })()
  }, [tenantId])

  /* ── Fetch active orders ─────────────────────────────────────── */
  const fetchOrders = useCallback(async () => {
    if (!tenantId) return
    const { data } = await supabase
      .from('order_events')
      .select('id,status,order_type,customer_name,items,notes,table_id,created_at,updated_at')
      .eq('tenant_id', tenantId)
      .in('status', ['confirmed', 'preparing'])
      .order('created_at', { ascending: true })
    if (data) {
      // Detect new orders for sound alert
      if (data.length > prevOrderCount.current && prevOrderCount.current > 0) {
        playSound()
      }
      prevOrderCount.current = data.length
      setOrders(data as KDSOrder[])
    }
    setLoading(false)
  }, [tenantId])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  /* ── Realtime subscription ───────────────────────────────────── */
  useEffect(() => {
    if (!tenantId) return
    const ch = supabase
      .channel('kds-orders-' + tenantId)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'order_events',
        filter: `tenant_id=eq.${tenantId}`,
      }, (payload) => {
        // Play sound on new order insert
        if (payload.eventType === 'INSERT' && (payload.new as any)?.status === 'confirmed') {
          playSound()
        }
        fetchOrders()
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [tenantId, fetchOrders])

  /* ── Tick timer every 15s ────────────────────────────────────── */
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 15000)
    return () => clearInterval(iv)
  }, [])

  /* ── Update order status ─────────────────────────────────────── */
  const advanceStatus = async (order: KDSOrder) => {
    const nextStatus = order.status === 'confirmed' ? 'preparing' : 'ready'
    setUpdating(order.id)
    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: order.id, status: nextStatus }),
      })
      if (res.ok) {
        if (nextStatus === 'ready') {
          setOrders(prev => prev.filter(o => o.id !== order.id))
        } else {
          setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: nextStatus } : o))
        }
      }
    } finally {
      setUpdating(null)
    }
  }

  /* ── Print kitchen ticket ───────────────────────────────────── */
  function handlePrint(order: KDSOrder) {
    const { mesa: noteMesa, customerNotes } = parseOrderNotes(order.notes)
    const tableInfo = order.table_id ? tableMap[order.table_id] : null
    const tableNumber = tableInfo?.number || noteMesa || null
    const zone = tableInfo?.zone_name || null

    const html = generateKitchenTicket({
      items: order.items,
      table: tableNumber,
      zone,
      notes: customerNotes || undefined,
      orderNum: order.id.slice(-4).toUpperCase(),
      customerName: order.customer_name,
    })
    printTicket(html)
  }

  /* ── Get table label for display ────────────────────────────── */
  function getTableLabel(order: KDSOrder): { label: string; zone?: string } {
    // Priority 1: table_id → lookup in tableMap
    if (order.table_id && tableMap[order.table_id]) {
      const t = tableMap[order.table_id]
      return {
        label: t.name || `Mesa ${t.number}`,
        zone: t.zone_name || undefined,
      }
    }
    // Priority 2: parse "Mesa: X" from notes
    const { mesa } = parseOrderNotes(order.notes)
    if (mesa) return { label: `Mesa ${mesa}` }
    // Priority 3: barra with customer name + time
    if (order.order_type === 'barra') {
      const time = new Date(order.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
      const name = order.customer_name && order.customer_name !== 'Barra' && order.customer_name !== 'QR'
        ? order.customer_name : ''
      return { label: name ? `Barra \u2014 ${name} \u2014 ${time}` : `Barra \u2014 ${time}` }
    }
    // Priority 4: other types
    if (order.order_type === 'recoger') return { label: 'Recoger' }
    if (order.order_type === 'domicilio') return { label: 'Domicilio' }
    return { label: 'Barra' }
  }

  /* ── Fullscreen toggle ───────────────────────────────────────── */
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.()
      setFullscreen(true)
    } else {
      document.exitFullscreen?.()
      setFullscreen(false)
    }
  }

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  /* ── Non-hospitality guard ───────────────────────────────────── */
  if (!loading && !isHospitality) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12 }}>
        <span style={{ fontSize: 40 }}>{'\uD83C\uDF73'}</span>
        <div style={{ fontSize: 18, fontWeight: 600, color: C.text }}>Modulo no disponible</div>
        <div style={{ fontSize: 14, color: C.text3 }}>La pantalla de cocina esta disponible para negocios de hosteleria.</div>
      </div>
    )
  }

  if (loading) return <PageSkeleton />

  const confirmed = orders.filter(o => o.status === 'confirmed')
  const preparing = orders.filter(o => o.status === 'preparing')

  return (
    <UpgradeGate feature="pedidos">
      <div ref={containerRef} style={{
        padding: fullscreen ? '24px' : '24px 32px',
        background: C.bg, minHeight: '100vh',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 28 }}>{'\uD83C\uDF73'}</span>
            <div>
              <h1 style={{ fontSize: fullscreen ? 28 : 22, fontWeight: 700, color: C.text, margin: 0 }}>{tx('Cocina')}</h1>
              <p style={{ fontSize: 13, color: C.text3, margin: '2px 0 0' }}>
                {orders.length} pedido{orders.length !== 1 ? 's' : ''} activo{orders.length !== 1 ? 's' : ''}
                {confirmed.length > 0 && <span style={{ color: C.blue, fontWeight: 600 }}> {'\u00b7'} {confirmed.length} nuevo{confirmed.length !== 1 ? 's' : ''}</span>}
              </p>
            </div>
          </div>
          <button onClick={toggleFullscreen} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px',
            borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface,
            color: C.text2, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {fullscreen
                ? <path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3" />
                : <path d="M8 3H5a2 2 0 00-2 2v3m18-5h-3a2 2 0 00-2 2v3m0 8v3a2 2 0 002 2h3M3 16v3a2 2 0 002 2h3" />
              }
            </svg>
            {fullscreen ? tx('Salir') : tx('Pantalla completa')}
          </button>
        </div>

        {/* Empty state */}
        {orders.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: fullscreen ? '70vh' : 400, gap: 16,
          }}>
            <span style={{ fontSize: 64 }}>{'\u2705'}</span>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{tx('Sin pedidos pendientes')}</div>
            <div style={{ fontSize: 15, color: C.text3 }}>{tx('Los pedidos nuevos apareceran aqui automaticamente')}</div>
          </div>
        )}

        {/* Orders grid */}
        {orders.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {[...confirmed, ...preparing].map(order => {
              const mins = minutesAgo(order.created_at)
              const urg = urgencyColor(mins)
              const isPreparing = order.status === 'preparing'
              const items = Array.isArray(order.items) ? order.items : []
              const isUpdating = updating === order.id
              const { label: tableLabel, zone } = getTableLabel(order)
              const { customerNotes } = parseOrderNotes(order.notes)

              return (
                <div key={order.id} style={{
                  borderRadius: 16, border: `2px solid ${urg.border}`,
                  background: urg.bg, padding: 0, overflow: 'hidden',
                  opacity: isUpdating ? 0.6 : 1, transition: 'opacity 0.2s',
                }}>
                  {/* Card header */}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '14px 18px', borderBottom: `1px solid ${urg.border}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{
                        fontSize: fullscreen ? 22 : 18, fontWeight: 800, color: C.text,
                        fontFamily: 'var(--rz-mono)',
                      }}>
                        #{order.id.slice(-4).toUpperCase()}
                      </span>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                        background: isPreparing ? 'rgba(240,168,78,0.15)' : 'rgba(96,165,250,0.15)',
                        color: isPreparing ? C.amber : C.blue,
                        textTransform: 'uppercase', letterSpacing: '0.03em',
                      }}>
                        {isPreparing ? tx('Preparando') : tx('Nuevo')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {/* Print button */}
                      <button onClick={() => handlePrint(order)} title="Imprimir comanda" style={{
                        background: 'none', border: `1px solid ${C.border}`, borderRadius: 6,
                        padding: '4px 8px', cursor: 'pointer', color: C.text3, fontSize: 14,
                      }}>{'\uD83D\uDDA8\uFE0F'}</button>
                      <div style={{
                        fontSize: fullscreen ? 20 : 16, fontWeight: 700, color: urg.text,
                        fontFamily: 'var(--rz-mono)',
                      }}>
                        {formatTimer(mins)}
                      </div>
                    </div>
                  </div>

                  {/* Table / type */}
                  <div style={{ padding: '10px 18px', borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: fullscreen ? 16 : 14, fontWeight: 600, color: C.text }}>
                        {tableLabel}
                      </span>
                      {zone && <span style={{ fontSize: 12, color: C.text3 }}>{'\u00b7'} {zone}</span>}
                      {order.customer_name && order.customer_name !== 'TPV' && order.customer_name !== 'QR' && (
                        <span style={{ fontSize: 13, color: C.text3 }}>{'\u2014'} {order.customer_name}</span>
                      )}
                    </div>
                  </div>

                  {/* Items */}
                  <div style={{ padding: '12px 18px' }}>
                    {items.map((item: any, i: number) => (
                      <div key={i} style={{
                        padding: '6px 0', borderBottom: i < items.length - 1 ? `1px solid rgba(255,255,255,0.03)` : 'none',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: fullscreen ? 18 : 15, fontWeight: 600, color: C.text }}>
                            {item.qty || item.quantity || 1}x {item.name || item.product || 'Producto'}
                          </span>
                        </div>
                        {item.notes && (
                          <span style={{ fontSize: 12, color: C.amber, fontStyle: 'italic', display: 'block', marginTop: 2 }}>
                            {'\u26A0'} {item.notes}
                          </span>
                        )}
                      </div>
                    ))}
                    {items.length === 0 && (
                      <div style={{ fontSize: 14, color: C.text3, fontStyle: 'italic' }}>Sin productos</div>
                    )}
                  </div>

                  {/* Customer notes (parsed — without metadata) */}
                  {customerNotes && (
                    <div style={{
                      padding: '8px 18px', background: 'rgba(240,168,78,0.06)',
                      borderTop: `1px solid rgba(255,255,255,0.04)`,
                    }}>
                      <span style={{ fontSize: 13, color: C.amber }}>{'\uD83D\uDCDD'} {customerNotes}</span>
                    </div>
                  )}

                  {/* Action button */}
                  <div style={{ padding: '12px 18px' }}>
                    <button
                      onClick={() => advanceStatus(order)}
                      disabled={isUpdating}
                      style={{
                        width: '100%', padding: fullscreen ? '16px' : '12px',
                        borderRadius: 10, border: 'none', cursor: isUpdating ? 'wait' : 'pointer',
                        background: isPreparing ? C.green : C.amber,
                        color: '#0C1018', fontSize: fullscreen ? 18 : 15, fontWeight: 700,
                        transition: 'opacity 0.15s',
                      }}
                    >
                      {isPreparing ? '\u2705 Marcar listo' : '\uD83D\uDD25 Empezar a preparar'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </UpgradeGate>
  )
}
