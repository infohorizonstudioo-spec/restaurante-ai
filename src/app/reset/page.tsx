'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

function ResetContent() {
  const router = useRouter()
  const [pw, setPw]         = useState('')
  const [pw2, setPw2]       = useState('')
  const [msg, setMsg]       = useState('')
  const [loading, setLoad]  = useState(false)
  const [done, setDone]     = useState(false)
  const [mode, setMode]     = useState<'request'|'reset'>('request')
  const [email, setEmail]   = useState('')
  const [sent, setSent]     = useState(false)

  useEffect(() => {
    // Detectar si viene de magic link (hash con access_token)
    const hash = window.location.hash
    if (hash && hash.includes('access_token')) {
      const params = new URLSearchParams(hash.substring(1))
      const token   = params.get('access_token')
      const refresh = params.get('refresh_token')
      if (token && refresh) {
        supabase.auth.setSession({ access_token: token, refresh_token: refresh })
        setMode('reset')
        window.history.replaceState({}, '', '/reset')
      }
    }
  }, [])

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) { setMsg('Introduce tu email'); return }
    setLoad(true); setMsg('')
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: process.env.NEXT_PUBLIC_APP_URL + '/reset'
    })
    setLoad(false)
    if (error) setMsg(error.message)
    else setSent(true)
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (pw.length < 8) { setMsg('Mínimo 8 caracteres'); return }
    if (pw !== pw2)    { setMsg('Las contraseñas no coinciden'); return }
    setLoad(true); setMsg('')
    const { error } = await supabase.auth.updateUser({ password: pw })
    setLoad(false)
    if (error) setMsg(error.message)
    else setDone(true)
  }

  if (done) return (
    <div style={{textAlign:'center'}}>
      <div style={{fontSize:48,marginBottom:16}}>✅</div>
      <h2 style={{fontSize:20,fontWeight:700,color:'#0f172a',marginBottom:8}}>Contraseña actualizada</h2>
      <p style={{fontSize:14,color:'#64748b',marginBottom:24}}>Ya puedes iniciar sesión con tu nueva contraseña.</p>
      <Link href="/login" style={{display:'inline-block',padding:'10px 24px',background:'linear-gradient(135deg,#1e40af,#3b82f6)',color:'white',borderRadius:9,fontWeight:600,textDecoration:'none'}}>
        Ir al login →
      </Link>
    </div>
  )

  if (sent) return (
    <div style={{textAlign:'center'}}>
      <div style={{fontSize:48,marginBottom:16}}>📧</div>
      <h2 style={{fontSize:20,fontWeight:700,color:'#0f172a',marginBottom:8}}>Email enviado</h2>
      <p style={{fontSize:14,color:'#64748b',marginBottom:8}}>Revisa tu bandeja de entrada y haz clic en el enlace para restablecer tu contraseña.</p>
      <p style={{fontSize:12,color:'#94a3b8'}}>Si no lo ves, revisa la carpeta de spam.</p>
    </div>
  )

  return (
    <div>
      <h1 style={{fontSize:22,fontWeight:700,color:'#0f172a',marginBottom:6}}>
        {mode==='reset' ? 'Nueva contraseña' : 'Restablecer contraseña'}
      </h1>
      <p style={{fontSize:14,color:'#64748b',marginBottom:28}}>
        {mode==='reset'
          ? 'Elige una contraseña segura para tu cuenta.'
          : 'Te enviaremos un enlace para restablecer tu contraseña.'}
      </p>

      <form onSubmit={mode==='reset' ? handleReset : handleRequest} style={{display:'flex',flexDirection:'column',gap:16}}>
        {mode==='request' && (
          <div>
            <label style={{display:'block',fontSize:11,fontWeight:600,color:'#374151',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.04em'}}>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@negocio.com" autoFocus
              style={{width:'100%',fontFamily:'inherit',fontSize:14,color:'#0f172a',background:'#f9fafb',border:'1px solid #e2e8f0',borderRadius:9,padding:'11px 14px',outline:'none',boxSizing:'border-box'}}/>
          </div>
        )}
        {mode==='reset' && (
          <>
            <div>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#374151',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.04em'}}>Nueva contraseña</label>
              <input type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="Mínimo 8 caracteres" autoFocus
                style={{width:'100%',fontFamily:'inherit',fontSize:14,color:'#0f172a',background:'#f9fafb',border:'1px solid #e2e8f0',borderRadius:9,padding:'11px 14px',outline:'none',boxSizing:'border-box'}}/>
            </div>
            <div>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#374151',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.04em'}}>Confirmar contraseña</label>
              <input type="password" value={pw2} onChange={e=>setPw2(e.target.value)} placeholder="Repite la contraseña"
                style={{width:'100%',fontFamily:'inherit',fontSize:14,color:'#0f172a',background:'#f9fafb',border:'1px solid #e2e8f0',borderRadius:9,padding:'11px 14px',outline:'none',boxSizing:'border-box'}}/>
            </div>
          </>
        )}

        {msg && <p style={{fontSize:13,color:'#dc2626',background:'#fef2f2',padding:'8px 12px',borderRadius:8}}>{msg}</p>}

        <button type="submit" disabled={loading}
          style={{width:'100%',padding:'12px',fontFamily:'inherit',fontSize:14,fontWeight:600,color:'white',background:'linear-gradient(135deg,#1e40af,#3b82f6)',border:'none',borderRadius:9,cursor:loading?'not-allowed':'pointer',opacity:loading?0.6:1}}>
          {loading ? 'Enviando...' : mode==='reset' ? 'Guardar contraseña' : 'Enviar enlace'}
        </button>

        <p style={{textAlign:'center',fontSize:13,color:'#64748b'}}>
          <Link href="/login" style={{color:'#1d4ed8',textDecoration:'none',fontWeight:500}}>← Volver al login</Link>
        </p>
      </form>
    </div>
  )
}

export default function ResetPage() {
  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f8fafc',fontFamily:"'DM Sans',-apple-system,sans-serif",padding:24}}>
      <div style={{width:'100%',maxWidth:400,background:'white',border:'1px solid #e2e8f0',borderRadius:16,padding:32,boxShadow:'0 4px 24px rgba(0,0,0,0.06)'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:32}}>
          <div style={{width:32,height:32,background:'linear-gradient(135deg,#1e40af,#3b82f6)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg>
          </div>
          <span style={{fontWeight:700,fontSize:15,color:'#0f172a'}}>Reservo.AI</span>
        </div>
        <Suspense fallback={<div style={{textAlign:'center',color:'#94a3b8'}}>Cargando...</div>}>
          <ResetContent/>
        </Suspense>
      </div>
    </div>
  )
}
