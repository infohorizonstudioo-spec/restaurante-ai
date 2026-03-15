'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { supabase, getDemoTenant } from '@/lib/supabase'
import type { Call } from '@/types'

export default function LlamadasPage() {
  const [calls, setCalls] = useState<Call[]>([])
  const [elapsed, setElapsed] = useState<Record<string,number>>({})

  useEffect(() => {
    async function load() {
      const t = await getDemoTenant()
      if (!t) return
      const { data } = await supabase.from('calls').select('*').eq('tenant_id', t.id).order('started_at', { ascending: false }).limit(20)
      setCalls(data || [])
    }
    load()
    const interval = setInterval(() => {
      setCalls(prev => prev.map(c => c.status === 'activa' ? {...c, duration_seconds: c.duration_seconds + 1} : c))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const active = calls.filter(c => c.status === 'activa')
  const history = calls.filter(c => c.status !== 'activa')

  function formatDuration(s: number) {
    const m = Math.floor(s/60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2,'0')}`
  }

  const INTENT_LABELS: Record<string,string> = {
    reservation: '📅 Reserva', order: '🍽️ Pedido', info: 'ℹ️ Información',
    cancel: '❌ Cancelación', complaint: '⚠️ Queja', unknown: '❓ Desconocida'
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Llamadas</h1>
        <p className="text-white/40 text-sm">{active.length} activas · {history.length} en historial</p>
      </div>

      {/* Llamadas activas */}
      {active.length === 0 ? (
        <div className="glass rounded-2xl py-20 text-center space-y-3">
          <div className="text-5xl">📞</div>
          <p className="text-white/30 text-sm">Sin llamadas activas</p>
          <p className="text-white/15 text-xs">La IA atenderá automáticamente las próximas llamadas</p>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider">En curso</h2>
          {active.map(call => (
            <div key={call.id} className="glass rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-xl pulse-dot">
                  📞
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <p className="font-bold text-lg">{call.caller_name || call.caller_phone || 'Llamada entrante'}</p>
                    <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">
                      {formatDuration(call.duration_seconds)}
                    </span>
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot"/>
                  </div>
                  {call.caller_phone && call.caller_name && <p className="text-sm text-white/40">{call.caller_phone}</p>}
                  {call.intent && (
                    <p className="text-sm text-white/60 mt-2">
                      Intención: <span className="text-violet-300">{INTENT_LABELS[call.intent] || call.intent}</span>
                    </p>
                  )}
                  {call.generating_reservation && (
                    <div className="mt-3 bg-violet-500/10 border border-violet-500/25 rounded-xl px-3 py-2 text-sm text-violet-300">
                      ✨ Generando reserva automáticamente...
                    </div>
                  )}
                </div>
              </div>
              {call.transcript && call.transcript.length > 0 && (
                <div className="mt-4 space-y-2 max-h-40 overflow-y-auto">
                  {call.transcript.slice(-4).map((t, i) => (
                    <div key={i} className={`text-xs px-3 py-2 rounded-lg max-w-[80%] ${t.role === 'assistant' ? 'bg-violet-500/15 text-violet-200 ml-auto' : 'bg-white/5 text-white/60'}`}>
                      {t.content}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Historial */}
      {history.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3">Historial reciente</h2>
          <div className="glass rounded-2xl overflow-hidden divide-y divide-white/[0.05]">
            {history.map(call => (
              <div key={call.id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02]">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm
                  ${call.status === 'completada' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                  {call.status === 'completada' ? '✓' : '✗'}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{call.caller_name || call.caller_phone || 'Desconocido'}</p>
                  <p className="text-xs text-white/30">{call.intent ? INTENT_LABELS[call.intent] || call.intent : '—'}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-white/40 font-mono">{formatDuration(call.duration_seconds)}</p>
                  <p className="text-xs text-white/25">{new Date(call.started_at).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
