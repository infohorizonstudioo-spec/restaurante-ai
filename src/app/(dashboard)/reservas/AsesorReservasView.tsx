'use client'
import NotifBell from '@/components/NotifBell'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { PageLoader } from '@/components/ui'
import { useTenant } from '@/contexts/TenantContext'

import { C } from "@/lib/colors"
import { RESERVATION_STATUS } from '@/lib/status-config'

const DAYS = ['DO','LU','MA','MI','JU','VI','SA']

const ESPECIALIDAD_STYLES: Record<string,{bg:string;color:string;label:string}> = {
  laboral:   {bg:C.blueDim, color:C.blue, label:'Laboral'},
  fiscal:    {bg:'rgba(52,211,153,0.10)', color:C.green, label:'Fiscal'},
  juridica:  {bg:C.violetDim, color:C.violet, label:'Jurídica'},
  contable:  {bg:C.amberDim, color:C.amber, label:'Contable'},
  otro:      {bg:'rgba(255,255,255,0.06)', color:C.text2, label:'Otro'},
}

const MODALIDAD_STYLES: Record<string,{label:string;icon:string}> = {
  presencial: {label:'Presencial', icon:'🏢'},
  online:     {label:'Online',     icon:'💻'},
  telefono:   {label:'Teléfono',   icon:'📞'},
}

function parseEspecialidad(notes?: string): string {
  if (!notes) return 'otro'
  const lower = notes.toLowerCase()
  if (lower.includes('laboral')) return 'laboral'
  if (lower.includes('fiscal')) return 'fiscal'
  if (lower.includes('juríd') || lower.includes('juridic') || lower.includes('legal')) return 'juridica'
  if (lower.includes('contab')) return 'contable'
  return 'otro'
}

