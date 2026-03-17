'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BUSINESS_TEMPLATES } from '@/types'
import type { Tenant, Call, Reservation } from '@/types'

export default function PanelPage() {
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [calls, setCalls] = useState<Call[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      const { data: profile } = await supabase.from('profiles').select('tenant_id, role').eq('id', user.id).single()
      if (!profile) { window.location.href = '/login'; return }
      if ((profile as any).role === 'superadmin') { window.location.href = '/admin'; return }
      const tid = (profile as any).tenant_id
      const today = new Date().toISOString().split('T')[0]
      const [{ data: t }, { data: c }, { data: r }] = await Promise.all([
        supabase.from('tenants').select('*').eq('id', tid).single(),
        supabase.from('calls').select('*').eq('tenant_id', tid).order('created_at', { ascending: false }).limit(10),
        supabase.from('reservations').select('*').eq('tenant_id', tid).gte('reservation_date', today).order('reservation_date').limit(20)
      ])
      setTenant(t); setCalls(c || []); setReservations(r || [])
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"/></div>
  if (!tenant) return null

  const template = BUSINESS_TEMPLATES[tenant.type] || BUSINESS_TEMPLATES.otro
  const today = new Date().toISOString().split('T')[0]
  const todayRes = reservations.filter(r => r.reservation_date === today)
  const callsLeft = Math.max(0, (tenant.free_calls_limit || 10) - (tenant.free_calls_used || 0))
  const isTrial = !tenant.plan || tenant.plan === 'trial' || tenant.plan === 'free'

  const modLinks: Record<string, {icon:string;label:string;href:string}> = {
    resumen:{icon:'📊',label:'Resumen',href:'/panel'},
    reservas:{icon:'📅',label:'Reservas',href:'/reservas'},
    citas:{icon:'📅',label:'Citas',href:'/reservas'},
    mesas:{icon:'🪑',label:'Mesas',href:'/mesas'},
    pedidos:{icon:'📦',label:'Pedidos',href:'/pedidos'},
    agenda:{icon:'🗓️',label:'Agenda',href:'/agenda'},
    clientes:{icon:'👥',label:'Clientes',href:'/clientes'},
    conversaciones:{icon:'💬',label:'Llamadas',href:'/llamadas'},
    seguimientos:{icon:'🔔',label:'Seguim.',href:'/llamadas'},
    oportunidades:{icon:'⭐',label:'Oport.',href:'/clientes'},
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3 max-w-7xl mx-auto">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Centro de control de {tenant.name}</h1>
            <p className="text-sm text-gray-500">{template.icon} {template.label}</p>
          </div>
          {isTrial && callsLeft <= 3 && (
            <a href="/precios" className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-sm text-amber-700 font-medium hover:bg-amber-100 transition-colors">
              ⏳ {callsLeft} llamadas gratis restantes — <span className="underline">Activar plan</span>
            </a>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Tarjetas */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <a href="/llamadas" className="bg-white rounded-2xl border p-5 hover:shadow-md transition-all group">
            <p className="text-2xl mb-2 group-hover:scale-110 transition-transform inline-block">📞</p>
            <p className="text-3xl font-bold text-gray-900">{calls.length}</p>
            <p className="text-sm text-gray-500 mt-0.5">Llamadas</p>
          </a>
          <a href="/reservas" className="bg-white rounded-2xl border p-5 hover:shadow-md transition-all group">
            <p className="text-2xl mb-2 group-hover:scale-110 transition-transform inline-block">{template.reservationUnit === 'mesa' ? '🪑' : '📅'}</p>
            <p className="text-3xl font-bold text-gray-900">{todayRes.length}</p>
            <p className="text-sm text-gray-500 mt-0.5">{template.reservationUnit === 'mesa' ? 'Reservas' : 'Citas'} hoy</p>
          </a>
          <a href="/clientes" className="bg-white rounded-2xl border p-5 hover:shadow-md transition-all group">
            <p className="text-2xl mb-2 group-hover:scale-110 transition-transform inline-block">👥</p>
            <p className="text-3xl font-bold text-gray-900">0</p>
            <p className="text-sm text-gray-500 mt-0.5">Clientes</p>
          </a>
          {isTrial ? (
            <a href="/precios" className="bg-amber-50 rounded-2xl border border-amber-200 p-5 hover:shadow-md transition-all group">
              <p className="text-2xl mb-2">⏳</p>
              <p className="text-3xl font-bold text-amber-700">{callsLeft}</p>
              <p className="text-sm text-amber-600 mt-0.5">Llamadas gratis</p>
            </a>
          ) : (
            <a href="/llamadas" className="bg-white rounded-2xl border p-5 hover:shadow-md transition-all group">
              <p className="text-2xl mb-2">💬</p>
              <p className="text-3xl font-bold text-gray-900">{tenant.plan_calls_used || 0}/{tenant.plan_calls_included || 50}</p>
              <p className="text-sm text-gray-500 mt-0.5">Uso del mes</p>
            </a>
          )}
        </div>

        {/* Llamadas + Reservas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl border">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold text-gray-900">Últimas llamadas</h2>
              <a href="/llamadas" className="text-sm text-indigo-600 hover:underline">Ver todas →</a>
            </div>
            {calls.length === 0 ? (
              <div className="p-10 text-center text-gray-400"><p className="text-3xl mb-2">📞</p><p>Sin llamadas aún</p><p className="text-xs mt-1">Cuando el agente reciba llamadas aparecerán aquí</p></div>
            ) : calls.slice(0,6).map(c => (
              <div key={c.id} className="px-6 py-3.5 border-b last:border-0 flex justify-between items-start hover:bg-gray-50 transition-colors">
                <div className="min-w-0">
                  <p className="font-medium text-sm text-gray-900">{c.from_number || 'Desconocido'}</p>
                  <p className="text-xs text-gray-500 truncate max-w-xs mt-0.5">{c.summary || 'Sin resumen'}</p>
                  {c.action_suggested && <p className="text-xs text-indigo-600 mt-0.5">💡 {c.action_suggested}</p>}
                </div>
                <div className="text-right shrink-0 ml-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${c.status==='completed'?'bg-green-100 text-green-700':'bg-blue-100 text-blue-700'}`}>{c.status||'activa'}</span>
                  <p className="text-xs text-gray-400 mt-1">{c.created_at?new Date(c.created_at).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}):''}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold text-gray-900">{template.reservationUnit === 'mesa' ? 'Reservas' : 'Citas'} hoy</h2>
              <a href="/agenda" className="text-sm text-indigo-600 hover:underline">Agenda →</a>
            </div>
            {todayRes.length === 0 ? (
              <div className="p-10 text-center text-gray-400"><p className="text-3xl mb-2">📅</p><p className="text-sm">Ninguna hoy</p></div>
            ) : todayRes.slice(0,8).map(r => (
              <div key={r.id} className="px-6 py-3 border-b last:border-0 flex justify-between items-center hover:bg-gray-50">
                <div>
                  <p className="font-medium text-sm text-gray-900">{r.customer_name}</p>
                  <p className="text-xs text-gray-500">{r.party_size} pers.{r.source==='voice_agent'?' · 🤖':''}</p>
                </div>
                <p className="font-mono text-sm text-gray-700">{r.reservation_time?.slice(0,5)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Accesos rápidos */}
        <div>
          <h2 className="font-semibold text-gray-900 mb-3">Accesos rápidos</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {template.modules.map((mod: string) => {
              const cfg = modLinks[mod] || {icon:'📌',label:mod,href:'/panel'}
              return (
                <a key={mod} href={cfg.href} className="bg-white border border-gray-200 rounded-xl p-3 text-center hover:border-indigo-300 hover:shadow-sm transition-all group">
                  <div className="text-xl mb-1 group-hover:scale-110 transition-transform inline-block">{cfg.icon}</div>
                  <p className="text-xs font-medium text-gray-700">{cfg.label}</p>
                </a>
              )
            })}
          </div>
        </div>

        {/* Aviso agente sin número */}
        {!tenant.agent_phone && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-indigo-900">Activa tu recepcionista AI</h3>
              <p className="text-sm text-indigo-700 mt-1">Configura el número de teléfono para empezar a recibir llamadas</p>
            </div>
            <a href="/configuracion" className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors shrink-0 ml-4">
              Configurar →
            </a>
          </div>
        )}
      </div>
    </div>
  )
}