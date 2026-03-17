'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 99,
    calls: 50,
    extra: 0.90,
    color: 'gray',
    badge: null,
    cta: 'Empezar ahora',
    ideal: 'Autónomos y pequeños negocios',
    features: [
      'Recepcionista AI 24/7',
      'Centro de control',
      'Agenda básica',
      'Historial de clientes',
      'Resumen automático de llamadas',
      '50 llamadas incluidas/mes',
    ]
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 299,
    calls: 200,
    extra: 0.70,
    color: 'indigo',
    badge: 'Más popular',
    cta: 'Elegir plan',
    ideal: 'Negocios en crecimiento, clínicas, restaurantes',
    features: [
      'Todo lo del plan Starter',
      'Automatizaciones',
      'Confirmaciones automáticas',
      'Recordatorios automáticos',
      'Recuperación de llamadas perdidas',
      'Estadísticas avanzadas',
      '200 llamadas incluidas/mes',
    ]
  },
  {
    id: 'business',
    name: 'Business',
    price: 499,
    calls: 600,
    extra: 0.50,
    color: 'violet',
    badge: null,
    cta: 'Escalar mi negocio',
    ideal: 'Alto volumen, restaurantes grandes, empresas',
    features: [
      'Todo lo del plan Pro',
      'Gestión de pedidos',
      'Entregas a domicilio',
      'Integraciones avanzadas',
      'Prioridad de soporte',
      'Automatizaciones avanzadas',
      '600 llamadas incluidas/mes',
    ]
  }
]

export default function PreciosPage() {
  const [tenant, setTenant] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
      if (!profile?.tenant_id) return
      const { data: t } = await supabase.from('tenants').select('*').eq('id', (profile as any).tenant_id).single()
      setTenant(t)
    }
    load()
  }, [])

  async function handleSelectPlan(planId: string) {
    if (!tenant) { window.location.href = '/registro'; return }
    setLoadingPlan(planId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session?.access_token },
        body: JSON.stringify({ plan: planId, tenant_id: tenant.id })
      })
      const d = await r.json()
      if (d.url) window.location.href = d.url
    } catch(e) { console.error(e) }
    finally { setLoadingPlan(null) }
  }

  const callsUsed = tenant?.call_count || 0
  const callsLeft = Math.max(0, (tenant?.free_calls_limit || 10) - (tenant?.free_calls_used || 0))
  const isTrial = !tenant?.plan || tenant?.plan === 'trial' || tenant?.plan === 'free'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
      {/* Header */}
      <div className="text-center pt-16 pb-12 px-4">
        <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-4 py-1.5 text-sm text-indigo-300 mb-6">
          ✨ Sin permanencia · Cancela cuando quieras
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          Elige tu plan
        </h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto">
          Empieza con 10 llamadas gratis. Sin tarjeta de crédito.
        </p>

        {/* Trial status */}
        {isTrial && tenant && (
          <div className="mt-6 inline-flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl px-6 py-3">
            <span className="text-2xl">⏳</span>
            <div className="text-left">
              <p className="text-amber-300 font-semibold">Llamadas gratuitas: <span className="text-white font-bold">{callsLeft} / {tenant?.free_calls_limit || 10}</span></p>
              {callsLeft === 0 && <p className="text-amber-400 text-sm mt-0.5">Has agotado tu prueba gratuita. Elige un plan para continuar.</p>}
              {callsLeft > 0 && callsLeft <= 3 && <p className="text-amber-400 text-sm mt-0.5">Estás cerca del límite. Elige un plan ahora.</p>}
            </div>
          </div>
        )}
      </div>

      {/* Plans grid */}
      <div className="max-w-6xl mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {PLANS.map((plan) => {
            const isCurrentPlan = tenant?.plan === plan.id
            const isPro = plan.id === 'pro'
            return (
              <div key={plan.id} className={`relative rounded-3xl border transition-all duration-300 ${isPro
                ? 'bg-indigo-600 border-indigo-400 shadow-2xl shadow-indigo-500/30 scale-105'
                : 'bg-slate-800/50 border-slate-700 hover:border-slate-500'
              }`}>
                {/* Badge */}
                {plan.badge && (
                  <div className="absolute -top-4 left-0 right-0 flex justify-center">
                    <span className="bg-gradient-to-r from-amber-400 to-orange-400 text-slate-900 text-sm font-bold px-4 py-1.5 rounded-full shadow-lg">
                      ⭐ {plan.badge}
                    </span>
                  </div>
                )}

                {isCurrentPlan && (
                  <div className="absolute -top-4 left-0 right-0 flex justify-center">
                    <span className="bg-green-500 text-white text-sm font-bold px-4 py-1.5 rounded-full">
                      ✅ Plan actual
                    </span>
                  </div>
                )}

                <div className="p-8">
                  {/* Plan name */}
                  <p className={`text-sm font-semibold uppercase tracking-wider mb-2 ${isPro ? 'text-indigo-200' : 'text-slate-400'}`}>
                    {plan.name}
                  </p>

                  {/* Price */}
                  <div className="flex items-end gap-1 mb-1">
                    <span className={`text-5xl font-black ${isPro ? 'text-white' : 'text-white'}`}>{plan.price}€</span>
                    <span className={`text-lg mb-2 ${isPro ? 'text-indigo-200' : 'text-slate-400'}`}>/mes</span>
                  </div>

                  {/* Calls info */}
                  <div className={`rounded-2xl p-4 mb-6 ${isPro ? 'bg-indigo-500/30' : 'bg-slate-700/50'}`}>
                    <div className="flex justify-between items-center">
                      <span className={`text-sm ${isPro ? 'text-indigo-200' : 'text-slate-400'}`}>Llamadas incluidas</span>
                      <span className={`font-bold text-lg ${isPro ? 'text-white' : 'text-white'}`}>{plan.calls}</span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className={`text-sm ${isPro ? 'text-indigo-200' : 'text-slate-400'}`}>Llamada extra</span>
                      <span className={`font-semibold ${isPro ? 'text-indigo-100' : 'text-slate-300'}`}>{plan.extra.toFixed(2).replace('.',',')}€</span>
                    </div>
                  </div>

                  {/* CTA Button */}
                  <button
                    onClick={() => handleSelectPlan(plan.id)}
                    disabled={isCurrentPlan || loadingPlan === plan.id}
                    className={`w-full py-3.5 rounded-2xl font-bold text-base transition-all duration-200 mb-6 ${
                      isCurrentPlan ? 'bg-green-500/20 text-green-400 cursor-default border border-green-500/30' :
                      isPro ? 'bg-white text-indigo-700 hover:bg-indigo-50 shadow-lg hover:shadow-xl active:scale-95' :
                      'bg-indigo-600 text-white hover:bg-indigo-500 active:scale-95'
                    }`}>
                    {loadingPlan === plan.id ? (
                      <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"/>Cargando...</span>
                    ) : isCurrentPlan ? '✅ Plan actual' : plan.cta}
                  </button>

                  {/* Ideal for */}
                  <p className={`text-xs mb-5 ${isPro ? 'text-indigo-200' : 'text-slate-500'}`}>
                    Ideal para: {plan.ideal}
                  </p>

                  {/* Features */}
                  <ul className="space-y-3">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className={`text-sm mt-0.5 shrink-0 ${isPro ? 'text-indigo-300' : 'text-indigo-400'}`}>✓</span>
                        <span className={`text-sm ${isPro ? 'text-indigo-100' : 'text-slate-300'}`}>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )
          })}
        </div>

        {/* Usage calculator */}
        <div className="mt-16 bg-slate-800/40 border border-slate-700 rounded-3xl p-8">
          <h2 className="text-2xl font-bold text-white mb-2 text-center">Calcula tu coste</h2>
          <p className="text-slate-400 text-center mb-8">¿Cuántas llamadas recibe tu negocio al mes?</p>
          <UsageCalculator />
        </div>

        {/* FAQ */}
        <div className="mt-12 text-center">
          <p className="text-slate-400 text-sm">
            ¿Tienes dudas? Escríbenos a <a href="mailto:hola@reservo.ai" className="text-indigo-400 hover:underline">hola@reservo.ai</a>
          </p>
          <p className="text-slate-500 text-sm mt-2">Sin permanencia · Cancela en cualquier momento · Sin comisiones ocultas</p>
        </div>
      </div>
    </div>
  )
}

