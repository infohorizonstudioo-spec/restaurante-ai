'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AdminPage() {
  const router = useRouter()
  const [tenants, setTenants] = useState<any[]>([])
  const [stats, setStats] = useState<Record<string,any>>({})
  const [time, setTime] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ name:'', slug:'', type:'restaurant', email:'', phone:'' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('es-ES', {hour:'2-digit',minute:'2-digit'}))
    tick(); const t = setInterval(tick, 1000); return () => clearInterval(t)
  }, [])

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('tenants').select('*').order('created_at', { ascending: false })
      setTenants(data || [])
      for (const t of (data || [])) {
        const [res, ord] = await Promise.all([
          supabase.from('reservations').select('id', { count: 'exact', head: true }).eq('tenant_id', t.id),
          supabase.from('orders').select('id', { count: 'exact', head: true }).eq('tenant_id', t.id),
        ])
        setStats(prev => ({ ...prev, [t.id]: { reservations: res.count || 0, orders: ord.count || 0 } }))
      }
    }
    load()
  }, [])

  async function createTenant() {
    if (!form.name || !form.slug) return
    setSaving(true)
    const { data, error } = await supabase.from('tenants').insert({
      name: form.name, slug: form.slug.toLowerCase().replace(/\s+/g, '-'),
      type: form.type, email: form.email || null, phone: form.phone || null, plan: 'free', active: true
    }).select().single()
    setSaving(false)
    if (!error && data) { setTenants(prev => [data, ...prev]); setShowNew(false); setForm({ name:'', slug:'', type:'restaurant', email:'', phone:'' }) }
  }

  async function logout() { await supabase.auth.signOut(); router.push('/login') }

  const TYPE: Record<string,string> = { restaurant:'🍽️ Restaurante', clinic:'🏥 Clínica', advisory:'💼 Asesoría', other:'◻ Otro' }

  return (
    <div className="min-h-screen bg-[#070710] text-white">
      <header className="border-b border-white/[0.06] bg-white/[0.02] sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-sm font-black">R</div>
            <div>
              <p className="font-bold text-sm">Reservo.AI</p>
              <p className="text-xs text-white/30">Admin · {tenants.length} negocios</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-xs text-white/30">{time}</span>
            <button onClick={logout} className="text-xs text-white/30 hover:text-white/60 transition-colors">Salir →</button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label:'Negocios activos', value: tenants.filter(t=>t.active).length, color:'from-violet-500/20 to-indigo-500/20', border:'border-violet-500/20' },
            { label:'Total reservas', value: Object.values(stats).reduce((s:any,v:any)=>s+v.reservations,0), color:'from-emerald-500/20 to-teal-500/20', border:'border-emerald-500/20' },
            { label:'Total pedidos', value: Object.values(stats).reduce((s:any,v:any)=>s+v.orders,0), color:'from-orange-500/20 to-amber-500/20', border:'border-orange-500/20' },
            { label:'Plan Pro', value: tenants.filter(t=>t.plan==='pro').length, color:'from-blue-500/20 to-cyan-500/20', border:'border-blue-500/20' },
          ].map(k => (
            <div key={k.label} className={`bg-gradient-to-br ${k.color} border ${k.border} rounded-2xl p-5`}>
              <div className="text-4xl font-black mb-1">{k.value}</div>
              <div className="text-xs text-white/40">{k.label}</div>
            </div>
          ))}
        </div>

        <div className="glass rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
            <h2 className="font-semibold">Negocios</h2>
            <button onClick={() => setShowNew(true)} className="bg-violet-600 hover:bg-violet-500 text-white font-medium px-4 py-2 rounded-xl text-sm transition-all">+ Nuevo</button>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {tenants.length === 0 ? (
              <div className="py-12 text-center text-white/25 text-sm">Sin negocios registrados</div>
            ) : tenants.map(t => (
              <div key={t.id} className="flex items-center gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors">
                <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center text-lg font-bold text-violet-300 shrink-0">{t.name.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{t.name}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${t.active?'bg-emerald-500/10 text-emerald-400 border-emerald-500/20':'bg-red-500/10 text-red-400 border-red-500/20'}`}>{t.active?'Activo':'Inactivo'}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/40 capitalize">{t.plan}</span>
                  </div>
                  <p className="text-xs text-white/30 mt-0.5">{TYPE[t.type]} · {t.email || t.slug}</p>
                </div>
                <div className="hidden sm:flex gap-6 text-center shrink-0">
                  <div><p className="text-base font-bold text-emerald-400">{stats[t.id]?.reservations ?? '—'}</p><p className="text-[10px] text-white/30">Reservas</p></div>
                  <div><p className="text-base font-bold text-orange-400">{stats[t.id]?.orders ?? '—'}</p><p className="text-[10px] text-white/30">Pedidos</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showNew && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={e=>{if(e.target===e.currentTarget)setShowNew(false)}}>
          <div className="glass rounded-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between"><h2 className="font-bold text-lg">Nuevo negocio</h2><button onClick={()=>setShowNew(false)} className="text-white/30 hover:text-white/60 text-xl">✕</button></div>
            <div className="space-y-3">
              {[{l:'Nombre *',k:'name',t:'text'},{l:'Slug (URL)',k:'slug',t:'text'},{l:'Email',k:'email',t:'email'},{l:'Teléfono',k:'phone',t:'tel'}].map(f=>(
                <div key={f.k}>
                  <label className="text-xs text-white/40 mb-1.5 block">{f.l}</label>
                  <input type={f.t} value={(form as any)[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/60"/>
                </div>
              ))}
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Tipo</label>
                <select value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/60">
                  {Object.entries(TYPE).map(([v,l])=><option key={v} value={v} className="bg-[#111]">{l}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={()=>setShowNew(false)} className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/60 text-sm hover:bg-white/10">Cancelar</button>
              <button onClick={createTenant} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold text-sm">{saving?'Creando...':'Crear'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}