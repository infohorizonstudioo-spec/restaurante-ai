'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Phone, PhoneIncoming, Zap, Clock } from 'lucide-react'

export default function LlamadasPage() {
  const [calls, setCalls] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
      if (!p?.tenant_id) return
      const { data: c } = await supabase.from('calls').select('*').eq('tenant_id', (p as any).tenant_id).order('created_at', { ascending: false }).limit(50)
      setCalls(c || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"/></div>

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 h-14 flex items-center">
        <div className="flex items-center gap-2">
          <Phone size={16} className="text-slate-400" />
          <h1 className="text-sm font-semibold text-slate-900">Llamadas</h1>
          <span className="text-xs text-slate-400">{calls.length} registradas</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-5">
        {calls.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <div className="w-11 h-11 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Phone size={20} className="text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-700">Sin llamadas aún</p>
            <p className="text-xs text-slate-400 mt-1">Las llamadas del agente aparecerán aquí en tiempo real</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="divide-y divide-slate-50">
              {calls.map(c => (
                <div key={c.id} className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${c.status === 'completed' ? 'bg-emerald-100' : 'bg-blue-100'}`}>
                    <PhoneIncoming size={15} className={c.status === 'completed' ? 'text-emerald-600' : 'text-blue-600'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm text-slate-900">{c.from_number || 'Número desconocido'}</p>
                      <span className={`inline-flex items-center text-[11px] px-2 py-0.5 rounded-md font-medium border ${c.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                        {c.status || 'activa'}
                      </span>
                      {c.duration && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                          <Clock size={10} /> {Math.floor(c.duration/60)}m {c.duration%60}s
                        </span>
                      )}
                    </div>
                    {c.summary && <p className="text-xs text-slate-600 mt-1">{c.summary}</p>}
                    {c.action_suggested && (
                      <div className="mt-1.5 inline-flex items-center gap-1 text-xs text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">
                        <Zap size={11} /> {c.action_suggested}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-slate-400">
                      {c.created_at ? new Date(c.created_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}