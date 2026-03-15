'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ResetPage() {
  const router = useRouter()
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    // Handle magic link hash tokens
    const hash = window.location.hash
    if (hash && hash.includes('access_token')) {
      const params = new URLSearchParams(hash.substring(1))
      const token = params.get('access_token')
      const refresh = params.get('refresh_token')
      if (token && refresh) {
        // Store in localStorage for supabase to pick up
        const key = 'sb-phrfucpinxxcsgxgbcno-auth-token'
        localStorage.setItem(key, JSON.stringify({
          access_token: token,
          refresh_token: refresh,
          expires_at: parseInt(params.get('expires_at') || '0'),
          token_type: 'bearer',
          user: {}
        }))
        window.history.replaceState({}, '', '/reset')
      }
    }
  }, [])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (pw.length < 8) { setMsg('Mínimo 8 caracteres'); return }
    setLoading(true)
    const r = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw, userId: '6fd6e70c-63d0-4530-901d-f00783cb2970' })
    })
    const d = await r.json()
    setLoading(false)
    if (d.success) { setDone(true) }
    else setMsg(d.error || 'Error')
  }

  if (done) return (
    <div className="min-h-screen bg-[#070710] flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-white text-xl font-bold mb-2">Contraseña actualizada</h2>
        <p className="text-white/40 text-sm mb-6">Ya puedes iniciar sesión normalmente</p>
        <a href="/login" className="bg-violet-600 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-violet-500 transition-all">
          Ir al login →
        </a>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#070710] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-2xl font-black mb-4">R</div>
          <h1 className="text-xl font-bold text-white">Establecer contraseña</h1>
          <p className="text-white/40 text-sm mt-1">admin@reservo.ai / arturo@horizonstudio.ai</p>
        </div>
        <form onSubmit={handleReset} className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 space-y-4">
          {msg && <p className="text-red-400 text-xs">{msg}</p>}
          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Nueva contraseña</label>
            <input type="password" value={pw} onChange={e => setPw(e.target.value)}
              placeholder="Mínimo 8 caracteres" autoFocus
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500/60"/>
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-all">
            {loading ? 'Actualizando...' : 'Guardar contraseña'}
          </button>
        </form>
      </div>
    </div>
  )
}