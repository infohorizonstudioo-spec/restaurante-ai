'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const STEPS_RESTAURANT = ['Configurar agente', 'Configurar local', 'Activar']
const STEPS_DEFAULT = ['Configurar agente', 'Activar']

const DAYS = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']
const DEFAULT_HOURS = { open: '09:00', close: '21:00', closed: false }

export default function OnboardingPage() {
  const [tenant, setTenant] = useState<any>(null)
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)

  // Step 1 - Agent config
  const [agentName, setAgentName] = useState('Gabriela')
  const [language, setLanguage] = useState('es')
  const [hours, setHours] = useState(() => Object.fromEntries(DAYS.map((d, i) => [d, { ...DEFAULT_HOURS, closed: i >= 5 }])))

  // Step 2 - Local (restaurant only)
  const [zones, setZones] = useState([
    { name: 'Interior', tables: 8 },
    { name: 'Terraza', tables: 6 },
  ])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single()
      if (!profile?.tenant_id) return
      const { data: t } = await supabase.from('tenants').select('*').eq('id', (profile as any).tenant_id).single()
      if (t?.onboarding_complete) { window.location.href = '/panel'; return }
      setTenant(t)
      if (t?.agent_name) setAgentName(t.agent_name)
    }
    load()
  }, [])

  const isRestaurant = tenant?.type === 'restaurante' || tenant?.type === 'bar'
  const totalSteps = isRestaurant ? 3 : 2
  const stepLabels = isRestaurant ? STEPS_RESTAURANT : STEPS_DEFAULT

  async function saveStep1() {
    setSaving(true)
    await supabase.from('tenants').update({ agent_name: agentName, language, business_hours: hours, onboarding_step: 2 }).eq('id', tenant.id)
    setSaving(false)
    setStep(2)
  }

  async function saveStep2Restaurant() {
    setSaving(true)
    // Crear zonas y mesas automáticamente
    for (const zone of zones) {
      if (!zone.name || zone.tables < 1) continue
      const { data: z } = await supabase.from('zones').insert({ tenant_id: tenant.id, name: zone.name, active: true }).select().single()
      if (z) {
        const tablesToInsert = Array.from({ length: zone.tables }, (_, i) => ({
          tenant_id: tenant.id, zone_id: z.id, name: `${zone.name[0]}${i+1}`, capacity: 4, status: 'libre', combinable: false
        }))
        await supabase.from('tables').insert(tablesToInsert)
      }
    }
    await supabase.from('tenants').update({ onboarding_step: 3 }).eq('id', tenant.id)
    setSaving(false)
    setStep(3)
  }

  async function completeOnboarding() {
    setSaving(true)
    await supabase.from('tenants').update({ onboarding_complete: true, onboarding_step: totalSteps }).eq('id', tenant.id)
    setSaving(false)
    window.location.href = '/panel'
  }

  if (!tenant) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"/>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-black text-white">R</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Configura Reservo.AI</h1>
          <p className="text-slate-400 mt-1">Para {tenant.name}</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8 px-4">
          {stepLabels.map((label, i) => (
            <div key={i} className="flex items-center gap-2 flex-1 last:flex-none">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step > i+1 ? 'bg-green-500 text-white' : step === i+1 ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                  {step > i+1 ? '✓' : i+1}
                </div>
                <span className={`text-sm hidden sm:block ${step === i+1 ? 'text-white font-medium' : 'text-slate-500'}`}>{label}</span>
              </div>
              {i < stepLabels.length - 1 && <div className={`flex-1 h-0.5 mx-2 ${step > i+1 ? 'bg-green-500' : 'bg-slate-700'}`}/>}
            </div>
          ))}
        </div>

        <div className="bg-slate-800/80 backdrop-blur rounded-3xl border border-slate-700 p-8">
          
          {/* STEP 1: Agent config */}
          {step === 1 && (
            <div>
              <h2 className="text-xl font-bold text-white mb-1">Configura tu recepcionista AI</h2>
              <p className="text-slate-400 text-sm mb-6">Personaliza cómo atenderá tus llamadas</p>
              
              <div className="space-y-6">
                <div>
                  <label className="text-sm font-medium text-slate-300 mb-2 block">Nombre del agente</label>
                  <input value={agentName} onChange={e => setAgentName(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"/>
                  <p className="text-slate-500 text-xs mt-1">Así se presentará al teléfono: "Hola, soy {agentName}..."</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-300 mb-2 block">Idioma</label>
                  <select value={language} onChange={e => setLanguage(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500">
                    <option value="es">🇪🇸 Español</option>
                    <option value="en">🇬🇧 English</option>
                    <option value="ca">🇪🇸 Català</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-300 mb-3 block">Horario del negocio</label>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {DAYS.map(day => (
                      <div key={day} className="flex items-center gap-3 bg-slate-700/50 rounded-xl px-4 py-2.5">
                        <span className="text-sm text-slate-300 w-20">{day}</span>
                        <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                          <input type="checkbox" checked={!hours[day].closed}
                            onChange={e => setHours(h => ({...h, [day]: {...h[day], closed: !e.target.checked}}))}
                            className="rounded accent-indigo-500"/>
                          Abierto
                        </label>
                        {!hours[day].closed && (
                          <>
                            <input type="time" value={hours[day].open}
                              onChange={e => setHours(h => ({...h, [day]: {...h[day], open: e.target.value}}))}
                              className="bg-slate-600 border border-slate-500 rounded-lg px-2 py-1 text-white text-xs focus:outline-none"/>
                            <span className="text-slate-500 text-xs">—</span>
                            <input type="time" value={hours[day].close}
                              onChange={e => setHours(h => ({...h, [day]: {...h[day], close: e.target.value}}))}
                              className="bg-slate-600 border border-slate-500 rounded-lg px-2 py-1 text-white text-xs focus:outline-none"/>
                          </>
                        )}
                        {hours[day].closed && <span className="text-slate-500 text-xs">Cerrado</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <button onClick={saveStep1} disabled={saving}
                className="w-full mt-8 bg-indigo-600 text-white py-3.5 rounded-2xl font-bold hover:bg-indigo-500 transition-colors disabled:opacity-50">
                {saving ? 'Guardando...' : 'Continuar →'}
              </button>
            </div>
          )}

          {/* STEP 2: Local config (restaurant) */}
          {step === 2 && isRestaurant && (
            <div>
              <h2 className="text-xl font-bold text-white mb-1">Configura tu local</h2>
              <p className="text-slate-400 text-sm mb-6">Define las zonas y mesas de tu negocio</p>
              
              <div className="space-y-4 mb-6">
                {zones.map((zone, i) => (
                  <div key={i} className="bg-slate-700/50 rounded-2xl p-4">
                    <div className="flex items-center gap-3">
                      <input value={zone.name} onChange={e => { const z = [...zones]; z[i].name = e.target.value; setZones(z) }}
                        placeholder="Nombre de la zona"
                        className="flex-1 bg-slate-600 border border-slate-500 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"/>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-sm">Mesas:</span>
                        <input type="number" value={zone.tables} min={1} max={50}
                          onChange={e => { const z = [...zones]; z[i].tables = parseInt(e.target.value)||1; setZones(z) }}
                          className="w-16 bg-slate-600 border border-slate-500 rounded-xl px-2 py-2 text-white text-sm text-center focus:outline-none"/>
                      </div>
                      {zones.length > 1 && (
                        <button onClick={() => setZones(zones.filter((_,j) => j !== i))} className="text-red-400 hover:text-red-300 text-lg">✕</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={() => setZones([...zones, { name: '', tables: 4 }])}
                className="w-full border border-dashed border-slate-600 text-slate-400 py-3 rounded-2xl text-sm hover:border-indigo-500 hover:text-indigo-400 transition-colors mb-6">
                + Añadir zona
              </button>

              <p className="text-slate-500 text-xs mb-6">Las mesas se crean automáticamente. Podrás personalizarlas desde el panel.</p>

              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="px-5 py-3.5 rounded-2xl border border-slate-600 text-slate-300 hover:border-slate-400">← Atrás</button>
                <button onClick={saveStep2Restaurant} disabled={saving}
                  className="flex-1 bg-indigo-600 text-white py-3.5 rounded-2xl font-bold hover:bg-indigo-500 disabled:opacity-50">
                  {saving ? 'Creando mesas...' : 'Continuar →'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2 (non-restaurant) or STEP 3: Activation */}
          {((step === 2 && !isRestaurant) || (step === 3 && isRestaurant)) && (
            <div className="text-center">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">🎉</span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">¡Todo listo!</h2>
              <p className="text-slate-400 mb-6">Tu recepcionista AI <span className="text-white font-semibold">{agentName}</span> está configurada para <span className="text-white font-semibold">{tenant.name}</span></p>

              <div className="bg-slate-700/50 rounded-2xl p-5 mb-6 text-left space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-green-400">✓</span>
                  <span className="text-slate-300 text-sm">Agente configurado: <span className="text-white font-medium">{agentName}</span></span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-green-400">✓</span>
                  <span className="text-slate-300 text-sm">Horario guardado</span>
                </div>
                {isRestaurant && (
                  <div className="flex items-center gap-3">
                    <span className="text-green-400">✓</span>
                    <span className="text-slate-300 text-sm">{zones.reduce((a,z) => a+z.tables,0)} mesas creadas en {zones.length} zonas</span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <span className="text-amber-400">⏳</span>
                  <span className="text-slate-300 text-sm">10 llamadas gratuitas disponibles</span>
                </div>
              </div>

              <button onClick={completeOnboarding} disabled={saving}
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-4 rounded-2xl font-bold text-lg hover:from-indigo-500 hover:to-violet-500 transition-all shadow-xl disabled:opacity-50">
                {saving ? 'Activando...' : 'Ir al centro de control →'}
              </button>

              <p className="text-slate-500 text-xs mt-4">
                Podrás activar el número de teléfono desde la configuración
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}