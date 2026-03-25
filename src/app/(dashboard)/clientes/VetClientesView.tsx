'use client'
import NotifBell from '@/components/NotifBell'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { PageLoader } from '@/components/ui'
import { useTenant } from '@/contexts/TenantContext'
import { getCommonStrings } from '@/lib/i18n'

const C = {
  amber:'#F0A84E',amberDim:'rgba(240,168,78,0.10)',
  teal:'#2DD4BF',tealDim:'rgba(45,212,191,0.10)',
  green:'#34D399',greenDim:'rgba(52,211,153,0.10)',
  red:'#F87171',redDim:'rgba(248,113,113,0.10)',
  yellow:'#FBB53F',yellowDim:'rgba(251,181,63,0.10)',
  violet:'#A78BFA',violetDim:'rgba(167,139,250,0.12)',
  text:'#E8EEF6',text2:'#8895A7',text3:'#49566A',
  bg:'#0C1018',surface:'#131920',surface2:'#1A2230',surface3:'#202C3E',
  border:'rgba(255,255,255,0.07)',borderMd:'rgba(255,255,255,0.11)',
}

const SPECIES_ICON: Record<string,string> = {
  perro:'🐕', gato:'🐈', conejo:'🐇', ave:'🐦', pez:'🐠', reptil:'🦎',
}

function getSpeciesIcon(text: string): string {
  const lower = text.toLowerCase()
  for (const [k,v] of Object.entries(SPECIES_ICON)) {
    if (lower.includes(k)) return v
  }
  return '🐾'
}

