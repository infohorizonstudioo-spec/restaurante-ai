'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

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
      setCustomers(c || [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = customers.filter(c => !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search))

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando...</div>

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold text-gray-900">Clientes</h1><p className="text-sm text-gray-500">{customers.length} clientes</p></div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre o teléfono..."
          className="border border-gray-300 rounded-xl px-4 py-2 text-sm w-64 focus:outline-none focus:border-indigo-500"/>
      </div>
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border p-12 text-center"><p className="text-4xl mb-3">👥</p><p className="text-gray-500">{search ? 'Sin resultados' : 'Sin clientes aún'}</p><p className="text-gray-400 text-sm mt-1">Los clientes se crean automáticamente cuando el agente toma una reserva</p></div>
      ) : (
        <div className="bg-white rounded-2xl border overflow-hidden">
          {filtered.map(c => (
            <div key={c.id} className="px-6 py-4 border-b last:border-0 hover:bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center font-bold text-indigo-700">{c.name?.[0]?.toUpperCase()}</div>
                <div>
                  <p className="font-medium text-gray-900">{c.name}</p>
                  <p className="text-sm text-gray-500">{c.phone}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-700">{c.total_reservations||0} reservas</p>
                <p className="text-xs text-gray-400">{c.created_at?new Date(c.created_at).toLocaleDateString('es-ES'):''}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}