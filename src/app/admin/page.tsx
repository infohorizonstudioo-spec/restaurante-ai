'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const PLAN_LABELS: Record<string,string> = { trial:'Trial', free:'Free', starter:'Starter 99€/mes', pro:'Pro 299€/mes', business:'Business 499€/mes', enterprise:'Enterprise' }
const PLAN_COLORS: Record<string,string> = {
  trial: 'bg-white/5 text-white/40 border-white/10',
  free: 'bg-white/5 text-white/40 border-white/10',
  starter: 'bg-violet-500/10 text-violet-300 border-violet-500/25',
  pro: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
  business: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
  enterprise: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
}

const emptyTenant = { name:'', slug:'', type:'restaurant', email:'', phone:'' }
const emptyUser = { name:'', email:'', password:'', tenantId:'' }
const TYPE: Record<string,string> = { restaurant:'🍽️ Restaurante', clinic:'🏥 Clínica', advisory:'💼 Asesoría', beauty:'💇 Peluquería', other:'◻ Otro' }

export default function AdminPage() {
  const router = useRouter()
  const [tenants, setTenants] = useState<any[]>([])
  const [tab, setTab] = useState<'tenants'|'users'|'planes'>('tenants')
  const [showNewTenant, setShowNewTenant] = useState(false)
  const [tenantForm, setTenantForm] = useState(emptyTenant)
  const [userForm, setUserForm] = useState(emptyUser)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [time, setTime] = useState('')

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('es-ES', {hour:'2-digit',minute:'2-digit'}))
    tick(); const t = setInterval(tick, 1000); return () => clearInterval(t)
  }, [])

  useEffect(() => { loadTenants() }, [])

  async function loadTenants() {
    const { data } = await supabase.from('tenants').select('*').order('created_at', { ascending: false })
    setTenants(data || [])
  }

  async function createTenant() {
    if (!tenantForm.name || !tenantForm.slug) { setMsg('Nombre y slug obligatorios'); return }
    setSaving(true); setMsg('')
    const { data, error } = await supabase.from('tenants').insert({
      name: tenantForm.name, slug: tenantForm.slug.toLowerCase().replace(/\s+/g,'-'),
      type: tenantForm.type, email: tenantForm.email || null, phone: tenantForm.phone || null, plan: 'trial', active: true
    }).select().single()
    setSaving(false)
    if (error) { setMsg('Error: ' + error.message); return }
    setTenants(prev => [data, ...prev]); setShowNewTenant(false); setTenantForm(emptyTenant)
    setMsg('✅ Negocio creado')
  }

  async function createUser() {
    if (!userForm.email || !userForm.password || !userForm.tenantId) { setMsg('Faltan campos obligatorios'); return }
    if (userForm.password.length < 8) { setMsg('Contraseña mínimo 8 caracteres'); return }
    setSaving(true); setMsg('')
    const res = await fetch('/api/admin/create-user', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userForm.email, password: userForm.password, name: userForm.name || userForm.email, tenantId: userForm.tenantId, role: 'client' })
    })
    const data = await res.json(); setSaving(false)
    if (!res.ok) { setMsg('Error: ' + data.error); return }
    setUserForm(emptyUser); setMsg('✅ Cliente creado · Accede con ' + userForm.email)
  }

  async function changePlan(tenantId: string, plan: string) {
    const res = await fetch('/api/admin/update-plan', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, plan })
    })
    if (res.ok) {
      setTenants(prev => prev.map(t => t.id === tenantId ? {...t, plan} : t))
      setMsg('✅ Plan actualizado')
    }
  }

  async function logout() { await supabase.auth.signOut(); router.push('/login') }

  const byPlan = (p: string) => tenants.filter(t => t.plan === p)
  const mrr = byPlan('starter').length * 99 + byPlan('pro').length * 299 + byPlan('business').length * 499

  return (
    <div className="min-h-screen bg-[#070710] text-white">
      <header className="border-b border-white/[0.06] bg-white/[0.02] sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-sm font-black shadow-lg shadow-violet-500/20">R</div>
            <div>
              <p className="font-bold text-sm">Reservo.AI</p>
              <p className="text-xs text-white/30">Panel Admin · {tenants.length} negocios</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-xs text-white/30">{time}</span>
            <Link href="/precios" className="text-xs text-white/30 hover:text-white/60">Precios</Link>
            <button onClick={logout} className="text-xs text-white/30 hover:text-white/60 transition-colors">Salir →</button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label:'Negocios total', value: tenants.length, color:'from-violet-500/20 to-indigo-500/20', border:'border-violet-500/20' },
            { label:'Plan Starter', value: byPlan('starter').length, color:'from-violet-500/20 to-indigo-500/20', border:'border-violet-500/20' },
            { label:'Plan Pro', value: byPlan('pro').length, color:'from-amber-500/20 to-orange-500/20', border:'border-amber-500/20' },
            { label:'MRR estimado', value: mrr + '€', color:'from-blue-500/20 to-indigo-500/20', border:'border-blue-500/20' },
          ].map(k => (
            <div key={k.label} className={`bg-gradient-to-br ${k.color} border ${k.border} rounded-2xl p-5`}>
              <div className="text-3xl font-black mb-1">{k.value}</div>
              <div className="text-xs text-white/40">{k.label}</div>
            </div>
          ))}
        </div>

        {msg && (
          <div className={`px-4 py-3 rounded-xl text-sm border ${msg.startsWith('✅') ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300' : 'bg-red-500/10 border-red-500/25 text-red-300'}`}>
            {msg} <button onClick={() => setMsg('')} className="float-right opacity-50 hover:opacity-100">✕</button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 border-b border-white/[0.06] pb-0">
          {[{key:'tenants',label:'Negocios'},{key:'users',label:'Crear cliente'},{key:'planes',label:'Gestión de planes'}].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${tab===t.key?'border-violet-500 text-white':'border-transparent text-white/40 hover:text-white/60'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab: Negocios */}
        {tab === 'tenants' && (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <h2 className="font-semibold">Negocios registrados</h2>
              <button onClick={() => { setShowNewTenant(true); setMsg('') }}
                className="bg-violet-600 hover:bg-violet-500 text-white font-medium px-4 py-2 rounded-xl text-sm transition-all">
                + Nuevo negocio
              </button>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {tenants.length === 0 ? (
                <div className="py-12 text-center text-white/25 text-sm">Sin negocios</div>
              ) : tenants.map(t => (
                <div key={t.id} className="flex items-center gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center font-bold text-violet-300 shrink-0">{t.name.charAt(0)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{t.name}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${(PLAN_COLORS as any)[t.plan] || 'bg-white/5 text-white/40 border-white/10'}`}>
                        {(PLAN_LABELS as any)[t.plan] || t.plan}
                      </span>
                    </div>
                    <p className="text-xs text-white/30 mt-0.5">{TYPE[t.type]} · {t.email || t.slug}</p>
                  </div>
                  <button onClick={() => { setUserForm(f => ({...f, tenantId: t.id})); setTab('users') }}
                    className="text-xs px-3 py-1.5 bg-violet-600/20 border border-violet-500/30 text-violet-300 rounded-lg hover:bg-violet-600/30 shrink-0">
                    + Cliente
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab: Crear cliente */}
        {tab === 'users' && (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 max-w-md space-y-4">
            <h2 className="font-semibold mb-4">Crear acceso para cliente</h2>
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Negocio *</label>
              <select value={userForm.tenantId} onChange={e => setUserForm(f => ({...f, tenantId: e.target.value}))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:border-violet-500/60">
                <option value="" className="bg-[#111]">— Selecciona negocio —</option>
                {tenants.map(t => <option key={t.id} value={t.id} className="bg-[#111]">{t.name}</option>)}
              </select>
            </div>
            {[{l:'Nombre del contacto',k:'name',t:'text',p:'Fernando García'},{l:'Email *',k:'email',t:'email',p:'cliente@negocio.com'},{l:'Contraseña *',k:'password',t:'password',p:'Mínimo 8 caracteres'}].map(f => (
              <div key={f.k}>
                <label className="text-xs text-white/40 mb-1.5 block">{f.l}</label>
                <input type={f.t} placeholder={f.p} value={(userForm as any)[f.k]}
                  onChange={e => setUserForm(p => ({...p, [f.k]: e.target.value}))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:border-violet-500/60"/>
              </div>
            ))}
            <button onClick={createUser} disabled={saving}
              className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-all">
              {saving ? 'Creando...' : 'Crear acceso de cliente'}
            </button>
          </div>
        )}

        {/* Tab: Gestión de planes */}
        {tab === 'planes' && (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.06]">
              <h2 className="font-semibold">Gestión de planes</h2>
              <p className="text-xs text-white/40 mt-1">Asigna el plan de cada negocio — Starter 350€/mes · Pro 500€/mes</p>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {tenants.map(t => (
                <div key={t.id} className="flex items-center gap-4 px-6 py-4">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center font-bold text-white/50 shrink-0">{t.name.charAt(0)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{t.name}</p>
                    <p className="text-xs text-white/30">{TYPE[t.type]}</p>
                  </div>
                  <select value={t.plan} onChange={e => changePlan(t.id, e.target.value)}
                    className={`text-xs px-3 py-2 rounded-lg border cursor-pointer transition-all focus:outline-none ${(PLAN_COLORS as any)[t.plan] || 'bg-white/5 text-white/40 border-white/10'} bg-[#0d0d1a]`}>
                    <option value="trial">Trial (gratis)</option>
                    <option value="starter">Starter — 99€/mes</option>
                    <option value="pro">Pro — 299€/mes</option>
                    <option value="business">Business — 499€/mes</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal nuevo negocio */}
      {showNewTenant && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={e => { if(e.target===e.currentTarget) setShowNewTenant(false) }}>
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 w-full max-w-md space-y-4 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">Nuevo negocio</h2>
              <button onClick={() => setShowNewTenant(false)} className="text-white/30 hover:text-white/60 text-xl">✕</button>
            </div>
            {[{l:'Nombre *',k:'name',t:'text'},{l:'Slug URL',k:'slug',t:'text'},{l:'Email',k:'email',t:'email'},{l:'Teléfono',k:'phone',t:'tel'}].map(f => (
              <div key={f.k}>
                <label className="text-xs text-white/40 mb-1.5 block">{f.l}</label>
                <input type={f.t} value={(tenantForm as any)[f.k]} onChange={e => setTenantForm(p => ({...p, [f.k]: e.target.value}))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/60"/>
              </div>
            ))}
            <select value={tenantForm.type} onChange={e => setTenantForm(p => ({...p, type: e.target.value}))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none">
              {Object.entries(TYPE).map(([v,l]) => <option key={v} value={v} className="bg-[#111]">{l}</option>)}
            </select>
            <div className="flex gap-3">
              <button onClick={() => setShowNewTenant(false)} className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/60 text-sm">Cancelar</button>
              <button onClick={createTenant} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold text-sm">
                {saving ? 'Creando...' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}