export default function VetClientesView() {
  const [clientes,setClientes]   = useState<any[]>([])
  const [loading,setLoading]     = useState(true)
  const [search,setSearch]       = useState('')
  const [selected,setSelected]   = useState<any|null>(null)
  const [historial,setHistorial] = useState<any[]>([])
  const [loadingH,setLoadingH]   = useState(false)
  const [tid,setTid]             = useState<string|null>(null)
  const { template } = useTenant()
  const L = template?.labels
  const cs = getCommonStrings('es')

  const load = useCallback(async (tenantId:string) => {
    const {data} = await supabase.from('customers').select('*')
      .eq('tenant_id',tenantId).order('created_at',{ascending:false})
    setClientes(data||[])
    setLoading(false)
  },[])

  useEffect(()=>{
    (async()=>{
      const {data:{user}} = await supabase.auth.getUser()
      if (!user) return
      const {data:p} = await supabase.from('profiles').select('tenant_id').eq('id',user.id).maybeSingle()
      if (!p?.tenant_id) return
      setTid(p.tenant_id); await load(p.tenant_id)
    })()
  },[load])

  async function openClient(c:any) {
    setSelected(c); setLoadingH(true); setHistorial([])
    const [resR, callR] = await Promise.all([
      supabase.from('reservations').select('*').eq('tenant_id',c.tenant_id).eq('customer_id',c.id).order('date',{ascending:false}).limit(20),
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

  // Group pets by owner — pets info from reservations notes/pet_name fields
  const filtered = search
    ? clientes.filter(c => (c.name||'').toLowerCase().includes(search.toLowerCase()) || (c.phone||'').includes(search) || (c.email||'').includes(search))
    : clientes

  return (
    <div style={{background:C.bg,minHeight:'100vh',display:'flex',flexDirection:'column'}}>
      {/* Header */}
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:'14px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,position:'sticky',top:0,zIndex:20}}>
        <div>
          <h1 style={{fontSize:16,fontWeight:700,color:C.text,letterSpacing:'-0.02em'}}>🐾 {L?.clientes||'Clientes'}</h1>
          <p style={{fontSize:11,color:C.text3,marginTop:2}}>{clientes.length} dueños registrados</p>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder='Buscar dueño o teléfono…'
            style={{padding:'8px 14px',fontSize:13,border:`1px solid ${C.borderMd}`,borderRadius:9,outline:'none',width:220,background:C.surface2,color:C.text,fontFamily:'inherit'}}/>
          <NotifBell/>
        </div>
      </div>

      <div style={{display:'flex',flex:1,overflow:'hidden'}}>
        {/* Client list */}
        <div style={{width:320,flexShrink:0,overflowY:'auto',borderRight:`1px solid ${C.border}`,background:C.surface}}>
          {filtered.length===0 ? (
            <div style={{padding:'60px 24px',textAlign:'center'}}>
              <div style={{fontSize:36,marginBottom:10}}>🐾</div>
              <p style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:4}}>{cs.noClients}</p>
              <p style={{fontSize:13,color:C.text3}}>Los dueños que contacten al agente aparecerán aquí.</p>
            </div>
          ) : filtered.map(c => (
            <div key={c.id} onClick={()=>openClient(c)} style={{padding:'12px 16px',cursor:'pointer',borderBottom:`1px solid ${C.border}`,
              background:selected?.id===c.id?C.surface2:'transparent',transition:'background 0.1s'}}
              onMouseEnter={e=>{if(selected?.id!==c.id)(e.currentTarget as HTMLElement).style.background=C.surface2}}
              onMouseLeave={e=>{if(selected?.id!==c.id)(e.currentTarget as HTMLElement).style.background='transparent'}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:36,height:36,borderRadius:'50%',background:c.vip?C.yellowDim:C.tealDim,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:c.vip?C.yellow:C.teal,flexShrink:0}}>
                  {c.name?.[0]?.toUpperCase()||'?'}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <p style={{fontSize:13,fontWeight:600,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.name}</p>
                    {c.vip&&<span style={{fontSize:9,fontWeight:700,color:C.yellow,background:C.yellowDim,padding:'1px 5px',borderRadius:4}}>VIP</span>}
                  </div>
                  <p style={{fontSize:11,color:C.text3,marginTop:1}}>{c.phone||c.email||'Sin contacto'}</p>
                  {/* Pet badges from metadata */}
                  {c.pets&&Array.isArray(c.pets)&&c.pets.length>0&&(
                    <div style={{display:'flex',gap:4,marginTop:3,flexWrap:'wrap'}}>
                      {c.pets.map((pet:any,i:number)=>(
                        <span key={i} style={{fontSize:10,padding:'1px 6px',borderRadius:5,background:C.tealDim,color:C.teal,fontWeight:500}}>
                          {getSpeciesIcon(pet.species||pet.type||'')} {pet.name||'Mascota'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{textAlign:'right',flexShrink:0}}>
                  <p style={{fontFamily:'var(--rz-mono)',fontSize:11,fontWeight:600,color:C.text2}}>{c.total_reservations||c.total_visits||0}</p>
                  {c.last_visit&&<p style={{fontSize:10,color:C.text3,marginTop:1}}>{new Date(c.last_visit).toLocaleDateString('es-ES',{day:'numeric',month:'short'})}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Detail panel */}
        <div style={{flex:1,overflowY:'auto',padding:24,background:C.bg}}>
          {!selected ? (
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',color:C.text3}}>
              <div style={{width:64,height:64,borderRadius:'50%',background:C.tealDim,display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,marginBottom:14}}>🐾</div>
              <p style={{fontSize:14,color:C.text3}}>Selecciona un dueño para ver su historial</p>
            </div>
          ) : (
            <>
              {/* Owner card */}
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:20,marginBottom:16}}>
                <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:16}}>
                  <div style={{width:50,height:50,borderRadius:'50%',background:selected.vip?C.yellowDim:C.tealDim,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:700,color:selected.vip?C.yellow:C.teal}}>
                    {selected.name?.[0]?.toUpperCase()||'?'}
                  </div>
                  <div>
                    <p style={{fontSize:17,fontWeight:700,color:C.text}}>{selected.name}</p>
                    <p style={{fontSize:13,color:C.text2,marginTop:1}}>{selected.phone}{selected.email?' · '+selected.email:''}</p>
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
                  {[
                    {label:'Visitas',value:selected.total_reservations||selected.total_visits||0},
                    {label:'Última visita',value:selected.last_visit?new Date(selected.last_visit).toLocaleDateString('es-ES',{day:'numeric',month:'short'}):'—'},
                    {label:'Total gastado',value:selected.total_spent?selected.total_spent+'€':'—'},
                  ].map(m=>(
                    <div key={m.label} style={{background:C.surface2,borderRadius:9,padding:'10px 14px'}}>
                      <p style={{fontSize:10,color:C.text3,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>{m.label}</p>
                      <p style={{fontFamily:'var(--rz-mono)',fontSize:18,fontWeight:700,color:C.text}}>{m.value}</p>
                    </div>
                  ))}
                </div>
                {selected.notes&&<p style={{marginTop:12,fontSize:13,color:C.text2,background:C.surface2,padding:'8px 12px',borderRadius:9}}>📝 {selected.notes}</p>}
              </div>

              {/* Pets section */}
              {selected.pets&&Array.isArray(selected.pets)&&selected.pets.length>0&&(
                <div style={{marginBottom:16}}>
                  <p style={{fontSize:10,fontWeight:700,color:C.text3,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10}}>Mascotas</p>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:10}}>
                    {selected.pets.map((pet:any,i:number)=>(
                      <div key={i} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:'12px 14px'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <span style={{fontSize:22}}>{getSpeciesIcon(pet.species||pet.type||'')}</span>
                          <div>
                            <p style={{fontSize:13,fontWeight:600,color:C.text}}>{pet.name||'Sin nombre'}</p>
                            <span style={{fontSize:10,padding:'1px 6px',borderRadius:5,background:C.tealDim,color:C.teal,fontWeight:500}}>{pet.species||pet.type||'Otro'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Visit history */}
              <p style={{fontSize:10,fontWeight:700,color:C.text3,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10}}>Historial de visitas</p>
              {loadingH ? <div style={{textAlign:'center',padding:20,color:C.text3}}>Cargando...</div>
              : historial.length===0 ? <p style={{fontSize:13,color:C.text3,padding:'20px 0'}}>{cs.noActivity}</p>
              : historial.map((h,i)=>(
                <div key={i} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:'12px 14px',marginBottom:8,display:'flex',gap:10,transition:'background 0.12s'}}
                  onMouseEnter={e=>(e.currentTarget.style.background=C.surface2)}
                  onMouseLeave={e=>(e.currentTarget.style.background=C.surface)}>
                  <span style={{fontSize:16}}>{h._type==='reserva'?'🐾':'📞'}</span>
                  <div style={{flex:1}}>
                    {h._type==='reserva' ? (
                      <>
                        <p style={{fontSize:13,fontWeight:500,color:C.text}}>
                          {(h.date||h.reservation_date)?.slice(0,10)} a las {(h.time||h.reservation_time||'').slice(0,5)}
                          {h.pet_name&&<> · {h.pet_name}</>}
                        </p>
                        <p style={{fontSize:11,color:C.text3,marginTop:1}}>
                          {h.service||h.notes||''} · {h.status}
                        </p>
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
