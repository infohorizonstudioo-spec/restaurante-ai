'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const TYPE: Record<string,string> = {
  restaurant: '🍽️ Restaurante',
  clinic: '🏥 Clínica',
  advisory: '💼 Asesoría',
  other: '◻ Otro'
}

const emptyTenant = { name:'', slug:'', type:'restaurant', email:'', phone:'' }
const emptyUser = { name:'', email:'', password:'', tenantId:'' }

export default function AdminPage() {
  const router = useRouter()
  const [tenants, setTenants] = useState<any[]>([])
  const [stats, setStats] = useState<Record<string,any>>({})
  const [time, setTime] = useState('')
  const [tab, setTab] = useState<'tenants'|'users'>('tenants')
  const [showNewTenant, setShowNewTenant] = useState(false)
  const [showNewUser, setShowNewUser] = useState(false)
  const [tenantForm, setTenantForm] = useState(emptyTenant)
  const [userForm, setUserForm] = useState(emptyUser)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('es-ES', {hour:'2-digit',minute:'2-digit'}))
    tick(); const t = setInterval(tick, 1000); return () => clearInterval(t)
  }, [])

  useEffect(() => {
    loadTenants()
  }, [])

  async function loadTenants() {
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

  async function createTenant() {
    if (!tenantForm.name || !tenantForm.slug) { setMsg('Nombre y slug son obligatorios'); return }
    setSaving(true); setMsg('')
    const { data, error } = await supabase.from('tenants').insert({
      name: tenantForm.name,
      slug: tenantForm.slug.toLowerCase().replace(/\s+/g, '-'),
      type: tenantForm.type,
      email: tenantForm.email || null,
      phone: tenantForm.phone || null,
      plan: 'free',
      active: true
    }).select().single()
    setSaving(false)
    if (error) { setMsg('Error: ' + error.message); return }
    if (data) {
      setTenants(prev => [data, ...prev])
      setShowNewTenant(false)
      setTenantForm(emptyTenant)
      setMsg('✅ Negocio creado correctamente')
    }
  }

  async function createUser() {
    if (!userForm.email || !userForm.password || !userForm.tenantId) {
      setMsg('Email, contraseña y negocio son obligatorios'); return
    }
    if (userForm.password.length < 8) { setMsg('La contraseña debe tener al menos 8 caracteres'); return }
    setSaving(true); setMsg('')
    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userForm.email,
          password: userForm.password,
          name: userForm.name || userForm.email,
          tenantId: userForm.tenantId,
          role: 'client'
        })
      })
      const data = await res.json()
      setSaving(false)
      if (!res.ok) { setMsg('Error: ' + data.error); return }
      setShowNewUser(false)
      setUserForm(emptyUser)
      setMsg('✅ Cliente creado · Puede acceder con ' + userForm.email)
    } catch(e: any) {
      setSaving(false)
      setMsg('Error: ' + e.message)
    }
  }

  async function logout() { await supabase.auth.signOut(); router.push('/login') }

  return (
    <div className="min-h-screen bg-[#070710] text-white">
      <header className="border-b border-white/[0.06] bg-white/[0.02] sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-sm font-black shadow-lg shadow-violet-500/20">R</div>
            <div>
              <p className="font-bold text-sm">Reservo.AI</p>
              <p className="text-xs text-white/30">Panel Admin</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-xs text-white/30">{time}</span>
            <button onClick={logout} className="text-xs text-white/30 hover:text-white/60 transition-colors">Salir →</button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label:'Negocios', value: tenants.length, color:'from-violet-500/20 to-indigo-500/20', border:'border-violet-500/20' },
            { label:'Activos', value: tenants.filter(t=>t.active).length, color:'from-emerald-500/20 to-teal-500/20', border:'border-emerald-500/20' },
            { label:'Reservas total', value: Object.values(stats).reduce((s:any,v:any)=>s+(v.reservations||0),0), color:'from-orange-500/20 to-amber-500/20', border:'border-orange-500/20' },
            { label:'Plan Pro', value: tenants.filter(t=>t.plan==='pro').length, color:'from-blue-500/20 to-cyan-500/20', border:'border-blue-500/20' },
          ].map(k => (
            <div key={k.label} className={`bg-gradient-to-br ${k.color} border ${k.border} rounded-2xl p-5`}>
              <div className="text-4xl font-black mb-1">{k.value}</div>
              <div className="text-xs text-white/40">{k.label}</div>
            </div>
          ))}
        </div>

        {/* Mensaje de éxito/error */}
        {msg && (
          <div className={`px-4 py-3 rounded-xl text-sm border ${msg.startsWith('✅') ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300' : 'bg-red-500/10 border-red-500/25 text-red-300'}`}>
            {msg}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2">
          <button onClick={() => setTab('tenants')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab==='tenants'?'bg-white/10 text-white':'text-white/40 hover:text-white/60 hover:bg-white/5'}`}>
            Negocios
          </button>
          <button onClick={() => setTab('users')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab==='users'?'bg-white/10 text-white':'text-white/40 hover:text-white/60 hover:bg-white/5'}`}>
            Crear cliente
          </button>
        </div>

        {/* Tab: Negocios */}
        {tab === 'tenants' && (
          <div className="glass rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <h2 className="font-semibold">Negocios registrados</h2>
              <button onClick={() => { setShowNewTenant(true); setMsg('') }}
                className="bg-violet-600 hover:bg-violet-500 text-white font-medium px-4 py-2 rounded-xl text-sm transition-all">
                + Nuevo negocio
              </button>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {tenants.length === 0 ? (
                <div className="py-12 text-center text-white/25 text-sm">Sin negocios · Crea el primero</div>
              ) : tenants.map(t => (
                <div key={t.id} className="flex items-center gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center text-lg font-bold text-violet-300 shrink-0">{t.name.charAt(0)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{t.name}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${t.active?'bg-emerald-500/10 text-emerald-400 border-emerald-500/20':'bg-red-500/10 text-red-400 border-red-500/20'}`}>{t.active?'Activo':'Inactivo'}</span>
                    </div>
                    <p className="text-xs text-white/30 mt-0.5">{TYPE[t.type]} · slug: {t.slug}</p>
                  </div>
                  <div className="hidden sm:flex gap-6 text-center shrink-0">
                    <div><p className="text-base font-bold text-emerald-400">{stats[t.id]?.reservations ?? '—'}</p><p className="text-[10px] text-white/30">Reservas</p></div>
                  </div>
                  <button onClick={() => { setUserForm(f => ({...f, tenantId: t.id})); setTab('users'); setShowNewUser(true) }}
                    className="text-xs px-3 py-1.5 bg-violet-600/20 border border-violet-500/30 text-violet-300 rounded-lg hover:bg-violet-600/30 transition-all shrink-0">
                    + Cliente
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab: Crear cliente */}
        {tab === 'users' && (
          <div className="glass rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.06]">
              <h2 className="font-semibold">Crear acceso para cliente</h2>
              <p className="text-xs text-white/40 mt-1">El cliente recibirá estas credenciales para acceder a su panel</p>
            </div>
            <div className="p-6 max-w-md space-y-4">
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Negocio *</label>
                <select value={userForm.tenantId} onChange={e => setUserForm(f => ({...f, tenantId: e.target.value}))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:border-violet-500/60">
                  <option value="" className="bg-[#111]">— Selecciona negocio —</option>
                  {tenants.map(t => <option key={t.id} value={t.id} className="bg-[#111]">{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Nombre del contacto</label>
                <input type="text" value={userForm.name} onChange={e => setUserForm(f => ({...f, name: e.target.value}))}
                  placeholder="Fernando García"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500/60"/>
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Email *</label>
                <input type="email" value={userForm.email} onChange={e => setUserForm(f => ({...f, email: e.target.value}))}
                  placeholder="cliente@negocio.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500/60"/>
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Contraseña *</label>
                <input type="password" value={userForm.password} onChange={e => setUserForm(f => ({...f, password: e.target.value}))}
                  placeholder="Mínimo 8 caracteres"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500/60"/>
              </div>
              <button onClick={createUser} disabled={saving}
                className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-all active:scale-95">
                {saving ? 'Creando acceso...' : 'Crear acceso de cliente'}
              </button>
              {msg && (
                <p className={`text-xs text-center ${msg.startsWith('✅')?'text-emerald-400':'text-red-400'}`}>{msg}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal nuevo negocio */}
      {showNewTenant && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={e => { if(e.target===e.currentTarget) setShowNewTenant(false) }}>
          <div className="glass rounded-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">Nuevo negocio</h2>
              <button onClick={() => setShowNewTenant(false)} className="text-white/30 hover:text-white/60 text-xl">✕</button>
            </div>
            <div className="space-y-3">
              {[{l:'Nombre del negocio *',k:'name',t:'text'},{l:'Slug (identificador URL)',k:'slug',t:'text'},{l:'Email de contacto',k:'email',t:'email'},{l:'Teléfono',k:'phone',t:'tel'}].map(f => (
                <div key={f.k}>
                  <label className="text-xs text-white/40 mb-1.5 block">{f.l}</label>
                  <input type={f.t} value={(tenantForm as any)[f.k]}
                    onChange={e => setTenantForm(p => ({...p, [f.k]: e.target.value}))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/60"/>
                </div>
              ))}
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Tipo de negocio</label>
                <select value={tenantForm.type} onChange={e => setTenantForm(p => ({...p, type: e.target.value}))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/60">
                  {Object.entries(TYPE).map(([v,l]) => <option key={v} value={v} className="bg-[#111]">{l}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowNewTenant(false)} className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/60 text-sm hover:bg-white/10">Cancelar</button>
              <button onClick={createTenant} disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold text-sm">
                {saving ? 'Creando...' : 'Crear negocio'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}