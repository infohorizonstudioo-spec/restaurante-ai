'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BUSINESS_TEMPLATES } from '@/types'
import type { Tenant, Call, Reservation } from '@/types'
import { Phone, Calendar, Users, Clock, TrendingUp, ArrowRight, Zap, AlertCircle } from 'lucide-react'

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

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"/>
        <p className="text-sm text-slate-500">Cargando...</p>
      </div>
    </div>
  )
  if (!tenant) return null

  const template = BUSINESS_TEMPLATES[tenant.type] || BUSINESS_TEMPLATES.otro
  const today = new Date().toISOString().split('T')[0]
  const todayRes = reservations.filter(r => r.reservation_date === today)
  const isTrial = !tenant.plan || tenant.plan === 'trial' || tenant.plan === 'free'
  const callsLeft = Math.max(0, (tenant.free_calls_limit || 10) - (tenant.free_calls_used || 0))
  const dateStr = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

  const stats = [
    { label: 'Llamadas totales', value: calls.length, icon: Phone, color: 'text-indigo-600', bg: 'bg-indigo-50', href: '/llamadas' },
    { label: template.reservationUnit === 'mesa' ? 'Reservas hoy' : 'Citas hoy', value: todayRes.length, icon: Calendar, color: 'text-emerald-600', bg: 'bg-emerald-50', href: '/reservas' },
    { label: 'Clientes', value: 0, icon: Users, color: 'text-sky-600', bg: 'bg-sky-50', href: '/clientes' },
    isTrial
      ? { label: 'Llamadas gratis', value: callsLeft, icon: Zap, color: callsLeft <= 3 ? 'text-amber-600' : 'text-violet-600', bg: callsLeft <= 3 ? 'bg-amber-50' : 'bg-violet-50', href: '/precios' }
      : { label: 'Uso del mes', value: `${tenant.plan_calls_used || 0}/${tenant.plan_calls_included || 50}`, icon: TrendingUp, color: 'text-violet-600', bg: 'bg-violet-50', href: '/precios' }
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 px-6 h-14 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-slate-900">Centro de control</h1>
          <p className="text-xs text-slate-500 capitalize">{dateStr}</p>
        </div>
        <div className="flex items-center gap-2">
          {isTrial && callsLeft <= 3 && (
            <a href="/precios" className="flex items-center gap-1.5 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors">
              <AlertCircle size={12} />
              {callsLeft} llamadas gratis restantes
            </a>
          )}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"/>
            Agente activo
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* Nombre negocio */}
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{tenant.name}</h2>
          <p className="text-sm text-slate-500 mt-0.5">{template.label} · {isTrial ? 'Plan trial' : `Plan ${tenant.plan}`}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s, i) => {
            const Icon = s.icon
            return (
              <a key={i} href={s.href}
                className="bg-white rounded-xl border border-slate-200 p-5 hover:border-indigo-300 hover:shadow-sm transition-all group">
                <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
                  <Icon size={18} className={s.color} />
                </div>
                <p className="text-2xl font-bold text-slate-900 tracking-tight">{s.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
              </a>
            )
          })}
        </div>

        {/* Content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          
          {/* Llamadas */}
          <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Phone size={15} className="text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-900">Últimas llamadas</h3>
              </div>
              <a href="/llamadas" className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                Ver todas <ArrowRight size={12} />
              </a>
            </div>
            {calls.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Phone size={18} className="text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-600">Sin llamadas aún</p>
                <p className="text-xs text-slate-400 mt-1">Las llamadas del agente aparecerán aquí</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {calls.slice(0,6).map(c => (
                  <div key={c.id} className="flex items-start justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center mt-0.5 flex-shrink-0">
                        <Phone size={13} className="text-slate-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">{c.from_number || 'Desconocido'}</p>
                        <p className="text-xs text-slate-500 truncate">{c.summary || 'Sin resumen'}</p>
                        {c.action_suggested && (
                          <p className="text-xs text-indigo-600 mt-0.5 flex items-center gap-1">
                            <Zap size={10} /> {c.action_suggested}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right ml-3 shrink-0">
                      <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-md font-medium ${c.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
                        {c.status || 'activa'}
                      </span>
                      <p className="text-xs text-slate-400 mt-1">
                        {c.created_at ? new Date(c.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reservas/Citas hoy */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Calendar size={15} className="text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-900">{template.reservationUnit === 'mesa' ? 'Reservas' : 'Citas'} hoy</h3>
              </div>
              <a href="/agenda" className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                Agenda <ArrowRight size={12} />
              </a>
            </div>
            {todayRes.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Calendar size={18} className="text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-600">Ninguna hoy</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {todayRes.slice(0,8).map(r => (
                  <div key={r.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{r.customer_name}</p>
                      <p className="text-xs text-slate-500">{r.party_size} pers.{r.source === 'voice_agent' ? ' · IA' : ''}</p>
                    </div>
                    <span className="text-sm font-mono font-medium text-slate-700 ml-2 shrink-0">
                      {r.reservation_time?.slice(0,5)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Accesos rápidos */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Accesos rápidos</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {template.modules.map((mod: string) => {
              const item = NAV_ITEMS_SIMPLE[mod]
              if (!item) return null
              const Icon = item.icon
              return (
                <a key={mod} href={item.href}
                  className="bg-white border border-slate-200 rounded-xl p-3.5 text-center hover:border-indigo-300 hover:shadow-sm transition-all group flex flex-col items-center gap-2">
                  <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center group-hover:bg-indigo-50 transition-colors">
                    <Icon size={15} className="text-slate-500 group-hover:text-indigo-600 transition-colors" />
                  </div>
                  <p className="text-xs font-medium text-slate-600 group-hover:text-slate-900 transition-colors">{item.label}</p>
                </a>
              )
            })}
          </div>
        </div>

        {/* CTA sin número */}
        {!tenant.agent_phone && (
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="font-semibold text-white text-sm">Activa tu recepcionista AI</p>
              <p className="text-indigo-200 text-xs mt-0.5">Configura el número de teléfono para recibir llamadas</p>
            </div>
            <a href="/configuracion" className="bg-white text-indigo-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-50 transition-colors shrink-0 ml-4">
              Configurar
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

import { LayoutDashboard, Calendar, CalendarDays, Grid3X3, ShoppingBag, Users, Phone, Bell, Star } from 'lucide-react'
const NAV_ITEMS_SIMPLE: Record<string, {icon:any;label:string;href:string}> = {
  resumen: {icon:LayoutDashboard,label:'Inicio',href:'/panel'},
  reservas:{icon:Calendar,label:'Reservas',href:'/reservas'},
  citas:{icon:Calendar,label:'Citas',href:'/reservas'},
  mesas:{icon:Grid3X3,label:'Mesas',href:'/mesas'},
  pedidos:{icon:ShoppingBag,label:'Pedidos',href:'/pedidos'},
  agenda:{icon:CalendarDays,label:'Agenda',href:'/agenda'},
  clientes:{icon:Users,label:'Clientes',href:'/clientes'},
  conversaciones:{icon:Phone,label:'Llamadas',href:'/llamadas'},
  seguimientos:{icon:Bell,label:'Seguim.',href:'/llamadas'},
  oportunidades:{icon:Star,label:'Oport.',href:'/clientes'},
}