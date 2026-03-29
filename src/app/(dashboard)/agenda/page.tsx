'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/contexts/TenantContext'
import { parseReservationConfig, ReservationConfig } from '@/lib/scheduling-engine'
import { PageLoader } from '@/components/ui'
import { RESERVATION_STATUS } from '@/lib/status-config'
import NotifBell from '@/components/NotifBell'
import Link from 'next/link'
import { C } from '@/lib/colors'

const DEFAULT_HOURS = Array.from({length:15},(_,i)=>i+8)  // 08:00 → 22:00


/** Generate short day names (Mon→LUN etc.) from locale, starting Monday */
function getDayShort(): string[] {
  const base = new Date(2024, 0, 1) // a known Monday
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base)
    d.setDate(d.getDate() + i)
    return d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase()
  })
}

/** Format month name from locale */
function fmtMonth(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'long' })
}

/** Capitalize first letter */
function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }

/** Build hour range from service_hours config — covers lunch through dinner for hosteleria, or generic 8–22 */
function buildHoursFromConfig(cfg?: ReservationConfig): number[] {
  const sh = cfg?.service_hours
  if (!sh) return DEFAULT_HOURS
  const starts: number[] = []
  const ends: number[] = []
  if (sh.lunch_start) starts.push(parseInt(sh.lunch_start.slice(0,2)))
  if (sh.dinner_start) starts.push(parseInt(sh.dinner_start.slice(0,2)))
  if (sh.lunch_end) ends.push(parseInt(sh.lunch_end.slice(0,2)))
  if (sh.dinner_end) ends.push(parseInt(sh.dinner_end.slice(0,2)))
  if (starts.length === 0 || ends.length === 0) return DEFAULT_HOURS
  const minH = Math.max(0, Math.min(...starts) - 1)  // 1h buffer before first service
  const maxH = Math.min(23, Math.max(...ends))         // include last service hour
  return Array.from({length: maxH - minH + 1}, (_, i) => i + minH)
}


function getWeekDays(base: Date): Date[] {
  const d = new Date(base)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return Array.from({length:7},(_,i)=>{ const dd=new Date(d); dd.setDate(d.getDate()+i); return dd })
}

function fmtTime(t:string){ return (t||'').slice(0,5) }


// ── Tooltip flotante ──────────────────────────────────────────────────────
function ResTooltip({r, tx}: {r:any, anchorRef?: React.RefObject<HTMLDivElement>, tx:(s:string)=>string}) {
  const cfg = RESERVATION_STATUS[r.status] || RESERVATION_STATUS.confirmada
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
        <span style={{fontSize:13,fontWeight:700,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.customer_name||tx('Sin nombre')}</span>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:5}}>
        <Row icon="🕐" text={`${fmtTime(r.time||r.reservation_time||'')} · ${ppl} ${ppl!==1?tx('personas'):tx('persona')}`}/>
        {(r.customer_phone||r.phone) && <Row icon="📞" text={r.customer_phone||r.phone}/>}
        {r.table_name && <Row icon="🪑" text={r.table_name}/>}
        {r.notes && <Row icon="📝" text={r.notes} muted/>}
      </div>
      <span style={{
        display:'inline-block',marginTop:10,
        fontSize:10,fontWeight:700,letterSpacing:'0.04em',textTransform:'uppercase',
        color:cfg.color,background:cfg.bg,padding:'3px 10px',borderRadius:20
      }}>{tx(cfg.label)}</span>
    </div>
  )
}

function Row({icon,text,muted}:{icon:string,text:string,muted?:boolean}) {
  return (
    <div style={{display:'flex',gap:7,alignItems:'flex-start'}}>
      <span style={{fontSize:11,flexShrink:0,marginTop:1}}>{icon}</span>
      <span style={{fontSize:12,color:muted?C.muted:'#94a3b8',lineHeight:1.4,wordBreak:'break-word'}}>{text}</span>
    </div>
  )
}


