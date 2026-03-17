'use client'
export const dynamic='force-dynamic'
import{useEffect,useState,useMemo,useCallback}from'react'
import{supabase}from'@/lib/supabase'
import{BUSINESS_TEMPLATES}from'@/types'
import{CalendarDays,Bot,Users,ChevronLeft,ChevronRight}from'lucide-react'
import{PageLoader,PageHeader}from'@/components/ui'

const HOURS=Array.from({length:17},(_,i)=>`${String(i+7).padStart(2,'0')}:00`)
function isoDate(d:Date){return d.toISOString().split('T')[0]}

export default function AgendaPage(){
  const[reservations,setRes]=useState<any[]>([])
  const[loading,setLoading]=useState(true)
  const[tenantType,setType]=useState('otro')
  const[selectedDate,setDate]=useState(isoDate(new Date()))

  const loadData=useCallback(async()=>{
    const{data:{user}}=await supabase.auth.getUser()
    if(!user)return
    const{data:p}=await supabase.from('profiles').select('tenant_id').eq('id',user.id).single()
    if(!p?.tenant_id)return
    const tid=(p as any).tenant_id
    const[{data:r},{data:t}]=await Promise.all([
      supabase.from('reservations').select('*').eq('tenant_id',tid).eq('reservation_date',selectedDate).order('reservation_time'),
      supabase.from('tenants').select('type').eq('id',tid).single(),
    ])
    setRes(r||[]);if(t?.type)setType(t.type);setLoading(false)
  },[selectedDate])

  useEffect(()=>{loadData()},[loadData])

  const today=isoDate(new Date())
  const nowHour=new Date().getHours()
  const isToday=selectedDate===today

  const weekDays=useMemo(()=>{
    const pivot=new Date(selectedDate+'T12:00')
    return Array.from({length:7},(_,i)=>{
      const d=new Date(pivot);d.setDate(pivot.getDate()-3+i)
      const iso=isoDate(d)
      return{iso,num:d.getDate(),wd:d.toLocaleDateString('es-ES',{weekday:'short'}).slice(0,2).toUpperCase(),isToday:iso===today}
    })
  },[selectedDate])

  const byHour=useMemo(()=>{
    const m:Record<string,typeof reservations>={}
    reservations.forEach(r=>{const h=r.reservation_time?.slice(0,5)?.replace(/:d+$/,':00')||'??:00';if(!m[h])m[h]=[];m[h].push(r)})
    return m
  },[reservations])

  function navigate(days:number){const d=new Date(selectedDate+'T12:00');d.setDate(d.getDate()+days);setDate(isoDate(d))}

  if(loading)return<PageLoader/>
  const template=BUSINESS_TEMPLATES[tenantType]||BUSINESS_TEMPLATES.otro
  const unit=template.reservationUnit==='mesa'?'reservas':'citas'
  const dateLabel=new Date(selectedDate+'T12:00').toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'})

  return(
    <div style={{background:'var(--color-bg)',minHeight:'100vh'}}>
      <PageHeader title="Agenda" subtitle={`${reservations.length} ${unit} · ${dateLabel}`}
        actions={
          <div style={{display:'flex',alignItems:'center',gap:4}}>
            <button onClick={()=>navigate(-1)} className="btn btn-secondary btn-sm" style={{padding:'6px 9px'}}><ChevronLeft size={14}/></button>
            <button onClick={()=>setDate(today)} className="btn btn-secondary btn-sm">Hoy</button>
            <button onClick={()=>navigate(1)} className="btn btn-secondary btn-sm" style={{padding:'6px 9px'}}><ChevronRight size={14}/></button>
            <input type="date" value={selectedDate} onChange={e=>setDate(e.target.value)} className="input-base" style={{width:140,marginLeft:4}}/>
          </div>
        }/>
      <div style={{maxWidth:900,margin:'0 auto',padding:'var(--content-pad)'}}>
        <div style={{display:'flex',gap:4,background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'var(--radius-lg)',padding:6,marginBottom:16}}>
          {weekDays.map(d=>(
            <button key={d.iso} onClick={()=>setDate(d.iso)} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',padding:'7px 4px',borderRadius:8,border:'none',cursor:'pointer',background:selectedDate===d.iso?'var(--color-brand)':d.isToday?'var(--color-brand-muted)':'transparent',color:selectedDate===d.iso?'#fff':d.isToday?'var(--color-brand)':'var(--color-text-muted)',transition:'all 0.12s'}}>
              <span style={{fontSize:10,fontWeight:600,opacity:0.75}}>{d.wd}</span>
              <span style={{fontSize:15,fontWeight:700,marginTop:2}}>{d.num}</span>
            </button>
          ))}
        </div>
        <div className="card" style={{overflow:'hidden'}}>
          {HOURS.map((hour,idx)=>{
            const slots=byHour[hour]||[]
            const hourNum=parseInt(hour)
            const isPast=isToday&&hourNum<nowHour
            const isNow=isToday&&hourNum===nowHour
            return(
              <div key={hour} style={{display:'flex',alignItems:'stretch',borderTop:idx>0?'1px solid var(--color-border-light)':'none',background:isNow?'rgba(79,70,229,0.03)':'transparent',minHeight:44}}>
                <div style={{width:60,flexShrink:0,padding:'12px 0 12px 16px',display:'flex',alignItems:'flex-start',gap:4}}>
                  <span className="text-mono" style={{fontSize:12,fontWeight:500,color:isNow?'var(--color-brand)':isPast?'var(--color-text-disabled)':'var(--color-text-muted)'}}>{hour}</span>
                  {isNow&&<div style={{width:5,height:5,borderRadius:'50%',background:'var(--color-brand)',marginTop:4,flexShrink:0}}/>}
                </div>
                <div style={{flex:1,padding:'8px 12px 8px 4px',display:'flex',alignItems:'center',flexWrap:'wrap' as any,gap:6}}>
                  {slots.length===0
                    ? <div style={{width:'100%',height:1,background:'var(--color-border-light)'}}/>
                    : slots.map((r:any)=>(
                        <div key={r.id} style={{display:'inline-flex',alignItems:'center',gap:8,background:r.status==='cancelada'?'var(--color-danger-light)':'var(--color-brand)',color:r.status==='cancelada'?'var(--color-danger)':'#fff',borderRadius:8,padding:'6px 12px',fontSize:12,fontWeight:500,opacity:r.status==='cancelada'?0.7:1}}>
                          <div>
                            <div style={{display:'flex',alignItems:'center',gap:5}}><span style={{fontWeight:700}}>{r.customer_name}</span>{r.source==='voice_agent'&&<Bot size={11} style={{opacity:0.8}}/>}</div>
                            <div style={{opacity:0.8,fontSize:11,marginTop:1}}><Users size={10} style={{display:'inline',marginRight:3}}/>{r.party_size} pers.{r.table_name&&` · ${r.table_name}`}</div>
                          </div>
                        </div>
                      ))
                  }
                </div>
              </div>
            )
          })}
        </div>
        {reservations.length===0&&<p className="text-body-sm" style={{color:'var(--color-text-muted)',textAlign:'center',marginTop:20}}>Sin {unit} para este día</p>}
      </div>
    </div>
  )
}