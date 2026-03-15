'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { supabase, getDemoTenant } from '@/lib/supabase'
import type { Order } from '@/types'

const STATUS_CFG: Record<string,{label:string;cls:string;next:string;nextLabel:string}> = {
  nuevo:      {label:'Nuevo',     cls:'bg-amber-500/15 text-amber-400 border-amber-500/25',    next:'confirmado', nextLabel:'Confirmar'},
  confirmado: {label:'Confirmado',cls:'bg-blue-500/15 text-blue-400 border-blue-500/25',       next:'preparando', nextLabel:'Preparar'},
  preparando: {label:'Preparando',cls:'bg-orange-500/15 text-orange-400 border-orange-500/25', next:'listo',      nextLabel:'Listo'},
  listo:      {label:'Listo',     cls:'bg-emerald-500/15 text-emerald-400 border-emerald-500/25', next:'enviado', nextLabel:'Enviar'},
  enviado:    {label:'Enviado',   cls:'bg-purple-500/15 text-purple-400 border-purple-500/25', next:'entregado',  nextLabel:'Entregado'},
  entregado:  {label:'Entregado', cls:'bg-white/8 text-white/30 border-white/10',              next:'',           nextLabel:''},
  cancelado:  {label:'Cancelado', cls:'bg-red-500/15 text-red-400 border-red-500/25',          next:'',           nextLabel:''},
}

export default function PedidosPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [filter, setFilter] = useState('activos')

  useEffect(() => {
    async function load() {
      const t = await getDemoTenant()
      if (!t) return
      const { data } = await supabase.from('orders').select('*').eq('tenant_id', t.id).order('created_at', { ascending: false })
      setOrders(data || [])
    }
    load()
    // eslint-disable-next-line
  }, [])

  async function updateStatus(id: string, status: string) {
    await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    setOrders(prev => prev.map(o => o.id === id ? {...o, status: status as any} : o))
  }

  const filtered = filter === 'activos'
    ? orders.filter(o => !['entregado','cancelado'].includes(o.status))
    : filter === 'todos' ? orders
    : orders.filter(o => o.status === filter)

  const active = orders.filter(o => !['entregado','cancelado'].includes(o.status))
  const urgent = orders.filter(o => o.priority === 'urgente' && !['entregado','cancelado'].includes(o.status))

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pedidos</h1>
          <p className="text-white/40 text-sm">{active.length} activos{urgent.length > 0 ? ` · ${urgent.length} urgentes` : ''}</p>
        </div>
      </div>

      <div className="flex gap-1">
        {['activos','todos','nuevo','preparando','listo'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all
              ${filter===f ? 'bg-white/12 text-white' : 'text-white/35 hover:text-white/60 hover:bg-white/5'}`}>
            {f} <span className="text-white/20 ml-1">{f==='activos'?active.length:f==='todos'?orders.length:orders.filter(o=>o.status===f).length}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.length === 0 ? (
          <div className="col-span-full glass rounded-2xl py-16 text-center text-white/25 text-sm">Sin pedidos</div>
        ) : filtered.map(order => {
          const cfg = STATUS_CFG[order.status] || STATUS_CFG.nuevo
          return (
            <div key={order.id} className={`glass rounded-2xl overflow-hidden border transition-all
              ${order.priority === 'urgente' ? 'border-red-500/30 shadow-red-500/10 shadow-lg' : 'border-white/[0.07]'}`}>
              <div className={`flex items-center justify-between px-4 py-3 border-b border-white/[0.06]`}>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2.5 py-1 rounded-full border ${cfg.cls}`}>{cfg.label}</span>
                  {order.priority === 'urgente' && <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full">Urgente</span>}
                </div>
                <span className="text-xs text-white/25 font-mono">
                  {new Date(order.created_at).toLocaleTimeString('es-ES', {hour:'2-digit',minute:'2-digit'})}
                </span>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{order.customer_name || '—'}</p>
                    <p className="text-xs text-white/35 capitalize">{order.type}</p>
                  </div>
                  <span className="font-bold text-lg">{order.total.toFixed(2)}€</span>
                </div>
                <div className="space-y-1">
                  {(order.items || []).map((item, i) => (
                    <div key={i} className="flex justify-between text-xs text-white/50">
                      <span>{item.qty}x {item.name}</span>
                      <span>{(item.qty*item.price).toFixed(2)}€</span>
                    </div>
                  ))}
                </div>
                {order.notes && <p className="text-xs text-amber-300/70 bg-amber-500/5 border border-amber-500/15 rounded-lg px-3 py-2">📝 {order.notes}</p>}
                {cfg.next && (
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => updateStatus(order.id, cfg.next)}
                      className="flex-1 bg-white text-gray-900 font-semibold py-2 rounded-xl text-sm hover:bg-white/90 transition-all active:scale-95">
                      {cfg.nextLabel} →
                    </button>
                    <button onClick={() => updateStatus(order.id, 'cancelado')}
                      className="w-9 h-9 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl hover:bg-red-500/20 transition-all text-sm flex items-center justify-center">
                      ✕
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
