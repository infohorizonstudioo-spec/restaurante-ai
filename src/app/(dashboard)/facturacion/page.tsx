'use client'
import NotifBell from '@/components/NotifBell'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PageLoader } from '@/components/ui'
import { useTenant } from '@/contexts/TenantContext'
import { getStatusLabel } from '@/lib/i18n'
import Link from 'next/link'

import { C } from '@/lib/colors'
const PLAN:Record<string,{label:string;color:string;price:number;calls:number;rate:number}> = {
  trial:     {label:'Trial',    color:C.amber,  price:0,   calls:10,  rate:0},
  free:      {label:'Trial',    color:C.amber,  price:0,   calls:10,  rate:0},
  starter:   {label:'Starter',  color:'#2DD4BF',price:99,  calls:50,  rate:0.90},
  pro:       {label:'Pro',      color:C.violet, price:299, calls:200, rate:0.70},
  business:  {label:'Business', color:C.green,  price:499, calls:600, rate:0.50},
  enterprise:{label:'Business', color:C.green,  price:499, calls:600, rate:0.50},
}

export default function FacturacionPage() {
  const { t, tx } = useTenant()
  const [loading, setLoading] = useState(true)
  const [billing, setBilling] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [tid,     setTid]     = useState<string|null>(null)
  const [upgradeError, setUpgradeError] = useState('')

  useEffect(()=>{
    (async()=>{
      const {data:{user}} = await supabase.auth.getUser(); if(!user) return
      const {data:p} = await supabase.from('profiles').select('tenant_id').eq('id',user.id).maybeSingle(); if(!p?.tenant_id) return
      setTid(p.tenant_id)
      const {data:b} = await supabase.rpc('get_billing_summary', {p_tenant_id:p.tenant_id})
      setBilling(b)
      const {data:h} = await supabase.from('billing_history').select('*').eq('tenant_id',p.tenant_id).order('cycle_start',{ascending:false}).limit(6)
      setHistory(h||[])
      setLoading(false)
    })()
  },[])

  const [upgrading, setUpgrading] = useState(false)

  async function handleUpgrade(plan:string){
    if(!tid||upgrading) return
    setUpgrading(true); setUpgradeError('')
    try {
      const {data:{user}} = await supabase.auth.getUser(); if(!user) return
      const res = await fetch('/api/stripe/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({plan,tenant_id:tid,user_id:user.id})})
      const d = await res.json()
      if(d.url) window.location.href=d.url
      else setUpgradeError(d.error||tx('Error al procesar el pago'))
    } catch(e:any){ setUpgradeError(e.message||tx('Error de conexión')) }
    finally{setUpgrading(false)}
  }

  if(loading) return <PageLoader/>
  if(!billing) return null

  const pi      = PLAN[billing.plan] || PLAN.trial
  const isTrial = billing.is_trial
  const usedPct = billing.included_calls>0 ? Math.min(100,Math.round((billing.used_calls/billing.included_calls)*100)) : 0
  const hasExtra = billing.extra_calls>0
  const extraCost = (billing.estimated_extra_cost||0).toFixed(2)
  const IVA = 0.21
  const total = ((pi.price+parseFloat(extraCost))*(1+IVA)).toFixed(2)
  const renewDate = billing.billing_cycle_end ? new Date(billing.billing_cycle_end).toLocaleDateString(undefined,{day:'numeric',month:'long',year:'numeric'}) : null

  return (
    <div style={{background:C.bg, minHeight:'100vh', fontFamily:'var(--rz-font)'}}>
      {/* Header */}
      <div style={{background:C.surface, borderBottom:`1px solid ${C.border}`, padding:'14px 28px', position:'sticky', top:0, zIndex:20, display:'flex', alignItems:'center', justifyContent:'space-between'}}>
        <div>
          <h1 style={{fontSize:16, fontWeight:700, color:C.text, letterSpacing:'-0.02em'}}>{t.nav.billing}</h1>
          <p style={{fontSize:11, color:C.text3, marginTop:2}}>{tx('Control en tiempo real de tu plan y consumo')}</p>
        </div>
        <NotifBell/>
      </div>

      <div style={{maxWidth:860, margin:'0 auto', padding:'24px 28px'}}>

        {/* Plan actual */}
        <div style={{background:C.surface, border:`1px solid ${pi.color}22`, borderRadius:16, padding:'20px 24px', marginBottom:14, position:'relative', overflow:'hidden'}}>
          <div style={{position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg, ${pi.color}, transparent)`, borderRadius:'16px 16px 0 0'}}/>
          <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between'}}>
            <div>
              <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:10}}>
                <span style={{fontSize:10, fontWeight:700, padding:'3px 10px', borderRadius:12, background:pi.color+'18', color:pi.color, textTransform:'uppercase', letterSpacing:'0.06em'}}>{pi.label}</span>
                <span style={{fontSize:10, fontWeight:600, padding:'3px 10px', borderRadius:12, background:billing.subscription_status==='active'?C.greenDim:C.surface2, color:billing.subscription_status==='active'?C.green:C.text3, border:`1px solid ${billing.subscription_status==='active'?C.green+'25':C.border}`}}>
                  {billing.subscription_status==='active'?tx('Activo'):billing.subscription_status==='past_due'?tx('Pago pendiente'):tx('Sin suscripción')}
                </span>
                {billing.next_plan && <span style={{fontSize:10, fontWeight:600, padding:'3px 10px', borderRadius:12, background:C.amberDim, color:C.amber}}>→ {billing.next_plan} {tx('próx. ciclo')}</span>}
              </div>
              <p style={{fontFamily:'var(--rz-mono)', fontSize:30, fontWeight:700, color:pi.color, letterSpacing:'-0.03em', marginBottom:4}}>{isTrial?tx('Gratis'):pi.price+'€/'+tx('mes')}</p>
              <p style={{fontSize:12, color:C.text3}}>{pi.calls} {tx('llamadas incluidas')}{!isTrial?` · ${pi.rate}€ ${tx('por llamada extra')}`:''}</p>
              {renewDate&&!isTrial&&<p style={{fontSize:12, color:C.text3, marginTop:4}}>{tx('Siguiente factura:')} {renewDate}</p>}
            </div>
            {isTrial&&<Link href='/precios' style={{padding:'10px 20px', fontSize:13, fontWeight:700, color:'#0C1018', background:C.amber, borderRadius:10, textDecoration:'none', whiteSpace:'nowrap', flexShrink:0}}>{tx('Activar plan →')}</Link>}
          </div>
        </div>

        {/* Uso del ciclo */}
        <div style={{background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:'20px 24px', marginBottom:14}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16}}>
            <div>
              <p style={{fontSize:14, fontWeight:700, color:C.text, marginBottom:3}}>{tx('Uso del ciclo actual')}</p>
              <p style={{fontSize:12, color:C.text3}}>{isTrial?tx('Llamadas del trial'):tx('Ciclo mensual')}</p>
            </div>
            <div style={{textAlign:'right'}}>
              <p style={{fontFamily:'var(--rz-mono)', fontSize:24, fontWeight:700, color:hasExtra?C.red:pi.color, letterSpacing:'-0.03em'}}>{billing.used_calls}<span style={{color:C.text3, fontSize:16}}>/{billing.included_calls}</span></p>
              <p style={{fontSize:11, color:C.text3}}>{tx('llamadas del plan')}</p>
            </div>
          </div>

          {/* Barra */}
          <div style={{height:6, background:'rgba(255,255,255,0.05)', borderRadius:3, overflow:'hidden', marginBottom:8}}>
            <div style={{height:'100%', width:usedPct+'%', background:usedPct>=100?C.red:usedPct>=80?C.yellow:pi.color, borderRadius:3, transition:'width 0.6s ease', transformOrigin:'left'}}/>
          </div>
          <div style={{display:'flex', justifyContent:'space-between'}}>
            <span style={{fontSize:11, color:C.text3}}>{billing.remaining_calls} {tx('llamadas restantes')}</span>
            <span style={{fontFamily:'var(--rz-mono)', fontSize:11, color:C.text3}}>{usedPct}%</span>
          </div>

          {/* Extra calls alert */}
          {hasExtra && (
            <div style={{marginTop:16, padding:'14px 16px', background:C.redDim, border:`1px solid ${C.red}25`, borderRadius:12}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div>
                  <p style={{fontSize:13, fontWeight:700, color:C.red, marginBottom:3}}>⚠ {tx('Llamadas extra')}: {billing.extra_calls}</p>
                  <p style={{fontSize:11, color:`${C.red}90`}}>{pi.rate}€ {tx('por llamada adicional')}</p>
                </div>
                <p style={{fontFamily:'var(--rz-mono)', fontSize:22, fontWeight:700, color:C.red}}>{extraCost}€</p>
              </div>
            </div>
          )}

          {/* Total estimado */}
          {!isTrial && (
            <div style={{marginTop:12, padding:'14px 16px', background:C.surface2, border:`1px solid ${C.border}`, borderRadius:12, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <div>
                <p style={{fontSize:12, color:C.text3}}>{tx('Suscripción mensual')} · {pi.price}€ + 21% IVA</p>
                {hasExtra && <p style={{fontSize:12, color:C.text3, marginTop:2}}>+ {extraCost}€ {tx('llamadas extra')}</p>}
              </div>
              <div style={{textAlign:'right'}}>
                <p style={{fontSize:11, color:C.text3, marginBottom:2}}>{tx('Total estimado (IVA incl.)')}</p>
                <p style={{fontFamily:'var(--rz-mono)', fontSize:24, fontWeight:700, color:C.text, letterSpacing:'-0.03em'}}>{total}€</p>
              </div>
            </div>
          )}
        </div>

        {/* KPIs */}
        <div className="rz-grid-3col" style={{gap:12, marginBottom:14}}>
          {[
            {label:tx('Llamadas usadas'), value:billing.used_calls, sub:tx('este ciclo'), color:pi.color},
            {label:tx('Llamadas restantes'), value:Math.max(0,billing.remaining_calls), sub:tx('antes de extras'), color:billing.remaining_calls<=10?C.red:C.green},
            {label:tx('Llamadas extra'), value:billing.extra_calls||0, sub:billing.extra_calls>0?extraCost+'€ '+tx('adicional'):tx('sin coste extra'), color:billing.extra_calls>0?C.red:C.text3},
          ].map(m=>(
            <div key={m.label} style={{background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:'16px 18px'}}>
              <p style={{fontFamily:'var(--rz-mono)', fontSize:26, fontWeight:700, color:m.color, letterSpacing:'-0.03em', marginBottom:4}}>{m.value}</p>
              <p style={{fontSize:12, fontWeight:600, color:C.text2}}>{m.label}</p>
              <p style={{fontSize:11, color:C.text3, marginTop:2}}>{m.sub}</p>
            </div>
          ))}
        </div>

        {/* Upgrade plans (trial only) */}
        {isTrial && (
          <div style={{background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:'20px 24px', marginBottom:14}}>
            <p style={{fontSize:15, fontWeight:700, color:C.text, marginBottom:16, letterSpacing:'-0.01em'}}>{tx('Elige tu plan')}</p>
            <div className="rz-grid-3col" style={{gap:12}}>
              {(['starter','pro','business'] as const).map(p=>{
                const pp=PLAN[p]; return(
                  <div key={p} style={{background:C.surface2, border:`1px solid ${C.border}`, borderRadius:14, padding:'18px', textAlign:'center'}}>
                    <p style={{fontSize:12, fontWeight:700, color:pp.color, marginBottom:6, textTransform:'uppercase', letterSpacing:'0.06em'}}>{pp.label}</p>
                    <p style={{fontFamily:'var(--rz-mono)', fontSize:24, fontWeight:700, color:C.text, marginBottom:2}}>{pp.price}€<span style={{fontSize:12, color:C.text3}}>/mes</span></p>
                    <p style={{fontSize:11, color:C.text3, marginBottom:14}}>{pp.calls} {tx('llamadas incluidas')}</p>
                    <button onClick={()=>handleUpgrade(p)} disabled={upgrading} style={{width:'100%', padding:'9px', fontSize:12, fontWeight:700, color:'#0C1018', background:pp.color, border:'none', borderRadius:9, cursor:'pointer', opacity:upgrading?0.6:1, transition:'all 0.15s'}}>
                      {upgrading?tx('Redirigiendo…'):tx('Activar')+' '+pp.label}
                    </button>
                  </div>
                )
              })}
            </div>
            {upgradeError&&<p style={{fontSize:12,color:C.red,marginTop:12,padding:'8px 12px',background:C.redDim,borderRadius:8}}>⚠ {upgradeError}</p>}
          </div>
        )}

        {/* Historial */}
        <div style={{background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, overflow:'hidden'}}>
          <div style={{padding:'14px 20px', borderBottom:`1px solid ${C.border}`}}>
            <p style={{fontSize:14, fontWeight:700, color:C.text}}>{tx('Historial de facturación')}</p>
          </div>
          {history.length===0 ? (
            <div style={{padding:'36px 20px', textAlign:'center'}}>
              <div style={{fontSize:28, marginBottom:10}}>🧾</div>
              <p style={{fontSize:14, color:C.text2, marginBottom:6}}>{tx('Sin historial aún')}</p>
              <p style={{fontSize:12, color:C.text3, lineHeight:1.6}}>{tx('El historial de facturas aparecerá aquí después de tu primera renovación mensual.')}</p>
            </div>
          ) : history.map((h,i)=>(
            <div key={h.id} style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px', borderTop:i>0?`1px solid ${C.border}`:'none', transition:'background 0.12s'}}
              onMouseEnter={e=>(e.currentTarget.style.background=C.surface2)}
              onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
              <div>
                <p style={{fontSize:13, fontWeight:600, color:C.text, marginBottom:3}}>{new Date(h.cycle_start).toLocaleDateString(undefined,{month:'long',year:'numeric'})}</p>
                <p style={{fontFamily:'var(--rz-mono)', fontSize:11, color:C.text3}}>{h.used_calls} {tx('llamadas')} · {h.extra_calls} extra</p>
              </div>
              <div style={{textAlign:'right'}}>
                <p style={{fontFamily:'var(--rz-mono)', fontSize:16, fontWeight:700, color:C.text, marginBottom:4}}>{h.total_amount}€</p>
                <span style={{fontSize:10, padding:'2px 8px', borderRadius:8, background:h.status==='paid'?C.greenDim:C.surface3, color:h.status==='paid'?C.green:C.text3, fontWeight:600, border:`1px solid ${h.status==='paid'?C.green+'25':C.border}`}}>{getStatusLabel(h.status==='paid'?'paid':'unpaid', t.locale)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
