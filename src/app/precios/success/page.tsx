'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function SuccessPage() {
  const params = useSearchParams()
  const [show, setShow] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 300)
    return () => clearTimeout(t)
  }, [])

  return (
    <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#0f172a,#1e3a5f)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'DM Sans',-apple-system,sans-serif",padding:24}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap'); *{box-sizing:border-box;margin:0;padding:0} @keyframes scaleIn{from{opacity:0;transform:scale(0.9)}to{opacity:1;transform:scale(1)}} @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{maxWidth:480,width:'100%',textAlign:'center',animation:'scaleIn 0.4s ease'}}>
        <div style={{width:80,height:80,borderRadius:24,background:'linear-gradient(135deg,#059669,#10b981)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 24px',boxShadow:'0 8px 32px rgba(5,150,105,0.4)'}}>
          <svg width='36' height='36' viewBox='0 0 24 24' fill='none'><path d='M20 6L9 17l-5-5' stroke='white' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'/></svg>
        </div>
        <h1 style={{fontSize:32,fontWeight:700,color:'white',letterSpacing:'-0.025em',marginBottom:12}}>Plan activado</h1>
        <p style={{fontSize:16,color:'rgba(255,255,255,0.6)',lineHeight:1.65,marginBottom:36}}>
          Tu recepcionista virtual ya está activa y lista para atender llamadas.
          Puedes ver tu consumo en el panel en cualquier momento.
        </p>
        <div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap'}}>
          <Link href='/panel' style={{padding:'13px 28px',fontSize:15,fontWeight:600,color:'white',background:'linear-gradient(135deg,#1e40af,#3b82f6)',borderRadius:11,textDecoration:'none',boxShadow:'0 4px 16px rgba(59,130,246,0.35)'}}>
            Ir al panel →
          </Link>
          <Link href='/configuracion' style={{padding:'13px 24px',fontSize:15,fontWeight:500,color:'rgba(255,255,255,0.75)',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:11,textDecoration:'none'}}>
            Configurar agente
          </Link>
        </div>
        <p style={{marginTop:32,fontSize:13,color:'rgba(255,255,255,0.3)'}}>
          ¿Dudas? <a href='mailto:hola@reservo.ai' style={{color:'rgba(255,255,255,0.5)',textDecoration:'none'}}>hola@reservo.ai</a>
        </p>
      </div>
    </div>
  )
}