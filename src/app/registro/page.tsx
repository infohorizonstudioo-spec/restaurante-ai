'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const TIPOS = [
  { value: 'restaurant', icon: '🍽️', label: 'Restaurante' },
  { value: 'bar',        icon: '🍺', label: 'Bar' },
  { value: 'clinic',     icon: '🏥', label: 'Clínica de salud' },
  { value: 'advisory',   icon: '💼', label: 'Asesoría / Consultoría' },
  { value: 'beauty',     icon: '💇', label: 'Peluquería / Estética' },
  { value: 'other',      icon: '◻',  label: 'Otro tipo de negocio' },
]

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ businessName:'', businessType:'restaurant', email:'', password:'', confirmPassword:'', phone:'' })
  function update(k: string, v: string) { setForm(f => ({...f, [k]:v})); setError('') }
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.businessName.trim()) { setError('Escribe el nombre de tu negocio'); return }
    if (!form.email.trim()) { setError('El email es obligatorio'); return }
    if (form.password.length < 8) { setError('Mínimo 8 caracteres'); return }
    if (form.password !== form.confirmPassword) { setError('Las contraseñas no coinciden'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName: form.businessName.trim(), businessType: form.businessType, email: form.email.trim().toLowerCase(), password: form.password, phone: form.phone.trim() || undefined })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error al crear la cuenta'); setLoading(false); return }
      const { error: loginError } = await supabase.auth.signInWithPassword({ email: form.email.trim().toLowerCase(), password: form.password })
      if (loginError) { router.push('/login'); return }
      router.push('/onboarding'); router.refresh()
    } catch(e: any) { setError(e.message); setLoading(false) }
  }
  return (
    <div className="min-h-screen bg-[#070710] flex items-center justify-center p-4">
      <div className="fixed inset-0 pointer-events-none"><div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-violet-600/8 rounded-full blur-3xl"/></div>
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/login"><div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-xl font-black shadow-2xl shadow-violet-500/30 mb-3">R</div></Link>
          <h1 className="text-2xl font-bold text-white">Crea tu cuenta en Reservo.AI</h1>
          <p className="text-white/40 text-sm mt-1">10 llamadas gratuitas para empezar · Sin tarjeta de crédito</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 space-y-4 backdrop-blur-sm">
            {error && <div className="bg-red-500/10 border border-red-500/25 text-red-300 text-xs px-3 py-2.5 rounded-xl">⚠ {error}</div>}
            <div><label className="text-xs text-white/40 mb-1.5 block">Nombre del negocio *</label>
              <input type="text" value={form.businessName} onChange={e => update('businessName', e.target.value)} placeholder="Ej: Restaurante La Bahía" autoFocus className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500/60 transition-all"/></div>
            <div><label className="text-xs text-white/40 mb-2 block">Tipo de negocio *</label>
              <div className="grid grid-cols-2 gap-2">{TIPOS.map(t => (<button key={t.value} type="button" onClick={() => update('businessType', t.value)} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-all text-left ${form.businessType === t.value ? 'bg-violet-600/20 border-violet-500/50 text-white' : 'bg-white/5 border-white/10 text-white/50 hover:border-white/25'}`}><span>{t.icon}</span><span>{t.label}</span></button>))}</div></div>
            <div><label className="text-xs text-white/40 mb-1.5 block">Email *</label>
              <input type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="tu@negocio.com" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500/60 transition-all"/></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-white/40 mb-1.5 block">Contraseña *</label>
                <input type="password" value={form.password} onChange={e => update('password', e.target.value)} placeholder="Mín. 8 caracteres" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500/60"/></div>
              <div><label className="text-xs text-white/40 mb-1.5 block">Confirmar *</label>
                <input type="password" value={form.confirmPassword} onChange={e => update('confirmPassword', e.target.value)} placeholder="Repetir" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500/60"/></div></div>
            <div><label className="text-xs text-white/40 mb-1.5 block">Teléfono <span className="text-white/25">(opcional)</span></label>
              <input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="+34 600 000 000" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500/60"/></div>
            <button type="submit" disabled={loading} className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl text-sm transition-all active:scale-95">
              {loading ? 'Creando tu cuenta...' : 'Crear cuenta · 10 llamadas gratis →'}</button>
          </div>
        </form>
        <div className="mt-5 text-center space-y-2">
          <p className="text-sm text-white/30">¿Ya tienes cuenta? <Link href="/login" className="text-violet-400 hover:text-violet-300 font-medium">Inicia sesión</Link></p>
          <p className="text-xs text-white/20"><Link href="/precios" className="hover:text-white/40">Ver planes · desde 350€/mes</Link></p>
        </div>
      </div>
    </div>
  )
}