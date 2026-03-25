'use client'
import NotifBell from '@/components/NotifBell'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { PageLoader } from '@/components/ui'
import { useTenant } from '@/contexts/TenantContext'
import VetClientesView from './VetClientesView'
import FisioClientesView from './FisioClientesView'
import PsicoClientesView from './PsicoClientesView'
import InmoClientesView from './InmoClientesView'
import AsesorClientesView from './AsesorClientesView'
import AcademiaAlumnosView from './AcademiaAlumnosView'
import BarbeClientesView from './BarbeClientesView'
import EcomClientesView from './EcomClientesView'

const C = {
  amber:'#F0A84E',amberDim:'rgba(240,168,78,0.10)',
  green:'#34D399',greenDim:'rgba(52,211,153,0.10)',
  violet:'#A78BFA',violetDim:'rgba(167,139,250,0.12)',
  yellow:'#FBB53F',yellowDim:'rgba(251,181,63,0.10)',
  text:'#E8EEF6',text2:'#8895A7',text3:'#49566A',
  bg:'#0C1018',surface:'#131920',surface2:'#1A2230',surface3:'#202C3E',
  border:'rgba(255,255,255,0.07)',borderMd:'rgba(255,255,255,0.11)',
}

// Router — decide qué vista mostrar según el tipo de negocio
export default function ClientesPage() {
  const { tenant } = useTenant()
  const type = tenant?.type

  if (type === 'veterinaria')  return <VetClientesView />
  if (type === 'fisioterapia') return <FisioClientesView />
  if (type === 'psicologia')   return <PsicoClientesView />
  if (type === 'inmobiliaria') return <InmoClientesView />
  if (type === 'asesoria' || type === 'seguros') return <AsesorClientesView />
  if (type === 'academia')     return <AcademiaAlumnosView />
  if (type === 'barberia')     return <BarbeClientesView />
  if (type === 'ecommerce')    return <EcomClientesView />

  // Vista por defecto: restaurante / hostelería / otros
  return <DefaultClientesView />
}

