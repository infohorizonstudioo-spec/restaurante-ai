'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { PageLoader } from '@/components/ui'

export default function ClientesPage() {
  const [clientes,setClientes] = useState<any[]>([])
  const [loading,setLoading]   = useState(true)
  const [search,setSearch]     = useState('')
  const [selected,setSelected] = useState<any|null>(null)
  const [historial,setHistorial] = useState<any[]>([])
  const [loadingH,setLoadingH] = useState(false)
  const [tid,setTid]           = useState<string|null>(null)

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
      const {data:p} = await supabase.from('profiles').select('tenant_id').eq('id',user.id).single()
      if (!p?.tenant_id) return
      setTid(p.tenant_id); await load(p.tenant_id)
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
    <div style={{background:'#f8fafc',minHeight:'100vh',display:'flex',flexDirection:'column'}}>
      <div style={{background:'white',borderBottom:'1px solid #e2e8f0',padding:'14px 24px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <h1 style={{fontSize:18,fontWeight:700,color:'#0f172a'}}>Clientes</h1>
          <p style={{fontSize:12,color:'#94a3b8',marginTop:1}}>{clientes.length} registrados</p>
        </div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nombre o teléfono..." style={{padding:'8px 14px',fontSize:13,border:'1px solid #e2e8f0',borderRadius:9,outline:'none',width:240}}/>
      </div>

      <div style={{display:'flex',flex:1,overflow:'hidden'}}>
        {/* Lista */}
        <div style={{width:340,flexShrink:0,overflowY:'auto',borderRight:'1px solid #e2e8f0',background:'white'}}>
          {filtered.length===0 ? (
            <div style={{padding:'60px 24px',textAlign:'center'}}>
              <div style={{fontSize:36,marginBottom:10}}>👥</div>
              <p style={{fontSize:14,fontWeight:600,color:'#374151',marginBottom:4}}>Sin clientes</p>
              <p style={{fontSize:12,color:'#94a3b8'}}>Los clientes que llamen al agente aparecerán aquí.</p>
            </div>
          ) : filtered.map(c => (
            <div key={c.id} onClick={()=>openClient(c)} style={{padding:'12px 16px',cursor:'pointer',borderBottom:'1px solid #f1f5f9',
              background:selected?.id===c.id?'#eff6ff':'transparent',transition:'background 0.1s'}}
              onMouseEnter={e=>{if(selected?.id!==c.id)(e.currentTarget as HTMLElement).style.background='#f9fafb'}}
              onMouseLeave={e=>{if(selected?.id!==c.id)(e.currentTarget as HTMLElement).style.background='transparent'}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:38,height:38,borderRadius:'50%',background:c.vip?'#fef9c3':'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:c.vip?'#a16207':'#1d4ed8',flexShrink:0}}>
                  {c.name?.[0]?.toUpperCase()||'?'}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <p style={{fontSize:13,fontWeight:600,color:'#0f172a',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.name}</p>
                    {c.vip&&<span style={{fontSize:9,fontWeight:700,color:'#a16207',background:'#fef9c3',padding:'1px 5px',borderRadius:4}}>VIP</span>}
                  </div>
                  <p style={{fontSize:11,color:'#94a3b8',marginTop:1}}>{c.phone||c.email||'Sin contacto'}</p>
                </div>
                <div style={{textAlign:'right',flexShrink:0}}>
                  <p style={{fontSize:11,fontWeight:600,color:'#374151'}}>{c.total_reservations||c.total_visits||0} citas</p>
                  {c.last_visit&&<p style={{fontSize:10,color:'#94a3b8',marginTop:1}}>{new Date(c.last_visit).toLocaleDateString('es-ES',{day:'numeric',month:'short'})}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Detalle */}
        <div style={{flex:1,overflowY:'auto',padding:24}}>
          {!selected ? (
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',color:'#94a3b8'}}>
              <div style={{fontSize:48,marginBottom:12}}>👤</div>
              <p style={{fontSize:14}}>Selecciona un cliente para ver su historial</p>
            </div>
          ) : (
            <>
              <div style={{background:'white',border:'1px solid #e2e8f0',borderRadius:14,padding:20,marginBottom:16}}>
                <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:16}}>
                  <div style={{width:52,height:52,borderRadius:'50%',background:selected.vip?'#fef9c3':'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:700,color:selected.vip?'#a16207':'#1d4ed8'}}>
                    {selected.name?.[0]?.toUpperCase()||'?'}
                  </div>
                  <div>
                    <p style={{fontSize:18,fontWeight:700,color:'#0f172a'}}>{selected.name}</p>
                    <p style={{fontSize:13,color:'#64748b'}}>{selected.phone}{selected.email?' · '+selected.email:''}</p>
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
                  {[
                    {label:'Visitas',value:selected.total_reservations||selected.total_visits||0},
                    {label:'Última visita',value:selected.last_visit?new Date(selected.last_visit).toLocaleDateString('es-ES',{day:'numeric',month:'short'}):'—'},
                    {label:'Total gastado',value:selected.total_spent?selected.total_spent+'€':'—'},
                  ].map(m=>(
                    <div key={m.label} style={{background:'#f8fafc',borderRadius:9,padding:'10px 14px'}}>
                      <p style={{fontSize:10,color:'#94a3b8',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:3}}>{m.label}</p>
                      <p style={{fontSize:18,fontWeight:700,color:'#0f172a'}}>{m.value}</p>
                    </div>
                  ))}
                </div>
                {selected.notes&&<p style={{marginTop:12,fontSize:13,color:'#64748b',background:'#f8fafc',padding:'8px 12px',borderRadius:9}}>📝 {selected.notes}</p>}
              </div>

              <p style={{fontSize:12,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:10}}>Historial</p>
              {loadingH ? <div style={{textAlign:'center',padding:20,color:'#94a3b8'}}>Cargando...</div>
              : historial.length===0 ? <p style={{fontSize:13,color:'#94a3b8',padding:'20px 0'}}>Sin actividad registrada.</p>
              : historial.map((h,i)=>(
                <div key={i} style={{background:'white',border:'1px solid #e2e8f0',borderRadius:10,padding:'12px 14px',marginBottom:8,display:'flex',gap:10}}>
                  <span style={{fontSize:16}}>{h._type==='reserva'?'📅':'📞'}</span>
                  <div style={{flex:1}}>
                    {h._type==='reserva' ? (
                      <>
                        <p style={{fontSize:13,fontWeight:500,color:'#0f172a'}}>
                          {(h.date||h.reservation_date)?.slice(0,10)} a las {(h.time||h.reservation_time||'').slice(0,5)} · {h.people||h.party_size} persona{(h.people||h.party_size)!==1?'s':''}
                        </p>
                        <p style={{fontSize:11,color:'#94a3b8',marginTop:1}}>{h.table_name||''} {h.status}</p>
                      </>
                    ) : (
                      <>
                        <p style={{fontSize:13,fontWeight:500,color:'#0f172a'}}>{h.summary||'Llamada'}</p>
                        <p style={{fontSize:11,color:'#94a3b8',marginTop:1}}>{(h.started_at||'').slice(0,10)}</p>
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