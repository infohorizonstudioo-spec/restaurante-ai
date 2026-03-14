'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const STATUS_CONFIG: Record<string, { label: string; color: string; next: string }> = {
  nuevo:      { label: '🔔 Nuevo',       color: 'bg-yellow-500', next: 'confirmado' },
  confirmado: { label: '✅ Confirmado',   color: 'bg-blue-500',   next: 'preparando' },
  preparando: { label: '👨‍🍳 Preparando', color: 'bg-orange-500', next: 'enviado' },
  enviado:    { label: '🛵 Enviado',      color: 'bg-purple-500', next: 'entregado' },
  entregado:  { label: '✅ Entregado',    color: 'bg-green-500',  next: '' },
  cancelado:  { label: '❌ Cancelado',    color: 'bg-red-500',    next: '' },
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
  const [audio] = useState(typeof Audio !== 'undefined' ? new Audio('/notification.mp3') : null)

  useEffect(() => {
    // Cargar pedidos iniciales
    supabase.from('orders').select('*')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => { if (data) setOrders(data as Order[]) })

    // Suscripción Realtime — cada nuevo pedido aparece automáticamente
    const channel = supabase
      .channel('orders-panel')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders'
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setOrders(prev => [payload.new as Order, ...prev])
          audio?.play().catch(() => {})
        }
        if (payload.eventType === 'UPDATE') {
          setOrders(prev => prev.map(o => o.id === payload.new.id ? payload.new as Order : o))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function updateStatus(orderId: string, newStatus: string) {
    await supabase.from('orders').update({ status: newStatus }).eq('id', orderId)
  }

  async function cancelOrder(orderId: string) {
    await supabase.from('orders').update({ status: 'cancelado' }).eq('id', orderId)
  }

  const filtered = filter === 'todos' ? orders : orders.filter(o => o.status === filter)
  const activeCount = orders.filter(o => !['entregado','cancelado'].includes(o.status)).length

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🍕</span>
          <div>
            <h1 className="text-xl font-bold">Panel de Pedidos</h1>
            <p className="text-gray-400 text-sm">IA Restaurante · En tiempo real</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {activeCount > 0 && (
            <span className="bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-full animate-pulse">
              {activeCount} activos
            </span>
          )}
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" title="Conectado"/>
        </div>
      </div>

      {/* Filtros */}
      <div className="px-6 py-3 flex gap-2 overflow-x-auto border-b border-gray-800">
        {['todos', 'nuevo', 'confirmado', 'preparando', 'enviado', 'entregado'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all
              ${filter === s ? 'bg-white text-gray-900' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
            {s === 'todos' ? '📋 Todos' : STATUS_CONFIG[s]?.label}
          </button>
        ))}
      </div>

      {/* Pedidos */}
      <div className="p-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-20 text-gray-500">
            <p className="text-4xl mb-3">📞</p>
            <p>Esperando llamadas...</p>
          </div>
        )}
        {filtered.map(order => (
          <OrderCard key={order.id} order={order} onUpdateStatus={updateStatus} onCancel={cancelOrder} />
        ))}
      </div>
    </div>
  )
}

function OrderCard({ order, onUpdateStatus, onCancel }: {
  order: Order
  onUpdateStatus: (id: string, status: string) => void
  onCancel: (id: string) => void
}) {
  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.nuevo
  const time = new Date(order.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  const isActive = !['entregado', 'cancelado'].includes(order.status)

  return (
    <div className={`bg-gray-900 rounded-2xl border overflow-hidden transition-all
      ${order.status === 'nuevo' ? 'border-yellow-500 shadow-yellow-500/20 shadow-lg' : 'border-gray-800'}`}>

      {/* Status bar */}
      <div className={`${cfg.color} px-4 py-2 flex items-center justify-between`}>
        <span className="font-bold text-sm">{cfg.label}</span>
        <span className="text-sm opacity-75">{time}</span>
      </div>

      {/* Info cliente */}
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-bold text-lg">{order.customer_name || 'Sin nombre'}</p>
            <p className="text-gray-400 text-sm">📞 {order.customer_phone || '-'}</p>
          </div>
          <span className={`text-sm px-2 py-1 rounded-lg font-medium
            ${order.payment_method === 'efectivo' ? 'bg-green-900 text-green-300' : 'bg-blue-900 text-blue-300'}`}>
            {order.payment_method === 'efectivo' ? '💵 Efectivo' : '💳 Tarjeta'}
          </span>
        </div>

        <div className="bg-gray-800 rounded-xl p-3">
          <p className="text-gray-400 text-xs mb-1">📍 Dirección</p>
          <p className="text-sm">{order.delivery_address || 'Sin dirección'}</p>
        </div>

        {/* Productos */}
        <div className="space-y-1">
          {(order.items || []).map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-gray-300">{item.qty}x {item.name}</span>
              <span className="text-gray-400">{(item.qty * item.price).toFixed(2)}€</span>
            </div>
          ))}
        </div>

        {order.notes && (
          <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-2 text-sm text-yellow-200">
            📝 {order.notes}
          </div>
        )}

        <div className="flex justify-between items-center pt-2 border-t border-gray-800">
          <span className="text-gray-400 text-sm">Total</span>
          <span className="font-bold text-xl">{order.total?.toFixed(2) || '0.00'}€</span>
        </div>

        {/* Acciones */}
        {isActive && (
          <div className="flex gap-2 pt-1">
            {cfg.next && (
              <button onClick={() => onUpdateStatus(order.id, cfg.next)}
                className="flex-1 bg-white text-gray-900 font-bold py-2 px-3 rounded-xl text-sm hover:bg-gray-100 transition-all">
                {STATUS_CONFIG[cfg.next]?.label} →
              </button>
            )}
            <button onClick={() => onCancel(order.id)}
              className="px-3 py-2 bg-gray-800 text-red-400 rounded-xl text-sm hover:bg-gray-700 transition-all">
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
