'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin() {
    if (!email || !password) { setError('Rellena todos los campos'); return }
    setLoading(true); setError('')
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) throw authError
      if (!data.user) throw new Error('Error de autenticación')
      
      // Obtener perfil para saber a dónde redirigir
      const { data: profile } = await supabase.from('profiles').select('role, tenant_id').eq('id', data.user.id).single()
      
      if ((profile as any)?.role === 'superadmin') {
        window.location.href = '/admin'
      } else if ((profile as any)?.tenant_id) {
        // Ver si tiene onboarding completo
        const { data: tenant } = await supabase.from('tenants').select('onboarding_complete').eq('id', (profile as any).tenant_id).single()
        window.location.href = tenant?.onboarding_complete ? '/panel' : '/onboarding'
      } else {
        window.location.href = '/panel'
      }
    } catch(e: any) {
      const msg = e.message || ''
      if (msg.includes('Invalid login') || msg.includes('invalid_credentials')) {
        setError('Email o contraseña incorrectos')
      } else if (msg.includes('Email not confirmed')) {
        setError('Confirma tu email antes de entrar')
      } else {
        setError('Error al iniciar sesión. Inténtalo de nuevo.')
      }
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-indigo-500/30">
            <span className="text-3xl font-black text-white">R</span>
          </div>
          <h1 className="text-3xl font-bold text-white">Reservo.AI</h1>
          <p className="text-slate-400 mt-1">Tu recepcionista con IA</p>
        </div>

        <div className="bg-slate-800/80 backdrop-blur rounded-3xl border border-slate-700 p-8 shadow-2xl">
          <h2 className="text-xl font-bold text-white mb-6">Iniciar sesión</h2>
          <div className="space-y-4 mb-6">
            <div>
              <label className="text-sm font-medium text-slate-300 mb-2 block">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com" autoComplete="email"
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                className="w-full bg-slate-700 border border-slate-600 rounded-2xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"/>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300 mb-2 block">Contraseña</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Tu contraseña" autoComplete="current-password"
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                className="w-full bg-slate-700 border border-slate-600 rounded-2xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"/>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-3 mb-4">
              <p className="text-red-400 text-sm">⚠️ {error}</p>
            </div>
          )}

          <button onClick={handleLogin} disabled={loading}
            className="w-full bg-indigo-600 text-white py-3.5 rounded-2xl font-bold hover:bg-indigo-500 transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/20">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                Entrando...
              </span>
            ) : 'Entrar'}
          </button>

          <div className="flex items-center justify-between mt-6 text-sm">
            <a href="/registro" className="text-indigo-400 hover:underline">¿Sin cuenta? Empieza gratis →</a>
            <a href="/reset" className="text-slate-500 hover:text-slate-300">¿Olvidaste la contraseña?</a>
          </div>

          <p className="text-center text-slate-600 text-xs mt-4">Ver planes · desde 99€/mes</p>
        </div>
      </div>
    </div>
  )
}