'use client'
import NotifBell from '@/components/NotifBell'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getSessionTenant } from '@/lib/session-cache'
import { PageLoader } from '@/components/ui'
import { useTenant } from '@/contexts/TenantContext'
import Link from 'next/link'

const TIPOS = ['todos','local','delivery','takeaway'] as const
const ESTADOS = ['nuevo','preparacion','listo','reparto','entregado'] as const
const ESTADO_COL:Record<string,{bg:string;color:string;label:string}> = {
  nuevo:       {bg:'#eff6ff',color:'#F0A84E',label:'Nuevo'},
  preparacion: {bg:'#fffbeb',color:'#FBB53F',label:'Preparando'},
  listo:       {bg:'#f0fdf4',color:'#34D399',label:'Listo'},
  reparto:     {bg:'#f5f3ff',color:'#A78BFA',label:'En reparto'},
  entregado:   {bg:'#f1f5f9',color:'#8895A7',label:'Entregado'},
}

export default function PedidosPage(){
  const [plan,setPlan]       = useState<string>('free')
  const [loading,setLoading] = useState(true)
  const [orders,setOrders]   = useState<any[]>([])
  const [tid,setTid]         = useState<string|null>(null)
  const [tipo,setTipo]       = useState<string>('todos')
  const [modal,setModal]     = useState<any|null>(null)
  const { template } = useTenant()

  const load = useCallback(async(tenantId:string)=>{
    const r = await fetch('/api/orders?tenant_id='+tenantId+'&limit=100')
    const d = await r.json()
    setOrders(d.orders||[])
  },[])

  useEffect(()=>{
    (async()=>{
      const {data:{user}} = await supabase.auth.getUser(); if(!user) return
      const {data:p} = await supabase.from('profiles').select('tenant_id').eq('id',user.id).maybeSingle(); if(!p?.tenant_id) return
      const {data:t} = await supabase.from('tenants').select('plan').eq('id',p.tenant_id).maybeSingle()
      setPlan(t?.plan||'free')
      setTid(p.tenant_id)
      await load(p.tenant_id)
      setLoading(false)
    })()
  },[load])

  useEffect(()=>{
    if(!tid) return
    const ch = supabase.channel('orders-rt')
      .on('postgres_changes',{event:'*',schema:'public',table:'orders',filter:'tenant_id=eq.'+tid},()=>load(tid))
      .subscribe()
    return ()=>{ supabase.removeChannel(ch) }
  },[tid,load])

  if(loading) return <PageLoader/>

  // GUARDIA: pedidos solo disponible para hostelería
  if(template && !template.hasOrders){
    return(
      <div style={{background:'#0C1018',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
        <div style={{textAlign:'center',maxWidth:400}}>
          <div style={{fontSize:48,marginBottom:16}}>🚫</div>
          <h2 style={{fontSize:20,fontWeight:700,color:'#E8EEF6',marginBottom:8}}>Módulo no disponible</h2>
          <p style={{fontSize:14,color:'#8895A7',lineHeight:1.6,marginBottom:24}}>
            El módulo de pedidos no aplica para <strong>{template.label}</strong>.<br/>
            Este módulo está diseñado para negocios de hostelería.
          </p>
          <Link href="/panel" style={{padding:'10px 24px',fontSize:14,fontWeight:600,color:'white',background:'linear-gradient(135deg,#F0A84E,#E8923A)',borderRadius:9,textDecoration:'none'}}>
            Volver al panel
          </Link>
        </div>
      </div>
    )
  }

  const isPro = plan==='pro'||plan==='business'||plan==='enterprise'

  if(!isPro) return (
    <div style={{background:'#0C1018',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
      <div style={{maxWidth:440,textAlign:'center'}}>
        <div style={{width:64,height:64,borderRadius:16,background:'linear-gradient(135deg,#7c3aed,#a78bfa)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px',boxShadow:'0 8px 24px rgba(124,58,237,0.25)'}}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
        </div>
        <h2 style={{fontSize:22,fontWeight:700,color:'#E8EEF6',marginBottom:10}}>Gestión de pedidos</h2>
        <p style={{fontSize:14,color:'#8895A7',lineHeight:1.6,marginBottom:24}}>Gestiona pedidos locales, para llevar y delivery desde tu panel. Disponible en el plan Pro y Business.</p>
        <Link href="/precios" style={{display:'inline-block',padding:'12px 28px',fontSize:14,fontWeight:600,color:'white',background:'linear-gradient(135deg,#7c3aed,#a78bfa)',borderRadius:10,textDecoration:'none',boxShadow:'0 4px 16px rgba(124,58,237,0.3)'}}>
          Ver planes →
        </Link>
      </div>
    </div>
  )

  const filtered = tipo==='todos' ? orders : orders.filter(o=>o.type===tipo)
  const activos  = orders.filter(o=>!['entregado','cancelado'].includes(o.status))

  async function cambiarEstado(id:string, status:string) {
    await fetch('/api/orders', {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ id, tenant_id: tid, status })
    })
    setModal(null)
    if(tid) load(tid)
  }

  async function nuevoOrder() {
    if(!tid) return
    const r = await fetch('/api/orders', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ tenant_id: tid, customer_name: 'Nuevo pedido', type: 'local' })
    })
    const d = await r.json()
    if(d.order) setModal(d.order)
    if(tid) load(tid)
  }

  return (
    <div style={{background:'#0C1018',minHeight:'100vh'}}>
      <div style={{background:'#131920',borderBottom:'1px solid rgba(255,255,255,0.07)',padding:'14px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:20}}>
        <div>
          <h1 style={{fontSize:18,fontWeight:700,color:'#E8EEF6'}}>Pedidos</h1>
          <p style={{fontSize:12,color:'#49566A',marginTop:1}}>{activos.length} activos · {orders.length} total</p>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
        <button onClick={nuevoOrder} style={{padding:'8px 18px',fontSize:13,fontWeight:600,color:'white',background:'linear-gradient(135deg,#F0A84E,#E8923A)',border:'none',borderRadius:9,cursor:'pointer'}}>
          + Nuevo pedido
        </button>
          <NotifBell/>
        </div>
      </div>

      {/* Filtros tipo */}
      <div style={{background:'#131920',borderBottom:'1px solid rgba(255,255,255,0.07)',padding:'0 24px',display:'flex',gap:0}}>
        {TIPOS.map(t=>(
          <button key={t} onClick={()=>setTipo(t)} style={{padding:'10px 16px',fontSize:13,background:'none',border:'none',cursor:'pointer',borderBottom:tipo===t?'2px solid #1d4ed8':'2px solid transparent',color:tipo===t?'#1d4ed8':'#64748b',fontWeight:tipo===t?600:400,fontFamily:'inherit',textTransform:'capitalize'}}>
            {t==='todos'?'Todos ('+orders.length+')':t+' ('+orders.filter(o=>o.type===t).length+')'}
          </button>
        ))}
      </div>

      <div style={{maxWidth:900,margin:'0 auto',padding:'20px 24px'}}>
        {/* Activos por estado */}
        {activos.length>0&&(
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:10,marginBottom:20}}>
            {(['nuevo','preparacion','listo','reparto'] as const).map(s=>{
              const cnt = orders.filter(o=>o.status===s).length
              const ss  = ESTADO_COL[s]
              return (
                <div key={s} style={{background:ss.bg,border:'1px solid '+ss.color+'33',borderRadius:12,padding:'12px 16px'}}>
                  <p style={{fontSize:22,fontWeight:700,color:ss.color}}>{cnt}</p>
                  <p style={{fontSize:12,color:ss.color,fontWeight:600}}>{ss.label}</p>
                </div>
              )
            })}
          </div>
        )}

        {filtered.length===0 ? (
          <div style={{background:'#131920',border:'1px solid rgba(255,255,255,0.07)',borderRadius:14,padding:'60px 24px',textAlign:'center'}}>
            <div style={{fontSize:40,marginBottom:10}}>🛍️</div>
            <p style={{fontSize:15,fontWeight:600,color:'#C4CDD8',marginBottom:4}}>Sin pedidos</p>
            <p style={{fontSize:13,color:'#49566A'}}>Los pedidos aparecerán aquí en tiempo real.</p>
          </div>
        ) : filtered.map((o,i)=>{
          const ss = ESTADO_COL[o.status]||ESTADO_COL.nuevo
          const items = Array.isArray(o.items)?o.items:[]
          return (
            <div key={o.id} onClick={()=>setModal(o)} style={{background:'#131920',border:'1px solid rgba(255,255,255,0.07)',borderRadius:12,padding:'14px 16px',marginBottom:10,cursor:'pointer',display:'flex',gap:12,alignItems:'flex-start',transition:'all 0.1s',boxShadow:'none'}}
              onMouseEnter={e=>(e.currentTarget as HTMLElement).style.boxShadow='0 4px 12px rgba(0,0,0,0.08)'}
              onMouseLeave={e=>(e.currentTarget as HTMLElement).style.boxShadow='0 1px 3px rgba(0,0,0,0.04)'}>
              <div style={{width:36,height:36,borderRadius:10,background:ss.bg,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:14}}>
                {o.type==='delivery'?'🛵':o.type==='takeaway'?'🥡':'🍽️'}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:2}}>
                  <p style={{fontSize:14,fontWeight:600,color:'#E8EEF6'}}>{o.customer_name}</p>
                  <span style={{fontSize:10,padding:'2px 7px',borderRadius:6,background:ss.bg,color:ss.color,fontWeight:700,flexShrink:0}}>{ss.label}</span>
                  <span style={{fontSize:10,color:'#49566A',textTransform:'capitalize'}}>{o.type}</span>
                </div>
                {items.length>0&&<p style={{fontSize:12,color:'#8895A7',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{items.map((it:any)=>(it.name||it.toString())).join(', ')}</p>}
                {o.notes&&<p style={{fontSize:11,color:'#49566A',marginTop:2,fontStyle:'italic'}}>{o.notes.slice(0,60)}</p>}
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                {o.total>0&&<p style={{fontSize:14,fontWeight:700,color:'#E8EEF6'}}>{o.total}€</p>}
                <p style={{fontSize:11,color:'#49566A',marginTop:2}}>{new Date(o.created_at).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal */}
      {modal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}} onClick={()=>setModal(null)}>
          <div style={{background:'#131920',borderRadius:16,padding:24,width:'100%',maxWidth:440,boxShadow:'0 20px 60px rgba(0,0,0,0.7)'}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}>
              <p style={{fontSize:17,fontWeight:700,color:'#E8EEF6'}}>{modal.customer_name}</p>
              <button onClick={()=>setModal(null)} style={{background:'none',border:'none',fontSize:22,cursor:'pointer',color:'#49566A'}}>×</button>
            </div>
            {modal.customer_phone&&<p style={{fontSize:13,color:'#C4CDD8',marginBottom:6}}>📞 {modal.customer_phone}</p>}
            {modal.customer_address&&<p style={{fontSize:13,color:'#C4CDD8',marginBottom:6}}>📍 {modal.customer_address}</p>}
            {modal.notes&&<p style={{fontSize:13,color:'#C4CDD8',marginBottom:12}}>📝 {modal.notes}</p>}
            <div style={{marginBottom:16}}>
              <p style={{fontSize:11,fontWeight:700,color:'#49566A',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:8}}>Cambiar estado</p>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {ESTADOS.map(s=>{
                  const ss=ESTADO_COL[s]; if(!ss) return null
                  return(
                    <button key={s} onClick={()=>cambiarEstado(modal.id,s)} style={{padding:'6px 12px',fontSize:12,fontWeight:600,borderRadius:8,border:'1px solid',borderColor:ss.color+'44',background:modal.status===s?ss.bg:'white',color:ss.color,cursor:'pointer',fontFamily:'inherit'}}>
                      {ss.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}