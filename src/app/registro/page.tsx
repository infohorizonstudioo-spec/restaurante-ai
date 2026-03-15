'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const TIPOS = [
  { value: 'restaurant', label: '🍽️ Restaurante / Bar' },
  { value: 'clinic',     label: '🏥 Clínica / Salud' },
  { value: 'advisory',  label: '💼 Asesoría / Consultoría' },
  { value: 'beauty',    label: '💇 Peluquería / Estética' },
  { value: 'other',     label: '◻ Otro tipo de negocio' },
]

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    businessName: '', businessType: 'restaurant',
    email: '', password: '', confirmPassword: '', phone: ''
  })

  function update(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); setError('') }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.businessName.trim()) { setError('Escribe el nombre de tu negocio'); return }
    if (!form.email.trim()) { setError('Email obligatorio'); return }
    if (form.password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return }
    if (form.password !== form.confirmPassword) { setError('Las contraseñas no coinciden'); return }

    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: form.businessName.trim(),
          businessType: form.businessType,
          email: form.email.trim().toLowerCase(),
          password: form.password,
          phone: form.phone.trim() || undefined,
        })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error al crear la cuenta'); setLoading(false); return }
      
      // Auto login after registration
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: form.email.trim().toLowerCase(), password: form.password
      })
      if (loginError) { router.push('/login'); return }
      router.push('/dashboard')
      router.refresh()
    } catch(e: any) {
      setError(e.message); setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#070710] flex items-center justify-center p-4">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-violet-600/8 rounded-full blur-3xl"/>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-600/8 rounded-full blur-3xl"/>
      </div>
      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-2xl font-black shadow-2xl shadow-violet-500/30 mb-4">R</div>
          <h1 className="text-2xl font-bold text-white">Empieza gratis</h1>
          <p className="text-white/40 text-sm mt-1">Crea tu cuenta de Reservo.AI en segundos</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 space-y-4 backdrop-blur-sm">
            {error && (
              <div className="bg-red-500/10 border border-red-500/25 text-red-300 text-xs px-3 py-2.5 rounded-xl flex items-center gap-2">
                <span>⚠</span> {error}
              </div>
            )}

            {/* Nombre del negocio */}
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Nombre de tu negocio *</label>
              <input type="text" value={form.businessName}
                onChange={e => update('businessName', e.target.value)}
                placeholder="Restaurante La Bahía"
                autoFocus
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500/60 transition-all"/>
            </div>

            {/* Tipo de negocio */}
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Tipo de negocio *</label>
              <div className="grid grid-cols-1 gap-2">
                {TIPOS.map(t => (
                  <button key={t.value} type="button"
                    onClick={() => update('businessType', t.value)}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm transition-all text-left
                      ${form.businessType === t.value
                        ? 'bg-violet-600/20 border-violet-500/50 text-white'
                        : 'bg-white/5 border-white/10 text-white/50 hover:border-white/25 hover:text-white/70'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Email *</label>
              <input type="email" value={form.email}
                onChange={e => update('email', e.target.value)}
                placeholder="tu@negocio.com"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500/60 transition-all"/>
            </div>

            {/* Contraseña */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Contraseña *</label>
                <input type="password" value={form.password}
                  onChange={e => update('password', e.target.value)}
                  placeholder="Mín. 8 caracteres"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500/60 transition-all"/>
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Confirmar</label>
                <input type="password" value={form.confirmPassword}
                  onChange={e => update('confirmPassword', e.target.value)}
                  placeholder="Repetir"
                  className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none transition-all
                    ${form.confirmPassword && form.password !== form.confirmPassword ? 'border-red-500/50 focus:border-red-500/60' : 'border-white/10 focus:border-violet-500/60'}`}/>
              </div>
            </div>

            {/* Teléfono (opcional) */}
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Teléfono <span className="text-white/25">(opcional)</span></label>
              <input type="tel" value={form.phone}
                onChange={e => update('phone', e.target.value)}
                placeholder="+34 600 000 000"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500/60 transition-all"/>
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl text-sm transition-all active:scale-95 mt-2">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Creando tu cuenta...
                </span>
              ) : 'Crear cuenta gratis →'}
            </button>
          </div>
        </form>

        <p className="text-center text-xs text-white/30 mt-5">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-violet-400 hover:text-violet-300 transition-colors">Inicia sesión</Link>
        </p>
        <p className="text-center text-xs text-white/20 mt-2">
          Reservo.AI © 2026 · Horizon Studio · Plan gratuito sin tarjeta
        </p>
      </div>
    </div>
  )
}