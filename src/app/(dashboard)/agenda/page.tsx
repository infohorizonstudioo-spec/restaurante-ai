'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const HOURS = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00']

export default function AgendaPage() {
  const [tenantId, setTenantId] = useState('')
  const [reservations, setReservations] = useState<any[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
      if (!p?.tenant_id) return
      setTenantId((p as any).tenant_id)
      const { data: r } = await supabase.from('reservations').select('*').eq('tenant_id', (p as any).tenant_id).eq('reservation_date', selectedDate).order('reservation_time')
      setReservations(r || [])
      setLoading(false)
    }
    load()
  }, [selectedDate])

  const dateLabel = new Date(selectedDate + 'T12:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  const dateLabels = [-1,0,1,2,3,4,5].map(d => {
    const dt = new Date(); dt.setDate(dt.getDate() + d)
    return { date: dt.toISOString().split('T')[0], label: dt.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }) }
  })

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando agenda...</div>

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
          className="border border-gray-300 rounded-xl px-3 py-2 text-sm"/>
      </div>

      {/* Week selector */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {dateLabels.map(d => (
          <button key={d.date} onClick={() => setSelectedDate(d.date)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${selectedDate === d.date ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
            {d.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 capitalize">{dateLabel}</h2>
          <span className="text-sm text-gray-500">{reservations.length} {reservations.length === 1 ? 'reserva' : 'reservas'}</span>
        </div>
        <div className="divide-y divide-gray-50">
          {HOURS.map(hour => {
            const res = reservations.filter(r => r.reservation_time?.slice(0,5) === hour)
            return (
              <div key={hour} className={`flex items-start gap-4 px-6 py-3 ${res.length > 0 ? 'bg-indigo-50/40' : ''}`}>
                <span className="text-sm font-mono text-gray-400 w-14 pt-0.5 shrink-0">{hour}</span>
                {res.length === 0 ? (
                  <span className="text-sm text-gray-300 italic">—</span>
                ) : (
                  <div className="flex flex-wrap gap-2 flex-1">
                    {res.map(r => (
                      <div key={r.id} className="bg-indigo-100 border border-indigo-200 rounded-xl px-3 py-2 text-sm">
                        <p className="font-medium text-indigo-900">{r.customer_name}</p>
                        <p className="text-indigo-600 text-xs">{r.party_size} pers.{r.table_name ? ' · ' + r.table_name : ''}{r.source === 'voice_agent' ? ' · 🤖 IA' : ''}</p>
                        {r.notes && <p className="text-indigo-500 text-xs italic mt-0.5">"{r.notes}"</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {reservations.length === 0 && (
          <div className="px-6 py-10 text-center text-gray-400">
            <p className="text-3xl mb-2">📅</p>
            <p>Sin reservas para este día</p>
          </div>
        )}
      </div>
    </div>
  )
}