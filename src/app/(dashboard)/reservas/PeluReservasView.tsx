'use client'
import NotifBell from '@/components/NotifBell'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { PageLoader } from '@/components/ui'
import { useTenant } from '@/contexts/TenantContext'

const C = {
  amber:'#F0A84E',amberDim:'rgba(240,168,78,0.10)',
  teal:'#2DD4BF',green:'#34D399',greenDim:'rgba(52,211,153,0.10)',
  red:'#F87171',redDim:'rgba(248,113,113,0.10)',
  yellow:'#FBB53F',violet:'#A78BFA',violetDim:'rgba(167,139,250,0.12)',
  blue:'#60A5FA',blueDim:'rgba(96,165,250,0.10)',
  text:'#E8EEF6',text2:'#8895A7',text3:'#49566A',
  bg:'#0C1018',surface:'#131920',surface2:'#1A2230',surface3:'#202C3E',
  border:'rgba(255,255,255,0.07)',borderMd:'rgba(255,255,255,0.11)',
}

const DAYS = ['DO','LU','MA','MI','JU','VI','SA']

const STATUS_STYLES:Record<string,{bg:string;color:string;label:string}> = {
  confirmada: {bg:C.greenDim,  color:C.green,  label:'Confirmada'},
  confirmed:  {bg:C.greenDim,  color:C.green,  label:'Confirmada'},
  pendiente:  {bg:'rgba(251,181,63,0.10)',color:C.yellow,label:'Pendiente'},
  pending:    {bg:'rgba(251,181,63,0.10)',color:C.yellow,label:'Pendiente'},
  cancelada:  {bg:C.redDim,    color:C.red,    label:'Cancelada'},
  cancelled:  {bg:C.redDim,    color:C.red,    label:'Cancelada'},
  completada: {bg:C.amberDim,  color:C.amber,  label:'Completada'},
  completed:  {bg:C.amberDim,  color:C.amber,  label:'Completada'},
}

const SERVICE_BADGES:Record<string,{bg:string;color:string}> = {
  corte:       {bg:C.violetDim, color:C.violet},
  tinte:       {bg:C.blueDim,   color:C.blue},
  mechas:      {bg:C.amberDim,  color:C.amber},
  tratamiento: {bg:C.greenDim,  color:C.green},
  barba:       {bg:'rgba(139,92,246,0.12)', color:'#8B5CF6'},
}

function detectService(notes:string): string|null {
  if (!notes) return null
  const lower = notes.toLowerCase()
  for (const key of Object.keys(SERVICE_BADGES)) {
    if (lower.includes(key)) return key
  }
  return null
}

function getWeek(base: Date) {
  const d = new Date(base)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(d); dd.setDate(d.getDate() + i)
    return dd
  })
}

