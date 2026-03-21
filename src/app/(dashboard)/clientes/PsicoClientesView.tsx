'use client'
import NotifBell from '@/components/NotifBell'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { PageLoader } from '@/components/ui'
import { useTenant } from '@/contexts/TenantContext'

const C = {
  amber:'#F0A84E',amberDim:'rgba(240,168,78,0.10)',
  green:'#34D399',greenDim:'rgba(52,211,153,0.10)',
  red:'#F87171',redDim:'rgba(248,113,113,0.10)',
  yellow:'#FBB53F',yellowDim:'rgba(251,181,63,0.10)',
  violet:'#A78BFA',violetDim:'rgba(167,139,250,0.12)',
  blue:'#60A5FA',blueDim:'rgba(96,165,250,0.10)',
  text:'#E8EEF6',text2:'#8895A7',text3:'#49566A',
  bg:'#0C1018',surface:'#131920',surface2:'#1A2230',surface3:'#202C3E',
  border:'rgba(255,255,255,0.07)',borderMd:'rgba(255,255,255,0.11)',
}

type SessionType = 'primera' | 'seguimiento' | 'pareja' | 'normal'

function classifySession(notes: string | null): { type: SessionType; label: string; bg: string; color: string } {
  const t = (notes || '').toLowerCase()
  if (/primera\s+vez|primera\s+sesi[oó]n|nuevo\s+paciente|nunca\s+he\s+venido|primera\s+visita/i.test(t))
    return { type: 'primera', label: 'Primera sesión', bg: C.greenDim, color: C.green }
  if (/pareja|terapia\s+de\s+pareja|sesión\s+de\s+pareja/i.test(t))
    return { type: 'pareja', label: 'Pareja', bg: C.violetDim, color: C.violet }
  if (/seguimiento|continuar|revisión|revision|control|próxima|regular/i.test(t))
    return { type: 'seguimiento', label: 'Seguimiento', bg: C.blueDim, color: C.blue }
  return { type: 'normal', label: 'Sesión', bg: C.violetDim, color: C.violet }
}

