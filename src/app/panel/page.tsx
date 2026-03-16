'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { BUSINESS_TEMPLATES } from '@/types'
import type { Tenant, Call, Reservation } from '@/types'

export default function PanelPage() {
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [calls, setCalls] = useState<Call[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }

      const { data: profile } = await supabase.from('profiles').select('tenant_id, role').eq('id', user.id).single()
      if (!profile) { window.location.href = '/login'; return }
      if (profile.role === 'superadmin') { window.location.href = '/admin'; return }

      const tenantId = profile.tenant_id
      const [{ data: t }, { data: c }, { data: r }] = await Promise.all([
        supabase.from('tenants').select('*').eq('id', tenantId).single(),
        supabase.from('calls').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(10),
        supabase.from('reservations').select('*').eq('tenant_id', tenantId).gte('reservation_date', new Date().toISOString().split('T')[0]).order('reservation_date').limit(20)
      ])
      setTenant(t); setCalls(c || []); setReservations(r || [])
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"/>
        <p className="text-gray-500">Cargando centro de control...</p>
      </div>
    </div>
  )

  if (!tenant) return null
  const template = BUSINESS_TEMPLATES[tenant.type as keyof typeof BUSINESS_TEMPLATES] || BUSINESS_TEMPLATES.otro
  const todayReservations = reservations.filter(r => r.reservation_date === new Date().toISOString().split('T')[0])
  const pendingCalls = calls.filter(c => c.status === 'completed' && !c.summary)
  const callsLeft = (tenant.free_calls_limit || 10) - (tenant.free_calls_used || 0)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Centro de control de {tenant.name}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {template.icon} {template.label} · {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {tenant.plan === 'trial' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-sm">
                <span className="text-amber-700 font-medium">Llamadas gratuitas: </span>
                <span className="text-amber-900 font-bold">{callsLeft} / {tenant.free_calls_limit || 10}</span>
                {callsLeft <= 2 && <a href="/precios" className="ml-2 text-indigo-600 underline">Activar plan →</a>}
              </div>
            )}
            <div className="w-2 h-2 bg-green-500 rounded-full"/>
            <span className="text-sm text-gray-500">Agente activo</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        
        {/* Tarjetas resumen */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard icon="📞" label="Llamadas hoy" value={calls.filter(c => c.created_at?.startsWith(new Date().toISOString().split('T')[0])).length} color="blue" href="/panel/llamadas"/>
          <SummaryCard icon={template.reservationUnit === 'mesa' ? '🪑' : '📅'} label={template.reservationUnit === 'mesa' ? 'Reservas hoy' : 'Citas hoy'} value={todayReservations.length} color="green" href="/panel/reservas"/>
          {template.hasOrders && <SummaryCard icon="📦" label="Pedidos pendientes" value={0} color="orange" href="/panel/pedidos"/>}
          <SummaryCard icon="💬" label="Conversaciones" value={calls.length} color="purple" href="/panel/llamadas"/>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Últimas llamadas */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Últimas llamadas</h2>
              <a href="/panel/llamadas" className="text-sm text-indigo-600 hover:underline">Ver todas →</a>
            </div>
            {calls.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-4xl mb-3">📞</p>
                <p className="text-gray-500">Aún no hay llamadas</p>
                <p className="text-sm text-gray-400 mt-1">Cuando Gabriela reciba llamadas aparecerán aquí</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {calls.slice(0, 6).map(call => (
                  <div key={call.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{call.from_number}</p>
                        {call.summary && <p className="text-sm text-gray-600 mt-0.5">{call.summary}</p>}
                        {!call.summary && <p className="text-sm text-gray-400 italic mt-0.5">Sin resumen</p>}
                      </div>
                      <div className="text-right ml-4 shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${call.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{call.status}</span>
                        <p className="text-xs text-gray-400 mt-1">{new Date(call.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                    {call.action_suggested && (
                      <div className="mt-2 bg-indigo-50 rounded-lg px-3 py-1.5">
                        <p className="text-xs text-indigo-700">💡 {call.action_suggested}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Agenda de hoy */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">{template.reservationUnit === 'mesa' ? 'Reservas' : 'Citas'} de hoy</h2>
              <a href="/panel/agenda" className="text-sm text-indigo-600 hover:underline">Agenda →</a>
            </div>
            {todayReservations.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-4xl mb-3">{template.reservationUnit === 'mesa' ? '🪑' : '📅'}</p>
                <p className="text-gray-500 text-sm">0 {template.reservationUnit === 'mesa' ? 'reservas' : 'citas'} para hoy</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {todayReservations.slice(0, 8).map(res => (
                  <div key={res.id} className="px-6 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{res.customer_name}</p>
                        <p className="text-xs text-gray-500">{res.party_size} pers. {res.table_name ? '· ' + res.table_name : ''}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-mono text-gray-700">{res.reservation_time?.slice(0,5)}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${res.status === 'confirmada' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{res.status}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Accesos rápidos por plantilla */}
        <div>
          <h2 className="font-semibold text-gray-900 mb-4">Accesos rápidos</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {template.modules.map(mod => {
              const modConfig: Record<string, { icon: string; label: string; href: string }> = {
                resumen: { icon: '📊', label: 'Resumen', href: '/panel' },
                reservas: { icon: '📅', label: 'Reservas', href: '/panel/reservas' },
                citas: { icon: '📅', label: 'Citas', href: '/panel/reservas' },
                mesas: { icon: '🪑', label: 'Mesas', href: '/panel/mesas' },
                pedidos: { icon: '📦', label: 'Pedidos', href: '/panel/pedidos' },
                agenda: { icon: '🗓️', label: 'Agenda', href: '/panel/agenda' },
                clientes: { icon: '👥', label: 'Clientes', href: '/panel/clientes' },
                pacientes: { icon: '🏥', label: 'Pacientes', href: '/panel/clientes' },
                conversaciones: { icon: '💬', label: 'Llamadas', href: '/panel/llamadas' },
                seguimientos: { icon: '🔔', label: 'Seguimientos', href: '/panel/llamadas' },
                oportunidades: { icon: '⭐', label: 'Oportunidades', href: '/panel/clientes' },
              }
              const m = modConfig[mod] || { icon: '📌', label: mod, href: '/panel' }
              return (
                <a key={mod} href={m.href} className="bg-white border border-gray-200 rounded-xl p-4 text-center hover:border-indigo-300 hover:shadow-sm transition-all group">
                  <div className="text-2xl mb-1 group-hover:scale-110 transition-transform">{m.icon}</div>
                  <p className="text-xs font-medium text-gray-700">{m.label}</p>
                </a>
              )
            })}
          </div>
        </div>

        {/* Configurar agente */}
        {!tenant.agent_phone && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-indigo-900">Activa tu recepcionista AI</h3>
              <p className="text-sm text-indigo-700 mt-1">Configura el número de teléfono para que Gabriela empiece a atender llamadas</p>
            </div>
            <a href="/configuracion" className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors">
              Configurar →
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

function SummaryCard({ icon, label, value, color, href }: {
  icon: string; label: string; value: number; color: string; href: string
}) {
  const colors = {
    blue: 'bg-blue-50 border-blue-100 text-blue-700',
    green: 'bg-green-50 border-green-100 text-green-700',
    orange: 'bg-orange-50 border-orange-100 text-orange-700',
    purple: 'bg-purple-50 border-purple-100 text-purple-700',
  }
  return (
    <a href={href} className={`${colors[color as keyof typeof colors]} border rounded-2xl p-5 hover:shadow-md transition-all block`}>
      <div className="text-2xl mb-2">{icon}</div>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm mt-0.5 opacity-80">{label}</p>
    </a>
  )
}