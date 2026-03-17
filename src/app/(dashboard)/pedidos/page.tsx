'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const STATUS_COLORS: Record<string, string> = {
  nuevo: 'bg-blue-100 text-blue-700',
  preparacion: 'bg-yellow-100 text-yellow-700',
  listo: 'bg-green-100 text-green-700',
  reparto: 'bg-orange-100 text-orange-700',
  entregado: 'bg-gray-100 text-gray-600',
}
const STATUS_LABELS: Record<string, string> = {
  nuevo: '🆕 Nuevo', preparacion: '👨‍🍳 En preparación',
  listo: '✅ Listo', reparto: '🛵 En reparto', entregado: '📦 Entregado',
}

export default function PedidosPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tenantId, setTenantId] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
      if (!p?.tenant_id) return
      setTenantId((p as any).tenant_id)
      const { data: o } = await supabase.from('orders')
        .select('*').eq('tenant_id', (p as any).tenant_id)
        .order('created_at', { ascending: false }).limit(50)
      setOrders(o || [])
      setLoading(false)
    }
    load()
  }, [])

  async function updateStatus(id: string, status: string) {
    await supabase.from('orders').update({ status }).eq('id', id)
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o))
  }

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando pedidos...</div>

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pedidos</h1>
          <p className="text-sm text-gray-500">{orders.length} pedidos</p>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
          <p className="text-4xl mb-4">📦</p>
          <p className="text-gray-500 font-medium">Sin pedidos aún</p>
          <p className="text-gray-400 text-sm mt-2">Los pedidos tomados por el agente aparecerán aquí</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(order => (
            <div key={order.id} className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <p className="font-semibold text-gray-900">{order.customer_name}</p>
                  <p className="text-sm text-gray-500">{order.customer_phone}</p>
                  {order.customer_address && (
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-sm text-gray-600">{order.customer_address}</p>
                      <a href={`https://maps.google.com/?q=${encodeURIComponent(order.customer_address)}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-lg hover:bg-blue-100 transition-colors">
                        📍 Maps
                      </a>
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${STATUS_COLORS[order.status] || STATUS_COLORS.nuevo}`}>
                    {STATUS_LABELS[order.status] || order.status}
                  </span>
                  <p className="text-xs text-gray-400 mt-1.5">
                    {order.created_at ? new Date(order.created_at).toLocaleString('es-ES', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : ''}
                  </p>
                </div>
              </div>

              {order.items && order.items.length > 0 && (
                <div className="bg-gray-50 rounded-xl p-3 mb-3">
                  <p className="text-xs font-medium text-gray-500 mb-2">PRODUCTOS</p>
                  {order.items.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-gray-700">{item.quantity}x {item.name}</span>
                      {item.price && <span className="text-gray-900 font-medium">{(item.quantity * item.price).toFixed(2)}€</span>}
                    </div>
                  ))}
                  {order.total && (
                    <div className="flex justify-between text-sm font-bold border-t border-gray-200 mt-2 pt-2">
                      <span>Total</span><span>{order.total.toFixed(2)}€</span>
                    </div>
                  )}
                </div>
              )}

              {order.notes && <p className="text-sm text-gray-500 italic mb-3">"{order.notes}"</p>}

              <div className="flex gap-2 flex-wrap">
                {['nuevo','preparacion','listo','reparto','entregado'].map(s => (
                  <button key={s} onClick={() => updateStatus(order.id, s)}
                    className={`text-xs px-3 py-1.5 rounded-xl border transition-all ${order.status === s ? (STATUS_COLORS[s] + ' border-transparent font-semibold') : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}