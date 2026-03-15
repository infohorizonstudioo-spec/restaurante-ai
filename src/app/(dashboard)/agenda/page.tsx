'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { supabase, getDemoTenant } from '@/lib/supabase'
import type { Reservation } from '@/types'

const HOURS = Array.from({length:14}, (_,i) => i + 9) // 9-22h

export default function AgendaPage() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [view, setView] = useState<'day'|'week'>('day')

  useEffect(() => {
    async function load() {
      const t = await getDemoTenant()
      if (!t) return
      const { data } = await supabase.from('reservations').select('*').eq('tenant_id', t.id).order('date').order('time')
      setReservations(data || [])
    }
    load()
  }, [])

  const dayRes = reservations.filter(r => r.date === selectedDate)

  function getWeekDays() {
    const days = []
    const d = new Date(selectedDate)
    const day = d.getDay()
    const mon = new Date(d); mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
    for (let i = 0; i < 7; i++) {
      const dd = new Date(mon); dd.setDate(mon.getDate() + i)
      days.push(dd.toISOString().split('T')[0])
    }
    return days
  }

  const weekDays = getWeekDays()
  const STATUS_COLOR: Record<string,string> = {
    pendiente:'bg-amber-500/30 border-amber-500/50 text-amber-200',
    confirmada:'bg-emerald-500/30 border-emerald-500/50 text-emerald-200',
    sentada:'bg-blue-500/30 border-blue-500/50 text-blue-200',
    cancelada:'bg-red-500/20 border-red-500/30 text-red-300',
    completada:'bg-white/5 border-white/10 text-white/30',
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agenda</h1>
          <p className="text-white/40 text-sm">{dayRes.length} reservas el {new Date(selectedDate+'T12:00').toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'})}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {(['day','week'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${view===v?'bg-white/12 text-white':'text-white/40 hover:text-white/60'}`}>
                {v === 'day' ? 'Día' : 'Semana'}
              </button>
            ))}
          </div>
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            className="glass rounded-xl px-3 py-2 text-sm text-white/70 bg-transparent"/>
        </div>
      </div>

      {view === 'day' ? (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="divide-y divide-white/[0.04]">
            {HOURS.map(h => {
              const hRes = dayRes.filter(r => parseInt(r.time) === h)
              return (
                <div key={h} className="flex gap-4 px-5 py-3 min-h-[60px]">
                  <div className="w-12 shrink-0 text-sm font-mono text-white/25 pt-1">{h}:00</div>
                  <div className="flex-1 flex flex-wrap gap-2">
                    {hRes.map(r => (
                      <div key={r.id} className={`rounded-xl px-3 py-2 text-xs border ${STATUS_COLOR[r.status] || STATUS_COLOR.pendiente} min-w-[140px]`}>
                        <p className="font-semibold">{r.customer_name}</p>
                        <p className="opacity-70">{r.time.slice(0,5)} · {r.people}p · {r.zone}</p>
                        {r.notes && <p className="opacity-50 truncate mt-0.5">{r.notes}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="grid grid-cols-8 border-b border-white/[0.06]">
            <div className="px-3 py-3"/>
            {weekDays.map(d => {
              const dd = new Date(d+'T12:00')
              const isToday = d === new Date().toISOString().split('T')[0]
              const isSelected = d === selectedDate
              return (
                <button key={d} onClick={() => { setSelectedDate(d); setView('day') }}
                  className={`px-2 py-3 text-center transition-all hover:bg-white/[0.03] ${isSelected ? 'bg-violet-500/15' : ''}`}>
                  <p className="text-xs text-white/30">{dd.toLocaleDateString('es-ES',{weekday:'short'})}</p>
                  <p className={`text-lg font-bold mt-0.5 ${isToday ? 'text-violet-400' : 'text-white/70'}`}>
                    {dd.getDate()}
                  </p>
                  <p className="text-[10px] text-white/25">{reservations.filter(r=>r.date===d).length} res.</p>
                </button>
              )
            })}
          </div>
          {HOURS.map(h => (
            <div key={h} className="grid grid-cols-8 border-b border-white/[0.04] min-h-[52px]">
              <div className="px-3 py-2 text-xs font-mono text-white/20">{h}:00</div>
              {weekDays.map(d => {
                const hRes = reservations.filter(r => r.date === d && parseInt(r.time) === h)
                return (
                  <div key={d} className="px-1 py-1 border-l border-white/[0.04]">
                    {hRes.map(r => (
                      <div key={r.id} className={`rounded px-1.5 py-1 text-[10px] mb-0.5 border ${STATUS_COLOR[r.status] || STATUS_COLOR.pendiente}`}>
                        {r.customer_name.split(' ')[0]} · {r.people}p
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
