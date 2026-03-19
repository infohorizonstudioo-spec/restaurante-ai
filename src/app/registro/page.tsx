'use client'
import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const TIPOS = [
  { key:'restaurante',    label:'🍽️', name:'Restaurante' },
  { key:'bar',            label:'🍺', name:'Bar' },
  { key:'clinica_dental', label:'🦷', name:'Clínica Dental' },
  { key:'clinica_medica', label:'🏥', name:'Clínica Médica' },
  { key:'asesoria',       label:'💼', name:'Asesoría' },
  { key:'peluqueria',     label:'✂️', name:'Peluquería' },
]

export default function RegistroPage() {
  const [step,setStep]       = useState(1)
  const [loading,setLoading] = useState(false)
  const [error,setError]     = useState('')
  const [form,setForm]       = useState({ name:'',email:'',password:'',businessName:'',businessType:'restaurante' })
  const up = (k:string,v:string) => setForm(f=>({...f,[k]:v}))

  const handleRegister = useCallback(async () => {
    if (!form.email||!form.password||!form.name||!form.businessName){setError('Rellena todos los campos');return}
    if (form.password.length<6){setError('La contraseña debe tener al menos 6 caracteres');return}
    setLoading(true);setError('')
    try {
      // 1. Crear tenant + usuario via API (usa service role, evita RLS)
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: form.businessName,
          businessType: form.businessType,
          email: form.email.trim().toLowerCase(),
          password: form.password,
          name: form.name,
        })
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error?.includes('already')) setError('Este email ya tiene cuenta. Inicia sesión.')
        else setError(data.error || 'Error al registrarse. Inténtalo de nuevo.')
        return
      }

      // 2. Hacer login automático para obtener sesión activa
      const { error: loginErr } = await supabase.auth.signInWithPassword({
        email: form.email.trim().toLowerCase(),
        password: form.password,
      })
      if (loginErr) {
        // Cuenta creada pero login falló — mandar a login
        window.location.href = '/login'
        return
      }

      // 3. Redirigir al onboarding
      window.location.href = '/onboarding'
    } catch(e:any) {
      setError('Error al registrarse. Inténtalo de nuevo.')
    } finally { setLoading(false) }
  },[form])

  const FEATURES = [
    { icon:'📞', title:'Recepcionista 24/7', desc:'Atiende llamadas automáticamente sin que tú estés presente.' },
    { icon:'📅', title:'Gestión en tiempo real', desc:'Reservas, citas y pedidos aparecen al instante en tu panel.' },
    { icon:'🔒', title:'Sin contratos', desc:'Empieza gratis. Cancela cuando quieras.' },
  ]

  return (
    <div style={{ minHeight:'100vh', display:'grid', gridTemplateColumns:'1fr 1fr', fontFamily:"'Sora',-apple-system,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap');
        *{box-sizing:border-box}
        @keyframes rz-spin{to{transform:rotate(360deg)}}
        @keyframes rz-fade-up{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .rzinp{width:100%;font-family:'Sora',sans-serif;font-size:14px;color:#E8EEF6;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:12px 14px;outline:none;transition:border-color 0.15s,box-shadow 0.15s}
        .rzinp::placeholder{color:#49566A}
        .rzinp:focus{border-color:#F0A84E!important;box-shadow:0 0 0 3px rgba(240,168,78,0.12)!important}
        .rzbtn{width:100%;padding:13px 20px;font-family:'Sora',sans-serif;font-size:14px;font-weight:700;color:#0C1018;background:linear-gradient(135deg,#F0A84E,#E8923A);border:none;border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 2px 14px rgba(240,168,78,0.25);transition:all 0.15s}
        .rzbtn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 4px 22px rgba(240,168,78,0.38)}
        .rzbtn:disabled{opacity:0.5;cursor:not-allowed;transform:none}
        .rz-tipo{padding:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;cursor:pointer;transition:all 0.12s;text-align:center;font-family:'Sora',sans-serif}
        .rz-tipo:hover{background:rgba(255,255,255,0.06);border-color:rgba(255,255,255,0.14)}
        .rz-tipo.sel{background:rgba(240,168,78,0.1);border-color:rgba(240,168,78,0.35)}
        @media(max-width:860px){.rz-rp{display:none!important}.rz-lp{grid-column:1/-1!important}}
      `}</style>

      {/* ── LEFT: Form ── */}
      <div className="rz-lp" style={{ display:'flex', flexDirection:'column', justifyContent:'center', padding:'clamp(28px,6vw,72px)', background:'#0F1823', minHeight:'100vh', borderRight:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth:400, width:'100%', margin:'0 auto' }}>
          <Link href="/" style={{ display:'flex', alignItems:'center', gap:9, marginBottom:40, textDecoration:'none' }}>
            <div style={{ width:32, height:32, borderRadius:10, background:'linear-gradient(135deg,#F0A84E,#E8923A)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 10px rgba(240,168,78,0.3)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="#0C1018"><path d="M22 17a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A2 2 0 014 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 17z"/></svg>
            </div>
            <span style={{ fontWeight:700, fontSize:16, color:'#E8EEF6', letterSpacing:'-0.02em' }}>Reservo<span style={{ color:'#F0A84E' }}>.AI</span></span>
          </Link>

          {/* Step indicator */}
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:32 }}>
            {[1,2].map((s,i) => (
              <div key={s} style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:28, height:28, borderRadius:'50%', background: step>=s ? 'linear-gradient(135deg,#F0A84E,#E8923A)' : 'rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color: step>=s ? '#0C1018' : '#49566A', transition:'all 0.2s', boxShadow: step>=s ? '0 2px 8px rgba(240,168,78,0.3)' : 'none' }}>
                  {step>s ? '✓' : s}
                </div>
                <span style={{ fontSize:12, color: step>=s ? '#E8EEF6' : '#49566A', fontWeight: step>=s ? 600 : 400 }}>{s===1?'Tu cuenta':'Tu negocio'}</span>
                {i<1 && <div style={{ width:24, height:1.5, background: step>s ? '#F0A84E' : 'rgba(255,255,255,0.07)', borderRadius:1, transition:'background 0.3s' }}/>}
              </div>
            ))}
          </div>

          {step===1 && (
            <div style={{ animation:'rz-fade-up 0.3s ease' }}>
              <h1 style={{ fontSize:24, fontWeight:700, color:'#E8EEF6', letterSpacing:'-0.03em', marginBottom:6 }}>Crea tu cuenta</h1>
              <p style={{ fontSize:13, color:'#8895A7', marginBottom:28 }}>10 llamadas gratis · Sin tarjeta de crédito</p>
              <div style={{ display:'flex', flexDirection:'column', gap:14, marginBottom:18 }}>
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#8895A7', marginBottom:6, letterSpacing:'0.05em', textTransform:'uppercase' }}>Nombre completo</label>
                  <input className="rzinp" type="text" value={form.name} onChange={e=>up('name',e.target.value)} placeholder="Juan García" autoComplete="name"/>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#8895A7', marginBottom:6, letterSpacing:'0.05em', textTransform:'uppercase' }}>Email</label>
                  <input className="rzinp" type="email" value={form.email} onChange={e=>up('email',e.target.value)} placeholder="tu@negocio.com" autoComplete="email"/>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#8895A7', marginBottom:6, letterSpacing:'0.05em', textTransform:'uppercase' }}>Contraseña</label>
                  <input className="rzinp" type="password" value={form.password} onChange={e=>up('password',e.target.value)} placeholder="Mínimo 6 caracteres" autoComplete="new-password"/>
                </div>
              </div>
              {error && <div style={{ background:'rgba(248,113,113,0.08)', border:'1px solid rgba(248,113,113,0.2)', borderRadius:9, padding:'10px 14px', marginBottom:14, fontSize:13, color:'#F87171' }}>{error}</div>}
              <button className="rzbtn" onClick={()=>{ if(!form.name||!form.email||!form.password){setError('Rellena todos los campos');return} if(form.password.length<6){setError('Contraseña mínimo 6 caracteres');return} setError('');setStep(2) }}>
                Continuar →
              </button>
              <p style={{ marginTop:22, fontSize:13, color:'#8895A7', textAlign:'center' }}>
                ¿Ya tienes cuenta?{' '}<Link href="/login" style={{ color:'#F0A84E', fontWeight:600, textDecoration:'none' }}>Iniciar sesión</Link>
              </p>
            </div>
          )}

          {step===2 && (
            <div style={{ animation:'rz-fade-up 0.3s ease' }}>
              <h1 style={{ fontSize:24, fontWeight:700, color:'#E8EEF6', letterSpacing:'-0.03em', marginBottom:6 }}>Tu negocio</h1>
              <p style={{ fontSize:13, color:'#8895A7', marginBottom:28 }}>Personalizaremos el agente para ti</p>
              <div style={{ display:'flex', flexDirection:'column', gap:16, marginBottom:18 }}>
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#8895A7', marginBottom:6, letterSpacing:'0.05em', textTransform:'uppercase' }}>Nombre del negocio</label>
                  <input className="rzinp" type="text" value={form.businessName} onChange={e=>up('businessName',e.target.value)} placeholder="Restaurante La Plaza"/>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#8895A7', marginBottom:10, letterSpacing:'0.05em', textTransform:'uppercase' }}>Tipo de negocio</label>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    {TIPOS.map(t => (
                      <button key={t.key} onClick={()=>up('businessType',t.key)} className={`rz-tipo${form.businessType===t.key?' sel':''}`}>
                        <div style={{ fontSize:20, marginBottom:4 }}>{t.label}</div>
                        <div style={{ fontSize:12, fontWeight:600, color: form.businessType===t.key ? '#F0A84E' : '#8895A7' }}>{t.name}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {error && <div style={{ background:'rgba(248,113,113,0.08)', border:'1px solid rgba(248,113,113,0.2)', borderRadius:9, padding:'10px 14px', marginBottom:14, fontSize:13, color:'#F87171' }}>{error}</div>}
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={()=>setStep(1)} style={{ flex:1, padding:'13px', fontFamily:"'Sora',sans-serif", fontSize:14, fontWeight:600, color:'#8895A7', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, cursor:'pointer' }}>← Atrás</button>
                <button className="rzbtn" style={{ flex:2 }} disabled={loading} onClick={handleRegister}>
                  {loading ? <><div style={{ width:16, height:16, border:'2px solid rgba(12,16,24,0.3)', borderTop:'2px solid #0C1018', borderRadius:'50%', animation:'rz-spin 0.7s linear infinite' }}/> Creando…</> : 'Empezar gratis →'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT: Features panel ── */}
      <div className="rz-rp" style={{ background:'linear-gradient(155deg,#0C1018 0%,#101825 45%,#0E1620 100%)', minHeight:'100vh', display:'flex', flexDirection:'column', justifyContent:'center', padding:'clamp(28px,5vw,60px)', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:'10%', right:'8%', width:280, height:280, background:'radial-gradient(circle,rgba(240,168,78,0.06),transparent)', pointerEvents:'none', borderRadius:'50%' }}/>
        <div style={{ position:'absolute', bottom:'20%', left:'5%', width:220, height:220, background:'radial-gradient(circle,rgba(45,212,191,0.05),transparent)', pointerEvents:'none', borderRadius:'50%' }}/>
        <div style={{ position:'absolute', inset:0, opacity:0.02, backgroundImage:'linear-gradient(rgba(255,255,255,0.9) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.9) 1px,transparent 1px)', backgroundSize:'48px 48px', pointerEvents:'none' }}/>
        <div style={{ position:'relative', zIndex:1 }}>
          <div style={{ marginBottom:40 }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'5px 12px', background:'rgba(240,168,78,0.1)', border:'1px solid rgba(240,168,78,0.2)', borderRadius:20, marginBottom:20 }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:'#F0A84E', animation:'rz-pulse 2s infinite' }}/>
              <span style={{ fontSize:11, fontWeight:700, color:'#F0A84E', letterSpacing:'0.06em', textTransform:'uppercase' }}>10 llamadas gratis</span>
            </div>
            <h2 style={{ fontSize:28, fontWeight:800, color:'#E8EEF6', letterSpacing:'-0.04em', lineHeight:1.2, marginBottom:12 }}>
              Tu recepcionista<br/>con IA ya está lista
            </h2>
            <p style={{ fontSize:14, color:'rgba(255,255,255,0.38)', lineHeight:1.7 }}>Sin instalaciones, sin complicaciones. En menos de 5 minutos tu negocio ya recibe llamadas.</p>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {FEATURES.map((f,i) => (
              <div key={f.title} style={{ display:'flex', gap:14, padding:'16px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, animation:'rz-fade-up 0.4s ease both', animationDelay:`${i*0.08}s` }}>
                <div style={{ width:40, height:40, borderRadius:11, background:'rgba(240,168,78,0.1)', border:'1px solid rgba(240,168,78,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{f.icon}</div>
                <div>
                  <p style={{ fontSize:14, fontWeight:700, color:'#E8EEF6', letterSpacing:'-0.01em', marginBottom:4 }}>{f.title}</p>
                  <p style={{ fontSize:12.5, color:'rgba(255,255,255,0.38)', lineHeight:1.55 }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:32, display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
            {[{n:'24/7',l:'Disponible'},{n:'+500',l:'Negocios'},{n:'<2s',l:'Respuesta'}].map(s => (
              <div key={s.l} style={{ textAlign:'center', padding:'14px 8px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10 }}>
                <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:18, fontWeight:600, color:'#F0A84E', letterSpacing:'-0.02em' }}>{s.n}</p>
                <p style={{ fontSize:10.5, color:'rgba(255,255,255,0.3)', marginTop:3, fontWeight:500 }}>{s.l}</p>
              </div>
            ))}
          </div>
        </div>
        <style>{`@keyframes rz-pulse{0%,100%{opacity:1}50%{opacity:0.45}} @keyframes rz-fade-up{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
      </div>
    </div>
  )
}
