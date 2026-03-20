'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { PageLoader } from '@/components/ui'
import NotifBell from '@/components/NotifBell'
import Link from 'next/link'

const HOURS = Array.from({length:15},(_,i)=>i+8)  // 08:00 → 22:00
const DAY_LABELS = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']
const DAY_SHORT  = ['LUN','MAR','MIÉ','JUE','VIE','SÁB','DOM']
const MONTH_ES   = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const STATUS_CFG: Record<string,{color:string;bg:string;label:string}> = {
  confirmada: {color:'#34d399',bg:'rgba(52,211,153,0.12)',label:'Confirmada'},
  confirmed:  {color:'#34d399',bg:'rgba(52,211,153,0.12)',label:'Confirmada'},
  pendiente:  {color:'#fbbf24',bg:'rgba(251,191,36,0.12)', label:'Pendiente'},
  pending:    {color:'#fbbf24',bg:'rgba(251,191,36,0.12)', label:'Pendiente'},
  cancelada:  {color:'#f87171',bg:'rgba(248,113,113,0.12)',label:'Cancelada'},
  cancelled:  {color:'#f87171',bg:'rgba(248,113,113,0.12)',label:'Cancelada'},
  completada: {color:'#818cf8',bg:'rgba(129,140,248,0.12)',label:'Completada'},
  completed:  {color:'#818cf8',bg:'rgba(129,140,248,0.12)',label:'Completada'},
}

function getWeekDays(base: Date): Date[] {
  const d = new Date(base)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return Array.from({length:7},(_,i)=>{ const dd=new Date(d); dd.setDate(d.getDate()+i); return dd })
}

function fmtTime(t:string){ return (t||'').slice(0,5) }
function fmtDate(d:Date){ return `${d.getDate()} ${MONTH_ES[d.getMonth()]} ${d.getFullYear()}` }


// ── Tooltip flotante ──────────────────────────────────────────────────────
function ResTooltip({r, anchorRef}: {r:any, anchorRef: React.RefObject<HTMLDivElement>}) {
  const cfg = STATUS_CFG[r.status] || STATUS_CFG.confirmada
  const ppl = r.people || r.party_size || 1
  return (
    <div style={{
      position:'fixed', zIndex:9999,
      background:'#161D2A', border:'1px solid rgba(255,255,255,0.12)',
      borderRadius:14, padding:'16px 18px', width:230,
      boxShadow:'0 8px 32px rgba(0,0,0,0.5)',
      pointerEvents:'none',
    }}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
        <div style={{width:10,height:10,borderRadius:'50%',background:cfg.color,flexShrink:0}}/>
        <span style={{fontSize:13,fontWeight:700,color:'#E8EEF6',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.customer_name||'Sin nombre'}</span>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:5}}>
        <Row icon="🕐" text={`${fmtTime(r.time||r.reservation_time||'')} · ${ppl} persona${ppl!==1?'s':''}`}/>
        {(r.customer_phone||r.phone) && <Row icon="📞" text={r.customer_phone||r.phone}/>}
        {r.table_name && <Row icon="🪑" text={r.table_name}/>}
        {r.notes && <Row icon="📝" text={r.notes} muted/>}
      </div>
      <span style={{
        display:'inline-block',marginTop:10,
        fontSize:10,fontWeight:700,letterSpacing:'0.04em',textTransform:'uppercase',
        color:cfg.color,background:cfg.bg,padding:'3px 10px',borderRadius:20
      }}>{cfg.label}</span>
    </div>
  )
}

function Row({icon,text,muted}:{icon:string,text:string,muted?:boolean}) {
  return (
    <div style={{display:'flex',gap:7,alignItems:'flex-start'}}>
      <span style={{fontSize:11,flexShrink:0,marginTop:1}}>{icon}</span>
      <span style={{fontSize:12,color:muted?'#49566A':'#94a3b8',lineHeight:1.4,wordBreak:'break-word'}}>{text}</span>
    </div>
  )
}


