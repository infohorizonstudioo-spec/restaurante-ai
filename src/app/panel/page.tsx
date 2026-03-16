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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Centro de control de {tenant.name}</h1>
        <p className="text-sm text-gray-500">{template.icon} {template.label}</p>
      </div>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <a href="/panel/llamadas" className="bg-white rounded-2xl border p-5 hover:shadow-md transition-all">
            <p className="text-2xl mb-1">📞</p>
            <p className="text-3xl font-bold">{calls.length}</p>
            <p className="text-sm text-gray-500">Llamadas</p>
          </a>
          <a href="/panel/reservas" className="bg-white rounded-2xl border p-5 hover:shadow-md transition-all">
            <p className="text-2xl mb-1">{template.reservationUnit === 'mesa' ? '🪑' : '📅'}</p>
            <p className="text-3xl font-bold">{todayRes.length}</p>
            <p className="text-sm text-gray-500">{template.reservationUnit === 'mesa' ? 'Reservas' : 'Citas'} hoy</p>
          </a>
          <a href="/panel/clientes" className="bg-white rounded-2xl border p-5 hover:shadow-md transition-all">
            <p className="text-2xl mb-1">👥</p>
            <p className="text-3xl font-bold">0</p>
            <p className="text-sm text-gray-500">Clientes</p>
          </a>
          {tenant.plan === 'trial' && (
            <a href="/precios" className="bg-amber-50 rounded-2xl border border-amber-200 p-5 hover:shadow-md transition-all">
              <p className="text-2xl mb-1">⏳</p>
              <p className="text-3xl font-bold text-amber-700">{callsLeft}</p>
              <p className="text-sm text-amber-600">Llamadas gratis</p>
            </a>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl border">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold">Últimas llamadas</h2>
              <a href="/panel/llamadas" className="text-sm text-indigo-600">Ver todas</a>
            </div>
            {calls.length === 0 ? (
              <div className="p-10 text-center text-gray-400"><p className="text-3xl mb-2">📞</p><p>Sin llamadas aún</p></div>
            ) : calls.slice(0,6).map(c => (
              <div key={c.id} className="px-6 py-3 border-b last:border-0 flex justify-between">
                <div>
                  <p className="font-medium text-sm">{c.from_number || 'Desconocido'}</p>
                  <p className="text-xs text-gray-500 truncate max-w-xs">{c.summary || 'Sin resumen'}</p>
                </div>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full self-start">{c.status || 'ok'}</span>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl border">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold">{template.reservationUnit === 'mesa' ? 'Reservas' : 'Citas'}</h2>
              <a href="/panel/reservas" className="text-sm text-indigo-600">Ver</a>
            </div>
            {todayRes.length === 0 ? (
              <div className="p-10 text-center text-gray-400"><p className="text-3xl mb-2">📅</p><p>Ninguna hoy</p></div>
            ) : todayRes.slice(0,8).map(r => (
              <div key={r.id} className="px-6 py-3 border-b last:border-0 flex justify-between">
                <div>
                  <p className="font-medium text-sm">{r.customer_name}</p>
                  <p className="text-xs text-gray-500">{r.party_size} pers.</p>
                </div>
                <p className="font-mono text-sm">{r.reservation_time?.slice(0,5)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}