// Vista por defecto — hostelería y tipos sin vista específica
function DefaultClientesView() {
  const [clientes,setClientes] = useState<any[]>([])
  const [loading,setLoading]   = useState(true)
  const [search,setSearch]     = useState('')
  const [selected,setSelected] = useState<any|null>(null)
  const [historial,setHistorial] = useState<any[]>([])
  const [loadingH,setLoadingH] = useState(false)
  const { template } = useTenant()

  const L = template?.labels
  const clientesLabel = L?.clientes || 'Clientes'

  const load = useCallback(async (tenantId:string) => {
    const {data} = await supabase.from('customers').select('*')
      .eq('tenant_id',tenantId).order('created_at',{ascending:false})
    setClientes(data||[])
    setLoading(false)
  },[])

  useEffect(()=>{
    ;(async()=>{
      const {data:{user}} = await supabase.auth.getUser()
      if (!user) return
      const {data:p} = await supabase.from('profiles').select('tenant_id').eq('id',user.id).maybeSingle()
      if (!p?.tenant_id) return
      await load(p.tenant_id)
    })()
  },[load])

  async function openClient(c:any) {
    setSelected(c); setLoadingH(true); setHistorial([])
    const [resR, callR] = await Promise.all([
      supabase.from('reservations').select('*').eq('tenant_id',c.tenant_id).eq('customer_id',c.id).order('date',{ascending:false}).limit(10),
      supabase.from('calls').select('*').eq('tenant_id',c.tenant_id).eq('caller_phone',c.phone).order('started_at',{ascending:false}).limit(5),
    ])
    setHistorial([
      ...(resR.data||[]).map(r=>({...r,_type:'reserva'})),
      ...(callR.data||[]).map(c=>({...c,_type:'llamada'})),
    ].sort((a,b)=>{
      const da = a.date||a.reservation_date||a.started_at||''
      const db = b.date||b.reservation_date||b.started_at||''
      return db.localeCompare(da)
    }))
    setLoadingH(false)
  }

  if (loading) return <PageLoader/>

  const filtered = search
    ? clientes.filter(c => (c.name||'').toLowerCase().includes(search.toLowerCase()) || (c.phone||'').includes(search) || (c.email||'').includes(search))
    : clientes

  return (
    <div style={{background:C.bg,minHeight:'100vh',display:'flex',flexDirection:'column'}}>
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:'14px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,position:'sticky',top:0,zIndex:20}}>
        <div>
          <h1 style={{fontSize:16,fontWeight:700,color:C.text,letterSpacing:'-0.02em'}}>{clientesLabel}</h1>
          <p style={{fontSize:11,color:C.text3,marginTop:2}}>{clientes.length} registrados</p>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={'Buscar '+clientesLabel.toLowerCase()+'…'}
            style={{padding:'8px 14px',fontSize:13,border:`1px solid ${C.borderMd}`,borderRadius:9,outline:'none',width:220,background:C.surface2,color:C.text,fontFamily:'inherit'}}/>
          <NotifBell/>
        </div>
      </div>

      <div style={{display:'flex',flex:1,overflow:'hidden'}}>
        <div style={{width:320,flexShrink:0,overflowY:'auto',borderRight:`1px solid ${C.border}`,background:C.surface}}>
          {filtered.length===0 ? (
            <div style={{padding:'60px 24px',textAlign:'center'}}>
              <div style={{fontSize:36,marginBottom:10}}>👥</div>
              <p style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:4}}>Sin clientes</p>
              <p style={{fontSize:13,color:C.text3}}>{clientesLabel} que contacten al agente aparecerán aquí.</p>
            </div>
          ) : filtered.map(c => (
            <div key={c.id} onClick={()=>openClient(c)} style={{padding:'12px 16px',cursor:'pointer',borderBottom:`1px solid ${C.border}`,background:selected?.id===c.id?C.surface2:'transparent',transition:'background 0.1s'}}
              onMouseEnter={e=>{if(selected?.id!==c.id)(e.currentTarget as HTMLElement).style.background=C.surface2}}
              onMouseLeave={e=>{if(selected?.id!==c.id)(e.currentTarget as HTMLElement).style.background='transparent'}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:36,height:36,borderRadius:'50%',background:c.vip?C.yellowDim:C.amberDim,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:c.vip?C.yellow:C.amber,flexShrink:0}}>
                  {c.name?.[0]?.toUpperCase()||'?'}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <p style={{fontSize:13,fontWeight:600,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.name}</p>
                    {c.vip&&<span style={{fontSize:9,fontWeight:700,color:C.yellow,background:C.yellowDim,padding:'1px 5px',borderRadius:4}}>VIP</span>}
                  </div>
                  <p style={{fontSize:11,color:C.text3,marginTop:1}}>{c.phone||c.email||'Sin contacto'}</p>
                </div>
                <div style={{textAlign:'right' as const,flexShrink:0}}>
                  <p style={{fontFamily:'var(--rz-mono)',fontSize:11,fontWeight:600,color:C.text2}}>{c.total_reservations||c.total_visits||0}</p>
                  {c.last_visit&&<p style={{fontSize:10,color:C.text3,marginTop:1}}>{new Date(c.last_visit).toLocaleDateString('es-ES',{day:'numeric',month:'short'})}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{flex:1,overflowY:'auto',padding:24,background:C.bg}}>
          {!selected ? (
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',color:C.text3}}>
              <div style={{width:64,height:64,borderRadius:'50%',background:C.amberDim,display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,marginBottom:14}}>👤</div>
              <p style={{fontSize:14,color:C.text3}}>Selecciona un cliente para ver su historial</p>
            </div>
          ) : (
            <>
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:20,marginBottom:16}}>
                <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:16}}>
                  <div style={{width:50,height:50,borderRadius:'50%',background:selected.vip?C.yellowDim:C.amberDim,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:700,color:selected.vip?C.yellow:C.amber}}>
                    {selected.name?.[0]?.toUpperCase()||'?'}
                  </div>
                  <div>
                    <p style={{fontSize:17,fontWeight:700,color:C.text}}>{selected.name}</p>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginTop:1}}>
                      <p style={{fontSize:13,color:C.text2}}>{selected.phone}{selected.email?' · '+selected.email:''}</p>
                      {selected.phone && (
                        <button onClick={async () => {
                          const sess = await supabase.auth.getSession()
                          if (!sess.data.session) return
                          await fetch('/api/voice/outbound', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sess.data.session.access_token },
                            body: JSON.stringify({ phone_number: selected.phone, reason: 'callback', customer_name: selected.name })
                          })
                        }}
                        style={{fontSize:11, padding:'3px 10px', borderRadius:7, border:`1px solid rgba(45,212,191,0.25)`, background:'rgba(45,212,191,0.10)', color:'#2DD4BF', cursor:'pointer', fontFamily:'inherit', fontWeight:500, flexShrink:0}}>
                          📞 Llamar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
                  {[
                    {label:'Visitas',value:selected.total_reservations||selected.total_visits||0},
                    {label:'Última visita',value:selected.last_visit?new Date(selected.last_visit).toLocaleDateString('es-ES',{day:'numeric',month:'short'}):'—'},
                    {label:'Total gastado',value:selected.total_spent?selected.total_spent+'€':'—'},
                  ].map(m=>(
                    <div key={m.label} style={{background:C.surface2,borderRadius:9,padding:'10px 14px'}}>
                      <p style={{fontSize:10,color:C.text3,fontWeight:600,textTransform:'uppercase' as const,letterSpacing:'0.06em',marginBottom:3}}>{m.label}</p>
                      <p style={{fontFamily:'var(--rz-mono)',fontSize:18,fontWeight:700,color:C.text}}>{m.value}</p>
                    </div>
                  ))}
                </div>
                {selected.notes&&<p style={{marginTop:12,fontSize:13,color:C.text2,background:C.surface2,padding:'8px 12px',borderRadius:9}}>📝 {selected.notes}</p>}
              </div>
              <p style={{fontSize:10,fontWeight:700,color:C.text3,textTransform:'uppercase' as const,letterSpacing:'0.08em',marginBottom:10}}>Historial</p>
              {loadingH ? <div style={{textAlign:'center' as const,padding:20,color:C.text3}}>Cargando...</div>
              : historial.length===0 ? <p style={{fontSize:13,color:C.text3,padding:'20px 0'}}>Sin actividad registrada.</p>
              : historial.map((h,i)=>(
                <div key={i} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:'12px 14px',marginBottom:8,display:'flex',gap:10,transition:'background 0.12s'}}
                  onMouseEnter={e=>(e.currentTarget.style.background=C.surface2)}
                  onMouseLeave={e=>(e.currentTarget.style.background=C.surface)}>
                  <span style={{fontSize:16}}>{h._type==='reserva'?'📅':'📞'}</span>
                  <div style={{flex:1}}>
                    {h._type==='reserva' ? (
                      <>
                        <p style={{fontSize:13,fontWeight:500,color:C.text}}>{(h.date||h.reservation_date)?.slice(0,10)} a las {(h.time||h.reservation_time||'').slice(0,5)}</p>
                        <p style={{fontSize:11,color:C.text3,marginTop:1}}>{h.status}</p>
                      </>
                    ) : (
                      <>
                        <p style={{fontSize:13,fontWeight:500,color:C.text}}>{h.summary||'Llamada'}</p>
                        <p style={{fontSize:11,color:C.text3,marginTop:1}}>{(h.started_at||'').slice(0,10)}</p>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
