'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { BUSINESS_TEMPLATES } from '@/types'
import type { Reservation, Tenant, Table, Zone } from '@/types'
import { Plus, Calendar, Users, Phone, MapPin, Bot, ChevronLeft, ChevronRight, X } from 'lucide-react'

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  confirmada: { label: 'Confirmada', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  pendiente:  { label: 'Pendiente',  cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  cancelada:  { label: 'Cancelada',  cls: 'bg-red-50 text-red-700 border-red-200' },
  completada: { label: 'Completada', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
}

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
    const { data: p } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
    if (!p?.tenant_id) return
    const tid = (p as any).tenant_id
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
  const dateLabel = new Date(selectedDate + 'T12:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

  // Week navigation
  const weekDays = Array.from({length:7},(_,i) => {
    const d = new Date(); d.setDate(d.getDate() - 3 + i)
    return { date: d.toISOString().split('T')[0], day: d.toLocaleDateString('es-ES',{weekday:'short'}).slice(0,3), num: d.getDate() }
  })

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"/></div>

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-slate-400" />
          <h1 className="text-sm font-semibold text-slate-900">{template.reservationUnit === 'mesa' ? 'Reservas' : 'Citas'}</h1>
          <span className="text-xs text-slate-400 ml-1">{reservations.length} para hoy</span>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 bg-indigo-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors">
          <Plus size={13} /> Nueva {unit}
        </button>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-5 space-y-4">
        {/* Week selector */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1.5">
          {weekDays.map(d => (
            <button key={d.date} onClick={() => setSelectedDate(d.date)}
              className={`flex-1 flex flex-col items-center py-2 px-1 rounded-lg text-xs font-medium transition-all ${
                selectedDate === d.date
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}>
              <span className="capitalize text-[10px] opacity-75">{d.day}</span>
              <span className="text-sm font-bold mt-0.5">{d.num}</span>
            </button>
          ))}
        </div>

        {/* Table */}
        {reservations.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <div className="w-11 h-11 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Calendar size={20} className="text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-700">Sin {unit}s para el {dateLabel}</p>
            <p className="text-xs text-slate-400 mt-1 mb-4">Crea una manualmente o el agente las añadirá automáticamente</p>
            <button onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-1.5 bg-indigo-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
              <Plus size={13} /> Nueva {unit}
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Hora</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Cliente</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Personas</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Mesa</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {reservations.map(res => (
                  <tr key={res.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-sm font-semibold text-slate-900">{res.reservation_time?.slice(0,5)}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-slate-900">{res.customer_name}</p>
                          {res.source === 'voice_agent' && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md font-medium">
                              <Bot size={9} /> IA
                            </span>
                          )}
                        </div>
                        {res.customer_phone && <p className="text-xs text-slate-400 mt-0.5">{res.customer_phone}</p>}
                        {res.notes && <p className="text-xs text-slate-400 italic mt-0.5 truncate max-w-xs">{res.notes}</p>}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      <div className="flex items-center gap-1 text-slate-600">
                        <Users size={13} className="text-slate-400" />
                        <span className="text-sm">{res.party_size}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      {res.table_name
                        ? <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded-md">{res.table_name}</span>
                        : <span className="text-xs text-slate-400">—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <select value={res.status} onChange={e => updateStatus(res.id, e.target.value)}
                        className={`text-xs font-medium px-2 py-1 rounded-md border appearance-none cursor-pointer focus:outline-none ${(STATUS_MAP[res.status] || STATUS_MAP.confirmada).cls}`}>
                        {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">Nueva {unit}</h3>
              <button onClick={() => setShowAdd(false)} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <X size={15} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Nombre *</label>
                  <input value={form.customer_name} onChange={e => setForm({...form, customer_name: e.target.value})}
                    placeholder="Juan García"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"/>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Teléfono</label>
                  <input value={form.customer_phone} onChange={e => setForm({...form, customer_phone: e.target.value})}
                    placeholder="+34 600 000 000"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"/>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Fecha *</label>
                  <input type="date" value={form.reservation_date} onChange={e => setForm({...form, reservation_date: e.target.value})}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"/>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Hora *</label>
                  <input type="time" value={form.reservation_time} onChange={e => setForm({...form, reservation_time: e.target.value})}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"/>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Personas</label>
                  <input type="number" value={form.party_size} min={1}
                    onChange={e => setForm({...form, party_size: parseInt(e.target.value)})}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"/>
                </div>
              </div>
              {template.hasTableManagement && tables.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Mesa</label>
                  <select value={form.table_id} onChange={e => setForm({...form, table_id: e.target.value})}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                    <option value="">Sin asignar</option>
                    {zones.map(z => <optgroup key={z.id} label={z.name}>{tables.filter(t => t.zone_id === z.id).map(t => <option key={t.id} value={t.id}>{t.name} ({t.capacity}p)</option>)}</optgroup>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">Notas</label>
                <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2}
                  placeholder="Alergias, peticiones especiales..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"/>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setShowAdd(false)}
                className="flex-1 border border-slate-200 text-slate-700 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button onClick={createReservation}
                className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors">
                Crear {unit}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}