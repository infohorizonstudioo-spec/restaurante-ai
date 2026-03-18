'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { PageLoader } from '@/components/ui'

const HOURS = Array.from({length:14},(_,i)=>(i+9).toString().padStart(2,'0')+':00')
const DAYS = ['LU','MA','MI','JU','VI','SA','DO']

function getWeekMon(base: Date) {
  const d = new Date(base)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day // semana empieza en lunes
  d.setDate(d.getDate() + diff)
  return Array.from({length:7},(_,i)=>{ const dd=new Date(d); dd.setDate(d.getDate()+i); return dd })
}

const STATUS_COL:Record<string,string> = {
  confirmada:'#1d4ed8',confirmed:'#1d4ed8',
  pendiente:'#d97706',pending:'#d97706',
  cancelada:'#dc2626',cancelled:'#dc2626',
  completada:'#059669',completed:'#059669',
}

export default function AgendaPage(){
  const [base,setBase]   = useState(new Date())
  const [res,setRes]     = useState<any[]>([])
  const [loading,setLoad]= useState(true)
  const [tid,setTid]     = useState<string|null>(null)
  const [hoverRes,setHover] = useState<any|null>(null)

  const load = useCallback(async(tenantId:string)=>{
    const week = getWeekMon(base)
    const from = week[0].toISOString().slice(0,10)
    const to   = week[6].toISOString().slice(0,10)
    const {data} = await supabase.from('reservations').select('*')
      .eq('tenant_id',tenantId).gte('date',from).lte('date',to)
      .in('status',['confirmada','confirmed','pendiente','pending'])
    setRes(data||[])
    setLoad(false)
  },[base])

  useEffect(()=>{
    (async()=>{
      const {data:{user}} = await supabase.auth.getUser(); if(!user) return
      const {data:p} = await supabase.from('profiles').select('tenant_id').eq('id',user.id).single(); if(!p?.tenant_id) return
      setTid(p.tenant_id); await load(p.tenant_id)
    })()
  },[load])

  if(loading) return <PageLoader/>
  const week = getWeekMon(base)
  const today = new Date().toISOString().slice(0,10)

  function getRes(dayIso:string, hour:string) {
    return res.filter(r => {
      const d = r.date||r.reservation_date||''
      const t = (r.time||r.reservation_time||'00:00').slice(0,5)
      return d===dayIso && t>=hour && t<(parseInt(hour)+1).toString().padStart(2,'0')+':00'
    })
  }

  return (
    <div style={{background:'#0C1018',minHeight:'100vh',display:'flex',flexDirection:'column'}}>
      <div style={{background:'#131920',borderBottom:'1px solid rgba(255,255,255,0.07)',padding:'14px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:20}}>
        <div>
          <h1 style={{fontSize:18,fontWeight:700,color:'#E8EEF6'}}>Agenda semanal</h1>
          <p style={{fontSize:12,color:'#49566A',marginTop:1}}>{res.length} reservas esta semana</p>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <button onClick={()=>setBase(d=>{const n=new Date(d);n.setDate(n.getDate()-7);return n})} style={{padding:'6px 12px',background:'#131920',border:'1px solid rgba(255,255,255,0.07)',borderRadius:8,cursor:'pointer',fontSize:13}}>‹ Anterior</button>
          <button onClick={()=>setBase(new Date())} style={{padding:'6px 12px',background:'rgba(96,165,250,0.10)',border:'1px solid #bfdbfe',borderRadius:8,cursor:'pointer',fontSize:13,color:'#F0A84E',fontWeight:600}}>Hoy</button>
          <button onClick={()=>setBase(d=>{const n=new Date(d);n.setDate(n.getDate()+7);return n})} style={{padding:'6px 12px',background:'#131920',border:'1px solid rgba(255,255,255,0.07)',borderRadius:8,cursor:'pointer',fontSize:13}}>Siguiente ›</button>
        </div>
      </div>

      <div style={{flex:1,overflow:'auto',padding:'0 0 20px'}}>
        <div style={{minWidth:800}}>
          {/* Header días */}
          <div style={{display:'grid',gridTemplateColumns:'60px repeat(7,1fr)',background:'#131920',borderBottom:'2px solid rgba(255,255,255,0.09)',position:'sticky',top:0,zIndex:20}}>
            <div/>
            {week.map((d,i)=>{
              const iso = d.toISOString().slice(0,10)
              const isToday = iso===today
              const cnt = res.filter(r=>(r.date||r.reservation_date)===iso).length
              return (
                <div key={iso} style={{padding:'10px 4px',textAlign:'center',borderLeft:'1px solid #f1f5f9'}}>
                  <p style={{fontSize:10,fontWeight:700,color:isToday?'#1d4ed8':'#94a3b8',textTransform:'uppercase',letterSpacing:'0.05em'}}>{DAYS[i]}</p>
                  <p style={{fontSize:18,fontWeight:isToday?700:500,color:isToday?'#1d4ed8':'#374151'}}>{d.getDate()}</p>
                  {cnt>0&&<span style={{fontSize:10,background:isToday?'#1d4ed8':'#e2e8f0',color:isToday?'white':'#374151',borderRadius:8,padding:'1px 6px',fontWeight:600}}>{cnt}</span>}
                </div>
              )
            })}
          </div>

          {/* Grid horas */}
          {HOURS.map(hour=>(
            <div key={hour} style={{display:'grid',gridTemplateColumns:'60px repeat(7,1fr)',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
              <div style={{padding:'8px 6px',textAlign:'right',fontSize:11,color:'#49566A',fontWeight:600,paddingTop:10}}>{hour}</div>
              {week.map((d,di)=>{
                const iso = d.toISOString().slice(0,10)
                const cellRes = getRes(iso, hour)
                const isToday = iso===today
                return (
                  <div key={di} style={{borderLeft:'1px solid #f1f5f9',minHeight:52,padding:'2px 3px',background:isToday?'#fafcff':'transparent',position:'relative'}}>
                    {cellRes.map(r=>{
                      const color = STATUS_COL[r.status]||'#1d4ed8'
                      const ppl = r.people||r.party_size||1
                      return (
                        <div key={r.id}
                          onMouseEnter={()=>setHover(r)} onMouseLeave={()=>setHover(null)}
                          style={{background:color+'18',border:'1px solid '+color+'44',borderLeft:'3px solid '+color,borderRadius:5,padding:'3px 5px',marginBottom:2,cursor:'pointer',position:'relative'}}>
                          <p style={{fontSize:11,fontWeight:700,color,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.customer_name||'—'}</p>
                          <p style={{fontSize:10,color:'#8895A7'}}>{(r.time||r.reservation_time||'').slice(0,5)} · {ppl}p</p>
                          {hoverRes?.id===r.id&&(
                            <div style={{position:'absolute',left:'100%',top:0,zIndex:50,background:'#131920',border:'1px solid rgba(255,255,255,0.07)',borderRadius:10,padding:'10px 14px',width:200,boxShadow:'0 4px 16px rgba(0,0,0,0.12)',pointerEvents:'none'}}>
                              <p style={{fontSize:13,fontWeight:700,color:'#E8EEF6',marginBottom:4}}>{r.customer_name}</p>
                              <p style={{fontSize:12,color:'#8895A7'}}>{(r.date||r.reservation_date)?.slice(0,10)} {(r.time||r.reservation_time||'').slice(0,5)}</p>
                              <p style={{fontSize:12,color:'#8895A7'}}>{ppl} persona{ppl!==1?'s':''}{r.table_name?' · '+r.table_name:''}</p>
                              {r.notes&&<p style={{fontSize:11,color:'#49566A',marginTop:4,fontStyle:'italic'}}>{r.notes}</p>}
                              <span style={{fontSize:10,fontWeight:700,color,background:color+'18',padding:'2px 7px',borderRadius:6,display:'inline-block',marginTop:4}}>{r.status}</span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}