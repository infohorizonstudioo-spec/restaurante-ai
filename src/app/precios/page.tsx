'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const PLANS = [
  {
    id:'starter', label:'Starter', price:99, calls:50, rate:0.90,
    color:'#1d4ed8', bg:'#eff6ff',
    features:['50 llamadas/mes incluidas','Reservas automaticas','Gestion de clientes','Panel en tiempo real','Soporte por email'],
  },
  {
    id:'pro', label:'Pro', price:299, calls:200, rate:0.70,
    color:'#7c3aed', bg:'#f5f3ff', popular:true,
    features:['200 llamadas/mes incluidas','Todo lo de Starter','Estadisticas avanzadas','Gestion de pedidos','Prioridad en soporte'],
  },
  {
    id:'business', label:'Business', price:499, calls:600, rate:0.50,
    color:'#059669', bg:'#f0fdf4',
    features:['600 llamadas/mes incluidas','Todo lo de Pro','Gestion de reparto','Multiples zonas','Soporte dedicado'],
  },
]

export default function PreciosPage(){
  const [loading,setLoading] = useState<string|null>(null)

  async function handlePlan(planId:string){
    if(loading) return
    setLoading(planId)
    try {
      const {data:{user}} = await supabase.auth.getUser()
      if (!user) { window.location.href = '/registro'; return }
      const {data:p} = await supabase.from('profiles').select('tenant_id').eq('id',user.id).single()
      const res = await fetch('/api/stripe/checkout', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ plan: planId, tenant_id: p?.tenant_id, user_id: user.id })
      })
      const d = await res.json()
      if (d.url) window.location.href = d.url
      else alert('Error: ' + (d.error||'Intente de nuevo'))
    } catch(e:any){
      alert('Error: '+e.message)
    } finally {
      setLoading(null)
    }
  }

  return(
    <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#0f172a 0%,#1e293b 100%)'}}>
      {/* Header */}
      <div style={{maxWidth:900,margin:'0 auto',padding:'32px 24px 0'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:48}}>
          <Link href='/' style={{fontSize:20,fontWeight:800,color:'white',textDecoration:'none'}}>Reservo.AI</Link>
          <Link href='/panel' style={{fontSize:13,color:'#94a3b8',textDecoration:'none'}}>Ir al panel</Link>
        </div>
        <div style={{textAlign:'center',marginBottom:48}}>
          <h1 style={{fontSize:36,fontWeight:800,color:'white',marginBottom:12,letterSpacing:'-0.025em'}}>Planes simples y transparentes</h1>
          <p style={{fontSize:16,color:'#94a3b8',lineHeight:1.6}}>Empieza gratis. Sin tarjeta. Cancela cuando quieras.</p>
        </div>
      </div>

      {/* Plans */}
      <div style={{maxWidth:900,margin:'0 auto',padding:'0 24px 48px',display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>
        {PLANS.map(plan=>(
          <div key={plan.id} style={{background:plan.popular?'white':'rgba(255,255,255,0.05)',border:'1px solid',borderColor:plan.popular?'transparent':plan.color+'33',borderRadius:16,padding:'24px',position:'relative',boxShadow:plan.popular?'0 20px 60px rgba(124,58,237,0.3)':undefined}}>
            {plan.popular&&<div style={{position:'absolute',top:-12,left:'50%',transform:'translateX(-50%)',background:'linear-gradient(135deg,#7c3aed,#a78bfa)',color:'white',fontSize:11,fontWeight:700,padding:'4px 14px',borderRadius:20,whiteSpace:'nowrap'}}>MAS POPULAR</div>}

            <div style={{marginBottom:20}}>
              <p style={{fontSize:13,fontWeight:700,color:plan.popular?plan.color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:8}}>{plan.label}</p>
              <div style={{display:'flex',alignItems:'flex-end',gap:4,marginBottom:4}}>
                <span style={{fontSize:36,fontWeight:800,color:plan.popular?'#0f172a':'white',letterSpacing:'-0.025em'}}>{plan.price}</span>
                <span style={{fontSize:14,color:plan.popular?'#64748b':'#94a3b8',marginBottom:8}}>EUR/mes</span>
              </div>
              <p style={{fontSize:12,color:plan.popular?'#64748b':'#64748b'}}>{plan.calls} llamadas incluidas</p>
              <p style={{fontSize:11,color:plan.popular?'#94a3b8':'#475569',marginTop:2}}>{plan.rate}EUR por llamada extra</p>
            </div>

            <button onClick={()=>handlePlan(plan.id)} disabled={!!loading}
              style={{width:'100%',padding:'12px',fontSize:14,fontWeight:700,borderRadius:10,border:'none',cursor:loading?'not-allowed':'pointer',
                background:plan.popular?'linear-gradient(135deg,#7c3aed,#a78bfa)':'linear-gradient(135deg,'+plan.color+','+plan.color+'cc)',
                color:'white',marginBottom:20,opacity:loading?0.7:1,transition:'all 0.15s'}}>
              {loading===plan.id?'Redirigiendo...':'Empezar con '+plan.label}
            </button>

            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {plan.features.map(f=>(
                <div key={f} style={{display:'flex',alignItems:'flex-start',gap:8}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={plan.popular?plan.color:'#94a3b8'} strokeWidth="2.5" style={{flexShrink:0,marginTop:1}}>
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                  <span style={{fontSize:12,color:plan.popular?'#374151':'#94a3b8',lineHeight:1.5}}>{f}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* FAQ */}
      <div style={{maxWidth:600,margin:'0 auto',padding:'0 24px 64px',textAlign:'center'}}>
        <p style={{fontSize:13,color:'#475569',lineHeight:1.8}}>
          Puedes cancelar en cualquier momento desde tu panel. Sin permanencias.<br/>
          El cobro se realiza mensualmente. Las llamadas extra se facturan al final del ciclo.
        </p>
      </div>
    </div>
  )
}