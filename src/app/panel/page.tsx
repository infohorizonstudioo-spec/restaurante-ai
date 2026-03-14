'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; next: string; icon: string }> = {
  nuevo:      { label: 'Nuevo',       color: 'text-amber-400',   bg: 'bg-amber-400/10 border-amber-400/30',   next: 'confirmado', icon: '🔔' },
  confirmado: { label: 'Confirmado',  color: 'text-blue-400',    bg: 'bg-blue-400/10 border-blue-400/30',     next: 'preparando', icon: '✅' },
  preparando: { label: 'Preparando',  color: 'text-orange-400',  bg: 'bg-orange-400/10 border-orange-400/30', next: 'enviado',    icon: '👨‍🍳' },
  enviado:    { label: 'En camino',   color: 'text-purple-400',  bg: 'bg-purple-400/10 border-purple-400/30', next: 'entregado',  icon: '🛵' },
  entregado:  { label: 'Entregado',   color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/30', next: '', icon: '✅' },
  cancelado:  { label: 'Cancelado',   color: 'text-red-400',     bg: 'bg-red-400/10 border-red-400/30',       next: '', icon: '✕' },
}

const NEXT_LABEL: Record<string, string> = {
  confirmado: 'Confirmar',
  preparando: 'Preparar',
  enviado: 'Enviar',
  entregado: 'Entregado',
}

interface Order {
  id: string
  customer_name: string
  customer_phone: string
  delivery_address: string
  payment_method: string
  items: Array<{ name: string; qty: number; price: number }>
  notes: string
  total: number
  status: string
  created_at: string
}

