'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const BUSINESS_TYPES = [
  { id: 'restaurante', icon: '🍽️', label: 'Restaurante' },
  { id: 'bar', icon: '🍺', label: 'Bar' },
  { id: 'clinica_dental', icon: '🦷', label: 'Clínica Dental' },
  { id: 'clinica_medica', icon: '🏥', label: 'Clínica Médica' },
  { id: 'asesoria', icon: '💼', label: 'Asesoría' },
  { id: 'peluqueria', icon: '✂️', label: 'Peluquería' },
  { id: 'seguros', icon: '🛡️', label: 'Seguros' },
  { id: 'inmobiliaria', icon: '🏠', label: 'Inmobiliaria' },
  { id: 'otro', icon: '🏪', label: 'Otro negocio' },
]

export default function RegistroPage() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ name: '', type: '', email: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!form.name || !form.type || !form.email || !form.password) { setError('Rellena todos los campos'); return }
    if (form.password !== form.confirm) { setError('Las contraseñas no coinciden'); return }
    if (form.password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }
    setLoading(true); setError('')
    try {
      const r = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName: form.name, businessType: form.type, email: form.email, password: form.password })
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Error al registrar')
      window.location.href = '/onboarding'
    } catch(e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl font-black text-white">R</span>
          </div>
          <h1 className="text-3xl font-bold text-white">Reservo.AI</h1>
          <p className="text-slate-400 mt-1">Crea tu cuenta gratis — 10 llamadas incluidas</p>
        </div>

        <div className="bg-slate-800/80 backdrop-blur rounded-3xl border border-slate-700 p-8">
          {/* Steps */}
          <div className="flex items-center gap-2 mb-8">
            {[1,2].map(s => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${step >= s ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400'}`}>{s}</div>
                {s < 2 && <div className={`flex-1 h-0.5 ${step > s ? 'bg-indigo-600' : 'bg-slate-700'}`}/>}
              </div>
            ))}
          </div>

          {step === 1 && (
            <div>
              <h2 className="text-xl font-bold text-white mb-1">¿Qué tipo de negocio tienes?</h2>
              <p className="text-slate-400 text-sm mb-6">Adaptamos Reservo.AI a tu sector</p>
              <div className="grid grid-cols-3 gap-3 mb-6">
                {BUSINESS_TYPES.map(bt => (
                  <button key={bt.id} onClick={() => setForm({...form, type: bt.id})}
                    className={`p-3 rounded-2xl border text-center transition-all ${form.type === bt.id ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:border-slate-400'}`}>
                    <div className="text-2xl mb-1">{bt.icon}</div>
                    <p className="text-xs font-medium">{bt.label}</p>
                  </button>
                ))}
              </div>
              <div className="mb-6">
                <label className="text-sm font-medium text-slate-300 mb-2 block">Nombre del negocio *</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  placeholder="Ej: Restaurante La Bahía"
                  className="w-full bg-slate-700 border border-slate-600 rounded-2xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"/>
              </div>
              <button onClick={() => { if (!form.type) { setError('Selecciona el tipo de negocio'); return } if (!form.name) { setError('Escribe el nombre del negocio'); return } setError(''); setStep(2) }}
                className="w-full bg-indigo-600 text-white py-3.5 rounded-2xl font-bold hover:bg-indigo-500 transition-colors">
                Continuar →
              </button>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold text-white mb-1">Crea tu cuenta</h2>
              <p className="text-slate-400 text-sm mb-6">Para <span className="text-white font-medium">{form.name}</span></p>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-sm font-medium text-slate-300 mb-2 block">Email *</label>
                  <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                    placeholder="tu@email.com"
                    className="w-full bg-slate-700 border border-slate-600 rounded-2xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"/>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-300 mb-2 block">Contraseña *</label>
                  <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full bg-slate-700 border border-slate-600 rounded-2xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"/>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-300 mb-2 block">Confirmar contraseña *</label>
                  <input type="password" value={form.confirm} onChange={e => setForm({...form, confirm: e.target.value})}
                    placeholder="Repite la contraseña"
                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                    className="w-full bg-slate-700 border border-slate-600 rounded-2xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"/>
                </div>
              </div>
              {error && <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-3 mb-4"><p className="text-red-400 text-sm">{error}</p></div>}
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="px-5 py-3.5 rounded-2xl border border-slate-600 text-slate-300 hover:border-slate-400 transition-colors">
                  ← Atrás
                </button>
                <button onClick={handleSubmit} disabled={loading}
                  className="flex-1 bg-indigo-600 text-white py-3.5 rounded-2xl font-bold hover:bg-indigo-500 transition-colors disabled:opacity-50">
                  {loading ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Creando cuenta...</span> : 'Crear cuenta gratis →'}
                </button>
              </div>
              <p className="text-center text-slate-500 text-xs mt-4">
                Al registrarte aceptas los <a href="#" className="text-indigo-400">términos de uso</a>
              </p>
            </div>
          )}

          {step === 1 && error && <p className="text-red-400 text-sm mt-3 text-center">{error}</p>}
        </div>

        <p className="text-center text-slate-400 text-sm mt-6">
          ¿Ya tienes cuenta? <a href="/login" className="text-indigo-400 hover:underline font-medium">Inicia sesión</a>
        </p>
      </div>
    </div>
  )
}