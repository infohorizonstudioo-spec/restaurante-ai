'use client'
import NotifBell from '@/components/NotifBell'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { PageLoader, PageSkeleton, Modal } from '@/components/ui'
import { useTenant } from '@/contexts/TenantContext'
import Link from 'next/link'
import { useToast } from '@/components/NotificationToast'

/* ── Status flow (matches agent update-order) ──────────────────────── */
const STATUS_FLOW = ['collecting','confirmed','preparing','ready','delivered'] as const
type OrderStatus = typeof STATUS_FLOW[number] | 'cancelled'

const STATUS_META: Record<string, { color: string; label: string; icon: string }> = {
  collecting:  { color: '#F0A84E', label: 'Recogiendo',  icon: '📝' },
  confirmed:   { color: '#60A5FA', label: 'Confirmado',  icon: '✅' },
  preparing:   { color: '#FBB53F', label: 'Preparando',  icon: '🍳' },
  ready:       { color: '#34D399', label: 'Listo',       icon: '🔔' },
  delivered:   { color: '#8895A7', label: 'Entregado',   icon: '✔️' },
  cancelled:   { color: '#F87171', label: 'Cancelado',   icon: '✖️' },
}

const ORDER_TYPES = ['todos','recoger','domicilio','mesa'] as const
const TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  recoger:   { label: 'Recoger',   icon: '🥡' },
  domicilio: { label: 'Domicilio', icon: '🛵' },
  mesa:      { label: 'Mesa',      icon: '🍽️' },
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return 'hace <1 min'
  if (diff < 3600) { const m = Math.floor(diff / 60); return `hace ${m} min` }
  if (diff < 86400) { const h = Math.floor(diff / 3600); return `hace ${h}h` }
  const d = Math.floor(diff / 86400); return `hace ${d}d`
}

function nextStatus(current: string): string | null {
  const idx = STATUS_FLOW.indexOf(current as any)
  if (idx === -1 || idx >= STATUS_FLOW.length - 1) return null
  return STATUS_FLOW[idx + 1]
}

function nextLabel(current: string): string {
  const ns = nextStatus(current)
  if (!ns) return ''
  const map: Record<string, string> = {
    confirmed: 'Confirmar',
    preparing: 'Preparar',
    ready: 'Marcar listo',
    delivered: 'Entregado',
  }
  return map[ns] || STATUS_META[ns]?.label || ''
}

