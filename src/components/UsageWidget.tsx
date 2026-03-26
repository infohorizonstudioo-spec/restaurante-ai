'use client'

import { C } from '@/lib/colors'

interface Props { tenant: any; compact?: boolean }

export default function UsageWidget({ tenant, compact = false }: Props) {
  const isTrial = !tenant.plan || tenant.plan === 'trial' || tenant.plan === 'free'

  if (isTrial) {
    const used = tenant.free_calls_used || 0
    const total = tenant.free_calls_limit || 10
    const left = Math.max(0, total - used)
    const pct = Math.min(100, (used / total) * 100)
    const isLow = left <= 3
    const isDepleted = left === 0

    const borderColor = isDepleted ? 'rgba(248,113,113,0.25)' : isLow ? 'rgba(240,168,78,0.25)' : C.border
    const bgColor = isDepleted ? C.redDim : isLow ? C.amberDim : C.surface

    return (
      <div style={{
        padding: compact ? 12 : 20, borderRadius: 14,
        border: `1px solid ${borderColor}`, background: bgColor,
      }}>
        {!compact && (
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <p style={{fontWeight:600,fontSize:13,color:C.text}}>Prueba gratuita</p>
            <a href="/precios" style={{fontSize:11,color:C.amber,fontWeight:600,textDecoration:'none'}}>Ver planes</a>
          </div>
        )}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
          <span style={{fontSize:12,color: isLow ? C.amber : C.sub,fontWeight: isLow ? 500 : 400}}>Llamadas gratuitas</span>
          <span style={{fontWeight:700,fontSize:13,color: isDepleted ? C.red : isLow ? C.amber : C.text}}>{left} / {total}</span>
        </div>
        <div style={{background:'rgba(255,255,255,0.06)',borderRadius:20,height:6,overflow:'hidden'}}>
          <div style={{
            height:'100%', borderRadius:20, transition:'width 0.4s ease',
            width:`${pct}%`,
            background: isDepleted ? C.red : isLow ? C.amber : C.green,
          }}/>
        </div>
        {isDepleted && !compact && (
          <div style={{marginTop:12}}>
            <p style={{color:C.red,fontSize:12,fontWeight:600,marginBottom:8}}>Prueba agotada</p>
            <a href="/precios" style={{
              display:'block',textAlign:'center',fontSize:13,fontWeight:700,
              padding:'9px 16px', borderRadius:10, textDecoration:'none',
              background:`linear-gradient(135deg,${C.amber},#E8923A)`,
              color:C.bg,
            }}>Activar plan →</a>
          </div>
        )}
        {isLow && !isDepleted && !compact && (
          <p style={{color:C.amber,fontSize:11,marginTop:8,fontWeight:500}}>
            Cerca del límite. <a href="/precios" style={{color:C.amber,textDecoration:'underline'}}>Elige un plan</a>
          </p>
        )}
      </div>
    )
  }

  // Paid plan
  const included = tenant.plan_calls_included || 50
  const used = tenant.plan_calls_used || 0
  const left = Math.max(0, included - used)
  const extra = Math.max(0, used - included)
  const extraCost = extra * (tenant.plan_extra_rate || 0.90)
  const pct = Math.min(100, (used / included) * 100)
  const isNear = pct >= 80
  const isOver = extra > 0

  const borderColor = isOver ? 'rgba(251,146,60,0.25)' : isNear ? 'rgba(240,168,78,0.25)' : C.border
  const bgColor = isOver ? C.orangeDim : isNear ? C.amberDim : C.surface

  return (
    <div style={{
      padding: compact ? 12 : 20, borderRadius: 14,
      border: `1px solid ${borderColor}`, background: bgColor,
    }}>
      {!compact && (
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <p style={{fontWeight:600,fontSize:13,color:C.text}}>Uso mensual</p>
          <a href="/precios" style={{fontSize:11,color:C.amber,fontWeight:600,textDecoration:'none'}}>Cambiar plan</a>
        </div>
      )}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
        <span style={{fontSize:12,color:C.sub}}>Llamadas usadas</span>
        <span style={{fontWeight:700,fontSize:13,color:C.text}}>{used} / {included}</span>
      </div>
      <div style={{background:'rgba(255,255,255,0.06)',borderRadius:20,height:6,overflow:'hidden',marginBottom:12}}>
        <div style={{
          height:'100%', borderRadius:20, transition:'width 0.4s ease',
          width:`${Math.min(100,pct)}%`,
          background: isOver ? C.orange : isNear ? C.amber : C.green,
        }}/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
        <div style={{background:'rgba(255,255,255,0.04)',borderRadius:10,padding:'8px 10px',textAlign:'center'}}>
          <p style={{color:C.muted,fontSize:10,marginBottom:2}}>Restantes</p>
          <p style={{fontWeight:700,fontSize:14,color: isNear ? C.amber : C.text}}>{left}</p>
        </div>
        <div style={{background: isOver ? C.orangeDim : 'rgba(255,255,255,0.04)',borderRadius:10,padding:'8px 10px',textAlign:'center'}}>
          <p style={{color:C.muted,fontSize:10,marginBottom:2}}>Coste extra</p>
          <p style={{fontWeight:700,fontSize:14,color: isOver ? C.orange : C.muted}}>{extraCost > 0 ? `+${extraCost.toFixed(2)}€` : '0€'}</p>
        </div>
      </div>
      {isNear && !isOver && !compact && (
        <p style={{color:C.amber,fontSize:11,marginTop:8,fontWeight:500}}>
          Al {Math.round(pct)}% del límite. <a href="/precios" style={{color:C.amber,textDecoration:'underline'}}>Sube de plan</a>
        </p>
      )}
      {isOver && !compact && (
        <p style={{color:C.orange,fontSize:11,marginTop:8,fontWeight:500}}>
          {extra} llamadas extra: +{extraCost.toFixed(2)}€
        </p>
      )}
    </div>
  )
}
