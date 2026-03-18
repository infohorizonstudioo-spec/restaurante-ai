'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PageLoader } from '@/components/ui'
import Link from 'next/link'

const PLAN_INFO:Record<string,{label:string;color:string;bg:string;price:number;calls:number;rate:number}> = {
  trial:    {label:'Trial',    color:'#d97706',bg:'#fffbeb',price:0,  calls:10, rate:0},
  free:     {label:'Trial',    color:'#d97706',bg:'#fffbeb',price:0,  calls:10, rate:0},
  starter:  {label:'Starter',  color:'#1d4ed8',bg:'#eff6ff',price:99, calls:50, rate:0.90},
  pro:      {label:'Pro',      color:'#7c3aed',bg:'#f5f3ff',price:299,calls:200,rate:0.70},
  business: {label:'Business', color:'#059669',bg:'#f0fdf4',price:499,calls:600,rate:0.50},
  enterprise:{label:'Business',color:'#059669',bg:'#f0fdf4',price:499,calls:600,rate:0.50},
}

export default function FacturacionPage(){
  const [loading,setLoading] = useState(true)
  const [billing,setBilling] = useState<any>(null)
  const [history,setHistory] = useState<any[]>([])
  const [tid,setTid] = useState<string|null>(null)
  const [upgrading,setUpgrading] = useState(false)

  useEffect(()=>{
    (async()=>{
      const {data:{user}} = await supabase.auth.getUser(); if(!user) return
      const {data:p} = await supabase.from('profiles').select('tenant_id').eq('id',user.id).single(); if(!p?.tenant_id) return
      setTid(p.tenant_id)
      // Usar RPC get_billing_summary para datos precisos del backend
      const {data:b} = await supabase.rpc('get_billing_summary', {p_tenant_id: p.tenant_id})
      setBilling(b)
      // Historial billing
      const {data:h} = await supabase.from('billing_history')
        .select('*').eq('tenant_id',p.tenant_id).order('cycle_start',{ascending:false}).limit(6)
      setHistory(h||[])
      setLoading(false)
    })()
  },[])

  async function handleUpgrade(plan:string){
    if(!tid||upgrading) return
    setUpgrading(true)
    try {
      const {data:{user}} = await supabase.auth.getUser(); if(!user) return
      const res = await fetch('/api/stripe/checkout', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ plan, tenant_id: tid, user_id: user.id })
      })
      const d = await res.json()
      if (d.url) window.location.href = d.url
      else alert('Error: '+d.error)
    } catch(e:any) { alert('Error: '+e.message) }
    finally { setUpgrading(false) }
  }

  if(loading) return <PageLoader/>
  if(!billing) return null

  const pi = PLAN_INFO[billing.plan] || PLAN_INFO.trial
  const isTrial = billing.is_trial
  const usedPct = billing.included_calls > 0 ? Math.min(100, Math.round((billing.used_calls/billing.included_calls)*100)) : 0
  const hasExtra = billing.extra_calls > 0
  const extraCost = (billing.estimated_extra_cost||0).toFixed(2)
  const IVA_RATE = 0.21 // IVA España
  const baseTotal = pi.price + parseFloat(extraCost)
  const totalConIVA = (baseTotal * (1 + IVA_RATE)).toFixed(2)
  const totalSinIVA = baseTotal.toFixed(2)
  const renewDate = billing.billing_cycle_end ? new Date(billing.billing_cycle_end).toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'}) : null

  return(
    <div style={{background:'#f8fafc',minHeight:'100vh'}}>
      <div style={{background:'white',borderBottom:'1px solid #e2e8f0',padding:'14px 24px'}}>
        <h1 style={{fontSize:18,fontWeight:700,color:'#0f172a'}}>Facturacion y uso</h1>
        <p style={{fontSize:12,color:'#94a3b8',marginTop:1}}>Control en tiempo real de tu plan y consumo</p>
      </div>

      <div style={{maxWidth:860,margin:'0 auto',padding:'24px'}}>

        {/* PLAN ACTUAL */}
        <div style={{background:'white',border:'2px solid '+pi.color+'33',borderRadius:16,padding:'20px 24px',marginBottom:16,display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
          <div>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
              <span style={{fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:12,background:pi.bg,color:pi.color,textTransform:'uppercase',letterSpacing:'0.05em'}}>{pi.label}</span>
              <span style={{fontSize:11,padding:'3px 10px',borderRadius:12,background:billing.subscription_status==='active'?'#f0fdf4':'#f8fafc',color:billing.subscription_status==='active'?'#059669':'#94a3b8',fontWeight:600}}>
                {billing.subscription_status==='active'?'Activo':billing.subscription_status==='past_due'?'Pago pendiente':billing.subscription_status==='cancelled'?'Cancelado':'Sin suscripcion'}
              </span>
              {billing.next_plan&&<span style={{fontSize:11,padding:'3px 10px',borderRadius:12,background:'#fffbeb',color:'#d97706',fontWeight:600}}>Cambia a {billing.next_plan} en el prox. ciclo</span>}
            </div>
            <p style={{fontSize:28,fontWeight:800,color:'#0f172a',letterSpacing:'-0.025em'}}>{isTrial?'Gratis':pi.price+'€/mes'}</p>
            <p style={{fontSize:12,color:'#64748b',marginTop:2}}>{pi.calls} llamadas incluidas{!isTrial?' · '+pi.rate+'€ por llamada extra':''}</p>
            {renewDate&&!isTrial&&<p style={{fontSize:12,color:'#94a3b8',marginTop:4}}>Siguiente factura: {renewDate}</p>}
          </div>
          {isTrial&&(
            <Link href='/precios' style={{padding:'10px 20px',fontSize:13,fontWeight:700,color:'white',background:'linear-gradient(135deg,#1e40af,#3b82f6)',borderRadius:10,textDecoration:'none',whiteSpace:'nowrap'}}>
              Activar plan
            </Link>
          )}
        </div>

        {/* USO DEL CICLO — LA PARTE CRITICA */}
        <div style={{background:'white',border:'1px solid #e2e8f0',borderRadius:16,padding:'20px 24px',marginBottom:16}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
            <div>
              <p style={{fontSize:14,fontWeight:700,color:'#0f172a',marginBottom:2}}>Uso del ciclo actual</p>
              <p style={{fontSize:12,color:'#94a3b8'}}>{isTrial?'Llamadas del trial':'Ciclo mensual'}</p>
            </div>
            <div style={{textAlign:'right'}}>
              <p style={{fontSize:22,fontWeight:800,color:hasExtra?'#dc2626':pi.color}}>{billing.used_calls} / {billing.included_calls}</p>
              <p style={{fontSize:11,color:'#94a3b8'}}>llamadas {isTrial?'usadas':'del plan'}</p>
            </div>
          </div>

          {/* Barra de progreso */}
          <div style={{height:10,background:'#f1f5f9',borderRadius:5,overflow:'hidden',marginBottom:8}}>
            <div style={{height:'100%',width:usedPct+'%',background:usedPct>=100?'#ef4444':usedPct>=80?'#f59e0b':pi.color,borderRadius:5,transition:'width 0.5s'}}/>
          </div>
          <div style={{display:'flex',justifyContent:'space-between'}}>
            <span style={{fontSize:11,color:'#94a3b8'}}>{billing.remaining_calls} llamadas restantes</span>
            <span style={{fontSize:11,color:'#94a3b8'}}>{usedPct}% usado</span>
          </div>

          {/* Extra calls */}
          {hasExtra&&(
            <div style={{marginTop:16,padding:'12px 16px',background:'#fef2f2',border:'1px solid #fecaca',borderRadius:10}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <p style={{fontSize:13,fontWeight:700,color:'#dc2626'}}>Llamadas extra: {billing.extra_calls}</p>
                  <p style={{fontSize:11,color:'#ef4444',marginTop:1}}>{pi.rate}€ por llamada adicional</p>
                </div>
                <div style={{textAlign:'right'}}>
                  <p style={{fontSize:18,fontWeight:800,color:'#dc2626'}}>{extraCost}€</p>
                  <p style={{fontSize:10,color:'#ef4444'}}>coste adicional estimado</p>
                </div>
              </div>
            </div>
          )}

          {/* Total estimado del mes */}
          {!isTrial&&(
            <div style={{marginTop:12,padding:'12px 16px',background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <p style={{fontSize:12,color:'#64748b'}}>Suscripcion mensual ({totalSinIVA}€ + 21% IVA)</p>
                <p style={{fontSize:12,color:'#64748b',marginTop:2}}>{hasExtra?'+ '+extraCost+'€ de llamadas extra':''}</p>
              </div>
              <div style={{textAlign:'right'}}>
                <p style={{fontSize:11,color:'#94a3b8',marginBottom:2}}>Total estimado este mes (IVA incl.)</p>
                <p style={{fontSize:22,fontWeight:800,color:'#0f172a'}}>{totalConIVA}€</p>
              </div>
            </div>
          )}
        </div>

        {/* METRICAS */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:16}}>
          {[
            {label:'Llamadas usadas', value:String(billing.used_calls), sub:'este ciclo', color:pi.color},
            {label:'Llamadas restantes', value:String(Math.max(0,billing.remaining_calls)), sub:'antes de extras', color:billing.remaining_calls<=10?'#dc2626':'#059669'},
            {label:'Llamadas extra', value:String(billing.extra_calls||0), sub:billing.extra_calls>0?extraCost+'€ adicional':'sin coste extra', color:billing.extra_calls>0?'#dc2626':'#94a3b8'},
          ].map(m=>(
            <div key={m.label} style={{background:'white',border:'1px solid #e2e8f0',borderRadius:12,padding:'14px 16px'}}>
              <p style={{fontSize:22,fontWeight:700,color:m.color}}>{m.value}</p>
              <p style={{fontSize:11,fontWeight:600,color:'#374151',marginTop:3}}>{m.label}</p>
              <p style={{fontSize:10,color:'#94a3b8',marginTop:1}}>{m.sub}</p>
            </div>
          ))}
        </div>

        {/* PLANES — upgrade CTA */}
        {isTrial&&(
          <div style={{background:'white',border:'1px solid #e2e8f0',borderRadius:16,padding:'20px 24px',marginBottom:16}}>
            <p style={{fontSize:15,fontWeight:700,color:'#0f172a',marginBottom:16}}>Elige tu plan</p>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
              {(['starter','pro','business'] as const).map(p=>{
                const pp = PLAN_INFO[p]
                return(
                  <div key={p} style={{border:'1px solid #e2e8f0',borderRadius:12,padding:'16px',textAlign:'center'}}>
                    <p style={{fontSize:13,fontWeight:700,color:pp.color,marginBottom:4}}>{pp.label}</p>
                    <p style={{fontSize:22,fontWeight:800,color:'#0f172a',marginBottom:2}}>{pp.price}€<span style={{fontSize:11,color:'#94a3b8'}}>/mes</span></p>
                    <p style={{fontSize:11,color:'#64748b',marginBottom:12}}>{pp.calls} llamadas incluidas</p>
                    <button onClick={()=>handleUpgrade(p)} disabled={upgrading} style={{width:'100%',padding:'8px',fontSize:12,fontWeight:700,color:'white',background:'linear-gradient(135deg,#1e40af,#3b82f6)',border:'none',borderRadius:8,cursor:'pointer',opacity:upgrading?0.6:1}}>
                      {upgrading?'Redirigiendo...':'Activar '+pp.label}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* HISTORIAL */}
        <div style={{background:'white',border:'1px solid #e2e8f0',borderRadius:16,overflow:'hidden'}}>
          <div style={{padding:'14px 20px',borderBottom:'1px solid #f1f5f9'}}>
            <p style={{fontSize:14,fontWeight:600,color:'#0f172a'}}>Historial de facturación</p>
          </div>
          {history.length===0 ? (
            <div style={{padding:'32px 20px',textAlign:'center',color:'#94a3b8'}}>
              <p style={{fontSize:14,marginBottom:6}}>Sin historial aún</p>
              <p style={{fontSize:12,lineHeight:1.6}}>El historial de facturas aparecerá aquí después de tu primera renovación mensual con Stripe.</p>
            </div>
          ) : history.map((h,i)=>(
            <div key={h.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 20px',borderTop:i>0?'1px solid #f8fafc':'none'}}>
              <div>
                <p style={{fontSize:13,fontWeight:500,color:'#0f172a'}}>{new Date(h.cycle_start).toLocaleDateString('es-ES',{month:'long',year:'numeric'})}</p>
                <p style={{fontSize:11,color:'#94a3b8'}}>{h.used_calls} llamadas · {h.extra_calls} extra</p>
              </div>
              <div style={{textAlign:'right'}}>
                <p style={{fontSize:14,fontWeight:700,color:'#0f172a'}}>{h.total_amount}€</p>
                <span style={{fontSize:10,padding:'1px 7px',borderRadius:8,background:h.status==='paid'?'#f0fdf4':'#f8fafc',color:h.status==='paid'?'#059669':'#94a3b8',fontWeight:600}}>{h.status==='paid'?'Pagado':'Pendiente'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}