'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

async function doLogin(email: string, pw: string): Promise<string|null> {
  if (!email || !pw) return 'Rellena todos los campos'
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pw })
    if (error) {
      if (error.message.includes('Invalid') || error.message.includes('invalid')) return 'Email o contraseña incorrectos'
      if (error.message.includes('Too many')) return 'Demasiados intentos. Espera unos minutos.'
      return 'Email o contraseña incorrectos'
    }
    if (!data.user) return 'No se pudo iniciar sesión'
    await new Promise(r => setTimeout(r, 400))
    const { data: p } = await supabase.from('profiles').select('role,tenant_id').eq('id', data.user.id).maybeSingle()
    if (p?.role === 'superadmin') { window.location.href = p.tenant_id ? '/panel' : '/admin'; return null }
    if (p?.tenant_id) {
      const { data: t } = await supabase.from('tenants').select('name').eq('id', p.tenant_id).maybeSingle()
      window.location.href = t?.name ? '/panel' : '/onboarding'
    } else {
      window.location.href = '/onboarding'
    }
    return null
  } catch (e: any) {
    return 'Email o contraseña incorrectos'
  }
}

export default function LoginPage() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)

  // Añadir event listener de forma imperativa en useEffect
  // Esto evita cualquier problema de hidratación de React
  useEffect(() => {
    const btn = btnRef.current
    if (!btn) return

    const handler = async () => {
      const emailVal = (document.getElementById('rz-email') as HTMLInputElement)?.value?.trim().toLowerCase() || ''
      const pwVal    = (document.getElementById('rz-pw')    as HTMLInputElement)?.value || ''
      setLoading(true)
      setError('')
      const err = await doLogin(emailVal, pwVal)
      if (err) { setError(err); setLoading(false) }
    }

    btn.addEventListener('click', handler)
    return () => btn.removeEventListener('click', handler)
  }, [])

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0F1823', fontFamily:"'Sora',-apple-system,sans-serif", padding:24 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&display=swap');
        *{box-sizing:border-box}
        @keyframes rz-spin{to{transform:rotate(360deg)}}
        .rzinp{width:100%;font-family:inherit;font-size:15px;color:#E8EEF6;background:rgba(255,255,255,0.06);border:1.5px solid rgba(255,255,255,0.12);border-radius:12px;padding:14px 16px;outline:none;transition:border-color 0.15s,box-shadow 0.15s}
        .rzinp::placeholder{color:#49566A}
        .rzinp:focus{border-color:#F0A84E;box-shadow:0 0 0 3px rgba(240,168,78,0.15)}
        .rzbtn{width:100%;padding:15px 20px;font-family:inherit;font-size:15px;font-weight:700;color:#0C1018;background:linear-gradient(135deg,#F0A84E,#E8923A);border:none;border-radius:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 4px 18px rgba(240,168,78,0.3);transition:all 0.15s;letter-spacing:-0.01em}
        .rzbtn:hover{transform:translateY(-1px);box-shadow:0 6px 24px rgba(240,168,78,0.4)}
        .rzbtn:active{transform:translateY(0)}
        .rzbtn:disabled{opacity:0.6;cursor:not-allowed;transform:none}
      `}</style>

      <div style={{ width:'100%', maxWidth:400 }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:40 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:10, marginBottom:24 }}>
            <div style={{ width:36, height:36, borderRadius:11, background:'linear-gradient(135deg,#F0A84E,#E8923A)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 14px rgba(240,168,78,0.35)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#0C1018"><path d="M22 17a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A2 2 0 014 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 17z"/></svg>
            </div>
            <span style={{ fontWeight:800, fontSize:18, color:'#E8EEF6', letterSpacing:'-0.02em' }}>Reservo<span style={{ color:'#F0A84E' }}>.AI</span></span>
          </div>
          <h1 style={{ fontSize:28, fontWeight:800, color:'#E8EEF6', letterSpacing:'-0.04em', marginBottom:8 }}>Bienvenido de nuevo</h1>
          <p style={{ fontSize:14, color:'#8895A7' }}>¿Sin cuenta? <Link href="/registro" style={{ color:'#F0A84E', fontWeight:600, textDecoration:'none' }}>Empieza gratis →</Link></p>
        </div>

        {/* Campos */}
        <div style={{ display:'flex', flexDirection:'column', gap:16, marginBottom:20 }}>
          <div>
            <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#8895A7', marginBottom:8, letterSpacing:'0.06em', textTransform:'uppercase' }}>Email</label>
            <input id="rz-email" type="email" placeholder="tu@negocio.com" autoComplete="email" className="rzinp"/>
          </div>
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <label style={{ fontSize:11, fontWeight:700, color:'#8895A7', letterSpacing:'0.06em', textTransform:'uppercase' }}>Contraseña</label>
              <Link href="/reset" style={{ fontSize:12, color:'#F0A84E', textDecoration:'none', fontWeight:600 }}>¿Olvidaste?</Link>
            </div>
            <input id="rz-pw" type="password" placeholder="••••••••" autoComplete="current-password" className="rzinp"/>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background:'rgba(248,113,113,0.08)', border:'1px solid rgba(248,113,113,0.25)', borderRadius:10, padding:'12px 16px', marginBottom:16, fontSize:13, color:'#F87171', display:'flex', alignItems:'center', gap:8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#F87171" strokeWidth="2"/><path d="M12 8v4M12 16h.01" stroke="#F87171" strokeWidth="2" strokeLinecap="round"/></svg>
            {error}
          </div>
        )}

        {/* Botón */}
        <button ref={btnRef} disabled={loading} className="rzbtn">
          {loading
            ? <><div style={{ width:17,height:17,border:'2.5px solid rgba(12,16,24,0.3)',borderTop:'2.5px solid #0C1018',borderRadius:'50%',animation:'rz-spin 0.7s linear infinite' }}/> Entrando…</>
            : <>Entrar en el panel <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0C1018" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg></>
          }
        </button>

        <p style={{ marginTop:24, fontSize:11, color:'#49566A', textAlign:'center', lineHeight:1.7 }}>
          Al entrar aceptas los <a href="#" style={{ color:'#8895A7', textDecoration:'none' }}>Términos de servicio</a> y la <a href="#" style={{ color:'#8895A7', textDecoration:'none' }}>Política de privacidad</a>
        </p>
      </div>
    </div>
  )
}
