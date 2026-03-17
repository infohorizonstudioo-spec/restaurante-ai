'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import UsageWidget from '@/components/UsageWidget'

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
    setTimeout(() => setSaved(false), 3000)
    setTenant({ ...tenant, ...form })
  }

  if (!tenant) return <div className="p-8 text-center text-gray-500">Cargando...</div>
  const isTrial = !tenant.plan || tenant.plan === 'trial' || tenant.plan === 'free'

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">Configuración</h1><p className="text-gray-500 text-sm">{tenant.name}</p></div>
      <UsageWidget tenant={tenant} />
      <div className="bg-white rounded-2xl border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Plan actual</h2>
          <a href="/precios" className="text-sm text-indigo-600 font-medium">{isTrial ? 'Activar plan →' : 'Cambiar plan →'}</a>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1.5 rounded-xl text-sm font-bold ${tenant.plan==='business'?'bg-violet-100 text-violet-700':tenant.plan==='pro'?'bg-indigo-100 text-indigo-700':tenant.plan==='starter'?'bg-blue-100 text-blue-700':'bg-amber-100 text-amber-700'}`}>
            {tenant.plan==='business'?'🚀 Business':tenant.plan==='pro'?'⭐ Pro':tenant.plan==='starter'?'🌱 Starter':'⏳ Prueba'}
          </span>
          <p className="text-sm text-gray-500">{isTrial ? `${Math.max(0,(tenant.free_calls_limit||10)-(tenant.free_calls_used||0))} llamadas gratis` : `${tenant.plan_calls_included||50} llamadas/mes`}</p>
        </div>
      </div>
      <div className="bg-white rounded-2xl border p-6 space-y-4">
        <h2 className="font-semibold">Recepcionista AI</h2>
        <div><label className="text-sm font-medium text-gray-700 mb-1.5 block">Nombre del agente</label><input value={form.agent_name} onChange={e => setForm({...form, agent_name: e.target.value})} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500"/></div>
        <div><label className="text-sm font-medium text-gray-700 mb-1.5 block">Idioma</label><select value={form.language} onChange={e => setForm({...form, language: e.target.value})} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500"><option value="es">🇪🇸 Español</option><option value="en">🇬🇧 English</option></select></div>
        <div><label className="text-sm font-medium text-gray-700 mb-1.5 block">Número del agente (Twilio)</label><input value={form.agent_phone} onChange={e => setForm({...form, agent_phone: e.target.value})} placeholder="+1 213 875 3573" className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-indigo-500"/>
          {form.agent_phone && <p className="text-green-600 text-xs mt-1">✅ Agente activo en {form.agent_phone}</p>}
          {!form.agent_phone && <p className="text-amber-600 text-xs mt-1">⚠️ Sin número asignado</p>}
        </div>
      </div>
      <button onClick={save} disabled={saving} className={`w-full py-3.5 rounded-2xl font-bold transition-all ${saved?'bg-green-500 text-white':'bg-indigo-600 text-white hover:bg-indigo-500'} disabled:opacity-50`}>
        {saving?'Guardando...':saved?'✅ Guardado':'Guardar cambios'}
      </button>
    </div>
  )
}