function parseModalidad(notes?: string): string {
  if (!notes) return 'presencial'
  const lower = notes.toLowerCase()
  if (lower.includes('online') || lower.includes('videollamada') || lower.includes('video')) return 'online'
  if (lower.includes('teléfono') || lower.includes('telefon') || lower.includes('llamada')) return 'telefono'
  return 'presencial'
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

type EspFilter = 'todos' | 'laboral' | 'fiscal' | 'juridica' | 'contable'

export default function AsesorReservasView() {
  const [base,setBase]           = useState(new Date())
  const [selected,setSelected]   = useState(new Date().toISOString().slice(0,10))
  const [reservas,setReservas]   = useState<any[]>([])
  const [loading,setLoading]     = useState(true)
  const [tid,setTid]             = useState<string|null>(null)
  const [modal,setModal]         = useState<any|null>(null)
  const [search,setSearch]       = useState('')
  const [espFilter,setEspFilter] = useState<EspFilter>('todos')
  const { template, tx } = useTenant()
  const L = template?.labels

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
    const ch = supabase.channel('asesor-res-rt-' + tid)
      .on('postgres_changes',{event:'*',schema:'public',table:'reservations',filter:'tenant_id=eq.'+tid},()=>load(tid))
      .subscribe()
    return ()=>{ supabase.removeChannel(ch) }
  },[tid,load])

  if (loading) return <PageLoader/>

  const week    = getWeek(base)
  const dayRes  = reservas.filter(r => (r.date||r.reservation_date)===selected)

  const espFiltered = espFilter === 'todos' ? dayRes : dayRes.filter(r => parseEspecialidad(r.notes || r.service) === espFilter)

  const filtered = search ? espFiltered.filter(r =>
    (r.customer_name||'').toLowerCase().includes(search.toLowerCase()) ||
    (r.customer_phone||'').includes(search)
  ) : espFiltered

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
          <h1 style={{fontSize:16,fontWeight:700,color:C.text,letterSpacing:'-0.02em'}}>💼 {L?.pageTitle || 'Citas'}</h1>
          <p style={{fontSize:11,color:C.text3,marginTop:2}}>{dayRes.length} citas para el {new Date(selected+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'})}</p>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={L?.buscarPlaceholder||'Buscar citas…'}
            style={{padding:'8px 14px',fontSize:13,border:`1px solid ${C.borderMd}`,borderRadius:9,outline:'none',width:200,background:C.surface2,color:C.text,fontFamily:'inherit'}}/>
          <NotifBell/>
        </div>
      </div>

      {/* Week nav */}
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:'0 24px',display:'flex',alignItems:'stretch'}}>
        <button onClick={()=>setBase(d=>{const n=new Date(d);n.setDate(n.getDate()-7);return n})} style={{padding:'12px',background:'none',border:'none',cursor:'pointer',color:C.text3,fontSize:18}} aria-label="Anterior">‹</button>
        {week.map(d => {
          const iso = d.toISOString().slice(0,10)
          const count = reservas.filter(r=>(r.date||r.reservation_date)===iso).length
          const isSel = iso===selected, isToday = iso===today
          return (
            <button key={iso} onClick={()=>setSelected(iso)} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',padding:'10px 4px',background:'none',border:'none',cursor:'pointer',borderBottom:isSel?`2px solid ${C.blue}`:`2px solid transparent`,transition:'all 0.12s'}}>
              <span style={{fontSize:10,color:isToday?C.blue:C.text3,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em'}}>{DAYS[d.getDay()]}</span>
              <span style={{fontSize:16,fontWeight:isSel?700:500,color:isSel?C.blue:isToday?C.blue:C.text,marginTop:1}}>{d.getDate()}</span>
              {count>0&&<span style={{width:18,height:18,borderRadius:'50%',background:isSel?C.blue:`rgba(255,255,255,0.08)`,color:isSel?'#0C1018':C.text2,fontSize:10,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',marginTop:2}}>{count}</span>}
            </button>
          )
        })}
        <button onClick={()=>setBase(d=>{const n=new Date(d);n.setDate(n.getDate()+7);return n})} style={{padding:'12px',background:'none',border:'none',cursor:'pointer',color:C.text3,fontSize:18}} aria-label="Siguiente">›</button>
      </div>

      {/* Especialidad filter */}
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:'8px 24px',display:'flex',gap:6,overflowX:'auto'}}>
        {([['todos','Todas','📋'],['laboral','Laboral','👷'],['fiscal','Fiscal','📊'],['juridica','Jurídica','⚖️'],['contable','Contable','🧮']] as [EspFilter,string,string][]).map(([key,label,icon])=>(
          <button key={key} onClick={()=>setEspFilter(key)}
            style={{padding:'5px 12px',fontSize:12,fontWeight:600,borderRadius:8,border:`1px solid ${espFilter===key?C.blue+'40':C.border}`,
              background:espFilter===key?C.blueDim:'transparent',color:espFilter===key?C.blue:C.text2,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}}>
            {icon} {tx(label)}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{maxWidth:760,margin:'0 auto',padding:'20px 24px'}}>
        {filtered.length===0 ? (
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:'60px 24px',textAlign:'center'}}>
            <div style={{fontSize:36,marginBottom:10}}>💼</div>
            <p style={{fontSize:15,fontWeight:600,color:C.text,marginBottom:4}}>{L?.emptyReservas||'Sin citas este día'}</p>
            <p style={{fontSize:13,color:C.text3}}>{tx('No hay citas de asesoría para el día seleccionado.')}</p>
          </div>
        ) : filtered.map(r=>{
          const ss = RESERVATION_STATUS[r.status]||RESERVATION_STATUS.pendiente
          const time = r.time||r.reservation_time||''
          const name = r.customer_name||tx('Sin nombre')
          const esp = parseEspecialidad(r.notes || r.service)
          const espStyle = ESPECIALIDAD_STYLES[esp] || ESPECIALIDAD_STYLES.otro
          const mod = parseModalidad(r.notes)
          const modStyle = MODALIDAD_STYLES[mod] || MODALIDAD_STYLES.presencial
          return (
            <div key={r.id} onClick={()=>setModal(r)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:'14px 16px',marginBottom:10,cursor:'pointer',display:'flex',alignItems:'center',gap:12,transition:'all 0.12s'}}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.surface2;(e.currentTarget as HTMLElement).style.borderColor=C.borderMd}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=C.surface;(e.currentTarget as HTMLElement).style.borderColor=C.border}}>
              <div style={{width:42,height:42,borderRadius:'50%',background:C.blueDim,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:C.blue,flexShrink:0}}>
                {name[0]?.toUpperCase()||'?'}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <p style={{fontSize:14,fontWeight:600,color:C.text}}>{name}</p>
                  <span style={{fontSize:9,fontWeight:700,color:espStyle.color,background:espStyle.bg,padding:'1px 6px',borderRadius:4,border:`1px solid ${espStyle.color}30`}}>{espStyle.label}</span>
                </div>
                <p style={{fontSize:12,color:C.text2,marginTop:1}}>
                  {time.slice(0,5)} · {modStyle.icon} {modStyle.label}
                  {r.service?' · '+r.service:''}
                  {r.notes&&!r.service?' · '+r.notes.slice(0,40)+(r.notes.length>40?'...':''):''}
                </p>
              </div>
              <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:6}}>
                <span style={{fontSize:10,padding:'3px 9px',borderRadius:8,background:ss.bg,color:ss.color,fontWeight:700,border:`1px solid ${ss.color}25`,flexShrink:0}}>{tx(ss.label)}</span>
                {r.customer_phone&&<p style={{fontSize:11,color:C.text3}}>{r.customer_phone}</p>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Detail modal */}
      {modal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}} onClick={()=>setModal(null)}>
          <div style={{background:C.surface,border:`1px solid ${C.borderMd}`,borderRadius:16,padding:24,width:'100%',maxWidth:440,boxShadow:'0 20px 60px rgba(0,0,0,0.6)'}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20}}>
              <div>
                <p style={{fontSize:18,fontWeight:700,color:C.text}}>{modal.customer_name||tx('Sin nombre')}</p>
                <p style={{fontSize:13,color:C.text2,marginTop:2}}>
                  {(modal.date||modal.reservation_date)?.slice(0,10)} · {(modal.time||modal.reservation_time||'').slice(0,5)}
                </p>
              </div>
              <button onClick={()=>setModal(null)} style={{background:'none',border:'none',fontSize:22,cursor:'pointer',color:C.text3}} aria-label="Cerrar">×</button>
            </div>

            {/* Cita info */}
            <div style={{background:C.surface2,borderRadius:10,padding:'12px 14px',marginBottom:14}}>
              <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                {(()=>{const e=parseEspecialidad(modal.notes||modal.service);const s=ESPECIALIDAD_STYLES[e]||ESPECIALIDAD_STYLES.otro;return <span style={{fontSize:11,fontWeight:700,color:s.color,background:s.bg,padding:'2px 8px',borderRadius:6,border:`1px solid ${s.color}30`}}>{s.label}</span>})()}
                {(()=>{const m=parseModalidad(modal.notes);const s=MODALIDAD_STYLES[m]||MODALIDAD_STYLES.presencial;return <span style={{fontSize:11,fontWeight:600,color:C.text2,background:'rgba(255,255,255,0.06)',padding:'2px 8px',borderRadius:6}}>{s.icon} {s.label}</span>})()}
              </div>
              {modal.service&&<p style={{fontSize:13,color:C.text2,marginTop:8}}>📋 {modal.service}</p>}
            </div>

            {modal.customer_phone&&<p style={{fontSize:13,color:C.text2,marginBottom:8}}>📞 {modal.customer_phone}</p>}
            {modal.table_name&&<p style={{fontSize:13,color:C.text2,marginBottom:8}}>💼 {tx('Despacho')}: {modal.table_name}</p>}
            {modal.notes&&<p style={{fontSize:13,color:C.text2,marginBottom:16}}>📝 {modal.notes}</p>}
            {modal.source==='voice_agent'&&<p style={{fontSize:12,color:C.violet,marginBottom:16,background:C.violetDim,padding:'6px 10px',borderRadius:8}}>📞 {tx('Cita creada por el agente de voz')}</p>}

            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:8}}>
              {['confirmada','pendiente','cancelada','completada'].map(s=>(
                <button key={s} onClick={()=>updateStatus(modal.id,s)}
                  style={{padding:'7px 14px',fontSize:12,fontWeight:600,borderRadius:8,border:`1px solid ${RESERVATION_STATUS[s]?.color||C.border}40`,
                    background: modal.status===s ? RESERVATION_STATUS[s]?.bg||C.surface2 : 'transparent',
                    color: RESERVATION_STATUS[s]?.color||C.text2,cursor:'pointer',fontFamily:'inherit'}}>
                  {tx(RESERVATION_STATUS[s]?.label||s)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
