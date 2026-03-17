'use client'
import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const ERR: Record<string,string> = {
  'Invalid login credentials': 'Email o contraseña incorrectos',
  'invalid_credentials': 'Email o contraseña incorrectos',
  'Email not confirmed': 'Confirma tu email antes de entrar',
  'Too many requests': 'Demasiados intentos. Espera unos minutos.',
}
function mapErr(m: string) {
  for (const [k, v] of Object.entries(ERR)) if (m.includes(k)) return v
  return 'Error al iniciar sesión. Inténtalo de nuevo.'
}

// ── Demo call simulation ──
const DEMO_STEPS = [
  { delay: 0,    icon: '📞', who: 'cliente',  text: 'Llama al restaurante...', color: '#94a3b8', typing: false },
  { delay: 1200, icon: '🤖', who: 'agente',   text: 'Hola, soy Gabriela de Restaurante La Plaza. ¿En qué puedo ayudarte?', color: '#3b82f6', typing: true },
  { delay: 3800, icon: '👤', who: 'cliente',  text: 'Quería hacer una reserva para mañana, 4 personas a las 21:00', color: '#0f172a', typing: false },
  { delay: 5500, icon: '🤖', who: 'agente',   text: 'Perfecto. ¿Me dices tu nombre para la reserva?', color: '#3b82f6', typing: true },
  { delay: 7200, icon: '👤', who: 'cliente',  text: 'Sí, es para Carlos Fernández', color: '#0f172a', typing: false },
  { delay: 8600, icon: '✅', who: 'sistema',  text: 'Reserva creada · Carlos Fernández · Mañana 21:00 · 4 personas', color: '#059669', typing: false },
]

