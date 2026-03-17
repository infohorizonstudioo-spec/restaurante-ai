'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

const NAMES: Record<string,string> = { starter:'Starter', pro:'Pro', business:'Business' }
const CALLS: Record<string,number> = { starter:50, pro:200, business:600 }

function SuccessContent() {
  const params = useSearchParams()
  const plan = params.get('plan') || 'pro'
  const [sec, setSec] = useState(5)
  useEffect(() => {
    const t = setInterval(() => setSec(s => { if (s<=1) { clearInterval(t); window.location.href='/panel'; return 0 } return s-1 }), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-3xl border border-slate-700 p-12 max-w-md w-full text-center">
        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6"><span className="text-4xl">✅</span></div>
        <h1 className="text-3xl font-bold text-white mb-3">¡Plan {NAMES[plan]} activado!</h1>
        <p className="text-slate-400 mb-2">Tu suscripción está activa.</p>
        <p className="text-indigo-400 font-semibold mb-8">{CALLS[plan]} llamadas incluidas este mes.</p>
        <div className="bg-slate-700/50 rounded-2xl p-4 mb-6">
          <p className="text-slate-300 text-sm">Redirigiendo en <span className="text-white font-bold">{sec}s</span></p>
        </div>
        <a href="/panel" className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-semibold hover:bg-indigo-500 transition-colors inline-block">Ir al centro de control →</a>
      </div>
    </div>
  )
}
export default function SuccessPage() { return <Suspense><SuccessContent/></Suspense> }