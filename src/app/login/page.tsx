'use client'
import{useState,useCallback}from'react'
import{supabase}from'@/lib/supabase'
import Link from'next/link'

const E:Record<string,string>={'Invalid login credentials':'Email o contraseña incorrectos','invalid_credentials':'Email o contraseña incorrectos','Email not confirmed':'Confirma tu email antes de entrar','Too many requests':'Demasiados intentos. Espera unos minutos.'}
function mapErr(m:string){for(const[k,v]of Object.entries(E))if(m.includes(k))return v;return'Error al iniciar sesión. Inténtalo de nuevo.'}

export default function LoginPage(){
  const[email,setEmail]=useState('');const[pw,setPw]=useState('');const[loading,setLoading]=useState(false);const[error,setError]=useState('')
  const login=useCallback(async()=>{
    if(!email.trim()||!pw){setError('Rellena todos los campos');return}
    setLoading(true);setError('')
    try{
      const{data,error:e}=await supabase.auth.signInWithPassword({email:email.trim().toLowerCase(),password:pw})
      if(e)throw e
      const{data:p}=await supabase.from('profiles').select('role,tenant_id').eq('id',data.user.id).single()
      if((p as any)?.role==='superadmin'){window.location.href='/admin';return}
      if((p as any)?.tenant_id){
        const{data:t}=await supabase.from('tenants').select('onboarding_complete').eq('id',(p as any).tenant_id).single()
        window.location.href=t?.onboarding_complete?'/panel':'/onboarding'
      }else window.location.href='/onboarding'
    }catch(e:any){setError(mapErr(e.message||''))}finally{setLoading(false)}
  },[email,pw])

  return(
    <div style={{minHeight:'100vh',display:'grid',gridTemplateColumns:'1fr 1fr',fontFamily:"'DM Sans',sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');*{box-sizing:border-box}@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}.fade{animation:fadeUp 0.5s ease forwards}input{outline:none;font-family:inherit}input:focus{border-color:#3b82f6!important;box-shadow:0 0 0 3px rgba(59,130,246,0.15)!important}@media(max-width:768px){.split-right{display:none!important}.split-form{grid-column:1/-1!important}}`}</style>
      
      {/* LEFT — form */}
      <div className="split-form fade" style={{display:'flex',flexDirection:'column',justifyContent:'center',padding:'48px',background:'#ffffff',minHeight:'100vh'}}>
        <div style={{maxWidth:380,width:'100%',margin:'0 auto'}}>
          <Link href="/" style={{display:'flex',alignItems:'center',gap:8,marginBottom:40,textDecoration:'none'}}>
            <div style={{width:32,height:32,background:'linear-gradient(135deg,#1e40af,#3b82f6)',borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center'}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" fill="white"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>
            <span style={{fontWeight:700,fontSize:16,color:'#0f172a',letterSpacing:'-0.01em'}}>Reservo.AI</span>
          </Link>
          
          <h1 style={{fontSize:26,fontWeight:700,letterSpacing:'-0.02em',color:'#0f172a',marginBottom:6}}>Bienvenido de nuevo</h1>
          <p style={{fontSize:14,color:'#64748b',marginBottom:32}}>¿Sin cuenta? <Link href="/registro" style={{color:'#2563eb',fontWeight:500}}>Empieza gratis →</Link></p>

          <div style={{display:'flex',flexDirection:'column',gap:16,marginBottom:24}}>
            <div>
              <label style={{display:'block',fontSize:12,fontWeight:600,color:'#374151',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.04em'}}>Email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&login()} placeholder="tu@negocio.com" autoComplete="email"
                style={{width:'100%',padding:'11px 14px',fontSize:14,color:'#0f172a',border:'1px solid #d1d5db',borderRadius:9,background:'#fafafa',transition:'all 0.15s'}}/>
            </div>
            <div>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                <label style={{fontSize:12,fontWeight:600,color:'#374151',textTransform:'uppercase',letterSpacing:'0.04em'}}>Contraseña</label>
                <Link href="/reset" style={{fontSize:12,color:'#2563eb'}}>¿Olvidaste?</Link>
              </div>
              <input type="password" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==='Enter'&&login()} placeholder="••••••••" autoComplete="current-password"
                style={{width:'100%',padding:'11px 14px',fontSize:14,color:'#0f172a',border:'1px solid #d1d5db',borderRadius:9,background:'#fafafa',transition:'all 0.15s'}}/>
            </div>
          </div>

          {error&&(
            <div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:8,padding:'10px 14px',marginBottom:16,display:'flex',alignItems:'center',gap:8,color:'#dc2626',fontSize:13}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              {error}
            </div>
          )}

          <button onClick={login} disabled={loading}
            style={{width:'100%',padding:'12px',fontSize:15,fontWeight:600,color:'white',background:loading?'#93c5fd':'linear-gradient(135deg,#1e40af,#3b82f6)',border:'none',borderRadius:9,cursor:loading?'default':'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,boxShadow:'0 2px 12px rgba(59,130,246,0.3)',transition:'all 0.15s'}}>
            {loading?<><div style={{width:16,height:16,border:'2px solid rgba(255,255,255,0.4)',borderTop:'2px solid white',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/>Entrando...</>:<>Entrar<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5l7 7-7 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></>}
          </button>

          <p style={{marginTop:24,fontSize:12,color:'#9ca3af',textAlign:'center'}}>Al entrar aceptas los <a href="#" style={{color:'#6b7280'}}>Términos</a> y la <a href="#" style={{color:'#6b7280'}}>Privacidad</a></p>
        </div>
      </div>

      {/* RIGHT — visual */}
      <div className="split-right" style={{background:'linear-gradient(145deg,#0f172a,#1e3a5f)',display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',padding:48,position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',top:'20%',right:'10%',width:200,height:200,background:'radial-gradient(circle,rgba(59,130,246,0.15),transparent)',borderRadius:'50%'}}/>
        <div style={{position:'absolute',bottom:'20%',left:'10%',width:150,height:150,background:'radial-gradient(circle,rgba(99,102,241,0.15),transparent)',borderRadius:'50%'}}/>
        <div style={{position:'relative',zIndex:1,maxWidth:360,textAlign:'center'}}>
          <div style={{fontSize:48,marginBottom:24}}>🤖</div>
          <h2 style={{fontSize:28,fontWeight:700,color:'white',letterSpacing:'-0.02em',marginBottom:12}}>Nunca pierdas una llamada</h2>
          <p style={{color:'rgba(255,255,255,0.65)',fontSize:15,lineHeight:1.6,marginBottom:40}}>Tu recepcionista AI trabaja 24/7 para que tú puedas centrarte en lo que importa.</p>
          <div style={{display:'flex',flexDirection:'column',gap:12,textAlign:'left'}}>
            {['Responde llamadas automáticamente','Crea reservas sin esfuerzo','Notificaciones en tiempo real','Panel de control completo'].map(b=>(
              <div key={b} style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:20,height:20,background:'rgba(59,130,246,0.25)',border:'1px solid rgba(59,130,246,0.4)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <span style={{color:'rgba(255,255,255,0.8)',fontSize:13}}>{b}</span>
              </div>
            ))}
          </div>
          <div style={{marginTop:40,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:12,padding:'16px 20px',textAlign:'left'}}>
            <p style={{color:'rgba(255,255,255,0.5)',fontSize:11,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.05em'}}>Clientes activos</p>
            <div style={{display:'flex',gap:0}}>
              {['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444'].map((c,i)=>(
                <div key={c} style={{width:28,height:28,borderRadius:'50%',background:c,border:'2px solid rgba(15,23,42,0.8)',marginLeft:i?-6:0}}/>
              ))}
              <div style={{marginLeft:8,display:'flex',alignItems:'center'}}>
                <span style={{color:'white',fontSize:13,fontWeight:600}}>+240 negocios</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}