export default function PsicoClientesView() {
  const [clientes,setClientes] = useState<any[]>([])
  const [loading,setLoading]   = useState(true)
  const [search,setSearch]     = useState('')
  const [selected,setSelected] = useState<any|null>(null)
  const [historial,setHistorial] = useState<any[]>([])
  const [sessionCount,setSessionCount] = useState<Record<string,number>>({})
  const [futureSesiones,setFutureSesiones] = useState<Record<string,boolean>>({})
  const [loadingH,setLoadingH] = useState(false)
  const [tid,setTid]           = useState<string|null>(null)
  const { template } = useTenant()
  const L = template?.labels

  const load = useCallback(async (tenantId:string) => {
    const {data:customers} = await supabase.from('customers').select('*')
      .eq('tenant_id',tenantId).order('created_at',{ascending:false})
    setClientes(customers||[])

    const {data:reservations} = await supabase.from('reservations').select('customer_id,date,status,table_name')
      .eq('tenant_id',tenantId)
    const counts: Record<string,number> = {}
    const hasActive: Record<string,boolean> = {}
    const today = new Date().toISOString().slice(0,10)
    for (const r of (reservations||[])) {
      if (!r.customer_id) continue
      const st = (r.status||'').toLowerCase()
      if (st !== 'cancelada' && st !== 'cancelled') {
        counts[r.customer_id] = (counts[r.customer_id]||0) + 1
      }
      if (r.date && r.date >= today && st !== 'cancelada' && st !== 'cancelled') {
        hasActive[r.customer_id] = true
      }
    }
    setSessionCount(counts)
    setFutureSesiones(hasActive)
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
    const {data} = await supabase.from('reservations').select('id,date,time,reservation_date,reservation_time,status,notes,table_name')
      .eq('tenant_id',c.tenant_id).eq('customer_id',c.id)
      .order('date',{ascending:false}).limit(20)
    setHistorial(data||[])
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
          <h1 style={{fontSize:16,fontWeight:700,color:C.text,letterSpacing:'-0.02em'}}>Pacientes — Psicología</h1>
          <p style={{fontSize:11,color:C.text3,marginTop:2}}>{clientes.length} registrados</p>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder='Buscar pacientes…'
            style={{padding:'8px 14px',fontSize:13,border:`1px solid ${C.borderMd}`,borderRadius:9,outline:'none',width:220,background:C.surface2,color:C.text,fontFamily:'inherit'}}/>
          <NotifBell/>
        </div>
      </div>

      <div style={{display:'flex',flex:1,overflow:'hidden'}}>
        {/* Lista */}
        <div style={{width:320,flexShrink:0,overflowY:'auto',borderRight:`1px solid ${C.border}`,background:C.surface}}>
          {filtered.length===0 ? (
            <div style={{padding:'60px 24px',textAlign:'center'}}>
              <div style={{fontSize:36,marginBottom:10}}>🧠</div>
              <p style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:4}}>Sin pacientes</p>
              <p style={{fontSize:13,color:C.text3}}>Los pacientes que contacten aparecerán aquí.</p>
            </div>
          ) : filtered.map(c => {
            const sessions = sessionCount[c.id] || 0
            const active = futureSesiones[c.id] || false
            return (
              <div key={c.id} onClick={()=>openClient(c)} style={{padding:'12px 16px',cursor:'pointer',borderBottom:`1px solid ${C.border}`,
                background:selected?.id===c.id?C.surface2:'transparent',transition:'background 0.1s'}}
                onMouseEnter={e=>{if(selected?.id!==c.id)(e.currentTarget as HTMLElement).style.background=C.surface2}}
                onMouseLeave={e=>{if(selected?.id!==c.id)(e.currentTarget as HTMLElement).style.background='transparent'}}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{width:36,height:36,borderRadius:'50%',background:C.violetDim,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:C.violet,flexShrink:0}}>
                    {c.name?.[0]?.toUpperCase()||'?'}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:6}}>
                      <p style={{fontSize:13,fontWeight:600,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.name}</p>
                      {active&&<span style={{fontSize:9,fontWeight:700,color:C.green,background:C.greenDim,padding:'1px 5px',borderRadius:4}}>Activo</span>}
                    </div>
                    <p style={{fontSize:11,color:C.text3,marginTop:1}}>{c.phone||c.email||'Sin contacto'}</p>
                  </div>
                  <div style={{textAlign:'right',flexShrink:0}}>
                    <p style={{fontFamily:'var(--rz-mono)',fontSize:11,fontWeight:600,color:C.text2}}>{sessions} ses.</p>
                    {c.last_visit&&<p style={{fontSize:10,color:C.text3,marginTop:1}}>{new Date(c.last_visit).toLocaleDateString('es-ES',{day:'numeric',month:'short'})}</p>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Detalle — discreto: solo fechas y tipo, sin notas ni motivo */}
        <div style={{flex:1,overflowY:'auto',padding:24,background:C.bg}}>
          {!selected ? (
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',color:C.text3}}>
              <div style={{width:64,height:64,borderRadius:'50%',background:C.violetDim,display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,marginBottom:14}}>🧠</div>
              <p style={{fontSize:14,color:C.text3}}>Selecciona un paciente para ver su historial</p>
            </div>
          ) : (
            <>
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:20,marginBottom:16}}>
                <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:16}}>
                  <div style={{width:50,height:50,borderRadius:'50%',background:C.violetDim,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:700,color:C.violet}}>
                    {selected.name?.[0]?.toUpperCase()||'?'}
                  </div>
                  <div>
                    <p style={{fontSize:17,fontWeight:700,color:C.text}}>{selected.name}</p>
                    <p style={{fontSize:13,color:C.text2,marginTop:1}}>{selected.phone}{selected.email?' · '+selected.email:''}</p>
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
                  {[
                    {label:'Sesiones',value:sessionCount[selected.id]||0},
                    {label:'Última sesión',value:selected.last_visit?new Date(selected.last_visit).toLocaleDateString('es-ES',{day:'numeric',month:'short'}):'—'},
                    {label:'Estado',value:futureSesiones[selected.id]?'En seguimiento':'Sin citas'},
                  ].map(m=>(
                    <div key={m.label} style={{background:C.surface2,borderRadius:9,padding:'10px 14px'}}>
                      <p style={{fontSize:10,color:C.text3,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>{m.label}</p>
                      <p style={{fontFamily:'var(--rz-mono)',fontSize:m.label==='Estado'?13:18,fontWeight:700,color:m.label==='Estado'?(futureSesiones[selected.id]?C.green:C.text3):C.text}}>{m.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <p style={{fontSize:10,fontWeight:700,color:C.text3,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10}}>Historial de sesiones</p>
              {loadingH ? <div style={{textAlign:'center',padding:20,color:C.text3}}>Cargando...</div>
              : historial.length===0 ? <p style={{fontSize:13,color:C.text3,padding:'20px 0'}}>Sin sesiones registradas.</p>
              : historial.map((h,i)=>{
                const session = classifySession(h.notes)
                return (
                  <div key={i} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:'12px 14px',marginBottom:8,display:'flex',gap:10,transition:'background 0.12s'}}
                    onMouseEnter={e=>(e.currentTarget.style.background=C.surface2)}
                    onMouseLeave={e=>(e.currentTarget.style.background=C.surface)}>
                    <span style={{fontSize:16}}>🧠</span>
                    <div style={{flex:1}}>
                      <p style={{fontSize:13,fontWeight:500,color:C.text}}>
                        {(h.date||h.reservation_date)?.slice(0,10)} a las {(h.time||h.reservation_time||'').slice(0,5)}
                      </p>
                      <p style={{fontSize:11,color:C.text3,marginTop:1}}>
                        {h.table_name ? `Terapeuta: ${h.table_name}` : ''}
                      </p>
                    </div>
                    <span style={{fontSize:10,padding:'3px 9px',borderRadius:8,background:session.bg,color:session.color,fontWeight:700,alignSelf:'center'}}>{session.label}</span>
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
