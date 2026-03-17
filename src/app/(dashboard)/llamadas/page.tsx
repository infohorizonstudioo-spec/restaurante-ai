'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

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

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando...</div>

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold text-gray-900">Llamadas</h1><span className="text-sm text-gray-500">{calls.length} llamadas</span></div>
      {calls.length === 0 ? (
        <div className="bg-white rounded-2xl border p-16 text-center"><p className="text-4xl mb-4">📞</p><p className="text-gray-500 font-medium">Sin llamadas aún</p><p className="text-gray-400 text-sm mt-2">Cuando el agente reciba llamadas aparecerán aquí</p></div>
      ) : (
        <div className="bg-white rounded-2xl border overflow-hidden">
          {calls.map(call => (
            <div key={call.id} className="px-6 py-4 hover:bg-gray-50 border-b last:border-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${call.status==='completed'?'bg-green-100':'bg-blue-100'}`}><span>📲</span></div>
                  <div>
                    <p className="font-medium text-gray-900">{call.from_number||'Número desconocido'}</p>
                    {call.summary && <p className="text-sm text-gray-600">{call.summary}</p>}
                    {call.action_suggested && <div className="mt-1 inline-flex bg-indigo-50 rounded-lg px-2 py-0.5"><span className="text-xs text-indigo-600">💡 {call.action_suggested}</span></div>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${call.status==='completed'?'bg-green-100 text-green-700':'bg-blue-100 text-blue-700'}`}>{call.status||'activa'}</span>
                  <p className="text-xs text-gray-400 mt-1">{call.created_at?new Date(call.created_at).toLocaleString('es-ES',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):''}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}