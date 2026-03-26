'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { PageLoader } from '@/components/ui'
import NotifBell from '@/components/NotifBell'
import { useTenant } from '@/contexts/TenantContext'
import { getStatusLabel } from '@/lib/i18n'

import { C } from "@/lib/colors"

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

const SERVICE_BADGES:Record<string,{label:string;bg:string;color:string}> = {
  corte:    {label:'Corte',          bg:C.amberDim, color:C.amber},
  barba:    {label:'Barba',          bg:'rgba(45,212,191,0.10)', color:C.teal},
  afeitado: {label:'Afeitado clásico',bg:'rgba(96,165,250,0.10)',color:'#60A5FA'},
  tinte:    {label:'Tinte barba',    bg:C.violetDim, color:C.violet},
  diseño:   {label:'Diseño barba',   bg:C.greenDim, color:C.green},
  combo:    {label:'Combo',          bg:'rgba(251,181,63,0.10)', color:C.yellow},
}

function detectService(notes:string):string|null {
  if (!notes) return null
  const lower = notes.toLowerCase()
  if (lower.includes('afeitado'))        return 'afeitado'
  if (lower.includes('diseño'))          return 'diseño'
  if (lower.includes('tinte'))           return 'tinte'
  if (lower.includes('combo'))           return 'combo'
  if (lower.includes('barba'))           return 'barba'
  if (lower.includes('corte'))           return 'corte'
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

export default function BarbeReservasView() {
  const { tenant, template } = useTenant()
  const L = template?.labels

  const [base,setBase]         = useState(new Date())
  const [selected,setSelected] = useState(new Date().toISOString().slice(0,10))
  const [reservas,setReservas] = useState<any[]>([])
  const [loading,setLoading]   = useState(true)
  const [tid,setTid]           = useState<string|null>(null)
  const [modal,setModal]       = useState<any|null>(null)
  const [search,setSearch]     = useState('')
  const [filterBarbero,setFilterBarbero] = useState('all')

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
    const ch = supabase.channel('barbe-res-rt')
      .on('postgres_changes',{event:'*',schema:'public',table:'reservations',filter:'tenant_id=eq.'+tid},()=>load(tid))
      .subscribe()
    return ()=>{ supabase.removeChannel(ch) }
  },[tid,load])

  if (tenant?.type !== 'barberia') return null
  if (loading) return <PageLoader/>

  const week    = getWeek(base)
  const dayRes  = reservas.filter(r => (r.date||r.reservation_date)===selected)

  // Barberos únicos para el filtro
  const barberos = Array.from(new Set(reservas.map(r => r.table_name).filter(Boolean))) as string[]

  const filtered = dayRes
    .filter(r => filterBarbero === 'all' || r.table_name === filterBarbero)
    .filter(r => !search || (r.customer_name||'').toLowerCase().includes(search.toLowerCase()) || (r.customer_phone||'').includes(search))

  const today = new Date().toISOString().slice(0,10)

  async function updateStatus(id:string, status:string) {
    await supabase.from('reservations').update({status}).eq('id',id)
    if (tid) load(tid)
    setModal(null)
  }

  return (
    <div style={{background:C.bg,minHeight:'100vh'}}>
      {/* Header */}
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:'14px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10,position:'sticky',top:0,zIndex:20}}>
        <div>
          <h1 style={{fontSize:16,fontWeight:700,color:C.text,letterSpacing:'-0.02em'}}>{L?.pageTitle || 'Citas'}</h1>
          <p style={{fontSize:11,color:C.text3,marginTop:2}}>{dayRes.length} para el {new Date(selected+'T12:00:00').toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'})}</p>
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
            <button key={iso} onClick={()=>setSelected(iso)} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',padding:'10px 4px',background:'none',border:'none',cursor:'pointer',borderBottom:isSel?`2px solid ${C.amber}`:`2px solid transparent`,transition:'all 0.12s'}}>
              <span style={{fontSize:10,color:isToday?C.amber:C.text3,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em'}}>{DAYS[d.getDay()]}</span>
              <span style={{fontSize:16,fontWeight:isSel?700:500,color:isSel?C.amber:isToday?C.amber:C.text,marginTop:1}}>{d.getDate()}</span>
              {count>0&&<span style={{width:18,height:18,borderRadius:'50%',background:isSel?C.amber:`rgba(255,255,255,0.08)`,color:isSel?'#0C1018':C.text2,fontSize:10,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',marginTop:2}}>{count}</span>}
            </button>
          )
        })}
        <button onClick={()=>setBase(d=>{const n=new Date(d);n.setDate(n.getDate()+7);return n})} style={{padding:'12px',background:'none',border:'none',cursor:'pointer',color:C.text3,fontSize:18}}>›</button>
      </div>

      {/* Filtro por barbero */}
      {barberos.length > 0 && (
        <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:'10px 24px',display:'flex',gap:6,flexWrap:'wrap'}}>
          <button onClick={()=>setFilterBarbero('all')} style={{
            padding:'5px 14px',fontSize:12,fontWeight:600,borderRadius:9,
            border:`1px solid ${filterBarbero==='all'?C.amber+'44':C.border}`,
            background:filterBarbero==='all'?C.amberDim:'transparent',
            color:filterBarbero==='all'?C.amber:C.text2,cursor:'pointer',fontFamily:'inherit'
          }}>Todos</button>
          {barberos.map(b=>(
            <button key={b} onClick={()=>setFilterBarbero(b)} style={{
              padding:'5px 14px',fontSize:12,fontWeight:600,borderRadius:9,
              border:`1px solid ${filterBarbero===b?C.amber+'44':C.border}`,
              background:filterBarbero===b?C.amberDim:'transparent',
              color:filterBarbero===b?C.amber:C.text2,cursor:'pointer',fontFamily:'inherit'
            }}>{b}</button>
          ))}
        </div>
      )}

      <div style={{maxWidth:760,margin:'0 auto',padding:'20px 24px'}}>
        {filtered.length===0 ? (
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:'60px 24px',textAlign:'center'}}>
            <div style={{fontSize:36,marginBottom:10}}>🪒</div>
            <p style={{fontSize:15,fontWeight:600,color:C.text,marginBottom:4}}>{L?.emptyReservas||'Sin citas este día'}</p>
            <p style={{fontSize:13,color:C.text3}}>No hay citas para el día seleccionado.</p>
          </div>
        ) : filtered.map(r=>{
          const ss = STATUS_STYLES[r.status]||STATUS_STYLES.pendiente
          const time = r.time||r.reservation_time||''
          const name = r.customer_name||'Sin nombre'
          const svc = detectService(r.notes||'')
          const svcBadge = svc ? SERVICE_BADGES[svc] : null
          return (
            <div key={r.id} onClick={()=>setModal(r)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:'14px 16px',marginBottom:10,cursor:'pointer',display:'flex',alignItems:'center',gap:12,transition:'all 0.12s'}}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.surface2;(e.currentTarget as HTMLElement).style.borderColor=C.borderMd}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=C.surface;(e.currentTarget as HTMLElement).style.borderColor=C.border}}>
              <div style={{width:42,height:42,borderRadius:'50%',background:C.amberDim,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:C.amber,flexShrink:0}}>
                {name[0]?.toUpperCase()||'?'}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontSize:14,fontWeight:600,color:C.text}}>{name}</p>
                <div style={{display:'flex',alignItems:'center',gap:6,marginTop:3,flexWrap:'wrap'}}>
                  <span style={{fontSize:12,color:C.text2}}>{time.slice(0,5)}</span>
                  {r.table_name && <span style={{fontSize:11,color:C.text3}}>· {r.table_name}</span>}
                  {svcBadge && (
                    <span style={{fontSize:10,padding:'2px 8px',borderRadius:8,background:svcBadge.bg,color:svcBadge.color,fontWeight:700,border:`1px solid ${svcBadge.color}25`}}>{svcBadge.label}</span>
                  )}
                  {r.notes && !svc && <span style={{fontSize:11,color:C.text3}}>· {r.notes.slice(0,30)}{r.notes.length>30?'...':''}</span>}
                </div>
              </div>
              <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:6}}>
                <span style={{fontSize:10,padding:'3px 9px',borderRadius:8,background:ss.bg,color:ss.color,fontWeight:700,border:`1px solid ${ss.color}25`,flexShrink:0}}>{getStatusLabel(r.status, 'es')}</span>
                {r.customer_phone&&<p style={{fontSize:11,color:C.text3}}>{r.customer_phone}</p>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal detalle */}
      {modal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}} onClick={()=>setModal(null)}>
          <div style={{background:C.surface,border:`1px solid ${C.borderMd}`,borderRadius:16,padding:24,width:'100%',maxWidth:440,boxShadow:'0 20px 60px rgba(0,0,0,0.6)'}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20}}>
              <div>
                <p style={{fontSize:18,fontWeight:700,color:C.text}}>{modal.customer_name||'Sin nombre'}</p>
                <p style={{fontSize:13,color:C.text2,marginTop:2}}>
                  {(modal.date||modal.reservation_date)?.slice(0,10)} · {(modal.time||modal.reservation_time||'').slice(0,5)}
                </p>
              </div>
              <button onClick={()=>setModal(null)} style={{background:'none',border:'none',fontSize:22,cursor:'pointer',color:C.text3}}>×</button>
            </div>
            {modal.customer_phone&&<p style={{fontSize:13,color:C.text2,marginBottom:8}}>📞 {modal.customer_phone}</p>}
            {modal.table_name&&<p style={{fontSize:13,color:C.text2,marginBottom:8}}>🪒 Barbero: {modal.table_name}</p>}
            {modal.notes&&<p style={{fontSize:13,color:C.text2,marginBottom:16}}>📝 {modal.notes}</p>}
            {modal.source==='voice_agent'&&<p style={{fontSize:12,color:C.amber,marginBottom:16,background:C.amberDim,padding:'6px 10px',borderRadius:8}}>📞 Cita creada por el agente de voz</p>}
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:8}}>
              {['confirmada','pendiente','cancelada','completada'].map(s=>(
                <button key={s} onClick={()=>updateStatus(modal.id,s)}
                  style={{padding:'7px 14px',fontSize:12,fontWeight:600,borderRadius:8,border:`1px solid ${STATUS_STYLES[s]?.color||C.border}40`,
                    background: modal.status===s ? STATUS_STYLES[s]?.bg||C.surface2 : 'transparent',
                    color: STATUS_STYLES[s]?.color||C.text2,cursor:'pointer',fontFamily:'inherit'}}>
                  {getStatusLabel(s, 'es')}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