function DemoPanel() {
  const [visibleSteps, setVisible] = useState<number[]>([])
  const [typingIdx, setTypingIdx] = useState<number | null>(null)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    let timers: ReturnType<typeof setTimeout>[] = []
    const run = () => {
      setVisible([]); setTypingIdx(null)
      DEMO_STEPS.forEach((step, i) => {
        if (step.typing) {
          timers.push(setTimeout(() => setTypingIdx(i), step.delay))
          timers.push(setTimeout(() => { setTypingIdx(null); setVisible(p => [...p, i]) }, step.delay + 900))
        } else {
          timers.push(setTimeout(() => setVisible(p => [...p, i]), step.delay))
        }
      })
      // loop
      timers.push(setTimeout(() => { setVisible([]); setTypingIdx(null); run() }, 13000))
    }
    const t = setTimeout(() => { setStarted(true); run() }, 800)
    return () => { clearTimeout(t); timers.forEach(clearTimeout) }
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', padding: '0 40px' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#1e40af,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 18 }}>🤖</span>
          </div>
          <div>
            <p style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>Gabriela — Recepcionista AI</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', animation: 'pulse 2s infinite' }} />
              <span style={{ fontSize: 11, color: '#86efac', fontWeight: 500 }}>Atendiendo llamadas ahora</span>
            </div>
          </div>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 1.6 }}>
          Así es como Reservo.AI responde por ti, crea reservas y organiza tu negocio — sin que levantes el teléfono.
        </p>
      </div>

      {/* Call simulation */}
      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 0, minHeight: 300, position: 'relative', overflow: 'hidden' }}>
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Llamada en curso</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f87171', animation: 'pulse 1.5s infinite' }} />
            <span style={{ fontSize: 11, color: '#f87171', fontWeight: 600 }}>EN VIVO</span>
          </div>
        </div>

        {/* Messages */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
          {DEMO_STEPS.map((step, i) => {
            const isVisible = visibleSteps.includes(i)
            const isTyping = typingIdx === i
            if (!isVisible && !isTyping) return null

            const isAgent = step.who === 'agente'
            const isSistema = step.who === 'sistema'

            if (isSistema && isVisible) {
              return (
                <div key={i} style={{ background: 'rgba(5,150,105,0.12)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, animation: 'fadeUp 0.4s ease' }}>
                  <span style={{ fontSize: 16 }}>{step.icon}</span>
                  <p style={{ fontSize: 12, color: '#4ade80', fontWeight: 600 }}>{step.text}</p>
                </div>
              )
            }

            return (
              <div key={i} style={{ display: 'flex', gap: 10, justifyContent: isAgent ? 'flex-start' : 'flex-end', animation: 'fadeUp 0.35s ease' }}>
                {isAgent && (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#1e40af,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, marginTop: 2 }}>
                    🤖
                  </div>
                )}
                <div style={{
                  maxWidth: '75%',
                  background: isAgent ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.08)',
                  border: isAgent ? '1px solid rgba(59,130,246,0.25)' : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: isAgent ? '4px 12px 12px 12px' : '12px 4px 12px 12px',
                  padding: '9px 13px',
                }}>
                  {isTyping ? (
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '2px 4px' }}>
                      {[0,1,2].map(j => (
                        <div key={j} style={{ width: 6, height: 6, borderRadius: '50%', background: '#60a5fa', animation: `bounce 1.2s infinite ${j * 0.2}s` }} />
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: 13, color: isAgent ? '#93c5fd' : 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>{step.text}</p>
                  )}
                </div>
                {!isAgent && !isSistema && (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, marginTop: 2 }}>
                    👤
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 20 }}>
        {[
          { n: '24/7', l: 'Disponible' },
          { n: '<30s', l: 'Respuesta' },
          { n: '100%', l: 'Llamadas atendidas' },
        ].map(s => (
          <div key={s.l} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '12px 10px', textAlign: 'center' }}>
            <p style={{ color: 'white', fontWeight: 700, fontSize: 16, letterSpacing: '-0.01em' }}>{s.n}</p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>{s.l}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const login = useCallback(async () => {
    if (!email.trim() || !pw) { setError('Rellena todos los campos'); return }
    setLoading(true); setError('')
    try {
      const { data, error: e } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: pw })
      if (e) throw e
      const { data: p } = await supabase.from('profiles').select('role,tenant_id').eq('id', data.user.id).single()
      if ((p as any)?.role === 'superadmin') { window.location.href = '/admin'; return }
      if ((p as any)?.tenant_id) {
        const { data: t } = await supabase.from('tenants').select('onboarding_complete').eq('id', (p as any).tenant_id).single()
        window.location.href = t?.onboarding_complete ? '/panel' : '/onboarding'
      } else window.location.href = '/onboarding'
    } catch (e: any) { setError(mapErr(e.message || '')) }
    finally { setLoading(false) }
  }, [email, pw])

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr', fontFamily: "'DM Sans',-apple-system,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        @keyframes bounce { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-4px); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        input:focus { border-color: #3b82f6 !important; box-shadow: 0 0 0 3px rgba(59,130,246,0.15) !important; outline: none; }
        .inp { width:100%; font-family:inherit; font-size:14px; color:#0f172a; background:#fafafa; border:1px solid #d1d5db; border-radius:9px; padding:11px 14px; outline:none; transition:all 0.15s; }
        .btn-main { width:100%; padding:12px; font-family:inherit; font-size:15px; font-weight:600; color:white; background:linear-gradient(135deg,#1e40af,#3b82f6); border:none; border-radius:9px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; box-shadow:0 2px 12px rgba(59,130,246,0.3); transition:all 0.15s; }
        .btn-main:hover { opacity:0.92; transform:translateY(-1px); }
        .btn-main:disabled { opacity:0.6; cursor:default; transform:none; }
        @media(max-width:768px) { .right-panel { display:none !important; } .left-panel { grid-column: 1/-1 !important; } }
      `}</style>

      {/* ── LEFT: Form ── */}
      <div className="left-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 'clamp(32px,5vw,64px)', background: '#ffffff', minHeight: '100vh' }}>
        <div style={{ maxWidth: 380, width: '100%', margin: '0 auto' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 44, textDecoration: 'none' }}>
            <div style={{ width: 30, height: 30, background: 'linear-gradient(135deg,#1e40af,#3b82f6)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(59,130,246,0.3)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg>
            </div>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', letterSpacing: '-0.01em' }}>Reservo.AI</span>
          </Link>

          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.025em', color: '#0f172a', marginBottom: 6 }}>Bienvenido de nuevo</h1>
          <p style={{ fontSize: 14, color: '#64748b', marginBottom: 32 }}>
            ¿Sin cuenta?{' '}
            <Link href="/registro" style={{ color: '#1d4ed8', fontWeight: 500, textDecoration: 'none' }}>Empieza gratis →</Link>
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()} placeholder="tu@negocio.com" autoComplete="email" className="inp" />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Contraseña</label>
                <Link href="/reset" style={{ fontSize: 12, color: '#1d4ed8', textDecoration: 'none' }}>¿Olvidaste?</Link>
              </div>
              <input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()} placeholder="••••••••" autoComplete="current-password" className="inp" />
            </div>
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 9, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 7 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#dc2626" strokeWidth="2"/><path d="M12 8v4M12 16h.01" stroke="#dc2626" strokeWidth="2" strokeLinecap="round"/></svg>
              {error}
            </div>
          )}

          <button onClick={login} disabled={loading} className="btn-main">
            {loading ? (
              <><div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Entrando...</>
            ) : (
              <>Entrar <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5l7 7-7 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></>
            )}
          </button>

          <p style={{ marginTop: 28, fontSize: 12, color: '#94a3b8', textAlign: 'center', lineHeight: 1.6 }}>
            Al entrar aceptas los{' '}
            <a href="#" style={{ color: '#64748b', textDecoration: 'underline' }}>Términos de uso</a> y la{' '}
            <a href="#" style={{ color: '#64748b', textDecoration: 'underline' }}>Política de privacidad</a>
          </p>
        </div>
      </div>

      {/* ── RIGHT: Live demo ── */}
      <div className="right-panel" style={{ background: 'linear-gradient(155deg,#0f172a 0%,#1e3a5f 60%,#0f172a 100%)', minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
        {/* Decorative blobs */}
        <div style={{ position: 'absolute', top: '15%', right: '10%', width: 240, height: 240, background: 'radial-gradient(circle,rgba(59,130,246,0.12),transparent)', borderRadius: '50%', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '20%', left: '5%', width: 180, height: 180, background: 'radial-gradient(circle,rgba(99,102,241,0.1),transparent)', borderRadius: '50%', pointerEvents: 'none' }} />
        <DemoPanel />
      </div>
    </div>
  )
}