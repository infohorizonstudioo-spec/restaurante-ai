'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CalendarDays, Bot } from 'lucide-react'
const HOURS = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00']
export default function AgendaPage() {
  const [reservations, setReservations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
      if (!p?.tenant_id) return
      const { data: r } = await supabase.from('reservations').select('*').eq('tenant_id', (p as any).tenant_id).eq('reservation_date', selectedDate).order('reservation_time')
      setReservations(r || []); setLoading(false)
    }
    load()
  }, [selectedDate])
  const today = new Date().toISOString().split('T')[0]
  const weekDays = Array.from({length:7},(_,i) => { const d = new Date(); d.setDate(d.getDate()-3+i); return { date: d.toISOString().split('T')[0], day: d.toLocaleDateString('es-ES',{weekday:'short'}).slice(0,3), num: d.getDate(), isToday: d.toISOString().split('T')[0]===today }})
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"/></div>
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2"><CalendarDays size={16} className="text-slate-400"/><h1 className="text-sm font-semibold text-slate-900">Agenda</h1></div>
        <input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
      </header>
      <div className="max-w-4xl mx-auto px-6 py-5 space-y-4">
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1.5">
          {weekDays.map(d=><button key={d.date} onClick={()=>setSelectedDate(d.date)} className={`flex-1 flex flex-col items-center py-2 rounded-lg text-xs font-medium transition-all ${selectedDate===d.date?'bg-indigo-600 text-white':d.isToday?'text-indigo-600 bg-indigo-50':'text-slate-500 hover:bg-slate-50'}`}><span className="capitalize text-[10px] opacity-75">{d.day}</span><span className="text-sm font-bold mt-0.5">{d.num}</span></button>)}
        </div>
        <p className="text-sm font-medium text-slate-700 capitalize">{new Date(selectedDate+'T12:00').toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'})} · <span className="text-slate-400 font-normal">{reservations.length} {reservations.length===1?'reserva':'reservas'}</span></p>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {HOURS.map(hour=>{
            const res = reservations.filter(r=>r.reservation_time?.slice(0,5)===hour)
            const isPast = selectedDate===today && parseInt(hour)<new Date().getHours()
            return <div key={hour} className={`flex items-start border-b last:border-0 border-slate-50 ${res.length>0?'bg-indigo-50/30':isPast?'bg-slate-50/50':''}`}>
              <div className={`w-16 flex-shrink-0 px-4 py-3.5 text-xs font-mono font-medium ${isPast?'text-slate-300':'text-slate-400'}`}>{hour}</div>
              <div className="flex-1 px-3 py-2.5 min-h-[44px] flex items-center flex-wrap gap-2">
                {res.length===0?<div className="w-full h-px bg-slate-100"/>:res.map(r=><div key={r.id} className="inline-flex items-center gap-2 bg-indigo-600 text-white rounded-lg px-3 py-1.5 text-xs"><span className="font-semibold">{r.customer_name}</span><span className="opacity-75">{r.party_size}p</span>{r.table_name&&<span className="opacity-75">· {r.table_name}</span>}{r.source==='voice_agent'&&<Bot size={10} className="opacity-75"/>}</div>)}
              </div>
            </div>
          })}
        </div>
      </div>
    </div>
  )
}