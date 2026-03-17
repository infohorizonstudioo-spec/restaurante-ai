'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Users, Search, Phone, Calendar } from 'lucide-react'
export default function ClientesPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
      if (!p?.tenant_id) return
      const { data: c } = await supabase.from('customers').select('*').eq('tenant_id', (p as any).tenant_id).order('created_at', { ascending: false })
      setCustomers(c || []); setLoading(false)
    }
    load()
  }, [])
  const filtered = customers.filter(c => !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search))
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"/></div>
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2"><Users size={16} className="text-slate-400"/><h1 className="text-sm font-semibold text-slate-900">Clientes</h1><span className="text-xs text-slate-400">{customers.length} registrados</span></div>
        <div className="relative"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar..." className="pl-8 pr-4 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-52"/></div>
      </header>
      <div className="max-w-5xl mx-auto px-6 py-5">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <div className="w-11 h-11 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3"><Users size={20} className="text-slate-400"/></div>
            <p className="text-sm font-semibold text-slate-700">{search ? 'Sin resultados' : 'Sin clientes aún'}</p>
            <p className="text-xs text-slate-400 mt-1">Los clientes se añaden automáticamente con cada reserva del agente</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Cliente</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Teléfono</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Reservas</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Alta</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5"><div className="flex items-center gap-3"><div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-semibold text-sm flex-shrink-0">{c.name?.[0]?.toUpperCase()||'?'}</div><div><p className="font-medium text-slate-900">{c.name}</p>{c.email&&<p className="text-xs text-slate-400">{c.email}</p>}</div></div></td>
                    <td className="px-5 py-3.5 hidden sm:table-cell">{c.phone?<div className="flex items-center gap-1.5 text-slate-600"><Phone size={12} className="text-slate-400"/><span className="text-sm">{c.phone}</span></div>:<span className="text-slate-400 text-xs">—</span>}</td>
                    <td className="px-5 py-3.5 hidden md:table-cell"><span className="text-sm font-medium text-slate-700">{c.total_reservations||0}</span></td>
                    <td className="px-5 py-3.5 hidden lg:table-cell"><div className="flex items-center gap-1.5 text-slate-500"><Calendar size={12} className="text-slate-400"/><span className="text-xs">{c.created_at?new Date(c.created_at).toLocaleDateString('es-ES'):'—'}</span></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}