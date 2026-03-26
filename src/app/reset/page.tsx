'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const C = {
  bg:'#0C1018', card:'#131920', card2:'#1A2230',
  border:'rgba(255,255,255,0.07)', borderMd:'rgba(255,255,255,0.11)',
  text:'#E8EEF6', sub:'#8895A7', muted:'#49566A',
  amber:'#F0A84E', amber2:'#E8923A',
  amberDim:'rgba(240,168,78,0.10)', amberGlow:'rgba(240,168,78,0.20)',
  red:'#F87171', redDim:'rgba(248,113,113,0.10)',
  green:'#34D399', greenDim:'rgba(52,211,153,0.10)',
}

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

  const inputStyle: React.CSSProperties = {
    width:'100%', fontFamily:'inherit', fontSize:14, color:C.text,
    background:'rgba(255,255,255,0.05)', border:`1px solid ${C.borderMd}`,
    borderRadius:10, padding:'12px 14px', outline:'none', boxSizing:'border-box',
    transition:'border-color 0.15s, box-shadow 0.15s',
  }

  const labelStyle: React.CSSProperties = {
    display:'block', fontSize:11, fontWeight:600, color:C.sub,
    marginBottom:6, textTransform:'uppercase', letterSpacing:'0.05em',
  }

  if (done) return (
    <div style={{textAlign:'center',animation:'rz-fade-up 0.3s ease'}}>
      <div style={{
        width:56, height:56, borderRadius:14, margin:'0 auto 20px',
        background:C.greenDim, display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <h2 style={{fontSize:20,fontWeight:700,color:C.text,marginBottom:8}}>Contraseña actualizada</h2>
      <p style={{fontSize:13,color:C.sub,marginBottom:24,lineHeight:1.6}}>Ya puedes iniciar sesión con tu nueva contraseña.</p>
      <Link href="/login" style={{
        display:'inline-flex',alignItems:'center',gap:8,
        padding:'12px 24px',
        background:`linear-gradient(135deg,${C.amber},${C.amber2})`,
        color:C.bg, borderRadius:10, fontWeight:700, fontSize:14,
        textDecoration:'none', boxShadow:`0 2px 14px ${C.amberGlow}`,
        transition:'all 0.15s',
      }}>
        Ir al login
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </Link>
    </div>
  )

  if (sent) return (
    <div style={{textAlign:'center',animation:'rz-fade-up 0.3s ease'}}>
      <div style={{
        width:56, height:56, borderRadius:14, margin:'0 auto 20px',
        background:C.amberDim, display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.amber} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
        </svg>
      </div>
      <h2 style={{fontSize:20,fontWeight:700,color:C.text,marginBottom:8}}>Email enviado</h2>
      <p style={{fontSize:13,color:C.sub,marginBottom:8,lineHeight:1.6}}>Revisa tu bandeja de entrada y haz clic en el enlace para restablecer tu contraseña.</p>
      <p style={{fontSize:12,color:C.muted}}>Si no lo ves, revisa la carpeta de spam.</p>
    </div>
  )

  return (
    <div style={{animation:'rz-fade-up 0.3s ease'}}>
      <h1 style={{fontSize:22,fontWeight:700,color:C.text,marginBottom:6}}>
        {mode==='reset' ? 'Nueva contraseña' : 'Restablecer contraseña'}
      </h1>
      <p style={{fontSize:13,color:C.sub,marginBottom:28,lineHeight:1.6}}>
        {mode==='reset'
          ? 'Elige una contraseña segura para tu cuenta.'
          : 'Te enviaremos un enlace para restablecer tu contraseña.'}
      </p>

      <form onSubmit={mode==='reset' ? handleReset : handleRequest} style={{display:'flex',flexDirection:'column',gap:16}}>
        {mode==='request' && (
          <div>
            <label style={labelStyle}>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
              placeholder="tu@negocio.com" autoFocus
              style={inputStyle}
              onFocus={e=>{e.currentTarget.style.borderColor=C.amber;e.currentTarget.style.boxShadow=`0 0 0 3px ${C.amberDim}`}}
              onBlur={e=>{e.currentTarget.style.borderColor=C.borderMd;e.currentTarget.style.boxShadow='none'}}
            />
          </div>
        )}
        {mode==='reset' && (
          <>
            <div>
              <label style={labelStyle}>Nueva contraseña</label>
              <input type="password" value={pw} onChange={e=>setPw(e.target.value)}
                placeholder="Mínimo 8 caracteres" autoFocus
                style={inputStyle}
                onFocus={e=>{e.currentTarget.style.borderColor=C.amber;e.currentTarget.style.boxShadow=`0 0 0 3px ${C.amberDim}`}}
                onBlur={e=>{e.currentTarget.style.borderColor=C.borderMd;e.currentTarget.style.boxShadow='none'}}
              />
            </div>
            <div>
              <label style={labelStyle}>Confirmar contraseña</label>
              <input type="password" value={pw2} onChange={e=>setPw2(e.target.value)}
                placeholder="Repite la contraseña"
                style={inputStyle}
                onFocus={e=>{e.currentTarget.style.borderColor=C.amber;e.currentTarget.style.boxShadow=`0 0 0 3px ${C.amberDim}`}}
                onBlur={e=>{e.currentTarget.style.borderColor=C.borderMd;e.currentTarget.style.boxShadow='none'}}
              />
            </div>
          </>
        )}

        {msg && (
          <p style={{
            fontSize:13,color:C.red,
            background:C.redDim, border:`1px solid rgba(248,113,113,0.2)`,
            padding:'10px 14px', borderRadius:10,
          }}>
            {msg}
          </p>
        )}

        <button type="submit" disabled={loading} style={{
          width:'100%', padding:'13px 20px', fontFamily:'inherit',
          fontSize:14, fontWeight:700, color:C.bg,
          background:`linear-gradient(135deg,${C.amber},${C.amber2})`,
          border:'none', borderRadius:10, cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.6 : 1, display:'flex', alignItems:'center',
          justifyContent:'center', gap:8,
          boxShadow:`0 2px 14px ${C.amberGlow}`,
          transition:'all 0.15s',
        }}>
          {loading && (
            <span style={{
              width:16,height:16,borderRadius:'50%',display:'inline-block',
              border:`2px solid rgba(12,16,24,0.3)`,borderTopColor:C.bg,
              animation:'rz-spin 0.7s linear infinite',
            }}/>
          )}
          {loading ? 'Enviando…' : mode==='reset' ? 'Guardar contraseña' : 'Enviar enlace'}
        </button>

        <p style={{textAlign:'center',fontSize:13,color:C.sub}}>
          <Link href="/login" style={{color:C.amber,textDecoration:'none',fontWeight:600,transition:'opacity 0.15s'}}>
            ← Volver al login
          </Link>
        </p>
      </form>
    </div>
  )
}

export default function ResetPage() {
  return (
    <div style={{
      minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:C.bg, fontFamily:"'Sora',-apple-system,BlinkMacSystemFont,sans-serif",
      padding:24,
    }}>
      <div style={{
        width:'100%', maxWidth:420,
        background:C.card, border:`1px solid ${C.border}`,
        borderRadius:16, padding:'36px 32px',
        boxShadow:'0 8px 40px rgba(0,0,0,0.4)',
      }}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:32}}>
          <div style={{
            width:32,height:32,borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center',
            background:`linear-gradient(135deg,${C.amber},${C.amber2})`,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill={C.bg}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg>
          </div>
          <span style={{fontWeight:700,fontSize:16,color:C.text,letterSpacing:'-0.02em'}}>RESERVO</span>
        </div>
        <Suspense fallback={<div style={{textAlign:'center',color:C.muted,padding:20}}>Cargando...</div>}>
          <ResetContent/>
        </Suspense>
      </div>
    </div>
  )
}
