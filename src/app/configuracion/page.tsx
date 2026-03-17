'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Settings, Bot, Phone, Globe, CreditCard, TrendingUp, Check } from 'lucide-react'

export default function ConfiguracionPage() {
  const [tenant, setTenant] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({ agent_name: '', agent_phone: '', language: 'es' })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
      if (!p?.tenant_id) return
      const { data: t } = await supabase.from('tenants').select('*').eq('id', (p as any).tenant_id).single()
      setTenant(t)
      setForm({ agent_name: t?.agent_name || 'Gabriela', agent_phone: t?.agent_phone || '', language: t?.language || 'es' })
    }
    load()
  }, [])

  async function save() {
    if (!tenant) return
    setSaving(true)
    await supabase.from('tenants').update(form).eq('id', tenant.id)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setTenant({ ...tenant, ...form })
  }

  if (!tenant) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"/></div>

  const isTrial = !tenant.plan || tenant.plan === 'trial' || tenant.plan === 'free'
  const callsLeft = Math.max(0, (tenant.free_calls_limit || 10) - (tenant.free_calls_used || 0))
  const PLAN_BADGE: Record<string, { label: string; cls: string }> = {
    trial:    { label: 'Trial',    cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    starter:  { label: 'Starter',  cls: 'bg-sky-50 text-sky-700 border-sky-200' },
    pro:      { label: 'Pro',      cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    business: { label: 'Business', cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  }
  const badge = PLAN_BADGE[tenant.plan] || PLAN_BADGE.trial

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 h-14 flex items-center">
        <div className="flex items-center gap-2">
          <Settings size={16} className="text-slate-400" />
          <h1 className="text-sm font-semibold text-slate-900">Configuración</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-6 space-y-4">
        
        {/* Plan actual */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CreditCard size={15} className="text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-900">Plan actual</h2>
            </div>
            <a href="/precios" className="text-xs text-indigo-600 font-medium hover:text-indigo-700 transition-colors">
              {isTrial ? 'Activar plan →' : 'Cambiar plan →'}
            </a>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-md border ${badge.cls}`}>{badge.label}</span>
            {isTrial ? (
              <span className={`text-sm text-slate-600`}>{callsLeft} de {tenant.free_calls_limit || 10} llamadas gratis</span>
            ) : (
              <span className="text-sm text-slate-600">{tenant.plan_calls_used || 0} / {tenant.plan_calls_included || 50} llamadas este mes</span>
            )}
          </div>
          {!isTrial && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Uso mensual</span>
                <span>{Math.round(((tenant.plan_calls_used || 0) / (tenant.plan_calls_included || 50)) * 100)}%</span>
              </div>
              <div className="bg-slate-100 rounded-full h-1.5">
                <div className="bg-indigo-600 h-1.5 rounded-full transition-all"
                  style={{ width: `${Math.min(100, ((tenant.plan_calls_used || 0) / (tenant.plan_calls_included || 50)) * 100)}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Agente */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Bot size={15} className="text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900">Recepcionista AI</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">Nombre del agente</label>
              <input value={form.agent_name} onChange={e => setForm({...form, agent_name: e.target.value})}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"/>
              <p className="text-xs text-slate-400 mt-1">Se presentará como: "Hola, soy {form.agent_name} de {tenant.name}"</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block flex items-center gap-1">
                <Globe size={11} /> Idioma
              </label>
              <select value={form.language} onChange={e => setForm({...form, language: e.target.value})}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                <option value="es">Español</option>
                <option value="en">English</option>
                <option value="ca">Català</option>
              </select>
            </div>
          </div>
        </div>

        {/* Teléfono */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Phone size={15} className="text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900">Número de teléfono</h2>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">Número Twilio del agente</label>
            <input value={form.agent_phone} onChange={e => setForm({...form, agent_phone: e.target.value})}
              placeholder="+1 213 875 3573"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"/>
            {form.agent_phone
              ? <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1"><Check size={11} /> Agente activo en {form.agent_phone}</p>
              : <p className="text-xs text-amber-600 mt-1.5">Sin número asignado. El agente no puede recibir llamadas.</p>}
          </div>
        </div>

        {/* Info negocio */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={15} className="text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900">Estadísticas</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Nombre', value: tenant.name },
              { label: 'Tipo', value: tenant.type?.replace('_',' ') },
              { label: 'Total llamadas', value: tenant.call_count || 0 },
              { label: 'Clientes', value: '—' },
            ].map(item => (
              <div key={item.label}>
                <p className="text-xs text-slate-400">{item.label}</p>
                <p className="text-sm font-medium text-slate-900 mt-0.5 capitalize">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <button onClick={save} disabled={saving}
          className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
            saved ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'
          } disabled:opacity-50`}>
          {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Guardando...</>
           : saved ? <><Check size={15} />Guardado</>
           : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}