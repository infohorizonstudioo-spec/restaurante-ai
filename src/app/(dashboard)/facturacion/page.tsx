'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PageLoader } from '@/components/ui'
import Link from 'next/link'

const PD: Record<string,{label:string;calls:number;rate:number;price:number;color:string}> = {
  free:     {label:'Trial gratuito',calls:10, rate:0,    price:0,  color:'#d97706'},
  trial:    {label:'Trial gratuito',calls:10, rate:0,    price:0,  color:'#d97706'},
  starter:  {label:'Starter',       calls:50, rate:0.90, price:99, color:'#1d4ed8'},
  pro:      {label:'Pro',           calls:200,rate:0.70, price:299,color:'#7c3aed'},
  business: {label:'Business',      calls:600,rate:0.50, price:499,color:'#059669'},
}

export default function FacturacionPage() {
  const [tenant,setTenant] = useState<any>(null)
  const [loading,setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const {data:{user}} = await supabase.auth.getUser()
      if (!user) return
      const {data:p} = await supabase.from('profiles').select('tenant_id').eq('id',user.id).single()
      if (!p?.tenant_id) return
      const {data:t} = await supabase.from('tenants').select('*').eq('id',p.tenant_id).single()
      setTenant(t); setLoading(false)
    })()
  },[])

  if (loading) return <PageLoader/>
  if (!tenant) return null

  const plan     = tenant.plan || 'free'
  const pd       = PD[plan] || PD.free
  const isTrial  = plan === 'free' || plan === 'trial'
  const used     = isTrial ? (tenant.free_calls_used||0) : (tenant.plan_calls_used||0)
  const included = isTrial ? (tenant.free_calls_limit||10) : (tenant.plan_calls_included||pd.calls)
  const extra    = Math.max(0, used - included)
  const extraCost = +(extra * pd.rate).toFixed(2)
  const remaining = Math.max(0, included - used)
  const pct      = Math.min(100, Math.round((used/included)*100))
  const periodStart = tenant.plan_period_start
    ? new Date(tenant.plan_period_start).toLocaleDateString('es-ES',{day:'numeric',month:'long'})
    : null

  const barColor = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : pd.color

  return (
    <div style={{background:'#f8fafc',minHeight:'100vh',fontFamily:"'DM Sans',-apple-system,sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');*{box-sizing:border-box;margin:0;padding:0}`}</style>

      <div style={{background:'white',borderBottom:'1px solid #e2e8f0',padding:'16px 28px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <h1 style={{fontSize:18,fontWeight:700,color:'#0f172a'}}>Uso y facturación</h1>
          <p style={{fontSize:12,color:'#94a3b8',marginTop:2}}>{tenant.name}</p>
        </div>
        <Link href='/precios' style={{padding:'8px 18px',fontSize:13,fontWeight:600,color:'white',background:'linear-gradient(135deg,#1e40af,#3b82f6)',borderRadius:9,textDecoration:'none'}}>
          {isTrial ? 'Activar plan' : 'Cambiar plan'} →
        </Link>
      </div>

      <div style={{maxWidth:720,margin:'0 auto',padding:'28px 24px',display:'flex',flexDirection:'column',gap:14}}>

        {/* Plan + barra de uso */}
        <div style={{background:'white',border:'1px solid #e2e8f0',borderRadius:14,padding:'22px 24px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
            <div>
              <p style={{fontSize:11,fontWeight:600,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4}}>Plan actual</p>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:10,height:10,borderRadius:'50%',background:pd.color}}/>
                <p style={{fontSize:20,fontWeight:700,color:'#0f172a'}}>{pd.label}</p>
                {pd.price > 0 && <p style={{fontSize:14,color:'#64748b'}}>{pd.price}€/mes</p>}
              </div>
            </div>
            {periodStart && <div style={{textAlign:'right'}}><p style={{fontSize:11,color:'#94a3b8'}}>Ciclo desde</p><p style={{fontSize:13,fontWeight:600,color:'#374151'}}>{periodStart}</p></div>}
          </div>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
            <span style={{fontSize:13,color:'#374151'}}>Llamadas usadas</span>
            <span style={{fontSize:13,fontWeight:700,color:pct>=90?'#dc2626':'#0f172a'}}>{used} / {included}</span>
          </div>
          <div style={{height:10,background:'#f1f5f9',borderRadius:5,overflow:'hidden',marginBottom:10}}>
            <div style={{height:'100%',width:pct+'%',background:barColor,borderRadius:5,transition:'width 0.5s'}}/>
          </div>
          <div style={{display:'flex',justifyContent:'space-between'}}>
            <span style={{fontSize:12,color:'#64748b'}}>{remaining} llamadas restantes</span>
            {!isTrial && pd.rate > 0 && <span style={{fontSize:12,color:'#64748b'}}>{pd.rate}€/llamada extra</span>}
          </div>
        </div>

        {/* KPIs */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
          {[
            {label:'Incluidas',value:included,icon:'📋',color:'#1d4ed8'},
            {label:'Usadas',value:used,icon:'📞',color:used>included?'#dc2626':'#059669'},
            {label:'Extra',value:extra,icon:'➕',color:extra>0?'#d97706':'#64748b'},
          ].map(m => (
            <div key={m.label} style={{background:'white',border:'1px solid #e2e8f0',borderRadius:12,padding:'16px 18px'}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                <span style={{fontSize:18}}>{m.icon}</span>
                <p style={{fontSize:11,color:'#94a3b8',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.04em'}}>{m.label}</p>
              </div>
              <p style={{fontSize:28,fontWeight:700,color:m.color,letterSpacing:'-0.025em'}}>{m.value}</p>
            </div>
          ))}
        </div>

        {/* Coste extra — solo planes de pago */}
        {!isTrial && (
          <div style={{background:extra>0?'#fffbeb':'#f0fdf4',border:'1px solid',borderColor:extra>0?'#fbbf24':'#86efac',borderRadius:14,padding:'20px 24px'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div>
                <p style={{fontSize:13,fontWeight:600,color:extra>0?'#92400e':'#166534',marginBottom:4}}>
                  {extra > 0 ? 'Coste adicional estimado este mes' : 'Sin coste adicional este mes'}
                </p>
                {extra > 0 && <p style={{fontSize:12,color:'#b45309'}}>{extra} llamadas extra x {pd.rate}€ = <strong>{extraCost}€</strong></p>}
                {extra === 0 && <p style={{fontSize:12,color:'#166534'}}>Dentro del limite de {included} llamadas incluidas.</p>}
              </div>
              <div style={{fontSize:36,fontWeight:800,color:extra>0?'#d97706':'#059669',letterSpacing:'-0.03em'}}>{extra>0?extraCost+'€':'0€'}</div>
            </div>
            {extra > 0 && (
              <div style={{marginTop:12,padding:'10px 14px',background:'rgba(255,255,255,0.6)',borderRadius:9,fontSize:12,color:'#92400e'}}>
                Este importe se sumara a tu proxima factura. Coste total estimado: <strong>{(pd.price + extraCost).toFixed(2)}€</strong>
              </div>
            )}
          </div>
        )}

        {/* Trial agotado */}
        {isTrial && remaining <= 3 && (
          <div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:14,padding:'20px 24px'}}>
            <p style={{fontSize:14,fontWeight:700,color:'#dc2626',marginBottom:6}}>
              {remaining===0 ? 'Trial agotado — el agente no responde llamadas' : 'Solo quedan ' + remaining + ' llamadas gratuitas'}
            </p>
            <p style={{fontSize:13,color:'#b91c1c',marginBottom:16,lineHeight:1.5}}>
              Activa un plan para que tu recepcionista continue sin interrupciones.
            </p>
            <Link href='/precios' style={{display:'inline-block',padding:'10px 22px',fontSize:13,fontWeight:700,color:'white',background:'#dc2626',borderRadius:9,textDecoration:'none'}}>
              Ver planes y precios →
            </Link>
          </div>
        )}

        {/* Detalles del plan */}
        <div style={{background:'white',border:'1px solid #e2e8f0',borderRadius:14,padding:'18px 24px'}}>
          <p style={{fontSize:13,fontWeight:600,color:'#0f172a',marginBottom:12}}>Detalles del plan</p>
          {[
            {label:'Plan',value:pd.label},
            {label:'Precio base',value:pd.price>0?pd.price+'€/mes':'Gratuito'},
            {label:'Llamadas incluidas',value:included+' /mes'},
            {label:'Precio por llamada extra',value:pd.rate>0?pd.rate+'€':'N/A'},
            {label:'Suscripcion Stripe',value:tenant.stripe_subscription_id?'Activa':'—'},
          ].map(row => (
            <div key={row.label} style={{display:'flex',justifyContent:'space-between',padding:'9px 0',borderBottom:'1px solid #f1f5f9'}}>
              <span style={{fontSize:13,color:'#64748b'}}>{row.label}</span>
              <span style={{fontSize:13,fontWeight:500,color:'#0f172a'}}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}