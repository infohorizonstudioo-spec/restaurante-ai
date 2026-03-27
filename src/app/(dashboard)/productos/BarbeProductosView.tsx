'use client'
import { useState } from 'react'
import NotifBell from '@/components/NotifBell'
import { useTenant } from '@/contexts/TenantContext'

import { C } from "@/lib/colors"

type Category = 'Corte' | 'Barba' | 'Combo' | 'Tratamiento'

interface Service {
  id: string
  name: string
  category: Category
  price: number
  duration: number
  description?: string
}

const CATEGORY_STYLES: Record<Category,{color:string;bg:string;icon:string}> = {
  Corte:       {color:C.amber, bg:C.amberDim, icon:'✂️'},
  Barba:       {color:C.teal,  bg:C.tealDim,  icon:'🪒'},
  Combo:       {color:C.yellow,bg:C.yellowDim, icon:'⚡'},
  Tratamiento: {color:C.violet,bg:C.violetDim, icon:'💈'},
}

const MOCK_SERVICES: Service[] = [
  {id:'1', name:'Corte clásico',      category:'Corte',       price:15, duration:30, description:'Corte con tijera o máquina'},
  {id:'2', name:'Corte degradado',     category:'Corte',       price:17, duration:35, description:'Fade / degradado con diseño'},
  {id:'3', name:'Corte + lavado',      category:'Corte',       price:18, duration:35},
  {id:'4', name:'Arreglo de barba',    category:'Barba',       price:12, duration:20, description:'Perfilado y recorte de barba'},
  {id:'5', name:'Afeitado clásico',    category:'Barba',       price:14, duration:25, description:'Afeitado con navaja y toalla caliente'},
  {id:'6', name:'Diseño de barba',     category:'Barba',       price:15, duration:25, description:'Diseño personalizado de barba'},
  {id:'7', name:'Combo corte + barba', category:'Combo',       price:22, duration:45, description:'Corte completo + arreglo de barba'},
  {id:'8', name:'Combo premium',       category:'Combo',       price:30, duration:60, description:'Corte + barba + lavado + tratamiento'},
  {id:'9', name:'Tinte barba',         category:'Tratamiento', price:12, duration:20, description:'Coloración de barba'},
  {id:'10',name:'Tratamiento capilar', category:'Tratamiento', price:20, duration:30, description:'Hidratación y nutrición capilar'},
  {id:'11',name:'Black mask',          category:'Tratamiento', price:10, duration:15, description:'Limpieza facial con mascarilla'},
]

const CATEGORIES: Category[] = ['Corte','Barba','Combo','Tratamiento']

export default function BarbeProductosView() {
  const { tenant } = useTenant()
  const [filter, setFilter] = useState<'all'|Category>('all')

  if (tenant?.type !== 'barberia') return null

  const filtered = filter === 'all' ? MOCK_SERVICES : MOCK_SERVICES.filter(s => s.category === filter)
  const grouped = CATEGORIES.reduce((acc, cat) => {
    const items = filtered.filter(s => s.category === cat)
    if (items.length > 0) acc[cat] = items
    return acc
  }, {} as Record<Category, Service[]>)

  return (
    <div style={{background:C.bg,minHeight:'100vh'}}>
      {/* Header */}
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:'14px 24px',position:'sticky',top:0,zIndex:30,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <h1 style={{fontSize:17,fontWeight:700,color:C.text}}>Servicios y tarifas</h1>
          <p style={{fontSize:12,color:C.text3,marginTop:2}}>{MOCK_SERVICES.length} servicios disponibles</p>
        </div>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <button style={{background:`linear-gradient(135deg,${C.amber},#E8923A)`,color:'#0C1018',fontWeight:700,fontSize:13,padding:'9px 18px',border:'none',borderRadius:10,cursor:'pointer',fontFamily:'inherit'}}>+ Servicio</button>
          <NotifBell/>
        </div>
      </div>

      <div style={{maxWidth:900,margin:'0 auto',padding:'20px 24px'}}>
        {/* KPIs */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:10,marginBottom:20}}>
          {CATEGORIES.map(cat=>{
            const cs = CATEGORY_STYLES[cat]
            const count = MOCK_SERVICES.filter(s=>s.category===cat).length
            return (
              <div key={cat} style={{background:cs.bg,border:`1px solid ${cs.color}22`,borderRadius:12,padding:'14px 16px'}}>
                <p style={{fontSize:22,fontWeight:800,color:cs.color,lineHeight:1}}>{count}</p>
                <p style={{fontSize:11,color:C.text3,marginTop:4}}>{cs.icon} {cat}</p>
              </div>
            )
          })}
        </div>

        {/* Filtros */}
        <div style={{display:'flex',gap:6,marginBottom:16,flexWrap:'wrap'}}>
          <button onClick={()=>setFilter('all')} style={{
            padding:'5px 14px',fontSize:12,fontWeight:600,borderRadius:9,
            border:`1px solid ${filter==='all'?C.amber+'44':C.border}`,
            background:filter==='all'?C.amberDim:'transparent',
            color:filter==='all'?C.amber:C.text2,cursor:'pointer',fontFamily:'inherit'
          }}>Todos</button>
          {CATEGORIES.map(cat=>{
            const cs = CATEGORY_STYLES[cat]
            return (
              <button key={cat} onClick={()=>setFilter(cat)} style={{
                padding:'5px 14px',fontSize:12,fontWeight:600,borderRadius:9,
                border:`1px solid ${filter===cat?cs.color+'44':C.border}`,
                background:filter===cat?cs.bg:'transparent',
                color:filter===cat?cs.color:C.text2,cursor:'pointer',fontFamily:'inherit'
              }}>{cs.icon} {cat}</button>
            )
          })}
        </div>

        {/* Lista por categoría */}
        {Object.entries(grouped).map(([cat, items])=>{
          const cs = CATEGORY_STYLES[cat as Category]
          return (
            <div key={cat} style={{marginBottom:20}}>
              <p style={{fontSize:11,fontWeight:700,color:C.text3,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:10}}>{cs.icon} {cat}</p>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {items.map(item=>(
                  <div key={item.id} style={{
                    background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:'12px 16px',
                    display:'flex',alignItems:'center',gap:14,transition:'all 0.12s'
                  }}
                    onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.surface2;(e.currentTarget as HTMLElement).style.borderColor=C.borderMd}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=C.surface;(e.currentTarget as HTMLElement).style.borderColor=C.border}}>
                    <div style={{width:36,height:36,borderRadius:10,background:cs.bg,border:`1px solid ${cs.color}33`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>
                      {cs.icon}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{fontSize:14,fontWeight:700,color:C.text}}>{item.name}</p>
                      {item.description && <p style={{fontSize:12,color:C.text3,marginTop:2}}>{item.description}</p>}
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
                      <span style={{fontSize:11,color:C.text3}}>{item.duration} min</span>
                      <span style={{fontSize:14,fontWeight:800,color:C.amber}}>{item.price}€</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
