'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) { setError('Rellena todos los campos'); return }
    setLoading(true); setError('')
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) { setError('Email o contraseña incorrectos'); setLoading(false); return }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single()
    router.push(profile?.role === 'superadmin' ? '/admin' : '/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#070710] flex items-center justify-center p-4">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-violet-600/8 rounded-full blur-3xl"/>
      </div>
      <div className="relative w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-2xl font-black shadow-2xl shadow-violet-500/30 mb-4">R</div>
          <h1 className="text-2xl font-bold text-white">Reservo.AI</h1>
          <p className="text-white/40 text-sm mt-1">Accede a tu panel de control</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 space-y-4 backdrop-blur-sm">
            {error && (
              <div className="bg-red-500/10 border border-red-500/25 text-red-300 text-xs px-3 py-2.5 rounded-xl">⚠ {error}</div>
            )}
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" autoFocus
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500/60 transition-all"/>
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Contraseña</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500/60 transition-all"/>
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-all active:scale-95 mt-2">
              {loading ? 'Accediendo...' : 'Entrar'}
            </button>
          </div>
        </form>
        <p className="text-center text-xs text-white/20 mt-6">Reservo.AI © 2026 · Horizon Studio</p>
      </div>
    </div>
  )
}