function UsageCalculator() {
  const [calls, setCalls] = useState(150)
  
  const plans = [
    { name: 'Starter', price: 99, included: 50, extra: 0.90 },
    { name: 'Pro', price: 299, included: 200, extra: 0.70 },
    { name: 'Business', price: 499, included: 600, extra: 0.50 },
  ]

  const costs = plans.map(p => {
    const extraCalls = Math.max(0, calls - p.included)
    const total = p.price + extraCalls * p.extra
    return { ...p, extraCalls, total }
  })

  const best = costs.reduce((a, b) => a.total < b.total ? a : b)

  return (
    <div>
      <div className="flex items-center gap-4 mb-8 max-w-lg mx-auto">
        <span className="text-white font-semibold shrink-0">Llamadas/mes:</span>
        <input type="range" min={10} max={800} step={10} value={calls} onChange={e => setCalls(parseInt(e.target.value))}
          className="flex-1 accent-indigo-500"/>
        <span className="text-indigo-400 font-bold w-16 text-right">{calls}</span>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {costs.map(p => (
          <div key={p.name} className={`rounded-2xl p-5 text-center border transition-all ${p.name === best.name ? 'bg-indigo-600 border-indigo-400' : 'bg-slate-700/50 border-slate-600'}`}>
            <p className="text-sm font-semibold text-slate-400 mb-1">{p.name}</p>
            <p className="text-2xl font-black text-white">{p.total.toFixed(0)}€</p>
            <p className="text-xs text-slate-400 mt-1">{p.price}€ base{p.extraCalls > 0 ? ` + ${(p.extraCalls * p.extra).toFixed(0)}€ extra` : ''}</p>
            {p.name === best.name && <p className="text-xs text-indigo-200 font-bold mt-2">✓ Mejor opción</p>}
          </div>
        ))}
      </div>
    </div>
  )
}