export default function PanelPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [filter, setFilter] = useState('todos')
  const [time, setTime] = useState('')

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    supabase.from('orders').select('*')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => { if (data) setOrders(data as Order[]) })

    const channel = supabase.channel('orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setOrders(prev => [payload.new as Order, ...prev])
          try { new Audio('/notification.mp3').play() } catch {}
        }
        if (payload.eventType === 'UPDATE') {
          setOrders(prev => prev.map(o => o.id === payload.new.id ? payload.new as Order : o))
        }
      }).subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function updateStatus(orderId: string, newStatus: string) {
    await supabase.from('orders').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', orderId)
  }

  async function cancelOrder(orderId: string) {
    await supabase.from('orders').update({ status: 'cancelado', updated_at: new Date().toISOString() }).eq('id', orderId)
  }

  const filtered = filter === 'todos' ? orders : orders.filter(o => o.status === filter)
  const activeCount = orders.filter(o => !['entregado', 'cancelado'].includes(o.status)).length
  const todayRevenue = orders.filter(o => o.status === 'entregado' && new Date(o.created_at).toDateString() === new Date().toDateString()).reduce((s, o) => s + (o.total || 0), 0)
  const totalToday = orders.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString()).length

  const filters = ['todos', 'nuevo', 'confirmado', 'preparando', 'enviado', 'entregado']

  return (
    <div className="min-h-screen bg-[#080810] text-white font-sans">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl"/>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl"/>
      </div>

      {/* Header */}
      <header className="relative border-b border-white/5 bg-white/[0.02] backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-pink-600 flex items-center justify-center text-lg shadow-lg shadow-orange-500/20">
              🍕
            </div>
            <div>
              <h1 className="font-bold text-lg leading-none">Panel de Pedidos</h1>
              <p className="text-xs text-white/30 mt-0.5">IA Restaurante · Tiempo real</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-6 text-sm">
              <div className="text-center">
                <div className="text-xl font-bold text-orange-400">{activeCount}</div>
                <div className="text-xs text-white/30">Activos</div>
              </div>
              <div className="w-px h-8 bg-white/10"/>
              <div className="text-center">
                <div className="text-xl font-bold text-emerald-400">{todayRevenue.toFixed(0)}€</div>
                <div className="text-xs text-white/30">Hoy</div>
              </div>
              <div className="w-px h-8 bg-white/10"/>
              <div className="text-center">
                <div className="text-xl font-bold text-blue-400">{totalToday}</div>
                <div className="text-xs text-white/30">Pedidos</div>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
              <span className="text-xs text-white/50 font-mono">{time}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Filter tabs */}
      <div className="relative border-b border-white/5 bg-white/[0.01]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1 py-2 overflow-x-auto scrollbar-hide">
            {filters.map(s => {
              const cfg = STATUS_CONFIG[s]
              const count = s === 'todos' ? orders.length : orders.filter(o => o.status === s).length
              const active = filter === s
              return (
                <button key={s} onClick={() => setFilter(s)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200
                    ${active ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}>
                  <span>{s === 'todos' ? '📋' : cfg?.icon}</span>
                  <span>{s === 'todos' ? 'Todos' : cfg?.label}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-mono
                    ${active ? 'bg-white/20 text-white' : 'bg-white/5 text-white/30'}`}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="relative max-w-7xl mx-auto px-6 py-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl mb-4">
              📞
            </div>
            <p className="text-white/30 text-sm">Esperando llamadas...</p>
            <p className="text-white/15 text-xs mt-1">Los pedidos aparecerán aquí en tiempo real</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map(order => (
              <OrderCard key={order.id} order={order} onUpdateStatus={updateStatus} onCancel={cancelOrder} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function OrderCard({ order, onUpdateStatus, onCancel }: {
  order: Order
  onUpdateStatus: (id: string, status: string) => void
  onCancel: (id: string) => void
}) {
  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.nuevo
  const isNew = order.status === 'nuevo'
  const isActive = !['entregado', 'cancelado'].includes(order.status)
  const time = new Date(order.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  const items = order.items || []

  return (
    <div className={`relative rounded-2xl border bg-white/[0.03] backdrop-blur-sm overflow-hidden transition-all duration-300 hover:bg-white/[0.05]
      ${isNew ? 'border-amber-500/40 shadow-lg shadow-amber-500/10' : 'border-white/8'}`}>

      {/* Glow for new orders */}
      {isNew && <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none"/>}

      {/* Top bar */}
      <div className={`flex items-center justify-between px-4 py-3 border-b border-white/5`}>
        <div className={`flex items-center gap-2 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.color}`}>
          <span>{cfg.icon}</span>
          <span>{cfg.label}</span>
        </div>
        <span className="text-xs text-white/25 font-mono">{time}</span>
      </div>

      <div className="p-4 space-y-3">
        {/* Customer */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-white">{order.customer_name || 'Sin nombre'}</p>
            <p className="text-xs text-white/35 mt-0.5">{order.customer_phone || '—'}</p>
          </div>
          <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium border
            ${order.payment_method === 'efectivo'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-blue-500/10 border-blue-500/30 text-blue-400'}`}>
            {order.payment_method === 'efectivo' ? '💵 Efectivo' : '💳 Tarjeta'}
          </span>
        </div>

        {/* Address */}
        <div className="flex items-start gap-2 bg-white/[0.03] border border-white/5 rounded-xl px-3 py-2.5">
          <span className="text-sm mt-0.5">📍</span>
          <p className="text-xs text-white/60 leading-relaxed">{order.delivery_address || 'Sin dirección'}</p>
        </div>

        {/* Items */}
        {items.length > 0 && (
          <div className="space-y-1.5">
            {items.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-white/10 flex items-center justify-center text-[10px] font-bold text-white/60">
                    {item.qty}
                  </span>
                  <span className="text-white/70">{item.name}</span>
                </div>
                <span className="text-white/35 font-mono">{(item.qty * item.price).toFixed(2)}€</span>
              </div>
            ))}
          </div>
        )}

        {/* Notes */}
        {order.notes && (
          <div className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/20 rounded-xl px-3 py-2.5">
            <span className="text-sm">📝</span>
            <p className="text-xs text-amber-300/70">{order.notes}</p>
          </div>
        )}

        {/* Total */}
        <div className="flex items-center justify-between pt-1 border-t border-white/5">
          <span className="text-xs text-white/25">Total del pedido</span>
          <span className="font-bold text-lg text-white">{(order.total || 0).toFixed(2)}€</span>
        </div>

        {/* Actions */}
        {isActive && (
          <div className="flex gap-2">
            {cfg.next && (
              <button onClick={() => onUpdateStatus(order.id, cfg.next)}
                className="flex-1 bg-white text-gray-900 font-semibold py-2.5 px-4 rounded-xl text-sm hover:bg-white/90 active:scale-95 transition-all">
                {NEXT_LABEL[cfg.next] || cfg.next} →
              </button>
            )}
            {order.status !== 'entregado' && (
              <button onClick={() => onCancel(order.id)}
                className="w-10 h-10 flex items-center justify-center bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl hover:bg-red-500/20 active:scale-95 transition-all text-sm">
                ✕
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
