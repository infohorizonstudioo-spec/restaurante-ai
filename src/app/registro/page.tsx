'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { BUSINESS_TEMPLATES } from '@/types'
import Link from 'next/link'

const CONV_R = [
  { from: 'client',  text: 'Hola, quiero pedir cita para el dentista.' },
  { from: 'agent',   text: '¡Hola! ¿Para qué tipo de consulta necesita la cita?' },
  { from: 'client',  text: 'Una limpieza dental, a ser posible esta semana.' },
  { from: 'agent',   text: 'Tengo disponibilidad el jueves a las 11:00 o el viernes a las 17:00. ¿Cuál le viene mejor?' },
  { from: 'client',  text: 'El jueves a las once, perfecto.' },
  { from: 'agent',   text: '¿Me dice su nombre para registrar la cita?' },
  { from: 'client',  text: 'Elena Rodríguez.' },
  { from: 'confirm', text: 'Cita confirmada · Elena Rodríguez · Jueves 11:00 · Limpieza dental' },
]

function RegDemo() {
  const [shown, setShown]   = useState<number[]>([])
  const [typing, setTyping] = useState<number | null>(null)
  const timersRef           = useRef<ReturnType<typeof setTimeout>[]>([])
  const scrollRef           = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function clearAll() {
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
    }
    function run() {
      clearAll()
      setShown([])
      setTyping(null)
      let delay = 400 // ← SIEMPRE dentro de run()
      CONV_R.forEach((msg, i) => {
        const readMs = Math.min(msg.text.length * 24 + 250, 1800)
        if (msg.from === 'agent') {
          timersRef.current.push(setTimeout(() => setTyping(i), delay))
          delay += 700
          timersRef.current.push(setTimeout(() => { setTyping(null); setShown(p=>[...p,i]) }, delay))
          delay += readMs
        } else {
          timersRef.current.push(setTimeout(() => setShown(p=>[...p,i]), delay))
          delay += readMs
        }
      })
      timersRef.current.push(setTimeout(run, delay + 2200))
    }
    run()
    return clearAll
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior:'smooth' })
  }, [shown, typing])

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <div style={{ marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:14 }}>
          <div style={{ position:'relative' }}>
            <div style={{ width:38,height:38,borderRadius:11,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.1)',display:'flex',alignItems:'center',justifyContent:'center' }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M12 2a5 5 0 1 1 0 10A5 5 0 0 1 12 2zm0 12c5.33 0 8 2.67 8 4v2H4v-2c0-1.33 2.67-4 8-4z" fill="rgba(255,255,255,0.7)"/></svg>
            </div>
            <div style={{ position:'absolute',bottom:-2,right:-2,width:10,height:10,borderRadius:'50%',background:'#4ade80',border:'2px solid #0b1120' }}/>
          </div>
          <div>
            <p style={{ color:'white',fontWeight:600,fontSize:14,letterSpacing:'-0.01em' }}>Lucía · Recepcionista de tu negocio</p>
            <p style={{ fontSize:11,color:'rgba(255,255,255,0.4)',marginTop:1 }}>Disponible 24 horas, 7 días a la semana</p>
          </div>
        </div>
        <h2 style={{ color:'white',fontSize:19,fontWeight:700,letterSpacing:'-0.025em',lineHeight:1.3,marginBottom:7 }}>
          Mira cómo trabaja tu recepcionista
        </h2>
        <p style={{ color:'rgba(255,255,255,0.4)',fontSize:12.5,lineHeight:1.65 }}>
          Atiende, pregunta y confirma — sin que tú tengas que hacer nada.
        </p>
      </div>

      <div style={{ flex:1,background:'rgba(0,0,0,0.25)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:13,overflow:'hidden',display:'flex',flexDirection:'column',minHeight:0 }}>
        <div style={{ padding:'9px 13px',borderBottom:'1px solid rgba(255,255,255,0.06)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0 }}>
          <div style={{ display:'flex', gap:5 }}>{['#ff5f57','#febc2e','#28c840'].map(c=><div key={c} style={{ width:8,height:8,borderRadius:'50%',background:c,opacity:0.65 }}/>)}</div>
          <div style={{ display:'flex',alignItems:'center',gap:5 }}>
            <div style={{ width:5,height:5,borderRadius:'50%',background:'#f87171',animation:'rdpulse 1.5s infinite' }}/>
            <span style={{ fontSize:9.5,color:'rgba(255,255,255,0.28)',letterSpacing:'0.06em',textTransform:'uppercase' as const,fontWeight:600 }}>En curso</span>
          </div>
        </div>
        <div ref={scrollRef} style={{ flex:1,padding:'12px 14px',display:'flex',flexDirection:'column',gap:9,overflowY:'auto' as const,scrollbarWidth:'none' as const }}>
          {CONV_R.map((msg,i)=>{
            const vis=shown.includes(i), typ=typing===i
            if(!vis&&!typ) return null
            if(msg.from==='confirm'&&vis) return(
              <div key={i} style={{ background:'rgba(74,222,128,0.1)',border:'1px solid rgba(74,222,128,0.18)',borderRadius:9,padding:'8px 12px',animation:'rdfadeUp 0.4s ease' }}>
                <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <p style={{ fontSize:11.5,color:'#4ade80',fontWeight:600,margin:0 }}>{msg.text}</p>
                </div>
              </div>
            )
            const isA=msg.from==='agent'
            return(
              <div key={i} style={{ display:'flex',gap:7,justifyContent:isA?'flex-start':'flex-end',animation:'rdfadeUp 0.3s ease' }}>
                {isA&&<div style={{ width:22,height:22,borderRadius:'50%',background:'rgba(255,255,255,0.08)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:2 }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M12 2a5 5 0 1 1 0 10A5 5 0 0 1 12 2zm0 12c5.33 0 8 2.67 8 4v2H4v-2c0-1.33 2.67-4 8-4z" fill="rgba(255,255,255,0.55)"/></svg></div>}
                <div style={{ maxWidth:'78%',background:isA?'rgba(255,255,255,0.07)':'rgba(59,130,246,0.22)',border:isA?'1px solid rgba(255,255,255,0.07)':'1px solid rgba(59,130,246,0.28)',borderRadius:isA?'4px 11px 11px 11px':'11px 4px 11px 11px',padding:'7px 11px' }}>
                  {typ
                    ?<div style={{ display:'flex',gap:3,alignItems:'center',height:14 }}>{[0,1,2].map(j=><div key={j} style={{ width:4,height:4,borderRadius:'50%',background:'rgba(255,255,255,0.38)',animation:'rdbounce 1.1s ease-in-out infinite',animationDelay:j*0.18+'s' }}/>)}</div>
                    :<p style={{ fontSize:12,color:isA?'rgba(255,255,255,0.72)':'rgba(255,255,255,0.88)',lineHeight:1.55,margin:0 }}>{msg.text}</p>
                  }
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ display:'flex',flexDirection:'column',gap:8,marginTop:14 }}>
        {['Responde igual que un recepcionista de confianza','Gestiona citas, reservas y consultas automáticamente','Todo aparece en tu panel en tiempo real','Sin contrataciones, sin horarios, sin imprevistos'].map(b=>(
          <div key={b} style={{ display:'flex',alignItems:'flex-start',gap:9 }}>
            <div style={{ width:16,height:16,borderRadius:'50%',background:'rgba(74,222,128,0.12)',border:'1px solid rgba(74,222,128,0.22)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:1 }}>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <p style={{ fontSize:12.5,color:'rgba(255,255,255,0.6)',lineHeight:1.5,margin:0 }}>{b}</p>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes rdfadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes rdpulse{0%,100%{opacity:1}50%{opacity:0.35}}
        @keyframes rdbounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
      `}</style>
    </div>
  )
}

export default function RegistroPage() {
  const [step,setStep]       = useState(1)
  const [loading,setLoading] = useState(false)
  const [error,setError]     = useState('')
  const [form,setForm]       = useState({ name:'',email:'',password:'',businessName:'',businessType:'restaurante' })

  const tipos = Object.entries(BUSINESS_TEMPLATES).filter(([k])=>k!=='otro')

  const handleRegister = useCallback(async () => {
    if (!form.email||!form.password||!form.name||!form.businessName){setError('Rellena todos los campos');return}
    if (form.password.length<6){setError('La contraseña debe tener al menos 6 caracteres');return}
    setLoading(true);setError('')
    try {
      const {data:auth,error:authErr} = await supabase.auth.signUp({email:form.email.trim().toLowerCase(),password:form.password})
      if (authErr) throw authErr
      if (!auth.user) throw new Error('No se pudo crear la cuenta')
      const slug = form.businessName.toLowerCase().replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-')
      const {data:tenant,error:tErr} = await supabase.from('tenants').insert({name:form.businessName,type:form.businessType,slug,plan:'free',free_calls_limit:10,free_calls_used:0}).select().single()
      if (tErr) throw tErr
      await supabase.from('profiles').upsert({id:auth.user.id,full_name:form.name,email:form.email.trim().toLowerCase(),tenant_id:(tenant as any).id,role:'admin'})
      window.location.href='/onboarding'
    } catch(e:any) {
      if (e.message?.includes('already registered')||e.message?.includes('already been registered')) setError('Este email ya tiene cuenta. Inicia sesión.')
      else setError('Error al registrarse. Inténtalo de nuevo.')
    } finally { setLoading(false) }
  },[form])

  return (
    <div style={{ minHeight:'100vh',display:'grid',gridTemplateColumns:'1fr 1fr',fontFamily:"'DM Sans',-apple-system,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box}
        @keyframes rgspin{to{transform:rotate(360deg)}}
        @keyframes rgfadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        input:focus,select:focus{border-color:#3b82f6!important;box-shadow:0 0 0 3px rgba(59,130,246,0.14)!important;outline:none}
        .rginp{width:100%;font-family:inherit;font-size:14px;color:#0f172a;background:#f9fafb;border:1px solid #e2e8f0;border-radius:9px;padding:11px 14px;outline:none;transition:border 0.15s,box-shadow 0.15s}
        .rgbtn{width:100%;padding:12px;font-family:inherit;font-size:15px;font-weight:600;color:white;background:linear-gradient(135deg,#1e40af,#3b82f6);border:none;border-radius:9px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 2px 10px rgba(59,130,246,0.28);transition:all 0.15s}
        .rgbtn:hover:not(:disabled){opacity:0.92;transform:translateY(-1px)}
        .rgbtn:disabled{opacity:0.55;cursor:default;transform:none}
        .rgtc{border:1px solid #e2e8f0;border-radius:9px;padding:10px 14px;cursor:pointer;transition:all 0.12s;background:#f9fafb;font-family:inherit;font-size:13px;text-align:left;color:#374151}
        .rgtc.sel{border-color:#3b82f6;background:#eff6ff;color:#1d4ed8;font-weight:600}
        .rgtc:hover:not(.sel){border-color:#94a3b8;background:#f1f5f9}
        @media(max-width:900px){.rgr{display:none!important}.rgl{grid-column:1/-1!important}}
      `}</style>

      <div className="rgl" style={{ display:'flex',flexDirection:'column',justifyContent:'center',padding:'clamp(32px,6vw,72px)',background:'#fff',minHeight:'100vh' }}>
        <div style={{ maxWidth:400,width:'100%',margin:'0 auto' }}>
          <Link href="/" style={{ display:'flex',alignItems:'center',gap:8,marginBottom:40,textDecoration:'none' }}>
            <div style={{ width:30,height:30,background:'linear-gradient(135deg,#1e40af,#3b82f6)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 2px 8px rgba(59,130,246,0.28)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/></svg>
            </div>
            <span style={{ fontWeight:700,fontSize:15,color:'#0f172a',letterSpacing:'-0.01em' }}>Reservo.AI</span>
          </Link>
          <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:32 }}>
            {[1,2].map((s,i)=>(
              <div key={s} style={{ display:'flex',alignItems:'center',gap:8 }}>
                <div style={{ width:26,height:26,borderRadius:'50%',background:step>=s?'linear-gradient(135deg,#1e40af,#3b82f6)':'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:step>=s?'white':'#94a3b8',transition:'all 0.2s',boxShadow:step>=s?'0 2px 8px rgba(59,130,246,0.25)':'none' }}>
                  {step>s?'✓':s}
                </div>
                <span style={{ fontSize:12,color:step>=s?'#0f172a':'#94a3b8',fontWeight:step>=s?500:400 }}>{s===1?'Tu cuenta':'Tu negocio'}</span>
                {i<1&&<div style={{ width:28,height:1.5,background:step>s?'#3b82f6':'#e2e8f0',borderRadius:1,transition:'background 0.2s' }}/>}
              </div>
            ))}
          </div>
          {step===1&&(
            <div style={{ animation:'rgfadeUp 0.3s ease' }}>
              <h1 style={{ fontSize:24,fontWeight:700,letterSpacing:'-0.02em',color:'#0f172a',marginBottom:6 }}>Crea tu cuenta</h1>
              <p style={{ fontSize:14,color:'#64748b',marginBottom:28 }}>10 llamadas gratis · Sin tarjeta de crédito</p>
              <div style={{ display:'flex',flexDirection:'column',gap:14,marginBottom:20 }}>
                <div><label style={{ display:'block',fontSize:11,fontWeight:600,color:'#374151',marginBottom:5,textTransform:'uppercase' as const,letterSpacing:'0.04em' }}>Nombre completo</label><input className="rginp" type="text" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Juan García" autoComplete="name"/></div>
                <div><label style={{ display:'block',fontSize:11,fontWeight:600,color:'#374151',marginBottom:5,textTransform:'uppercase' as const,letterSpacing:'0.04em' }}>Email</label><input className="rginp" type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="tu@negocio.com" autoComplete="email"/></div>
                <div><label style={{ display:'block',fontSize:11,fontWeight:600,color:'#374151',marginBottom:5,textTransform:'uppercase' as const,letterSpacing:'0.04em' }}>Contraseña</label><input className="rginp" type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="Mínimo 6 caracteres" autoComplete="new-password"/></div>
              </div>
              {error&&<div style={{ background:'#fef2f2',border:'1px solid #fecaca',borderRadius:9,padding:'10px 14px',marginBottom:16,fontSize:13,color:'#dc2626' }}>{error}</div>}
              <button className="rgbtn" onClick={()=>{if(!form.name||!form.email||!form.password){setError('Rellena todos los campos');return}if(form.password.length<6){setError('Contraseña: mínimo 6 caracteres');return}setError('');setStep(2)}}>Continuar →</button>
              <p style={{ marginTop:20,fontSize:13,color:'#64748b',textAlign:'center' as const }}>¿Ya tienes cuenta? <Link href="/login" style={{ color:'#1d4ed8',fontWeight:500,textDecoration:'none' }}>Iniciar sesión</Link></p>
            </div>
          )}
          {step===2&&(
            <div style={{ animation:'rgfadeUp 0.3s ease' }}>
              <h1 style={{ fontSize:24,fontWeight:700,letterSpacing:'-0.02em',color:'#0f172a',marginBottom:6 }}>¿Cuál es tu negocio?</h1>
              <p style={{ fontSize:14,color:'#64748b',marginBottom:28 }}>Personalizaremos tu recepcionista para ti</p>
              <div style={{ display:'flex',flexDirection:'column',gap:14,marginBottom:20 }}>
                <div><label style={{ display:'block',fontSize:11,fontWeight:600,color:'#374151',marginBottom:5,textTransform:'uppercase' as const,letterSpacing:'0.04em' }}>Nombre del negocio</label><input className="rginp" type="text" value={form.businessName} onChange={e=>setForm({...form,businessName:e.target.value})} placeholder="Restaurante La Plaza"/></div>
                <div>
                  <label style={{ display:'block',fontSize:11,fontWeight:600,color:'#374151',marginBottom:10,textTransform:'uppercase' as const,letterSpacing:'0.04em' }}>Tipo de negocio</label>
                  <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8 }}>
                    {tipos.slice(0,6).map(([key,tmpl])=>(
                      <button key={key} onClick={()=>setForm({...form,businessType:key})} className={'rgtc'+(form.businessType===key?' sel':'')}>
                        {(tmpl as any).label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {error&&<div style={{ background:'#fef2f2',border:'1px solid #fecaca',borderRadius:9,padding:'10px 14px',marginBottom:16,fontSize:13,color:'#dc2626' }}>{error}</div>}
              <div style={{ display:'flex',gap:10 }}>
                <button onClick={()=>setStep(1)} style={{ flex:1,padding:'12px',fontFamily:'inherit',fontSize:14,fontWeight:500,color:'#374151',background:'white',border:'1px solid #e2e8f0',borderRadius:9,cursor:'pointer' }}>← Atrás</button>
                <button className="rgbtn" style={{ flex:2 }} disabled={loading} onClick={handleRegister}>
                  {loading?<><div style={{ width:16,height:16,border:'2px solid rgba(255,255,255,0.3)',borderTop:'2px solid white',borderRadius:'50%',animation:'rgspin 0.7s linear infinite' }}/>Creando...</>:'Empezar gratis →'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="rgr" style={{ background:'linear-gradient(160deg,#0b1120 0%,#0f1f3d 48%,#0b1120 100%)',minHeight:'100vh',display:'flex',flexDirection:'column',justifyContent:'center',padding:'clamp(32px,5vw,56px)',position:'relative',overflow:'hidden' }}>
        <div style={{ position:'absolute',inset:0,opacity:0.02,backgroundImage:'linear-gradient(rgba(255,255,255,0.8) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.8) 1px,transparent 1px)',backgroundSize:'40px 40px',pointerEvents:'none' }}/>
        <div style={{ position:'relative',zIndex:1,height:'min(580px,80vh)',display:'flex',flexDirection:'column' }}>
          <RegDemo/>
        </div>
      </div>
    </div>
  )
}