export default function PedidosPage() {
  const toast = useToast()
  const [plan, setPlan] = useState<string>('free')
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<any[]>([])
  const [tid, setTid] = useState<string | null>(null)
  const [tipoFilter, setTipoFilter] = useState<string>('todos')
  const [modal, setModal] = useState<any | null>(null)
  const modalRef = useRef<any | null>(null)
  const [, setTick] = useState(0)
  const { template } = useTenant()
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const load = useCallback(async (tenantId: string) => {
    const r = await fetch('/api/orders?tenant_id=' + tenantId + '&limit=100')
    const d = await r.json()
    setOrders(d.orders || [])
  }, [])

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).maybeSingle()
      if (!p?.tenant_id) return
      const { data: t } = await supabase.from('tenants').select('plan').eq('id', p.tenant_id).maybeSingle()
      setPlan(t?.plan || 'free')
      setTid(p.tenant_id)
      await load(p.tenant_id)
      setLoading(false)
    })()
  }, [load])

  // Keep modalRef in sync with modal state (avoids stale closure in RT handler)
  useEffect(() => { modalRef.current = modal }, [modal])

  // Tick every 30s to keep "hace X min" timers fresh
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 30000)
    return () => clearInterval(iv)
  }, [])

  // Realtime subscription on order_events
  useEffect(() => {
    if (!tid) return
    const ch = supabase.channel('order-events-rt-' + tid)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_events', filter: 'tenant_id=eq.' + tid }, () => {
        playSound()
        load(tid)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'order_events', filter: 'tenant_id=eq.' + tid }, (payload) => {
        load(tid)
        // Update modal if viewing the same order (read from ref to avoid stale closure)
        if (modalRef.current && payload.new && (payload.new as any).id === modalRef.current.id) {
          setModal(payload.new)
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'order_events', filter: 'tenant_id=eq.' + tid }, () => load(tid))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [tid, load])

  function playSound() {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2JkZiYl5OSjYeFgoB/f4GDhYmNkJKUlZWUko+MiIWCf31+f4GDhYmMj5GTlJWVlJKQjYmGg4B+fX5/gYSHioyPkZOUlZWUkpCNiYaDgH5+fn+BhIeKjI+Rk5SVlZSSkI2JhoOAfn5+f4GEh4qMj5GTlJWVlJKQjYmGg4B+fn5/gYSHioyPkZOUlZWUkpCNiYaDgH5+fn+BhIeKjI+Rk5SVlQ==')
      }
      audioRef.current.currentTime = 0
      audioRef.current.play()
    } catch { /* ignore audio errors */ }
  }

  if (loading) return <PageSkeleton variant="list"/>

  // GUARDIA: pedidos solo disponible para hostelería
  if (template && !template.hasOrders) {
    return (
      <div style={{ background: '#0C1018', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#E8EEF6', marginBottom: 8 }}>Módulo no disponible</h2>
          <p style={{ fontSize: 14, color: '#8895A7', lineHeight: 1.6, marginBottom: 24 }}>
            El módulo de pedidos no aplica para <strong>{template.label}</strong>.<br />
            Este módulo está diseñado para negocios de hostelería.
          </p>
          <Link href="/panel" style={{ padding: '10px 24px', fontSize: 14, fontWeight: 600, color: 'white', background: 'linear-gradient(135deg,#F0A84E,#E8923A)', borderRadius: 9, textDecoration: 'none' }}>
            Volver al panel
          </Link>
        </div>
      </div>
    )
  }

  const isPro = plan === 'pro' || plan === 'business' || plan === 'enterprise'

  if (!isPro) return (
    <div style={{ background: '#0C1018', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 440, textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: 'linear-gradient(135deg,#F0A84E,#E8923A)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 8px 24px rgba(240,168,78,0.25)' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="#0C1018"><path d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#E8EEF6', marginBottom: 10 }}>Gestión de pedidos</h2>
        <p style={{ fontSize: 14, color: '#8895A7', lineHeight: 1.6, marginBottom: 24 }}>Gestiona pedidos locales, para llevar y delivery desde tu panel. Disponible en el plan Pro y Business.</p>
        <Link href="/precios" style={{ display: 'inline-block', padding: '12px 28px', fontSize: 14, fontWeight: 600, color: '#0C1018', background: 'linear-gradient(135deg,#F0A84E,#E8923A)', borderRadius: 10, textDecoration: 'none', boxShadow: '0 4px 16px rgba(240,168,78,0.3)' }}>
          Ver planes →
        </Link>
      </div>
    </div>
  )

  const filtered = tipoFilter === 'todos' ? orders : orders.filter(o => o.order_type === tipoFilter)
  const activos = orders.filter(o => !['delivered', 'cancelled'].includes(o.status))

  async function cambiarEstado(id: string, status: string) {
    await fetch('/api/orders', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, tenant_id: tid, status })
    })
    const sm = STATUS_META[status]
    toast.push({ title: sm?.label || status, body: 'Estado del pedido actualizado', type: 'order', priority: 'info', icon: sm?.icon || '✅' })
    setModal(null)
    if (tid) load(tid)
  }

  async function avanzarEstado(id: string, currentStatus: string) {
    const ns = nextStatus(currentStatus)
    if (!ns) return
    await cambiarEstado(id, ns)
  }

  async function nuevoOrder() {
    if (!tid) return
    const r = await fetch('/api/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tid, customer_name: 'Nuevo pedido', order_type: 'mesa' })
    })
    const d = await r.json()
    if (d.order) setModal(d.order)
    if (tid) load(tid)
  }

  return (
    <div style={{ background: '#0C1018', minHeight: '100vh' }}>
      {/* ── Header ────────────────────────────────────────────── */}
      <div style={{ background: '#131920', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 20 }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: '#E8EEF6', letterSpacing: '-0.02em' }}>Pedidos</h1>
          <p style={{ fontSize: 12, color: '#49566A', marginTop: 2 }}>{activos.length} activos · {orders.length} total</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={nuevoOrder} style={{ padding: '9px 18px', fontSize: 13, fontWeight: 700, color: '#0C1018', background: 'linear-gradient(135deg,#F0A84E,#E8923A)', border: 'none', borderRadius: 9, cursor: 'pointer', boxShadow: '0 2px 12px rgba(240,168,78,0.25)' }}>
            + Nuevo pedido
          </button>
          <NotifBell />
        </div>
      </div>

      {/* ── Filter bar ────────────────────────────────────────── */}
      <div style={{ background: '#131920', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '0 24px', display: 'flex', gap: 0 }}>
        {ORDER_TYPES.map(t => (
          <button key={t} onClick={() => setTipoFilter(t)} style={{
            padding: '10px 16px', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer',
            borderBottom: tipoFilter === t ? '2px solid #F0A84E' : '2px solid transparent',
            color: tipoFilter === t ? '#F0A84E' : '#8895A7',
            fontWeight: tipoFilter === t ? 600 : 400, fontFamily: 'inherit', textTransform: 'capitalize'
          }}>
            {t === 'todos'
              ? 'Todos (' + orders.length + ')'
              : (TYPE_LABELS[t]?.icon || '') + ' ' + (TYPE_LABELS[t]?.label || t) + ' (' + orders.filter(o => o.order_type === t).length + ')'
            }
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '20px 24px' }}>
        {/* ── Status summary cards ────────────────────────────── */}
        {activos.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 10, marginBottom: 20 }}>
            {(['collecting', 'confirmed', 'preparing', 'ready'] as const).map(s => {
              const cnt = orders.filter(o => o.status === s).length
              const sm = STATUS_META[s]
              return (
                <div key={s} style={{ background: '#1A2230', border: '1px solid ' + sm.color + '33', borderRadius: 12, padding: '12px 16px' }}>
                  <p style={{ fontSize: 22, fontWeight: 700, color: sm.color }}>{cnt}</p>
                  <p style={{ fontSize: 12, color: sm.color, fontWeight: 600 }}>{sm.icon} {sm.label}</p>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Order cards ─────────────────────────────────────── */}
        {filtered.length === 0 ? (
          <div style={{ background: '#131920', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '64px 24px', textAlign: 'center' }}>
            <div style={{ position: 'relative', display: 'inline-block', marginBottom: 20 }}>
              <div style={{ width: 64, height: 64, background: 'linear-gradient(135deg,rgba(240,168,78,0.10),rgba(240,168,78,0.04))', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, border: '1px solid rgba(240,168,78,0.12)' }}>🛍️</div>
              <div style={{ position: 'absolute', inset: -8, borderRadius: 24, border: '1px dashed rgba(240,168,78,0.12)', pointerEvents: 'none' }}/>
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#E8EEF6', marginBottom: 8 }}>Sin pedidos todavía</p>
            <p style={{ fontSize: 13, color: '#8895A7', lineHeight: 1.6, maxWidth: 320, margin: '0 auto 20px' }}>Los pedidos de tus clientes aparecerán aquí en tiempo real cuando lleguen por llamada, WhatsApp o tu carta digital.</p>
            <button onClick={nuevoOrder} style={{ padding: '9px 20px', fontSize: 13, fontWeight: 600, color: '#0C1018', background: 'linear-gradient(135deg,#F0A84E,#E8923A)', border: 'none', borderRadius: 9, cursor: 'pointer' }}>
              + Crear pedido manual
            </button>
          </div>
        ) : filtered.map(o => {
          const sm = STATUS_META[o.status] || STATUS_META.collecting
          const items = Array.isArray(o.items) ? o.items : []
          const typeInfo = TYPE_LABELS[o.order_type] || { label: o.order_type || 'Otro', icon: '📦' }
          const total = o.total_estimate || 0
          const ns = nextStatus(o.status)
          const address = extractAddress(o)

          return (
            <div key={o.id} onClick={() => setModal(o)} style={{
              background: '#131920', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12,
              padding: '14px 16px', marginBottom: 10, cursor: 'pointer',
              borderLeft: '3px solid ' + sm.color,
              transition: 'box-shadow 0.15s'
            }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.3)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = 'none'}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                {/* Icon */}
                <div style={{ width: 38, height: 38, borderRadius: 10, background: sm.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16 }}>
                  {typeInfo.icon}
                </div>
                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#E8EEF6' }}>{o.customer_name}</p>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: sm.color + '18', color: sm.color, fontWeight: 700 }}>{sm.label}</span>
                    <span style={{ fontSize: 10, color: '#49566A' }}>{typeInfo.label}</span>
                    {o.table_id && <span style={{ fontSize: 10, color: '#60A5FA', fontWeight: 600 }}>Mesa {o.table_id}</span>}
                  </div>
                  {/* Items preview */}
                  {items.length > 0 && (
                    <p style={{ fontSize: 12, color: '#8895A7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>
                      {items.map((it: any) => {
                        const qty = it.quantity && it.quantity > 1 ? it.quantity + 'x ' : ''
                        return qty + (it.name || it.toString())
                      }).join(', ')}
                    </p>
                  )}
                  {/* Delivery address */}
                  {address && (
                    <p style={{ fontSize: 11, color: '#2DD4BF', marginTop: 2, fontWeight: 600 }}>📍 {address}</p>
                  )}
                  {/* Notes (non-address) */}
                  {o.notes && !o.notes.startsWith('DIRECCION:') && !o.notes.startsWith('DIRECCIÓN:') && (
                    <p style={{ fontSize: 11, color: '#49566A', marginTop: 2, fontStyle: 'italic' }}>{o.notes.length > 80 ? o.notes.slice(0, 80) + '...' : o.notes}</p>
                  )}
                  {/* Time */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                    <span style={{ fontSize: 11, color: o.status === 'collecting' || o.status === 'confirmed' ? '#F0A84E' : '#49566A', fontWeight: o.status === 'collecting' ? 600 : 400 }}>
                      {timeAgo(o.created_at)}
                    </span>
                    <span style={{ fontSize: 11, color: '#49566A' }}>
                      {new Date(o.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {o.pickup_time && (
                      <span style={{ fontSize: 11, color: '#A78BFA', fontWeight: 600 }}>Recogida: {o.pickup_time}</span>
                    )}
                  </div>
                </div>
                {/* Right side: total + quick action */}
                <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  {total > 0 && <p style={{ fontSize: 16, fontWeight: 700, color: '#34D399' }}>{total.toFixed(2)}€</p>}
                  {ns && o.status !== 'delivered' && o.status !== 'cancelled' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); avanzarEstado(o.id, o.status) }}
                      style={{
                        padding: '5px 12px', fontSize: 11, fontWeight: 600, borderRadius: 7,
                        border: '1px solid ' + (STATUS_META[ns]?.color || '#F0A84E') + '44',
                        background: (STATUS_META[ns]?.color || '#F0A84E') + '18',
                        color: STATUS_META[ns]?.color || '#F0A84E',
                        cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap'
                      }}>
                      {nextLabel(o.status)} →
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Order detail modal ────────────────────────────────── */}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.customer_name || 'Pedido'} size="sm">
        {modal && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, background: (STATUS_META[modal.status]?.color || '#8895A7') + '18', color: STATUS_META[modal.status]?.color || '#8895A7', fontWeight: 700 }}>
                {STATUS_META[modal.status]?.icon} {STATUS_META[modal.status]?.label || modal.status}
              </span>
              <span style={{ fontSize: 11, color: '#49566A' }}>
                {(TYPE_LABELS[modal.order_type]?.icon || '📦') + ' ' + (TYPE_LABELS[modal.order_type]?.label || modal.order_type)}
              </span>
              {modal.table_id && <span style={{ fontSize: 11, color: '#60A5FA', fontWeight: 600 }}>Mesa {modal.table_id}</span>}
            </div>

            {/* Customer info */}
            <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {modal.customer_phone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <p style={{ fontSize: 13, color: '#C4CDD8' }}>📞 {modal.customer_phone}</p>
                  <button onClick={async () => {
                    const sess = await supabase.auth.getSession()
                    if (!sess.data.session) return
                    await fetch('/api/voice/outbound', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sess.data.session.access_token },
                      body: JSON.stringify({ phone_number: modal.customer_phone, reason: 'general', customer_name: modal.customer_name })
                    })
                  }}
                    style={{ fontSize: 11, padding: '4px 10px', borderRadius: 7, border: '1px solid rgba(45,212,191,0.3)', background: 'rgba(45,212,191,0.08)', color: '#2DD4BF', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
                    Llamar
                  </button>
                </div>
              )}
              {extractAddress(modal) && (
                <p style={{ fontSize: 13, color: '#2DD4BF' }}>📍 {extractAddress(modal)}</p>
              )}
              {modal.pickup_time && (
                <p style={{ fontSize: 13, color: '#A78BFA' }}>🕐 Recogida: {modal.pickup_time}</p>
              )}
              {modal.notes && (
                <p style={{ fontSize: 13, color: '#C4CDD8' }}>📝 {modal.notes}</p>
              )}
            </div>

            {/* Items list */}
            {Array.isArray(modal.items) && modal.items.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#49566A', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Productos</p>
                <div style={{ background: '#1A2230', borderRadius: 10, overflow: 'hidden' }}>
                  {modal.items.map((item: any, idx: number) => (
                    <div key={idx} style={{
                      padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      borderBottom: idx < modal.items.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none'
                    }}>
                      <div>
                        <p style={{ fontSize: 13, color: '#E8EEF6', fontWeight: 500 }}>{item.name || item.toString()}</p>
                        {item.quantity && item.quantity > 1 && (
                          <p style={{ fontSize: 11, color: '#49566A' }}>x{item.quantity}</p>
                        )}
                      </div>
                      {item.price != null && (
                        <p style={{ fontSize: 13, color: '#34D399', fontWeight: 600 }}>{(item.price * (item.quantity || 1)).toFixed(2)}€</p>
                      )}
                    </div>
                  ))}
                  {/* Total row */}
                  {(modal.total_estimate || 0) > 0 && (
                    <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', background: '#0C1018', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                      <p style={{ fontSize: 13, color: '#E8EEF6', fontWeight: 700 }}>Total</p>
                      <p style={{ fontSize: 15, color: '#34D399', fontWeight: 700 }}>{(modal.total_estimate || 0).toFixed(2)}€</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Status flow buttons */}
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#49566A', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Cambiar estado</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {STATUS_FLOW.map(s => {
                  const sm = STATUS_META[s]
                  if (!sm) return null
                  const isActive = modal.status === s
                  const idx = STATUS_FLOW.indexOf(s)
                  const currentIdx = STATUS_FLOW.indexOf(modal.status as any)
                  const isPast = currentIdx >= 0 && idx < currentIdx
                  return (
                    <button key={s} onClick={() => cambiarEstado(modal.id, s)} style={{
                      padding: '7px 14px', fontSize: 12, fontWeight: 600, borderRadius: 8,
                      border: '1px solid ' + sm.color + '44',
                      background: isActive ? sm.color + '30' : '#1A2230',
                      color: isActive ? sm.color : isPast ? '#49566A' : sm.color + 'aa',
                      cursor: 'pointer', fontFamily: 'inherit',
                      opacity: isPast ? 0.5 : 1,
                    }}>
                      {sm.icon} {sm.label}
                    </button>
                  )
                })}
              </div>
              {/* Cancel button */}
              {modal.status !== 'delivered' && modal.status !== 'cancelled' && (
                <button onClick={() => cambiarEstado(modal.id, 'cancelled')} style={{
                  marginTop: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 8,
                  border: '1px solid #F8717144', background: '#F8717118', color: '#F87171',
                  cursor: 'pointer', fontFamily: 'inherit'
                }}>
                  ✖️ Cancelar pedido
                </button>
              )}
            </div>

            {/* Timestamps */}
            <div style={{ fontSize: 11, color: '#49566A', display: 'flex', gap: 16 }}>
              <span>Creado: {new Date(modal.created_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
              {modal.updated_at && modal.updated_at !== modal.created_at && (
                <span>Actualizado: {new Date(modal.updated_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
              )}
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}

/** Extract delivery address from notes or dedicated field */
function extractAddress(order: any): string | null {
  if (order.customer_address) return order.customer_address
  if (order.delivery_address) return order.delivery_address
  if (order.notes && (order.notes.startsWith('DIRECCION:') || order.notes.startsWith('DIRECCIÓN:'))) {
    const parts = order.notes.split(' | ')
    const addrPart = parts.find((p: string) => p.startsWith('DIRECCION:') || p.startsWith('DIRECCIÓN:'))
    if (addrPart) return addrPart.replace(/^DIRECCI[OÓ]N:\s*/, '')
  }
  return null
}
