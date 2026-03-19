'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [pw,       setPw]       = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function login() {
    const e = email.trim().toLowerCase()
    const p = pw
    if (!e || !p) { setError('Rellena todos los campos'); return }
    setLoading(true); setError('')
    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email: e, password: p })
      if (err) { setError('Email o contraseña incorrectos'); return }
      const { data: prof } = await supabase.from('profiles').select('role,tenant_id').eq('id', data.user.id).maybeSingle()
      if (prof?.role === 'superadmin') { window.location.href = prof.tenant_id ? '/panel' : '/admin'; return }
      if (prof?.tenant_id) {
        const { data: t } = await supabase.from('tenants').select('name').eq('id', prof.tenant_id).maybeSingle()
        window.location.href = t?.name ? '/panel' : '/onboarding'
      } else { window.location.href = '/onboarding' }
    } catch { setError('Error al iniciar sesión') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0F1823', fontFamily:"'Sora',-apple-system,sans-serif", padding:24 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&display=swap');
        *{box-sizing:border-box}
        @keyframes spin{to{transform:rotate(360deg)}}
        input{width:100%;font-family:inherit;font-size:15px;color:#E8EEF6;background:rgba(255,255,255,0.06);border:1.5px solid rgba(255,255,255,0.12);border-radius:12px;padding:14px 16px;outline:none}
        input:focus{border-color:#F0A84E;box-shadow:0 0 0 3px rgba(240,168,78,0.15)}
        input::placeholder{color:#49566A}
      `}</style>
      <div style={{ width:'100%', maxWidth:400 }}>
        <div style={{ textAlign:'center', marginBottom:40 }}>
          <Link href="/" style={{ display:'inline-flex', alignItems:'center', gap:10, marginBottom:24, textDecoration:'none' }}>
            <div style={{ width:36,height:36,borderRadius:11,background:'linear-gradient(135deg,#F0A84E,#E8923A)',display:'flex',alignItems:'center',justifyContent:'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#0C1018"><path d="M22 17a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A2 2 0 014 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 17z"/></svg>
            </div>
            <span style={{ fontWeight:800,fontSize:18,color:'#E8EEF6',letterSpacing:'-0.02em' }}>Reservo<span style={{ color:'#F0A84E' }}>.AI</span></span>
          </Link>
          <h1 style={{ fontSize:28,fontWeight:800,color:'#E8EEF6',letterSpacing:'-0.04em',marginBottom:8 }}>Bienvenido de nuevo</h1>
          <p style={{ fontSize:14,color:'#8895A7' }}>¿Sin cuenta? <Link href="/registro" style={{ color:'#F0A84E',fontWeight:600,textDecoration:'none' }}>Empieza gratis →</Link></p>
        </div>
        <div style={{ display:'flex',flexDirection:'column',gap:16,marginBottom:20 }}>
          <div>
            <label style={{ display:'block',fontSize:11,fontWeight:700,color:'#8895A7',marginBottom:8,letterSpacing:'0.06em',textTransform:'uppercase' }}>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&login()} placeholder="tu@negocio.com" autoComplete="email"/>
          </div>
          <div>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8 }}>
              <label style={{ fontSize:11,fontWeight:700,color:'#8895A7',letterSpacing:'0.06em',textTransform:'uppercase' }}>Contraseña</label>
              <Link href="/reset" style={{ fontSize:12,color:'#F0A84E',textDecoration:'none',fontWeight:600 }}>¿Olvidaste?</Link>
            </div>
            <input type="password" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==='Enter'&&login()} placeholder="••••••••" autoComplete="current-password"/>
          </div>
        </div>
        {error&&<div style={{ background:'rgba(248,113,113,0.08)',border:'1px solid rgba(248,113,113,0.25)',borderRadius:10,padding:'12px 16px',marginBottom:16,fontSize:13,color:'#F87171' }}>{error}</div>}
        <button onClick={login} disabled={loading} style={{ width:'100%',padding:'15px',fontFamily:'inherit',fontSize:15,fontWeight:700,color:'#0C1018',background:'linear-gradient(135deg,#F0A84E,#E8923A)',border:'none',borderRadius:12,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,boxShadow:'0 4px 18px rgba(240,168,78,0.3)',opacity:loading?0.7:1 }}>
          {loading?<><div style={{ width:17,height:17,border:'2.5px solid rgba(12,16,24,0.3)',borderTop:'2.5px solid #0C1018',borderRadius:'50%',animation:'spin 0.7s linear infinite' }}/> Entrando…</>:<>Entrar en el panel →</>}
        </button>
        <p style={{ marginTop:24,fontSize:11,color:'#49566A',textAlign:'center' }}>
          Al entrar aceptas los <a href="#" style={{ color:'#8895A7',textDecoration:'none' }}>Términos de servicio</a> y la <a href="#" style={{ color:'#8895A7',textDecoration:'none' }}>Política de privacidad</a>
        </p>
      </div>
    </div>
  )
}
