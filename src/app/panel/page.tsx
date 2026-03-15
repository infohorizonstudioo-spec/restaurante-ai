'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const PLAN_LABEL: Record<string,string> = { trial:'Prueba gratuita', starter:'Starter 350€/mes', pro:'Pro 500€/mes', free:'Gratuito' }
const PLAN_COLOR: Record<string,string> = { trial:'text-white/40', starter:'text-violet-400', pro:'text-amber-400', free:'text-white/40' }

const ESTADO_PEDIDO: Record<string,{label:string,color:string}> = {
  nuevo: { label:'Nuevo', color:'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  preparando: { label:'En preparación', color:'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  listo: { label:'Listo', color:'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  reparto: { label:'En reparto', color:'bg-violet-500/20 text-violet-300 border-violet-500/30' },
  entregado: { label:'Entregado', color:'bg-white/10 text-white/40 border-white/10' },
}

const ESTADO_RESERVA: Record<string,{label:string,color:string}> = {
  confirmed: { label:'Confirmada', color:'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  pending: { label:'Pendiente', color:'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  cancelled: { label:'Cancelada', color:'bg-red-500/20 text-red-300 border-red-500/30' },
}

function Badge({ estado, map }: { estado: string; map: Record<string,{label:string,color:string}> }) {
  const s = map[estado] || { label: estado, color: 'bg-white/10 text-white/40 border-white/10' }
  return <span className={`text-[10px] px-2 py-0.5 rounded-full border ${s.color}`}>{s.label}</span>
}

export default function PanelPage() {
  const router = useRouter()
  const [tenant, setTenant] = useState<any>(null)
  const [reservas, setReservas] = useState<any[]>([])
  const [pedidos, setPedidos] = useState<any[]>([])
  const [alertas, setAlertas] = useState<any[]>([])
  const [mesas, setMesas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('resumen')
  const [time, setTime] = useState('')
  const [today, setToday] = useState('')

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setTime(now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }))
      setToday(now.toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long' }))
    }
    tick(); const t = setInterval(tick, 1000); return () => clearInterval(t)
  }, [])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('tenant_id, role').eq('id', user.id).single()
      if (profile?.role === 'superadmin') { router.push('/admin'); return }
      if (!profile?.tenant_id) { router.push('/onboarding'); return }
      const [tenantRes, reservasRes, pedidosRes, alertasRes, mesasRes] = await Promise.all([
        supabase.from('tenants').select('*').eq('id', profile.tenant_id).single(),
        supabase.from('reservations').select('*').eq('tenant_id', profile.tenant_id).order('start_time', { ascending: true }).limit(20),
        supabase.from('orders').select('*').eq('tenant_id', profile.tenant_id).neq('status', 'entregado').order('created_at', { ascending: false }).limit(10),
        supabase.from('alerts').select('*').eq('tenant_id', profile.tenant_id).eq('read', false).order('created_at', { ascending: false }).limit(10),
        supabase.from('tables').select('*').eq('tenant_id', profile.tenant_id).order('name'),
      ])
      setTenant(tenantRes.data)
      setReservas(reservasRes.data || [])
      setPedidos(pedidosRes.data || [])
      setAlertas(alertasRes.data || [])
      setMesas(mesasRes.data || [])
      setLoading(false)
    }
    load()
    const ch = supabase.channel('panel').on('postgres_changes', { event:'*', schema:'public' }, load).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  async function logout() { await supabase.auth.signOut(); router.push('/login') }

  if (loading) return <div className="min-h-screen bg-[#070710] flex items-center justify-center"><div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"/></div>

  const callsLeft = (tenant?.free_calls_limit || 10) - (tenant?.free_calls_used || 0)
  const isTrial = tenant?.plan === 'trial' || tenant?.plan === 'free'
  const reservasHoy = reservas.filter(r => { const d = new Date(r.start_time); const n = new Date(); return d.toDateString() === n.toDateString() })
  const pedidosActivos = pedidos.filter(p => p.status !== 'entregado')

  const NAV = [
    { id:'resumen',        icon:'⊞', label:'Resumen' },
    { id:'agenda',         icon:'▤', label:'Agenda' },
    { id:'pedidos',        icon:'≡', label:'Pedidos', badge: pedidosActivos.length },
    { id:'mesas',          icon:'⊡', label:'Mesas' },
    { id:'conversaciones', icon:'◉', label:'Conversaciones' },
    { id:'avisos',         icon:'▲', label:'Avisos', badge: alertas.length },
  ]

  return (
    <div className="min-h-screen bg-[#070710] text-white flex">
      {/* Sidebar */}
      <aside className="w-[200px] shrink-0 flex flex-col border-r border-white/[0.06] bg-white/[0.015]">
        <div className="px-4 pt-5 pb-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-sm font-black shadow-lg shadow-violet-500/20">R</div>
            <span className="text-xs font-bold text-white/80">Reservo.AI</span>
          </div>
          <p className="text-[10px] text-white/30 truncate">{tenant?.name}</p>
          <span className={`text-[10px] font-medium ${PLAN_COLOR[tenant?.plan] || 'text-white/40'}`}>{PLAN_LABEL[tenant?.plan] || tenant?.plan}</span>
        </div>
        <nav className="flex-1 px-2 space-y-0.5">
          {NAV.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all relative ${activeTab===item.id?'bg-white/[0.08] text-white font-medium':'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'}`}>
              <span className="text-base w-5 text-center opacity-70">{item.icon}</span>
              {item.label}
              {item.badge ? <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{item.badge}</span> : null}
            </button>
          ))}
        </nav>
        {isTrial && callsLeft <= 3 && (
          <div className="mx-3 mb-3 p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl">
            <p className="text-[11px] text-amber-300 font-medium mb-1">⚠ {callsLeft} llamadas restantes</p>
            <Link href="/precios" className="text-[11px] text-amber-400 hover:text-amber-300">Activar plan →</Link>
          </div>
        )}
        <div className="px-3 py-4 border-t border-white/[0.06]">
          <p className="text-[11px] text-white/50 font-medium mb-0.5 truncate">{tenant?.email || 'Admin'}</p>
          <button onClick={logout} className="text-[10px] text-white/25 hover:text-white/50 transition-colors">Cerrar sesión →</button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-[#070710]/90 backdrop-blur-sm border-b border-white/[0.06] px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-base">Panel de control de {tenant?.name}</h1>
            <p className="text-xs text-white/30 capitalize">{today}</p>
          </div>
          <div className="flex items-center gap-4">
            {isTrial && (
              <div className="flex items-center gap-2 text-xs">
                <div className="w-24 bg-white/10 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-violet-500 h-full rounded-full" style={{ width: `${(callsLeft / (tenant?.free_calls_limit || 10)) * 100}%` }}/>
                </div>
                <span className="text-white/40">{callsLeft}/{tenant?.free_calls_limit || 10} llamadas</span>
              </div>
            )}
            <span className="font-mono text-xs text-white/30">{time}</span>
          </div>
        </div>

        <div className="p-6">

          {/* ── RESUMEN ── */}
          {activeTab === 'resumen' && (
            <div className="space-y-6">
              {/* KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label:'Reservas hoy', value: reservasHoy.length, icon:'📅', color:'from-violet-500/15 to-indigo-500/15', border:'border-violet-500/20', action: () => setActiveTab('agenda') },
                  { label:'Pedidos activos', value: pedidosActivos.length, icon:'🛒', color:'from-orange-500/15 to-amber-500/15', border:'border-orange-500/20', action: () => setActiveTab('pedidos') },
                  { label:'Llamadas activas', value: 0, icon:'📞', color:'from-emerald-500/15 to-teal-500/15', border:'border-emerald-500/20', action: () => {} },
                  { label:'Avisos sin leer', value: alertas.length, icon:'🔔', color:'from-red-500/15 to-rose-500/15', border:'border-red-500/20', action: () => setActiveTab('avisos') },
                ].map(k => (
                  <button key={k.label} onClick={k.action}
                    className={`bg-gradient-to-br ${k.color} border ${k.border} rounded-2xl p-5 text-left hover:opacity-90 transition-all active:scale-95`}>
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-2xl">{k.icon}</span>
                    </div>
                    <div className="text-4xl font-black mb-1">{k.value}</div>
                    <div className="text-xs text-white/50">{k.label}</div>
                  </button>
                ))}
              </div>

              {/* Grid: reservas + avisos */}
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Próximas reservas */}
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                    <h2 className="font-semibold text-sm">Reservas de hoy</h2>
                    <button onClick={() => setActiveTab('agenda')} className="text-xs text-violet-400 hover:text-violet-300">Ver todas →</button>
                  </div>
                  {reservasHoy.length === 0 ? (
                    <div className="py-10 text-center text-white/25 text-sm">0 reservas para este día</div>
                  ) : (
                    <div className="divide-y divide-white/[0.04]">
                      {reservasHoy.slice(0,5).map(r => (
                        <div key={r.id} className="px-5 py-3 flex items-center gap-3">
                          <div className="font-mono text-xs text-violet-400 w-12 shrink-0">
                            {new Date(r.start_time).toLocaleTimeString('es-ES', {hour:'2-digit',minute:'2-digit'})}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{r.guest_name || 'Cliente'}</p>
                            <p className="text-xs text-white/30">{r.party_size || 1} personas{r.table_id ? ' · Mesa '+r.table_id.slice(-4) : ''}</p>
                          </div>
                          <Badge estado={r.status || 'pending'} map={ESTADO_RESERVA}/>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pedidos activos */}
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                    <h2 className="font-semibold text-sm">Pedidos activos</h2>
                    <button onClick={() => setActiveTab('pedidos')} className="text-xs text-violet-400 hover:text-violet-300">Ver todos →</button>
                  </div>
                  {pedidosActivos.length === 0 ? (
                    <div className="py-10 text-center text-white/25 text-sm">Sin pedidos activos</div>
                  ) : (
                    <div className="divide-y divide-white/[0.04]">
                      {pedidosActivos.slice(0,5).map(p => (
                        <div key={p.id} className="px-5 py-3 flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{p.customer_name || 'Cliente'}</p>
                            <p className="text-xs text-white/30">{p.customer_phone} · {new Date(p.created_at).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}</p>
                          </div>
                          <Badge estado={p.status || 'nuevo'} map={ESTADO_PEDIDO}/>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Trial banner */}
              {isTrial && (
                <div className="bg-gradient-to-r from-violet-600/20 to-indigo-600/20 border border-violet-500/30 rounded-2xl p-5 flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <p className="font-semibold text-sm">Llamadas gratuitas restantes: <span className="text-violet-400">{callsLeft} de {tenant?.free_calls_limit || 10}</span></p>
                    <p className="text-xs text-white/40 mt-0.5">Activa un plan para llamadas ilimitadas y funciones completas</p>
                  </div>
                  <Link href="/precios" className="bg-violet-600 hover:bg-violet-500 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-all shrink-0">
                    Ver planes →
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* ── AGENDA ── */}
          {activeTab === 'agenda' && (
            <div className="space-y-4">
              <h2 className="font-bold text-lg capitalize">{today}</h2>
              <div className="space-y-2">
                {['9:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00'].map(hora => {
                  const reserva = reservasHoy.find(r => { const h = new Date(r.start_time); return h.getHours() + ':' + h.getMinutes().toString().padStart(2,'0') === hora.replace(':00',':00') || (h.getHours() + ':00') === hora })
                  return (
                    <div key={hora} className={`flex gap-4 ${reserva ? '' : 'opacity-50'}`}>
                      <div className="w-14 text-xs text-white/40 font-mono pt-3 shrink-0">{hora}</div>
                      {reserva ? (
                        <div className="flex-1 bg-violet-500/10 border border-violet-500/25 rounded-xl px-4 py-3">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div>
                              <p className="font-semibold text-sm">{reserva.guest_name || 'Cliente'}</p>
                              <p className="text-xs text-white/40">{reserva.guest_phone || '—'} · {reserva.party_size || 1} personas{reserva.notes ? ' · ' + reserva.notes : ''}</p>
                            </div>
                            <Badge estado={reserva.status || 'pending'} map={ESTADO_RESERVA}/>
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 border border-white/[0.04] border-dashed rounded-xl px-4 py-3 text-xs text-white/20">Disponible</div>
                      )}
                    </div>
                  )
                })}
                {reservasHoy.length === 0 && (
                  <div className="text-center py-12 text-white/25">📅 0 reservas para este día</div>
                )}
              </div>
            </div>
          )}

          {/* ── PEDIDOS ── */}
          {activeTab === 'pedidos' && (
            <div className="space-y-4">
              <h2 className="font-bold text-lg">Gestión de pedidos</h2>
              {pedidos.length === 0 ? (
                <div className="text-center py-16 text-white/25">🛒 Sin pedidos activos</div>
              ) : pedidos.map(p => (
                <div key={p.id} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <p className="font-semibold">{p.customer_name || 'Cliente'}</p>
                      <p className="text-xs text-white/40">{p.customer_phone} · {new Date(p.created_at).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}</p>
                    </div>
                    <Badge estado={p.status || 'nuevo'} map={ESTADO_PEDIDO}/>
                  </div>
                  {p.delivery_address && (
                    <div className="flex items-center gap-2 text-xs text-white/50 mb-2">
                      <span>📍</span>
                      <span>{p.delivery_address}</span>
                      <a href={`https://maps.google.com/?q=${encodeURIComponent(p.delivery_address)}`} target="_blank" rel="noopener noreferrer"
                        className="text-violet-400 hover:text-violet-300 font-medium">Ver en Maps →</a>
                    </div>
                  )}
                  {p.items && <div className="text-xs text-white/40 mb-3 bg-white/5 rounded-lg px-3 py-2">{typeof p.items === 'string' ? p.items : JSON.stringify(p.items)}</div>}
                  {p.notes && <div className="text-xs text-white/30 italic">Nota: {p.notes}</div>}
                  <div className="flex gap-2 mt-3">
                    {Object.entries(ESTADO_PEDIDO).slice(0, -1).map(([key, val]) => (
                      <button key={key} onClick={async () => { await supabase.from('orders').update({status:key}).eq('id',p.id); setPedidos(prev => prev.map(x => x.id===p.id?{...x,status:key}:x)) }}
                        className={`text-[11px] px-3 py-1.5 rounded-lg border transition-all ${p.status===key ? val.color : 'bg-white/5 border-white/10 text-white/40 hover:border-white/25'}`}>
                        {val.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── MESAS ── */}
          {activeTab === 'mesas' && (
            <div className="space-y-4">
              <h2 className="font-bold text-lg">Gestión de mesas</h2>
              {mesas.length === 0 ? (
                <div className="text-center py-16 text-white/25">🪑 Sin mesas configuradas · Añade mesas desde tu Panel de control</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {mesas.map(m => (
                    <div key={m.id} className={`rounded-2xl p-4 border text-center ${m.status==='libre'?'bg-emerald-500/10 border-emerald-500/25':m.status==='ocupada'?'bg-red-500/10 border-red-500/25':'bg-amber-500/10 border-amber-500/25'}`}>
                      <div className="text-lg font-black mb-1">{m.name}</div>
                      <div className="text-xs text-white/50 mb-2">{m.zone || 'Interior'} · {m.capacity || 4} personas</div>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border ${m.status==='libre'?'bg-emerald-500/20 text-emerald-300 border-emerald-500/30':m.status==='ocupada'?'bg-red-500/20 text-red-300 border-red-500/30':'bg-amber-500/20 text-amber-300 border-amber-500/30'}`}>
                        {m.status === 'libre' ? 'Libre' : m.status === 'ocupada' ? 'Ocupada' : 'Reservada'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── CONVERSACIONES ── */}
          {activeTab === 'conversaciones' && (
            <div className="space-y-4">
              <h2 className="font-bold text-lg">Conversaciones activas</h2>
              <div className="text-center py-16 text-white/25">💬 Sin conversaciones activas</div>
            </div>
          )}

          {/* ── AVISOS ── */}
          {activeTab === 'avisos' && (
            <div className="space-y-4">
              <h2 className="font-bold text-lg">Avisos importantes</h2>
              {alertas.length === 0 ? (
                <div className="text-center py-16 text-white/25">🔔 Sin avisos pendientes</div>
              ) : alertas.map(a => (
                <div key={a.id} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 flex items-start gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 ${a.type==='reservation'?'bg-violet-500/20':a.type==='order'?'bg-orange-500/20':a.type==='call'?'bg-emerald-500/20':'bg-red-500/20'}`}>
                    {a.type==='reservation'?'📅':a.type==='order'?'🛒':a.type==='call'?'📞':'⚠'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{a.message || a.title || 'Aviso'}</p>
                    <p className="text-xs text-white/30 mt-0.5">{new Date(a.created_at).toLocaleString('es-ES')}</p>
                  </div>
                  <button onClick={async () => { await supabase.from('alerts').update({read:true}).eq('id',a.id); setAlertas(prev => prev.filter(x => x.id !== a.id)) }}
                    className="text-white/30 hover:text-white/60 text-xl shrink-0">✕</button>
                </div>
              ))}
            </div>
          )}

        </div>
      </main>
    </div>
  )
}