export default function PeluReservasView() {
  const [base,setBase]         = useState(new Date())
  const [selected,setSelected] = useState(new Date().toISOString().slice(0,10))
  const [reservas,setReservas] = useState<any[]>([])
  const [loading,setLoading]   = useState(true)
  const [tid,setTid]           = useState<string|null>(null)
  const [modal,setModal]       = useState<any|null>(null)
  const [search,setSearch]     = useState('')
  const { tenant, template }   = useTenant()
  const L = template?.labels

  const isPelu = tenant?.type === 'peluqueria'
  const accent = isPelu ? C.violet : C.text2
  const accentDim = isPelu ? C.violetDim : 'rgba(136,149,167,0.12)'

  const load = useCallback(async (tenantId:string) => {
    const week = getWeek(base)
    const from = week[0].toISOString().slice(0,10)
    const to   = week[6].toISOString().slice(0,10)
    const {data} = await supabase.from('reservations')
      .select('*').eq('tenant_id',tenantId)
      .gte('date',from).lte('date',to)
      .order('date').order('time')
    setReservas(data||[])
    setLoading(false)
  },[base])

  useEffect(()=>{
    (async()=>{
      const {data:{user}} = await supabase.auth.getUser()
      if (!user) return
      const {data:p} = await supabase.from('profiles').select('tenant_id').eq('id',user.id).maybeSingle()
      if (!p?.tenant_id) return
      setTid(p.tenant_id); await load(p.tenant_id)
    })()
  },[load])

  useEffect(()=>{
    if (!tid) return
    const ch = supabase.channel('pelu-res-rt')
      .on('postgres_changes',{event:'*',schema:'public',table:'reservations',filter:'tenant_id=eq.'+tid},()=>load(tid))
      .subscribe()
    return ()=>{ supabase.removeChannel(ch) }
  },[tid,load])

  if (loading) return <PageLoader/>

  const week    = getWeek(base)
  const dayRes  = reservas.filter(r => (r.date||r.reservation_date)===selected)
  const filtered = search ? dayRes.filter(r =>
    (r.customer_name||'').toLowerCase().includes(search.toLowerCase()) ||
    (r.customer_phone||'').includes(search) ||
    (r.notes||'').toLowerCase().includes(search.toLowerCase()) ||
    (r.table_name||'').toLowerCase().includes(search.toLowerCase())
  ) : dayRes
  const today = new Date().toISOString().slice(0,10)

  async function updateStatus(id:string, status:string) {
    await supabase.from('reservations').update({status}).eq('id',id)
    if (tid) load(tid)
    setModal(null)
  }

  return (
    <div style={{background:C.bg,minHeight:'100vh'}}>
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:'14px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10,position:'sticky',top:0,zIndex:20}}>
        <div>
          <h1 style={{fontSize:16,fontWeight:700,color:C.text,letterSpacing:'-0.02em'}}>{L?.pageTitle || 'Citas'}</h1>
          <p style={{fontSize:11,color:C.text3,marginTop:2}}>{dayRes.length} cita{dayRes.length!==1?'s':''} para el {new Date(selected+'T12:00:00').toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'})}</p>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={L?.buscarPlaceholder||'Buscar citas…'}
            style={{padding:'8px 14px',fontSize:13,border:`1px solid ${C.borderMd}`,borderRadius:9,outline:'none',width:200,background:C.surface2,color:C.text,fontFamily:'inherit'}}/>
          <NotifBell/>
        </div>
      </div>

      {/* Week nav */}
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:'0 24px',display:'flex',alignItems:'stretch'}}>
        <button onClick={()=>setBase(d=>{const n=new Date(d);n.setDate(n.getDate()-7);return n})} style={{padding:'12px',background:'none',border:'none',cursor:'pointer',color:C.text3,fontSize:18}}>‹</button>
        {week.map(d => {
          const iso = d.toISOString().slice(0,10)
          const count = reservas.filter(r=>(r.date||r.reservation_date)===iso).length
          const isSel = iso===selected, isToday = iso===today
          return (
            <button key={iso} onClick={()=>setSelected(iso)} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',padding:'10px 4px',background:'none',border:'none',cursor:'pointer',borderBottom:isSel?`2px solid ${accent}`:`2px solid transparent`,transition:'all 0.12s'}}>
              <span style={{fontSize:10,color:isToday?accent:C.text3,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em'}}>{DAYS[d.getDay()]}</span>
              <span style={{fontSize:16,fontWeight:isSel?700:500,color:isSel?accent:isToday?accent:C.text,marginTop:1}}>{d.getDate()}</span>
              {count>0&&<span style={{width:18,height:18,borderRadius:'50%',background:isSel?accent:`rgba(255,255,255,0.08)`,color:isSel?'#0C1018':C.text2,fontSize:10,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',marginTop:2}}>{count}</span>}
            </button>
          )
        })}
        <button onClick={()=>setBase(d=>{const n=new Date(d);n.setDate(n.getDate()+7);return n})} style={{padding:'12px',background:'none',border:'none',cursor:'pointer',color:C.text3,fontSize:18}}>›</button>
      </div>

      <div style={{maxWidth:760,margin:'0 auto',padding:'20px 24px'}}>
        {filtered.length===0 ? (
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:'60px 24px',textAlign:'center'}}>
            <div style={{fontSize:36,marginBottom:10}}>{isPelu ? '✂️' : '🪒'}</div>
            <p style={{fontSize:15,fontWeight:600,color:C.text,marginBottom:4}}>{L?.emptyReservas||'Sin citas este día'}</p>
            <p style={{fontSize:13,color:C.text3}}>No hay citas para el día seleccionado.</p>
          </div>
        ) : filtered.map((r)=>{
          const ss = STATUS_STYLES[r.status]||STATUS_STYLES.pendiente
          const time = r.time||r.reservation_time||''
          const name = r.customer_name||'Sin nombre'
          const service = detectService(r.notes||'')
          const professional = r.table_name || null
          const duration = r.people || null

          return (
            <div key={r.id} onClick={()=>setModal(r)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:'14px 16px',marginBottom:10,cursor:'pointer',display:'flex',alignItems:'center',gap:12,transition:'all 0.12s'}}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.surface2;(e.currentTarget as HTMLElement).style.borderColor=C.borderMd}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=C.surface;(e.currentTarget as HTMLElement).style.borderColor=C.border}}>
              <div style={{width:42,height:42,borderRadius:'50%',background:accentDim,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:accent,flexShrink:0}}>
                {name[0]?.toUpperCase()||'?'}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <p style={{fontSize:14,fontWeight:600,color:C.text}}>{name}</p>
                  {service && (
                    <span style={{fontSize:10,padding:'2px 8px',borderRadius:6,background:SERVICE_BADGES[service]?.bg||C.violetDim,color:SERVICE_BADGES[service]?.color||C.violet,fontWeight:600,textTransform:'capitalize'}}>
                      {service}
                    </span>
                  )}
                </div>
                <p style={{fontSize:12,color:C.text2,marginTop:1}}>
                  {time.slice(0,5)}
                  {professional ? ` · ${professional}` : ''}
                  {duration ? ` · ${duration} min` : ''}
                  {r.notes ? ` · ${r.notes.slice(0,40)}${r.notes.length>40?'...':''}` : ''}
                </p>
              </div>
              <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:6}}>
                <span style={{fontSize:10,padding:'3px 9px',borderRadius:8,background:ss.bg,color:ss.color,fontWeight:700,border:`1px solid ${ss.color}25`,flexShrink:0}}>{ss.label}</span>
                {r.customer_phone&&<p style={{fontSize:11,color:C.text3}}>{r.customer_phone}</p>}
              </div>
            </div>
          )
        })}
      </div>

      {modal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}} onClick={()=>setModal(null)}>
          <div style={{background:C.surface,border:`1px solid ${C.borderMd}`,borderRadius:16,padding:24,width:'100%',maxWidth:440,boxShadow:'0 20px 60px rgba(0,0,0,0.6)'}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20}}>
              <div>
                <p style={{fontSize:18,fontWeight:700,color:C.text}}>{modal.customer_name||'Sin nombre'}</p>
                <p style={{fontSize:13,color:C.text2,marginTop:2}}>
                  {(modal.date||modal.reservation_date)?.slice(0,10)} · {(modal.time||modal.reservation_time||'').slice(0,5)}
                  {modal.people ? ` · ${modal.people} min` : ''}
                </p>
              </div>
              <button onClick={()=>setModal(null)} style={{background:'none',border:'none',fontSize:22,cursor:'pointer',color:C.text3}}>×</button>
            </div>
            {modal.customer_phone&&<p style={{fontSize:13,color:C.text2,marginBottom:8}}>📞 {modal.customer_phone}</p>}
            {modal.table_name&&<p style={{fontSize:13,color:C.text2,marginBottom:8}}>👤 Profesional: {modal.table_name}</p>}
            {modal.notes&&<p style={{fontSize:13,color:C.text2,marginBottom:8}}>✂️ {modal.notes}</p>}
            {(() => {
              const svc = detectService(modal.notes||'')
              if (!svc) return null
              const badge = SERVICE_BADGES[svc]
              return <p style={{fontSize:12,color:badge?.color||C.violet,marginBottom:8,background:badge?.bg||C.violetDim,padding:'6px 10px',borderRadius:8,textTransform:'capitalize'}}>Servicio: {svc}</p>
            })()}
            {modal.source==='voice_agent'&&<p style={{fontSize:12,color:C.violet,marginBottom:16,background:C.violetDim,padding:'6px 10px',borderRadius:8}}>📞 Cita creada por el agente de voz</p>}
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:8}}>
              {['confirmada','pendiente','cancelada','completada'].map(s=>(
                <button key={s} onClick={()=>updateStatus(modal.id,s)}
                  style={{padding:'7px 14px',fontSize:12,fontWeight:600,borderRadius:8,border:`1px solid ${STATUS_STYLES[s]?.color||C.border}40`,
                    background: modal.status===s ? STATUS_STYLES[s]?.bg||C.surface2 : 'transparent',
                    color: STATUS_STYLES[s]?.color||C.text2,cursor:'pointer',fontFamily:'inherit'}}>
                  {STATUS_STYLES[s]?.label||s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
