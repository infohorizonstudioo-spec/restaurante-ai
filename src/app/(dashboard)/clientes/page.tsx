'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { supabase, getDemoTenant } from '@/lib/supabase'
import type { Customer } from '@/types'

export default function ClientesPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      const t = await getDemoTenant()
      if (!t) return
      const { data } = await supabase.from('customers').select('*').eq('tenant_id', t.id).order('visits', { ascending: false })
      setCustomers(data || [])
    }
    load()
  }, [])

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search) || c.email?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-white/40 text-sm">{customers.length} clientes registrados</p>
        </div>
      </div>

      <input placeholder="Buscar por nombre, teléfono o email..." value={search} onChange={e => setSearch(e.target.value)}
        className="w-full max-w-md glass rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/25 bg-transparent focus:outline-none focus:border-violet-500/50"/>

      {filtered.length === 0 ? (
        <div className="glass rounded-2xl py-16 text-center text-white/25 text-sm">
          {customers.length === 0 ? 'Sin clientes registrados aún. Se añaden automáticamente al hacer reservas.' : 'Sin resultados'}
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Cliente','Teléfono','Visitas','Gasto total','Última visita','Notas'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs text-white/30 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/30 to-indigo-500/30 flex items-center justify-center text-xs font-bold text-violet-300">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{c.name}</p>
                        {c.email && <p className="text-xs text-white/30">{c.email}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-white/50">{c.phone || '—'}</td>
                  <td className="px-4 py-3.5 text-sm font-medium">{c.visits}</td>
                  <td className="px-4 py-3.5 text-sm">{c.total_spent.toFixed(2)}€</td>
                  <td className="px-4 py-3.5 text-xs text-white/40">
                    {c.last_visit ? new Date(c.last_visit).toLocaleDateString('es-ES') : '—'}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-white/40 max-w-[200px] truncate">{c.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