// ── Bloque de reserva en la celda ─────────────────────────────────────────
function ResBlock({r, onHover, onLeave}: {r:any, onHover:(e:React.MouseEvent,r:any)=>void, onLeave:()=>void}) {
  const cfg = STATUS_CFG[r.status] || STATUS_CFG.confirmada
  const ppl = r.people || r.party_size || 1
  const time = fmtTime(r.time || r.reservation_time || '')
  return (
    <div
      onMouseEnter={e=>onHover(e,r)}
      onMouseLeave={onLeave}
      style={{
        background:cfg.bg, borderLeft:`3px solid ${cfg.color}`,
        borderRadius:'0 7px 7px 0', padding:'5px 8px', marginBottom:3,
        cursor:'pointer', transition:'all 0.15s',
        border:`1px solid ${cfg.color}22`,
        borderLeftWidth:3, borderLeftColor:cfg.color,
      }}
    >
      <p style={{fontSize:11.5,fontWeight:700,color:'#E8EEF6',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',lineHeight:1.3}}>{r.customer_name||'Sin nombre'}</p>
      <p style={{fontSize:10,color:'#8895A7',marginTop:1}}>{time} · {ppl}p</p>
    </div>
  )
}


// ── Página principal ──────────────────────────────────────────────────────
export default function AgendaPage() {
  const [base,setBase]   = useState(new Date())
  const [res,setRes]     = useState<any[]>([])
  const [loading,setLoad]= useState(true)
  const [tid,setTid]     = useState<string|null>(null)
  const [tooltip,setTooltip] = useState<{r:any,x:number,y:number}|null>(null)
  const anchorRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async(tenantId:string)=>{
    const week = getWeekDays(base)
    const from = week[0].toISOString().slice(0,10)
    const to   = week[6].toISOString().slice(0,10)
    const {data} = await supabase.from('reservations').select('*')
      .eq('tenant_id',tenantId).gte('date',from).lte('date',to)
      .not('status','in','("cancelada","cancelled")')
      .order('time',{ascending:true})
    setRes(data||[])
    setLoad(false)
  },[base])

  useEffect(()=>{
    (async()=>{
      const {data:{user}} = await supabase.auth.getUser(); if(!user) return
      const {data:p} = await supabase.from('profiles').select('tenant_id').eq('id',user.id).maybeSingle(); if(!p?.tenant_id) return
      setTid(p.tenant_id); await load(p.tenant_id)
    })()
  },[load])

  if(loading) return <PageLoader/>

  const week   = getWeekDays(base)
  const todayIso = new Date().toISOString().slice(0,10)
  const weekFrom = week[0], weekTo = week[6]
  const weekLabel = weekFrom.getMonth()===weekTo.getMonth()
    ? `${weekFrom.getDate()} – ${weekTo.getDate()} ${MONTH_ES[weekTo.getMonth()]} ${weekTo.getFullYear()}`
    : `${weekFrom.getDate()} ${MONTH_ES[weekFrom.getMonth()]} – ${weekTo.getDate()} ${MONTH_ES[weekTo.getMonth()]} ${weekTo.getFullYear()}`

  const totalThisWeek = res.length
  const todayCount = res.filter(r=>(r.date||r.reservation_date)===todayIso).length

  function getResForCell(dayIso:string, hour:number) {
    return res.filter(r=>{
      const d = r.date||r.reservation_date||''
      const t = parseInt((r.time||r.reservation_time||'00:00').slice(0,2))
      return d===dayIso && t===hour
    })
  }

  function handleHover(e:React.MouseEvent, r:any) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setTooltip({r, x: rect.right+8, y: rect.top})
  }


  const C = {
    bg:'#0C1018', card:'#131920', border:'rgba(255,255,255,0.07)',
    text:'#E8EEF6', muted:'#49566A', sub:'#8895A7', amber:'#F0A84E',
    today:'rgba(240,168,78,0.06)', todayBorder:'rgba(240,168,78,0.25)',
  }

  return (
    <div style={{background:C.bg,minHeight:'100vh',display:'flex',flexDirection:'column',fontFamily:"'Sora',-apple-system,sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#2d3748;border-radius:3px}
        .nav-btn{background:transparent;border:1px solid ${C.border};border-radius:9px;padding:7px 14px;color:${C.sub};font-size:13px;cursor:pointer;font-family:inherit;transition:all 0.15s}
        .nav-btn:hover{background:rgba(255,255,255,0.05);color:${C.text}}
        .today-btn{background:rgba(240,168,78,0.10);border:1px solid rgba(240,168,78,0.30);border-radius:9px;padding:7px 16px;color:${C.amber};font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:all 0.15s}
        .today-btn:hover{background:rgba(240,168,78,0.18)}
        .res-cell:hover{background:rgba(255,255,255,0.02)}
        .new-btn{background:linear-gradient(135deg,#F0A84E,#E8923A);color:#0C1018;font-weight:700;font-size:13px;padding:8px 18px;border:none;border-radius:10px;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:6px;text-decoration:none;transition:all 0.15s}
        .new-btn:hover{transform:translateY(-1px);box-shadow:0 4px 16px rgba(240,168,78,0.3)}
      `}</style>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div style={{background:C.card,borderBottom:`1px solid ${C.border}`,padding:'14px 24px',position:'sticky',top:0,zIndex:30,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:20}}>
          <div>
            <h1 style={{fontSize:17,fontWeight:700,color:C.text,lineHeight:1.2}}>Agenda</h1>
            <p style={{fontSize:12,color:C.muted,marginTop:2}}>{weekLabel}</p>
          </div>
          <div style={{display:'flex',gap:6,alignItems:'center'}}>
            <button className="nav-btn" onClick={()=>setBase(d=>{const n=new Date(d);n.setDate(n.getDate()-7);return n})}>‹</button>
            <button className="today-btn" onClick={()=>setBase(new Date())}>Hoy</button>
            <button className="nav-btn" onClick={()=>setBase(d=>{const n=new Date(d);n.setDate(n.getDate()+7);return n})}>›</button>
          </div>
        </div>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <div style={{display:'flex',gap:16,marginRight:8}}>
            <Stat label="Esta semana" value={totalThisWeek} color={C.amber}/>
            <Stat label="Hoy" value={todayCount} color="#34d399"/>
          </div>
          <Link href="/reservas/nueva" className="new-btn">
            <span style={{fontSize:16,lineHeight:1}}>+</span> Nueva reserva
          </Link>
          <NotifBell/>
        </div>
      </div>


      {/* ── Calendario ───────────────────────────────────────────────────── */}
      <div style={{flex:1,overflow:'auto'}}>
        <div style={{minWidth:820}}>

          {/* Cabecera días */}
          <div style={{display:'grid',gridTemplateColumns:'64px repeat(7,1fr)',background:C.card,borderBottom:`2px solid ${C.border}`,position:'sticky',top:0,zIndex:20}}>
            <div style={{padding:'12px 0',borderRight:`1px solid ${C.border}`}}/>
            {week.map((d,i)=>{
              const iso = d.toISOString().slice(0,10)
              const isToday = iso===todayIso
              const cnt = res.filter(r=>(r.date||r.reservation_date)===iso).length
              return (
                <div key={iso} style={{padding:'10px 8px',textAlign:'center',borderRight:`1px solid ${C.border}`,background:isToday?C.today:'transparent'}}>
                  <p style={{fontSize:10,fontWeight:600,letterSpacing:'0.06em',color:isToday?C.amber:C.muted,marginBottom:4}}>{DAY_SHORT[i]}</p>
                  <div style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:32,height:32,borderRadius:'50%',background:isToday?C.amber:'transparent',margin:'0 auto'}}>
                    <span style={{fontSize:16,fontWeight:isToday?700:500,color:isToday?'#0C1018':C.text}}>{d.getDate()}</span>
                  </div>
                  {cnt>0&&<div style={{marginTop:5}}><span style={{fontSize:10,fontWeight:600,color:isToday?C.amber:'#818cf8',background:isToday?'rgba(240,168,78,0.15)':'rgba(129,140,248,0.15)',padding:'2px 8px',borderRadius:10}}>{cnt}</span></div>}
                </div>
              )
            })}
          </div>

          {/* Franjas horarias */}
          {HOURS.map(hour=>{
            const hasAny = week.some(d=>getResForCell(d.toISOString().slice(0,10),hour).length>0)
            return (
              <div key={hour} style={{display:'grid',gridTemplateColumns:'64px repeat(7,1fr)',borderBottom:`1px solid rgba(255,255,255,0.04)`,minHeight:60,background:hasAny?'rgba(255,255,255,0.005)':'transparent'}}>
                <div style={{padding:'10px 10px 0 0',textAlign:'right',borderRight:`1px solid ${C.border}`,flexShrink:0}}>
                  <span style={{fontSize:11,fontWeight:600,color:C.muted}}>{hour.toString().padStart(2,'0')}:00</span>
                </div>
                {week.map((d,di)=>{
                  const iso = d.toISOString().slice(0,10)
                  const isToday = iso===todayIso
                  const cellRes = getResForCell(iso,hour)
                  return (
                    <div key={di} className="res-cell" style={{borderRight:`1px solid ${C.border}`,padding:'4px 5px',background:isToday?C.today:'transparent',transition:'background 0.1s',minHeight:60}}>
                      {cellRes.map(r=>(
                        <ResBlock key={r.id} r={r} onHover={handleHover} onLeave={()=>setTooltip(null)}/>
                      ))}
                    </div>
                  )
                })}
              </div>
            )
          })}

          {/* Footer: leyenda */}
          <div style={{display:'flex',gap:20,padding:'16px 24px',borderTop:`1px solid ${C.border}`}}>
            {Object.entries({confirmada:'#34d399',pendiente:'#fbbf24',completada:'#818cf8'}).map(([k,c])=>(
              <div key={k} style={{display:'flex',alignItems:'center',gap:6}}>
                <div style={{width:10,height:10,borderRadius:'50%',background:c}}/>
                <span style={{fontSize:11,color:C.muted,textTransform:'capitalize'}}>{STATUS_CFG[k]?.label||k}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tooltip flotante ─────────────────────────────────────────────── */}
      {tooltip&&<div style={{position:'fixed',left:Math.min(tooltip.x,window.innerWidth-250),top:Math.max(8,Math.min(tooltip.y,window.innerHeight-200)),zIndex:9999,pointerEvents:'none'}}>
        <ResTooltip r={tooltip.r} anchorRef={anchorRef}/>
      </div>}
    </div>
  )
}

function Stat({label,value,color}:{label:string,value:number,color:string}) {
  return (
    <div style={{textAlign:'center'}}>
      <p style={{fontSize:20,fontWeight:800,color,lineHeight:1}}>{value}</p>
      <p style={{fontSize:10,color:'#49566A',marginTop:2}}>{label}</p>
    </div>
  )
}
