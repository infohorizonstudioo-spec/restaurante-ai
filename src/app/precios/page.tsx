'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const PLANS = [
  {id:'starter',label:'Starter',price:'99',calls:50,rate:'0.90',color:'#1d4ed8',bg:'#eff6ff',popular:false,
   features:['50 llamadas incluidas','Reservas automaticas','Clientes y panel','Soporte email']},
  {id:'pro',label:'Pro',price:'299',calls:200,rate:'0.70',color:'#7c3aed',bg:'#f5f3ff',popular:true,
   features:['200 llamadas incluidas','Todo Starter','Estadisticas avanzadas','Pedidos','Soporte prioritario']},
  {id:'business',label:'Business',price:'499',calls:600,rate:'0.50',color:'#059669',bg:'#f0fdf4',popular:false,
   features:['600 llamadas incluidas','Todo Pro','Gestion reparto','Multi-zona','Soporte dedicado']},
] as const
type PlanId = 'starter'|'pro'|'business'

export default function PreciosPage(){
  const [loading,setLoading] = useState<PlanId|null>(null)
  const [checkoutError, setCheckoutError] = useState('')

  async function handlePlan(planId:PlanId){
    if(loading) return
    setLoading(planId); setCheckoutError('')
    try {
      const {data:{user}} = await supabase.auth.getUser()
      if (!user) { window.location.href = '/registro'; return }
      const {data:p} = await supabase.from('profiles').select('tenant_id').eq('id',user.id).single()
      const res = await fetch('/api/stripe/checkout', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ plan: planId, tenant_id: p?.tenant_id, user_id: user.id })
      })
      const d = await res.json()
      if (d.url) window.location.href = d.url
      else setCheckoutError(d.error||'Error al procesar. Inténtalo de nuevo.')
    } catch(e:any){ setCheckoutError(e.message||'Error de conexión') }
    finally { setLoading(null) }
  }

  return(
    <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#0f172a,#1e293b)'}}>
      <div style={{maxWidth:900,margin:'0 auto',padding:'32px 24px'}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:48}}>
          <Link href='/' style={{fontSize:20,fontWeight:800,color:'white',textDecoration:'none'}}>Reservo.AI</Link>
          <Link href='/panel' style={{fontSize:13,color:'#94a3b8',textDecoration:'none'}}>Ir al panel</Link>
        </div>
        <div style={{textAlign:'center',marginBottom:48}}>
          <h1 style={{fontSize:36,fontWeight:800,color:'white',marginBottom:12}}>Planes simples y transparentes</h1>
          <p style={{fontSize:16,color:'#94a3b8'}}>Empieza gratis. Sin tarjeta. Cancela cuando quieras.</p>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>
          {checkoutError&&<div style={{gridColumn:'1/-1',padding:'10px 14px',background:'rgba(248,113,113,0.1)',border:'1px solid rgba(248,113,113,0.3)',borderRadius:10}}><p style={{fontSize:13,color:'#F87171'}}>⚠ {checkoutError}</p></div>}
          {PLANS.map(plan=>(
            <div key={plan.id} style={{background:plan.popular?'white':'rgba(255,255,255,0.06)',border:'1px solid',borderColor:plan.popular?'transparent':plan.color+'33',borderRadius:16,padding:24,position:'relative'}}>
              {plan.popular&&(
                <div style={{position:'absolute',top:-12,left:'50%',transform:'translateX(-50%)',background:'linear-gradient(135deg,#7c3aed,#a78bfa)',color:'white',fontSize:11,fontWeight:700,padding:'4px 14px',borderRadius:20,whiteSpace:'nowrap'}}>MAS POPULAR</div>
              )}
              <p style={{fontSize:13,fontWeight:700,color:plan.popular?plan.color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:8}}>{plan.label}</p>
              <div style={{display:'flex',alignItems:'flex-end',gap:4,marginBottom:4}}>
                <span style={{fontSize:36,fontWeight:800,color:plan.popular?'#0f172a':'white'}}>{plan.price}</span>
                <span style={{fontSize:14,color:'#94a3b8',marginBottom:8}}>EUR/mes</span>
              </div>
              <p style={{fontSize:12,color:'#64748b',marginBottom:2}}>{plan.calls} llamadas incluidas</p>
              <p style={{fontSize:11,color:'#475569',marginBottom:16}}>{plan.rate} EUR extra/llamada</p>
              <button onClick={()=>handlePlan(plan.id as PlanId)} disabled={!!loading}
                style={{width:'100%',padding:12,fontSize:14,fontWeight:700,borderRadius:10,border:'none',cursor:loading?'not-allowed':'pointer',background:'linear-gradient(135deg,'+plan.color+','+plan.color+'cc)',color:'white',marginBottom:20,opacity:loading?0.7:1}}>
                {loading===plan.id?'Redirigiendo...':'Empezar '+plan.label}
              </button>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {plan.features.map((f:string)=>(
                  <div key={f} style={{display:'flex',gap:8,alignItems:'flex-start'}}>
                    <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke={plan.popular?plan.color:'#64748b'} strokeWidth='2.5' style={{flexShrink:0,marginTop:1}}><path d='M20 6L9 17l-5-5'/></svg>
                    <span style={{fontSize:12,color:plan.popular?'#374151':'#94a3b8'}}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}