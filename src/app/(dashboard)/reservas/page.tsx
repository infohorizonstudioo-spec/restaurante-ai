'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BUSINESS_TEMPLATES } from '@/types'
import type { Reservation, Tenant, Table, Zone } from '@/types'

export default function ReservasPage() {
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [tables, setTables] = useState<Table[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ customer_name: '', customer_phone: '', reservation_date: new Date().toISOString().split('T')[0], reservation_time: '13:00', party_size: 2, table_id: '', notes: '', status: 'confirmada' })

  useEffect(() => { loadData() }, [selectedDate])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
    if (!profile) return
    const tid = (profile as any).tenant_id
    const [{ data: t }, { data: r }, { data: tb }, { data: z }] = await Promise.all([
      supabase.from('tenants').select('*').eq('id', tid).single(),
      supabase.from('reservations').select('*').eq('tenant_id', tid).eq('reservation_date', selectedDate).order('reservation_time'),
      supabase.from('tables').select('*').eq('tenant_id', tid),
      supabase.from('zones').select('*').eq('tenant_id', tid)
    ])
    setTenant(t); setReservations(r || []); setTables(tb || []); setZones(z || [])
    setLoading(false)
  }

  async function createReservation() {
    if (!tenant || !form.customer_name || !form.reservation_date || !form.reservation_time) return
    const tableData = form.table_id ? tables.find(t => t.id === form.table_id) : null
    await supabase.from('reservations').insert({ tenant_id: tenant.id, ...form, party_size: parseInt(form.party_size as any), table_name: tableData?.name, source: 'manual' })
    setShowAdd(false); loadData()
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('reservations').update({ status }).eq('id', id)
    setReservations(prev => prev.map(r => r.id === id ? { ...r, status: status as any } : r))
  }

  const template = tenant ? BUSINESS_TEMPLATES[tenant.type] || BUSINESS_TEMPLATES.otro : BUSINESS_TEMPLATES.otro
  const unit = template.reservationUnit === 'mesa' ? 'reserva' : 'cita'
  const sc: Record<string,string> = { confirmada:'bg-green-100 text-green-700', pendiente:'bg-yellow-100 text-yellow-700', cancelada:'bg-red-100 text-red-700', completada:'bg-gray-100 text-gray-700' }

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando...</div>

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold">{template.reservationUnit === 'mesa' ? 'Reservas' : 'Citas'}</h1><p className="text-sm text-gray-500">{reservations.length} para {new Date(selectedDate + 'T12:00').toLocaleDateString('es-ES')}</p></div>
        <div className="flex items-center gap-3">
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="border border-gray-300 rounded-xl px-3 py-2 text-sm"/>
          <button onClick={() => setShowAdd(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700">+ Nueva {unit}</button>
        </div>
      </div>
      {reservations.length === 0 ? (
        <div className="bg-white rounded-2xl border p-12 text-center">
          <p className="text-4xl mb-3">{template.reservationUnit === 'mesa' ? '🪑' : '📅'}</p>
          <p className="text-gray-500">No hay {unit}s para este día</p>
          <button onClick={() => setShowAdd(true)} className="mt-4 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium">Crear {unit}</button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border overflow-hidden">
          {reservations.map(res => (
            <div key={res.id} className="flex items-center justify-between px-6 py-4 border-b last:border-0 hover:bg-gray-50">
              <div className="flex items-center gap-4">
                <p className="w-14 text-xl font-mono font-bold">{res.reservation_time?.slice(0,5)}</p>
                <div>
                  <p className="font-medium">{res.customer_name}</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm text-gray-500">👥 {res.party_size} pers.</span>
                    {res.customer_phone && <span className="text-sm text-gray-500">📱 {res.customer_phone}</span>}
                    {res.table_name && <span className="text-sm text-gray-500">🪑 {res.table_name}</span>}
                    {res.source === 'voice_agent' && <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">🤖 IA</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${sc[res.status]||sc.confirmada}`}>{res.status}</span>
                <select value={res.status} onChange={e => updateStatus(res.id, e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1">
                  <option value="confirmada">Confirmada</option><option value="pendiente">Pendiente</option><option value="completada">Completada</option><option value="cancelada">Cancelada</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-3">
            <h3 className="font-bold text-lg">Nueva {unit}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium text-gray-700">Nombre *</label><input value={form.customer_name} onChange={e => setForm({...form, customer_name: e.target.value})} className="w-full mt-1 border border-gray-300 rounded-xl px-3 py-2 text-sm"/></div>
              <div><label className="text-sm font-medium text-gray-700">Teléfono</label><input value={form.customer_phone} onChange={e => setForm({...form, customer_phone: e.target.value})} className="w-full mt-1 border border-gray-300 rounded-xl px-3 py-2 text-sm"/></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="text-sm font-medium text-gray-700">Fecha *</label><input type="date" value={form.reservation_date} onChange={e => setForm({...form, reservation_date: e.target.value})} className="w-full mt-1 border border-gray-300 rounded-xl px-3 py-2 text-sm"/></div>
              <div><label className="text-sm font-medium text-gray-700">Hora *</label><input type="time" value={form.reservation_time} onChange={e => setForm({...form, reservation_time: e.target.value})} className="w-full mt-1 border border-gray-300 rounded-xl px-3 py-2 text-sm"/></div>
              <div><label className="text-sm font-medium text-gray-700">Personas</label><input type="number" value={form.party_size} onChange={e => setForm({...form, party_size: parseInt(e.target.value)})} min={1} className="w-full mt-1 border border-gray-300 rounded-xl px-3 py-2 text-sm"/></div>
            </div>
            {template.hasTableManagement && tables.length > 0 && (
              <div><label className="text-sm font-medium text-gray-700">Mesa</label>
                <select value={form.table_id} onChange={e => setForm({...form, table_id: e.target.value})} className="w-full mt-1 border border-gray-300 rounded-xl px-3 py-2 text-sm">
                  <option value="">Sin asignar</option>
                  {zones.map(z => <optgroup key={z.id} label={z.name}>{tables.filter(t => t.zone_id === z.id).map(t => <option key={t.id} value={t.id}>{t.name} ({t.capacity}p)</option>)}</optgroup>)}
                </select>
              </div>
            )}
            <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} placeholder="Notas..." className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none"/>
            <div className="flex gap-2"><button onClick={() => setShowAdd(false)} className="flex-1 border border-gray-300 rounded-xl py-2 text-sm">Cancelar</button><button onClick={createReservation} className="flex-1 bg-indigo-600 text-white rounded-xl py-2 text-sm font-medium">Crear {unit}</button></div>
          </div>
        </div>
      )}
    </div>
  )
}