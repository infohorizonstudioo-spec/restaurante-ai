'use client'
import{useState,useCallback}from'react'
import{supabase}from'@/lib/supabase'
import{Bot,ArrowRight,AlertCircle}from'lucide-react'
const E:Record<string,string>={'Invalid login credentials':'Email o contraseña incorrectos','invalid_credentials':'Email o contraseña incorrectos','Email not confirmed':'Confirma tu email','Too many requests':'Demasiados intentos'}
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
  const inp=(label:string,type:string,val:string,set:(v:string)=>void,ph:string,ac:string)=>(
    <div>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
        <label style={{color:'#64748b',fontSize:11,fontWeight:600,letterSpacing:'0.05em',textTransform:'uppercase' as any}}>{label}</label>
        {label==='Contraseña'&&<a href="/reset" style={{color:'#6366f1',fontSize:11,textDecoration:'none'}}>¿Olvidaste?</a>}
      </div>
      <input type={type} value={val} autoComplete={ac} placeholder={ph} onKeyDown={(e:any)=>e.key==='Enter'&&login()} onChange={(e:any)=>set(e.target.value)}
        style={{width:'100%',fontFamily:'inherit',fontSize:14,color:'#f1f5f9',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:10,padding:'10px 12px',outline:'none'}}
        onFocus={(e:any)=>e.target.style.borderColor='#6366f1'} onBlur={(e:any)=>e.target.style.borderColor='rgba(255,255,255,0.1)'}/>
    </div>
  )
  return(
    <div style={{minHeight:'100vh',background:'linear-gradient(145deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%)',display:'flex',alignItems:'center',justifyContent:'center',padding:16,position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',inset:0,opacity:0.03,backgroundImage:'linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)',backgroundSize:'48px 48px'}}/>
      <div style={{position:'absolute',top:'-20%',left:'50%',transform:'translateX(-50%)',width:600,height:400,background:'radial-gradient(ellipse,rgba(99,102,241,0.18) 0%,transparent 70%)',pointerEvents:'none'}}/>
      <div style={{width:'100%',maxWidth:400,position:'relative'}}>
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{width:52,height:52,background:'linear-gradient(135deg,#6366f1,#4f46e5)',borderRadius:14,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px',boxShadow:'0 0 0 1px rgba(255,255,255,0.1),0 8px 32px rgba(79,70,229,0.4)'}}><Bot size={24} color="#fff"/></div>
          <h1 style={{color:'#f1f5f9',fontSize:22,fontWeight:700,letterSpacing:'-0.02em',marginBottom:4}}>Reservo.AI</h1>
          <p style={{color:'#64748b',fontSize:13}}>Tu recepcionista con inteligencia artificial</p>
        </div>
        <div style={{background:'rgba(15,23,42,0.8)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:20,padding:'28px',backdropFilter:'blur(20px)',boxShadow:'0 25px 50px rgba(0,0,0,0.4)'}}>
          <p style={{color:'#e2e8f0',fontSize:15,fontWeight:600,marginBottom:20}}>Iniciar sesión</p>
          <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:16}}>
            {inp('Email','email',email,setEmail,'tu@negocio.com','email')}
            {inp('Contraseña','password',pw,setPw,'••••••••','current-password')}
          </div>
          {error&&<div style={{background:'rgba(220,38,38,0.1)',border:'1px solid rgba(220,38,38,0.3)',borderRadius:8,padding:'9px 12px',marginBottom:14,display:'flex',alignItems:'center',gap:7,color:'#fca5a5',fontSize:12}}><AlertCircle size={13} style={{flexShrink:0}}/>{error}</div>}
          <button onClick={login} disabled={loading} style={{width:'100%',padding:'11px 16px',background:loading?'#4338ca':'linear-gradient(135deg,#6366f1,#4f46e5)',color:'#fff',fontSize:14,fontWeight:600,fontFamily:'inherit',border:'none',borderRadius:10,cursor:loading?'default':'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:7,boxShadow:'0 4px 14px rgba(79,70,229,0.4)'}}>
            {loading?<><div style={{width:14,height:14,border:'2px solid rgba(255,255,255,0.4)',borderTop:'2px solid #fff',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/>Entrando...</>:<>Entrar <ArrowRight size={15}/></>}
          </button>
          <p style={{textAlign:'center',color:'#475569',fontSize:12,marginTop:16}}>¿Sin cuenta? <a href="/registro" style={{color:'#6366f1',textDecoration:'none',fontWeight:500}}>Empieza gratis →</a></p>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}