// ── Bloque de reserva en la celda ─────────────────────────────────────────
function ResBlock({r, onHover, onLeave, tx}: {r:any, onHover:(e:React.MouseEvent,r:any)=>void, onLeave:()=>void, tx:(s:string)=>string}) {
  const cfg = RESERVATION_STATUS[r.status] || RESERVATION_STATUS.confirmada
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
      <p style={{fontSize:11.5,fontWeight:700,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',lineHeight:1.3}}>{r.customer_name||tx('Sin nombre')}</p>
      <p style={{fontSize:10,color:C.text2,marginTop:1}}>{time} · {ppl}p</p>
    </div>
  )
}


// ── Página principal ──────────────────────────────────────────────────────
export default function AgendaPage() {
  const { tenant, template, loading: tenantLoading, tx } = useTenant()
  const L = template?.labels
  const DAY_SHORT = getDayShort()
  const [base,setBase]   = useState(new Date())
  const [res,setRes]     = useState<any[]>([])
  const [loading,setLoad]= useState(true)
  const [tooltip,setTooltip] = useState<{r:any,x:number,y:number}|null>(null)
  const [isMobile,setIsMobile] = useState(false)
  const [mobileDay,setMobileDay] = useState(() => { const d = new Date().getDay(); return d === 0 ? 6 : d - 1 })
  const [schedCfg,setSchedCfg] = useState<ReservationConfig|null>(null)

  // Detect mobile viewport
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const load = useCallback(async(tenantId:string)=>{
    setLoad(true)
    const week = getWeekDays(base)
    const from = week[0].toISOString().slice(0,10)
    const to   = week[6].toISOString().slice(0,10)
    const [resResult, tenantResult] = await Promise.all([
      supabase.from('reservations').select('*')
        .eq('tenant_id',tenantId).gte('date',from).lte('date',to)
        .not('status','in','("cancelada","cancelled")')
        .order('time',{ascending:true}),
      supabase.from('tenants').select('reservation_config,type')
        .eq('id',tenantId).maybeSingle()
    ])
    setRes(resResult.data||[])
    if (tenantResult.data?.reservation_config) {
      setSchedCfg(parseReservationConfig(tenantResult.data.reservation_config))
    }
    setLoad(false)
  },[base])

  useEffect(()=>{
    if (tenantLoading) return
    if (!tenant?.id) { setLoad(false); return }
    load(tenant.id)
  },[load, tenant?.id, tenantLoading])

  if(loading || tenantLoading) return <PageLoader/>

  const HOURS  = buildHoursFromConfig(schedCfg ?? undefined)
  const week   = getWeekDays(base)
  const todayIso = new Date().toISOString().slice(0,10)
  const visibleDays = isMobile ? [week[mobileDay]] : week
  const colCount = visibleDays.length
  const weekFrom = week[0], weekTo = week[6]
  const weekLabel = weekFrom.getMonth()===weekTo.getMonth()
    ? `${weekFrom.getDate()} – ${weekTo.getDate()} ${cap(fmtMonth(weekTo))} ${weekTo.getFullYear()}`
    : `${weekFrom.getDate()} ${cap(fmtMonth(weekFrom))} – ${weekTo.getDate()} ${cap(fmtMonth(weekTo))} ${weekTo.getFullYear()}`

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


  const today_bg = 'rgba(240,168,78,0.06)'
  const todayBorder = 'rgba(240,168,78,0.25)'

  return (
    <div style={{background:C.bg,minHeight:'100vh',display:'flex',flexDirection:'column',fontFamily:"'Sora',-apple-system,sans-serif"}}>
      <style>{`
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#2d3748;border-radius:3px}
        .nav-btn{background:transparent;border:1px solid ${C.border};border-radius:9px;padding:7px 14px;color:${C.text2};font-size:13px;cursor:pointer;font-family:inherit;transition:all 0.15s}
        .nav-btn:hover{background:${C.surface2};color:${C.text}}
        .today-btn{background:rgba(240,168,78,0.10);border:1px solid rgba(240,168,78,0.30);border-radius:9px;padding:7px 16px;color:${C.amber};font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:all 0.15s}
        .today-btn:hover{background:rgba(240,168,78,0.18)}
        .res-cell:hover{background:${C.surface2}}
        .new-btn{background:linear-gradient(135deg,${C.amber},#E8923A);color:${C.bg};font-weight:700;font-size:13px;padding:8px 18px;border:none;border-radius:10px;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:6px;text-decoration:none;transition:all 0.15s}
        .new-btn:hover{transform:translateY(-1px);box-shadow:0 4px 16px rgba(240,168,78,0.3)}
      `}</style>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div style={{background:C.surface,backdropFilter:'blur(16px)',WebkitBackdropFilter:'blur(16px)',borderBottom:`1px solid ${C.border}`,padding:isMobile?'10px 12px':'14px 24px',position:'sticky',top:0,zIndex:30,display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
        <div style={{display:'flex',alignItems:'center',gap:isMobile?10:20}}>
          <div>
            <h1 style={{fontSize:isMobile?15:17,fontWeight:700,color:C.text,lineHeight:1.2}}>{tx('Agenda')}</h1>
            <p style={{fontSize:11,color:C.muted,marginTop:2}}>{weekLabel}</p>
          </div>
          <div style={{display:'flex',gap:6,alignItems:'center'}}>
            <button className="nav-btn" onClick={()=>setBase(d=>{const n=new Date(d);n.setDate(n.getDate()-7);return n})} aria-label="Anterior">‹</button>
            <button className="today-btn" onClick={()=>{setBase(new Date());setMobileDay(()=>{const d=new Date().getDay();return d===0?6:d-1})}}>{tx('Hoy')}</button>
            <button className="nav-btn" onClick={()=>setBase(d=>{const n=new Date(d);n.setDate(n.getDate()+7);return n})} aria-label="Siguiente">›</button>
          </div>
        </div>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          {!isMobile && <div style={{display:'flex',gap:16,marginRight:8}}>
            <Stat label={tx('Esta semana')} value={totalThisWeek} color={C.amber}/>
            <Stat label={tx('Hoy')} value={todayCount} color="#34d399"/>
          </div>}
          <Link href="/reservas/nueva" className="new-btn">
            <span style={{fontSize:16,lineHeight:1}}>+</span>{!isMobile&&` ${tx('Nueva')} ${L?.reserva || tx('reserva')}`}
          </Link>
          <NotifBell/>
        </div>
      </div>

      {/* ── Mobile day selector ──────────────────────────────────────────── */}
      {isMobile && (
        <div style={{display:'flex',gap:4,padding:'8px 12px',background:C.surface,borderBottom:`1px solid ${C.border}`,overflowX:'auto'}}>
          {week.map((d,i)=>{
            const iso = d.toISOString().slice(0,10)
            const isToday = iso===todayIso
            const isSelected = i===mobileDay
            const cnt = res.filter(r=>(r.date||r.reservation_date)===iso).length
            return (
              <button key={iso} onClick={()=>setMobileDay(i)} style={{
                flex:'1 0 0',minWidth:42,padding:'6px 4px',borderRadius:10,border:'none',cursor:'pointer',
                background:isSelected?(isToday?C.amber:C.surface2):'transparent',
                display:'flex',flexDirection:'column',alignItems:'center',gap:2,fontFamily:'inherit',
              }}>
                <span style={{fontSize:9,fontWeight:600,color:isSelected&&isToday?C.bg:isToday?C.amber:C.muted}}>{DAY_SHORT[i]}</span>
                <span style={{fontSize:14,fontWeight:isSelected?700:500,color:isSelected&&isToday?C.bg:isSelected?C.text:C.text2}}>{d.getDate()}</span>
                {cnt>0&&<span style={{fontSize:8,fontWeight:700,color:isToday?C.amber:'#818cf8'}}>{cnt}</span>}
              </button>
            )
          })}
        </div>
      )}


      {/* ── Calendario ───────────────────────────────────────────────────── */}
      <div className="rz-page-enter" style={{flex:1,overflow:'auto'}}>
        <div style={{minWidth:isMobile?0:820}}>

          {/* Cabecera días (hidden on mobile — day selector above replaces it) */}
          {!isMobile && (
          <div style={{display:'grid',gridTemplateColumns:`64px repeat(${colCount},1fr)`,background:C.surface,borderBottom:`2px solid ${C.border}`,position:'sticky',top:0,zIndex:20}}>
            <div style={{padding:'12px 0',borderRight:`1px solid ${C.border}`}}/>
            {visibleDays.map((d,i)=>{
              const iso = d.toISOString().slice(0,10)
              const isToday = iso===todayIso
              const dayIdx = week.indexOf(d)
              const cnt = res.filter(r=>(r.date||r.reservation_date)===iso).length
              return (
                <div key={iso} style={{padding:'10px 8px',textAlign:'center',borderRight:`1px solid ${C.border}`,background:isToday?today_bg:'transparent'}}>
                  <p style={{fontSize:10,fontWeight:600,letterSpacing:'0.06em',color:isToday?C.amber:C.muted,marginBottom:4}}>{DAY_SHORT[dayIdx]}</p>
                  <div style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:32,height:32,borderRadius:'50%',background:isToday?C.amber:'transparent',margin:'0 auto'}}>
                    <span style={{fontSize:16,fontWeight:isToday?700:500,color:isToday?C.bg:C.text}}>{d.getDate()}</span>
                  </div>
                  {cnt>0&&<div style={{marginTop:5}}><span style={{fontSize:10,fontWeight:600,color:isToday?C.amber:'#818cf8',background:isToday?'rgba(240,168,78,0.15)':'rgba(129,140,248,0.15)',padding:'2px 8px',borderRadius:10}}>{cnt}</span></div>}
                </div>
              )
            })}
          </div>
          )}

          {/* Franjas horarias */}
          {HOURS.map(hour=>{
            const hasAny = visibleDays.some(d=>getResForCell(d.toISOString().slice(0,10),hour).length>0)
            return (
              <div key={hour} style={{display:'grid',gridTemplateColumns:`${isMobile?'48px':'64px'} repeat(${colCount},1fr)`,borderBottom:`1px solid ${C.border}`,minHeight:isMobile?50:60,background:hasAny?C.surface2:'transparent'}}>
                <div style={{padding:isMobile?'8px 6px 0 0':'10px 10px 0 0',textAlign:'right',borderRight:`1px solid ${C.border}`,flexShrink:0}}>
                  <span style={{fontSize:11,fontWeight:600,color:C.muted}}>{hour.toString().padStart(2,'0')}:00</span>
                </div>
                {visibleDays.map((d,di)=>{
                  const iso = d.toISOString().slice(0,10)
                  const isToday = iso===todayIso
                  const cellRes = getResForCell(iso,hour)
                  return (
                    <div key={di} className="res-cell" style={{borderRight:`1px solid ${C.border}`,padding:'4px 5px',background:isToday?today_bg:'transparent',transition:'background 0.1s',minHeight:isMobile?50:60}}>
                      {cellRes.map(r=>(
                        <ResBlock key={r.id} r={r} onHover={handleHover} onLeave={()=>setTooltip(null)} tx={tx}/>
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
                <span style={{fontSize:11,color:C.muted,textTransform:'capitalize'}}>{tx(RESERVATION_STATUS[k]?.label||k)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tooltip flotante ─────────────────────────────────────────────── */}
      {tooltip&&<div style={{position:'fixed',left:Math.min(tooltip.x,window.innerWidth-250),top:Math.max(8,Math.min(tooltip.y,window.innerHeight-200)),zIndex:9999,pointerEvents:'none'}}>
        <ResTooltip r={tooltip.r} tx={tx}/>
      </div>}
    </div>
  )
}

function Stat({label,value,color}:{label:string,value:number,color:string}) {
  return (
    <div style={{textAlign:'center'}}>
      <p style={{fontSize:20,fontWeight:800,color,lineHeight:1}}>{value}</p>
      <p style={{fontSize:10,color:C.muted,marginTop:2}}>{label}</p>
    </div>
  )
}
