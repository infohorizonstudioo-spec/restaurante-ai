'use client'
import { useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

function SuccessContent(){
  const router = useRouter()
  useEffect(()=>{
    const t = setTimeout(()=>router.push('/panel'), 4000)
    return ()=>clearTimeout(t)
  },[router])
  return(
    <div style={{textAlign:'center',maxWidth:440,padding:'0 24px'}}>
      <div style={{width:72,height:72,borderRadius:'50%',background:'linear-gradient(135deg,#059669,#34d399)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 24px',boxShadow:'0 8px 32px rgba(5,150,105,0.35)'}}>
        <svg width='32' height='32' viewBox='0 0 24 24' fill='none' stroke='white' strokeWidth='2.5'>
          <path d='M20 6L9 17l-5-5'/>
        </svg>
      </div>
      <h1 style={{fontSize:26,fontWeight:800,color:'white',marginBottom:10,letterSpacing:'-0.025em'}}>Pago completado</h1>
      <p style={{fontSize:15,color:'#94a3b8',lineHeight:1.7,marginBottom:28}}>Tu suscripcion ya esta activa. Redirigiendo al panel...</p>
      <Link href='/panel' style={{display:'inline-block',padding:'12px 28px',fontSize:14,fontWeight:700,color:'white',background:'linear-gradient(135deg,#059669,#10b981)',borderRadius:10,textDecoration:'none'}}>
        Ir al panel ahora
      </Link>
    </div>
  )
}

export default function SuccessPage(){
  return(
    <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#0f172a,#1e293b)',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <Suspense fallback={<div style={{color:'white'}}>Cargando...</div>}>
        <SuccessContent/>
      </Suspense>
    </div>
  )
}