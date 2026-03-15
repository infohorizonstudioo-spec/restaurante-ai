
export default function DashboardPage() {
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [calls, setCalls] = useState<Call[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [time, setTime] = useState('')

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }))
    tick(); const t = setInterval(tick, 1000); return () => clearInterval(t)
  }, [])

  useEffect(() => {
    async function load() {
      const t = await getDemoTenant()
      if (!t) return
      setTenant(t)
      const today = new Date().toISOString().split('T')[0]
      const [res, ord, cal, ale] = await Promise.all([
        supabase.from('reservations').select('*').eq('tenant_id', t.id).eq('date', today).order('time'),
        supabase.from('orders').select('*').eq('tenant_id', t.id).not('status', 'in', '("entregado","cancelado")').order('created_at', { ascending: false }),
        supabase.from('calls').select('*').eq('tenant_id', t.id).eq('status', 'activa'),
        supabase.from('alerts').select('*').eq('tenant_id', t.id).eq('read', false).order('created_at', { ascending: false }).limit(5),
      ])
      setReservations(res.data || [])
      setOrders(ord.data || [])
      setCalls(cal.data || [])
      setAlerts(ale.data || [])
    }
    load()
    const channel = supabase.channel('dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const today = new Date().toISOString().split('T')[0]
  const todayRes = reservations.filter(r => r.date === today)
  const pendingRes = todayRes.filter(r => r.status === 'pendiente').length
  const confirmedRes = todayRes.filter(r => r.status === 'confirmada').length
  const totalPeople = todayRes.reduce((s, r) => s + r.people, 0)

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{tenant?.name || 'Dashboard'}</h1>
          <p className="text-white/40 text-sm mt-0.5">{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <div className="flex items-center gap-3">
          {calls.length > 0 && (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot"/>
              <span className="text-emerald-400 text-sm font-medium">{calls.length} llamada{calls.length > 1 ? 's' : ''} activa{calls.length > 1 ? 's' : ''}</span>
            </div>
          )}
          <div className="glass rounded-xl px-4 py-2 font-mono text-sm text-white/50">{time}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Reservas hoy', value: todayRes.length, sub: `${totalPeople} personas`, color: 'from-violet-500/20 to-indigo-500/20', border: 'border-violet-500/20', href: '/reservas' },
          { label: 'Confirmadas', value: confirmedRes, sub: `${pendingRes} pendientes`, color: 'from-emerald-500/20 to-teal-500/20', border: 'border-emerald-500/20', href: '/reservas' },
          { label: 'Pedidos activos', value: orders.length, sub: 'en cocina', color: 'from-orange-500/20 to-amber-500/20', border: 'border-orange-500/20', href: '/pedidos' },
          { label: 'Llamadas activas', value: calls.length, sub: calls.length > 0 ? 'IA atendiendo' : 'Líneas libres', color: 'from-blue-500/20 to-cyan-500/20', border: 'border-blue-500/20', href: '/llamadas' },
        ].map(card => (
          <Link key={card.label} href={card.href} className={`glass glass-hover rounded-2xl p-5 bg-gradient-to-br ${card.color} border ${card.border} transition-all hover:scale-[1.02] cursor-pointer slide-in`}>
            <div className="text-4xl font-black mb-1">{card.value}</div>
            <div className="text-xs text-white/40">{card.label}</div>
            <div className="text-xs text-white/25 mt-0.5">{card.sub}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <h2 className="font-semibold text-sm">Reservas de hoy</h2>
            <Link href="/reservas" className="text-xs text-violet-400 hover:text-violet-300">Ver todas →</Link>
          </div>
          <div className="divide-y divide-white/[0.05]">
            {todayRes.length === 0 ? (
              <div className="py-12 text-center text-white/25 text-sm">Sin reservas para hoy</div>
            ) : todayRes.slice(0, 7).map(r => (
              <div key={r.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.02]">
                <div className="text-sm font-mono text-white/40 w-12 shrink-0">{r.time.slice(0,5)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.customer_name}</p>
                  <p className="text-xs text-white/30">{r.people} pers · {r.zone}</p>
                </div>
                {r.allergies && <span className="text-xs text-amber-400">⚠</span>}
                <StatusBadge status={r.status}/>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="glass rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06]"><h2 className="font-semibold text-sm">Avisos</h2></div>
            <div className="p-3 space-y-2">
              <div className="rounded-xl px-3 py-2.5 text-xs bg-violet-500/10 border border-violet-500/20 text-violet-300">
                <p className="font-medium">Reserva grande a las 21:30</p>
                <p className="opacity-70 mt-0.5">Diego Ruiz · 8 personas · Mesa privada</p>
              </div>
              <div className="rounded-xl px-3 py-2.5 text-xs bg-amber-500/10 border border-amber-500/20 text-amber-300">
                <p className="font-medium">Alergia detectada</p>
                <p className="opacity-70 mt-0.5">Ana Martínez · 14:30 · Frutos secos</p>
              </div>
              {alerts.map(a => (
                <div key={a.id} className={`rounded-xl px-3 py-2.5 text-xs ${a.severity === 'urgent' ? 'bg-orange-500/10 border border-orange-500/20 text-orange-300' : 'bg-blue-500/10 border border-blue-500/20 text-blue-300'}`}>
                  <p className="font-medium">{a.title}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="glass rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <h2 className="font-semibold text-sm">Pedidos activos</h2>
              <Link href="/pedidos" className="text-xs text-violet-400">Ver →</Link>
            </div>
            <div className="p-3 space-y-2">
              {orders.length === 0 ? (
                <p className="text-xs text-white/25 text-center py-4">Sin pedidos activos</p>
              ) : orders.slice(0, 4).map(o => (
                <div key={o.id} className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/[0.03]">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{o.customer_name || 'Pedido'}</p>
                    <p className="text-[10px] text-white/30">{o.total?.toFixed(2)}€</p>
                  </div>
                  <StatusBadge status={o.status}/>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
