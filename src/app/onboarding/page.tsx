'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const STEPS = [
  { id: 1, title: 'Prueba gratuita', emoji: '🎁' },
  { id: 2, title: 'Configura tu recepcionista', emoji: '⚙️' },
  { id: 3, title: '¡Lista para usar!', emoji: '🚀' },
]

const IDIOMAS = [
  { value: 'es', label: '🇪🇸 Español' },
  { value: 'en', label: '🇬🇧 English' },
  { value: 'ca', label: '🏴 Català' },
  { value: 'eu', label: '🏴 Euskera' },
]

const TIPOS_LABEL: Record<string,string> = { restaurant:'Restaurante', bar:'Bar', clinic:'Clínica', advisory:'Asesoría', beauty:'Peluquería', other:'Negocio' }

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [tenant, setTenant] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState({ agentName: '', agentPhone: '', phoneOption: 'new', language: 'es' })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
      if (!profile?.tenant_id) { router.push('/dashboard'); return }
      const { data: t } = await supabase.from('tenants').select('*').eq('id', profile.tenant_id).single()
      if (!t) { router.push('/dashboard'); return }
      if (t.onboarding_complete) { router.push('/panel'); return }
      setTenant(t)
      setConfig(c => ({ ...c, agentName: t.agent_name || ('Recepcionista de ' + t.name), agentPhone: t.agent_phone || '' }))
      setStep(t.onboarding_step > 0 ? t.onboarding_step : 1)
      setLoading(false)
    }
    load()
  }, [])

  async function saveStep(nextStep: number, data?: any) {
    setSaving(true)
    const updates: any = { onboarding_step: nextStep }
    if (data) Object.assign(updates, data)
    await supabase.from('tenants').update(updates).eq('id', tenant.id)
    setTenant((t: any) => ({ ...t, ...updates }))
    setSaving(false)
    if (nextStep > 3) {
      await supabase.from('tenants').update({ onboarding_complete: true }).eq('id', tenant.id)
      router.push('/panel')
    } else {
      setStep(nextStep)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-[#070710] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"/>
    </div>
  )

  const callsLeft = (tenant?.free_calls_limit || 10) - (tenant?.free_calls_used || 0)

  return (
    <div className="min-h-screen bg-[#070710] text-white">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-violet-600/6 rounded-full blur-3xl"/>
      </div>

      {/* Header */}
      <div className="relative max-w-2xl mx-auto px-6 pt-10 pb-4">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-sm font-black shadow-lg shadow-violet-500/20">R</div>
            <span className="font-bold text-sm">Reservo.AI</span>
          </div>
          <div className="text-xs text-white/30">Paso {step} de 3</div>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-10">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center flex-1">
              <div className={`flex items-center gap-2 ${s.id <= step ? 'opacity-100' : 'opacity-30'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${s.id < step ? 'bg-emerald-500 text-white' : s.id === step ? 'bg-violet-600 text-white ring-4 ring-violet-500/30' : 'bg-white/10 text-white/40'}`}>
                  {s.id < step ? '✓' : s.id}
                </div>
                <span className={`text-xs hidden sm:block ${s.id === step ? 'text-white font-medium' : 'text-white/40'}`}>{s.title}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`flex-1 h-px mx-3 ${s.id < step ? 'bg-emerald-500/50' : 'bg-white/10'}`}/>}
            </div>
          ))}
        </div>

        {/* ─── PASO 1: PRUEBA GRATUITA ─── */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-5xl mb-4">🎁</div>
              <h1 className="text-3xl font-black mb-3">Prueba tu recepcionista AI<br/>con 10 llamadas gratuitas</h1>
              <p className="text-white/50 text-base max-w-lg mx-auto">
                Puedes probar cómo funciona Reservo.AI con hasta <strong className="text-white">10 llamadas de clientes</strong> antes de elegir un plan.
                Sin tarjeta de crédito. Sin compromisos.
              </p>
            </div>

            {/* Counter */}
            <div className="bg-gradient-to-br from-violet-500/10 to-indigo-500/10 border border-violet-500/20 rounded-2xl p-6 text-center">
              <div className="text-6xl font-black text-violet-400 mb-1">{callsLeft}</div>
              <div className="text-white/60 text-sm">llamadas gratuitas disponibles de {tenant?.free_calls_limit || 10}</div>
              <div className="mt-4 w-full bg-white/10 rounded-full h-2 overflow-hidden">
                <div className="bg-gradient-to-r from-violet-500 to-indigo-500 h-full rounded-full transition-all" style={{ width: `${(callsLeft / (tenant?.free_calls_limit || 10)) * 100}%` }}/>
              </div>
            </div>

            {/* Features */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { icon: '📞', title: 'Atiende llamadas', desc: 'Tu IA responde automáticamente 24/7' },
                { icon: '📅', title: 'Toma reservas', desc: 'Registra y gestiona reservas al instante' },
                { icon: '🛒', title: 'Registra pedidos', desc: 'Anota pedidos sin que muevas un dedo' },
              ].map(f => (
                <div key={f.title} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-center">
                  <div className="text-2xl mb-2">{f.icon}</div>
                  <div className="font-semibold text-sm mb-1">{f.title}</div>
                  <div className="text-xs text-white/40">{f.desc}</div>
                </div>
              ))}
            </div>

            <button onClick={() => setStep(2)}
              className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-4 rounded-xl text-base transition-all active:scale-95 shadow-lg shadow-violet-500/25">
              Configurar mi recepcionista →
            </button>
          </div>
        )}

        {/* ─── PASO 2: CONFIGURACIÓN ─── */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black mb-1">Configura tu recepcionista AI</h1>
              <p className="text-white/40 text-sm">Personaliza cómo tu recepcionista se presentará a tus clientes</p>
            </div>

            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-5">
              {/* Nombre agente */}
              <div>
                <label className="text-xs text-white/50 mb-1.5 block font-medium">Nombre del agente AI</label>
                <input type="text" value={config.agentName} onChange={e => setConfig(c => ({...c, agentName: e.target.value}))}
                  placeholder="Ej: María, Asistente, Recepcionista..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500/60 transition-all"/>
                <p className="text-[11px] text-white/25 mt-1">Así se presentará cuando atienda una llamada</p>
              </div>

              {/* Idioma */}
              <div>
                <label className="text-xs text-white/50 mb-1.5 block font-medium">Idioma principal</label>
                <div className="grid grid-cols-2 gap-2">
                  {IDIOMAS.map(l => (
                    <button key={l.value} type="button" onClick={() => setConfig(c => ({...c, language: l.value}))}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm transition-all ${config.language === l.value ? 'bg-violet-600/20 border-violet-500/50 text-white' : 'bg-white/5 border-white/10 text-white/50 hover:border-white/25'}`}>
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Teléfono */}
              <div>
                <label className="text-xs text-white/50 mb-2 block font-medium">Número de teléfono del negocio</label>
                <div className="space-y-2">
                  <button onClick={() => setConfig(c => ({...c, phoneOption: 'new'}))}
                    className={`w-full flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${config.phoneOption === 'new' ? 'bg-violet-600/15 border-violet-500/40 text-white' : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'}`}>
                    <div className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 ${config.phoneOption === 'new' ? 'border-violet-500 bg-violet-500' : 'border-white/30'}`}/>
                    <div>
                      <div className="font-medium text-sm">Generar un número nuevo para el agente</div>
                      <div className="text-xs text-white/40 mt-0.5">Se asigna un número de teléfono dedicado para tu recepcionista IA</div>
                    </div>
                  </button>
                  <button onClick={() => setConfig(c => ({...c, phoneOption: 'redirect'}))}
                    className={`w-full flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${config.phoneOption === 'redirect' ? 'bg-violet-600/15 border-violet-500/40 text-white' : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'}`}>
                    <div className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 ${config.phoneOption === 'redirect' ? 'border-violet-500 bg-violet-500' : 'border-white/30'}`}/>
                    <div>
                      <div className="font-medium text-sm">Usar mi número actual con desvío de llamadas</div>
                      <div className="text-xs text-white/40 mt-0.5">Desvía las llamadas de tu número actual al agente IA</div>
                    </div>
                  </button>
                </div>
                {config.phoneOption === 'redirect' && (
                  <input type="tel" value={config.agentPhone} onChange={e => setConfig(c => ({...c, agentPhone: e.target.value}))}
                    placeholder="Tu número de teléfono actual"
                    className="mt-2 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500/60"/>
                )}
              </div>

              {/* Horario */}
              <div>
                <label className="text-xs text-white/50 mb-1.5 block font-medium">Horario del negocio</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {['Lun-Vie','Sábado','Domingo','Festivos'].map(d => (
                    <div key={d} className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-center">
                      <div className="text-white/40 mb-1">{d}</div>
                      <div className="text-white/70 font-medium">{d === 'Festivos' ? 'Cerrado' : '09:00–21:00'}</div>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-white/25 mt-2">Personalizable desde el Panel de control</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="px-6 py-3 rounded-xl bg-white/5 text-white/60 text-sm hover:bg-white/10 transition-all">← Atrás</button>
              <button onClick={() => saveStep(3, { agent_name: config.agentName, agent_phone: config.phoneOption === 'redirect' ? config.agentPhone : '+34 900 XXX XXX', language: config.language })}
                disabled={saving || !config.agentName.trim()}
                className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition-all">
                {saving ? 'Guardando...' : 'Guardar configuración →'}
              </button>
            </div>
          </div>
        )}

        {/* ─── PASO 3: ACTIVACIÓN ─── */}
        {step === 3 && (
          <div className="space-y-6 text-center">
            <div>
              <div className="relative inline-flex items-center justify-center w-24 h-24 mb-4">
                <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping"/>
                <div className="relative w-24 h-24 bg-emerald-500/20 border-2 border-emerald-500/40 rounded-full flex items-center justify-center text-4xl">🚀</div>
              </div>
              <h1 className="text-3xl font-black mb-2">¡Tu recepcionista AI está lista!</h1>
              <p className="text-white/50">Hemos configurado tu recepcionista para <strong className="text-white">{tenant?.name}</strong></p>
            </div>

            {/* Número asignado */}
            <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-2xl p-6">
              <p className="text-sm text-white/50 mb-2">Número de teléfono de tu recepcionista</p>
              <div className="text-3xl font-black text-emerald-400 tracking-wide mb-3">
                {tenant?.agent_phone || '+34 900 123 456'}
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-sm text-emerald-300">
                📞 Llama a este número para probar tu recepcionista AI
              </div>
            </div>

            {/* Info del agente */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 text-left space-y-3">
              <h3 className="font-semibold text-sm">Configuración de tu agente</h3>
              {[
                { label: 'Nombre del agente', value: tenant?.agent_name || config.agentName },
                { label: 'Negocio', value: tenant?.name },
                { label: 'Tipo', value: (TIPOS_LABEL as any)[tenant?.type] || tenant?.type },
                { label: 'Idioma', value: IDIOMAS.find(l => l.value === (tenant?.language || 'es'))?.label },
                { label: 'Llamadas gratuitas', value: `${(tenant?.free_calls_limit || 10) - (tenant?.free_calls_used || 0)} de ${tenant?.free_calls_limit || 10} disponibles` },
              ].map(item => (
                <div key={item.label} className="flex justify-between text-sm">
                  <span className="text-white/40">{item.label}</span>
                  <span className="font-medium">{item.value}</span>
                </div>
              ))}
            </div>

            {/* Instrucciones */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-left text-sm text-blue-200">
              <div className="font-semibold mb-2">📋 Cómo probar tu recepcionista</div>
              <ol className="space-y-1 text-xs text-blue-300/80 list-decimal list-inside">
                <li>Llama al número de tu recepcionista desde tu móvil</li>
                <li>Di que quieres hacer una reserva o pregunta sobre el negocio</li>
                <li>Observa cómo la IA gestiona la conversación</li>
                <li>Revisa las reservas y pedidos en tu Panel de control</li>
              </ol>
            </div>

            <button onClick={() => saveStep(4)}
              className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-4 rounded-xl text-base transition-all active:scale-95 shadow-lg shadow-violet-500/25">
              Ir al Panel de control →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}