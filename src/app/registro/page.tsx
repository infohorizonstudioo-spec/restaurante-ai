'use client'
import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { BUSINESS_TEMPLATES } from '@/types'
import Link from 'next/link'

const DEMO_STEPS = [
  { delay: 0,    who: 'cliente', text: 'Llama para hacer una reserva...', isAgent: false },
  { delay: 1200, who: 'agente',  text: '¡Buenas tardes! Soy Sofía de Clínica Dental Sonría. ¿Le ayudo?', isAgent: true, typing: true },
  { delay: 3800, who: 'cliente', text: 'Quiero cita para limpieza, ¿hay el martes?', isAgent: false },
  { delay: 5500, who: 'agente',  text: 'Claro, tengo disponible a las 11:00 o las 17:30 el martes. ¿Cuál le viene mejor?', isAgent: true, typing: true },
  { delay: 8000, who: 'cliente', text: 'A las 11:00 perfecto', isAgent: false },
  { delay: 9200, who: 'sistema', text: '✅ Cita confirmada · Martes · 11:00 · Limpieza dental · María López', isAgent: false, isSystem: true },
]

function MiniDemo() {
  const [shown, setShown] = useState<number[]>([])
  const [typing, setTyping] = useState<number | null>(null)

  useEffect(() => {
    let timers: ReturnType<typeof setTimeout>[] = []
    const run = () => {
      setShown([]); setTyping(null)
      DEMO_STEPS.forEach((s, i) => {
        if (s.typing) {
          timers.push(setTimeout(() => setTyping(i), s.delay))
          timers.push(setTimeout(() => { setTyping(null); setShown(p => [...p, i]) }, s.delay + 1000))
        } else {
          timers.push(setTimeout(() => setShown(p => [...p, i]), s.delay))
        }
      })
      timers.push(setTimeout(run, 14000))
    }
    const t = setTimeout(run, 600)
    return () => { clearTimeout(t); timers.forEach(clearTimeout) }
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f87171', animation: 'pulse 1.5s infinite' }} />
          <span style={{ fontSize: 11, color: '#f87171', fontWeight: 600, letterSpacing: '0.04em' }}>LLAMADA EN VIVO</span>
        </div>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Simulación demo</span>
      </div>

      {DEMO_STEPS.map((s, i) => {
        const isVis = shown.includes(i)
        const isTyp = typing === i
        if (!isVis && !isTyp) return null

        if (s.isSystem && isVis) return (
          <div key={i} style={{ background: 'rgba(5,150,105,0.15)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 9, padding: '9px 12px', animation: 'fadeUp 0.4s ease' }}>
            <p style={{ fontSize: 12, color: '#4ade80', fontWeight: 600 }}>{s.text}</p>
          </div>
        )

        return (
          <div key={i} style={{ display: 'flex', justifyContent: s.isAgent ? 'flex-start' : 'flex-end', gap: 8, animation: 'fadeUp 0.3s ease' }}>
            {s.isAgent && <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg,#1e40af,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0, marginTop: 2 }}>🤖</div>}
            <div style={{ maxWidth: '78%', background: s.isAgent ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.07)', border: s.isAgent ? '1px solid rgba(59,130,246,0.2)' : '1px solid rgba(255,255,255,0.08)', borderRadius: s.isAgent ? '3px 10px 10px 10px' : '10px 3px 10px 10px', padding: '8px 12px' }}>
              {isTyp
                ? <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>{[0,1,2].map(j => <div key={j} style={{ width: 5, height: 5, borderRadius: '50%', background: '#60a5fa', animation: 'bounce 1.2s infinite', animationDelay: j*0.2+'s' }}/>)}</div>
                : <p style={{ fontSize: 12, color: s.isAgent ? '#93c5fd' : 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>{s.text}</p>
              }
            </div>
            {!s.isAgent && !s.isSystem && <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0, marginTop: 2 }}>👤</div>}
          </div>
        )
      })}
    </div>
  )
}

export default function RegistroPage() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', email: '', password: '', businessName: '', businessType: 'restaurante' })

  const tipos = Object.entries(BUSINESS_TEMPLATES).filter(([k]) => k !== 'otro')

  const handleRegister = useCallback(async () => {
    if (!form.email || !form.password || !form.name || !form.businessName) { setError('Rellena todos los campos'); return }
    if (form.password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }
    setLoading(true); setError('')
    try {
      const { data: authData, error: authErr } = await supabase.auth.signUp({ email: form.email.trim().toLowerCase(), password: form.password })
      if (authErr) throw authErr
      if (!authData.user) throw new Error('No se pudo crear la cuenta')
      const slug = form.businessName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
      const { data: tenant, error: tErr } = await supabase.from('tenants').insert({ name: form.businessName, type: form.businessType, slug, plan: 'free', free_calls_limit: 10, free_calls_used: 0 }).select().single()
      if (tErr) throw tErr
      await supabase.from('profiles').upsert({ id: authData.user.id, full_name: form.name, email: form.email.trim().toLowerCase(), tenant_id: (tenant as any).id, role: 'admin' })
      window.location.href = '/onboarding'
    } catch (e: any) {
      if (e.message?.includes('already registered') || e.message?.includes('already been registered')) setError('Este email ya tiene cuenta. Inicia sesión.')
      else setError('Error al registrarse: ' + (e.message || 'Inténtalo de nuevo'))
    } finally { setLoading(false) }
  }, [form])

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr', fontFamily: "'DM Sans',-apple-system,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
        @keyframes bounce { 0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)} }
        @keyframes spin { to { transform:rotate(360deg); } }
        input:focus, select:focus { border-color:#3b82f6 !important; box-shadow:0 0 0 3px rgba(59,130,246,0.15) !important; outline:none; }
        .inp { width:100%; font-family:inherit; font-size:14px; color:#0f172a; background:#fafafa; border:1px solid #d1d5db; border-radius:9px; padding:11px 14px; outline:none; transition:all 0.15s; }
        .btn-main { width:100%; padding:12px; font-family:inherit; font-size:15px; font-weight:600; color:white; background:linear-gradient(135deg,#1e40af,#3b82f6); border:none; border-radius:9px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; box-shadow:0 2px 12px rgba(59,130,246,0.3); transition:all 0.15s; }
        .btn-main:hover { opacity:0.92; transform:translateY(-1px); }
        .btn-main:disabled { opacity:0.6; cursor:default; transform:none; }
        .tipo-card { border:1px solid #e2e8f0; border-radius:9px; padding:11px 14px; cursor:pointer; transition:all 0.12s; background:#fafafa; font-family:inherit; font-size:13px; text-align:left; }
        .tipo-card:hover { border-color:#93c5fd; background:#eff6ff; }
        @media(max-width:768px) { .right-panel{display:none!important} .left-panel{grid-column:1/-1!important} }
      `}</style>

      {/* LEFT: Form */}
      <div className="left-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 'clamp(32px,5vw,64px)', background: '#fff', minHeight: '100vh' }}>
        <div style={{ maxWidth: 400, width: '100%', margin: '0 auto' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 40, textDecoration: 'none' }}>
            <div style={{ width: 30, height: 30, background: 'linear-gradient(135deg,#1e40af,#3b82f6)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(59,130,246,0.3)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg>
            </div>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', letterSpacing: '-0.01em' }}>Reservo.AI</span>
          </Link>

          {/* Step indicator */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 32, alignItems: 'center' }}>
            {[1, 2].map(s => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: step >= s ? 'linear-gradient(135deg,#1e40af,#3b82f6)' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: step >= s ? 'white' : '#94a3b8', transition: 'all 0.2s' }}>
                  {step > s ? '✓' : s}
                </div>
                <span style={{ fontSize: 12, color: step >= s ? '#0f172a' : '#94a3b8', fontWeight: step >= s ? 500 : 400 }}>
                  {s === 1 ? 'Tu cuenta' : 'Tu negocio'}
                </span>
                {s < 2 && <div style={{ width: 24, height: 1, background: step > s ? '#3b82f6' : '#e2e8f0', transition: 'background 0.2s' }} />}
              </div>
            ))}
          </div>

          {step === 1 && (
            <div style={{ animation: 'fadeUp 0.3s ease' }}>
              <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', color: '#0f172a', marginBottom: 6 }}>Crea tu cuenta</h1>
              <p style={{ fontSize: 14, color: '#64748b', marginBottom: 28 }}>10 llamadas gratis · Sin tarjeta de crédito</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Nombre completo</label>
                  <input className="inp" type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Juan García" autoComplete="name" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Email</label>
                  <input className="inp" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="tu@negocio.com" autoComplete="email" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Contraseña</label>
                  <input className="inp" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 6 caracteres" autoComplete="new-password" />
                </div>
              </div>
              {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 9, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#dc2626' }}>{error}</div>}
              <button className="btn-main" onClick={() => {
                if (!form.name || !form.email || !form.password) { setError('Rellena todos los campos'); return }
                if (form.password.length < 6) { setError('Contraseña: mínimo 6 caracteres'); return }
                setError(''); setStep(2)
              }}>
                Continuar →
              </button>
              <p style={{ marginTop: 20, fontSize: 13, color: '#64748b', textAlign: 'center' }}>
                ¿Ya tienes cuenta? <Link href="/login" style={{ color: '#1d4ed8', fontWeight: 500, textDecoration: 'none' }}>Iniciar sesión</Link>
              </p>
            </div>
          )}

          {step === 2 && (
            <div style={{ animation: 'fadeUp 0.3s ease' }}>
              <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', color: '#0f172a', marginBottom: 6 }}>Cuéntanos tu negocio</h1>
              <p style={{ fontSize: 14, color: '#64748b', marginBottom: 28 }}>Personalizaremos el agente para ti</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Nombre del negocio</label>
                  <input className="inp" type="text" value={form.businessName} onChange={e => setForm({ ...form, businessName: e.target.value })} placeholder="Restaurante La Plaza" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tipo de negocio</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {tipos.slice(0, 6).map(([key, tmpl]) => (
                      <button key={key} onClick={() => setForm({ ...form, businessType: key })} className="tipo-card"
                        style={{ border: form.businessType === key ? '2px solid #3b82f6' : '1px solid #e2e8f0', background: form.businessType === key ? '#eff6ff' : '#fafafa', color: form.businessType === key ? '#1d4ed8' : '#374151', fontWeight: form.businessType === key ? 600 : 400 }}>
                        {(tmpl as any).label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 9, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#dc2626' }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setStep(1)} style={{ flex: 1, padding: '12px', fontFamily: 'inherit', fontSize: 14, fontWeight: 500, color: '#374151', background: 'white', border: '1px solid #d1d5db', borderRadius: 9, cursor: 'pointer' }}>
                  ← Atrás
                </button>
                <button className="btn-main" style={{ flex: 2 }} disabled={loading} onClick={handleRegister}>
                  {loading ? <><div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />Creando...</> : 'Empezar gratis →'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Demo animado */}
      <div className="right-panel" style={{ background: 'linear-gradient(155deg,#0f172a 0%,#1e3a5f 60%,#0f172a 100%)', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 'clamp(32px,5vw,56px)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '10%', right: '8%', width: 220, height: 220, background: 'radial-gradient(circle,rgba(59,130,246,0.1),transparent)', borderRadius: '50%', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '15%', left: '5%', width: 160, height: 160, background: 'radial-gradient(circle,rgba(99,102,241,0.1),transparent)', borderRadius: '50%', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Header */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: 'linear-gradient(135deg,#1e40af,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🤖</div>
              <div>
                <p style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>Sofía — Recepcionista AI</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', animation: 'pulse 2s infinite' }} />
                  <span style={{ fontSize: 11, color: '#86efac', fontWeight: 500 }}>Atendiendo llamadas ahora</span>
                </div>
              </div>
            </div>
            <h2 style={{ color: 'white', fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.3, marginBottom: 8 }}>
              Mira cómo funciona en tiempo real
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 1.6 }}>
              El agente responde, entiende y crea la reserva — todo mientras tú te dedicas a lo que importa.
            </p>
          </div>

          {/* Chat demo */}
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '16px 18px', minHeight: 260 }}>
            <MiniDemo />
          </div>

          {/* Bullets */}
          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              'Atiende en tu idioma, con tu nombre y estilo',
              'Crea citas directamente en tu panel',
              'Responde en menos de 2 segundos',
              'Sin colas, sin esperas, sin llamadas perdidas',
            ].map(b => (
              <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>{b}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}