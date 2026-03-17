'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { PageLoader } from '@/components/ui'

const SL:Record<string,string> = {completed:'Completada','in-progress':'En curso',failed:'Fallida',pending:'Pendiente'}
const SC:Record<string,string> = {completed:'#059669','in-progress':'#1d4ed8',failed:'#dc2626',pending:'#d97706'}
const SB:Record<string,string> = {completed:'#f0fdf4','in-progress':'#eff6ff',failed:'#fef2f2',pending:'#fffbeb'}

function groupByDate(calls:any[]){
  const m=new Map<string,any[]>()
  for(const c of calls){
    const d=(c.started_at||c.created_at||'')?.slice(0,10)||'Desconocida'
    if(!m.has(d))m.set(d,[]);m.get(d)!.push(c)
  }
  return [...m.entries()].sort((a,b)=>b[0].localeCompare(a[0]))
}

function fmt(sec:number|null){
  if(!sec)return null
  const m=Math.floor(sec/60),s=sec%60
  return m>0?m+'m '+s+'s':s+'s'
}

export default function LlamadasPage(){
  const [calls,setCalls]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [open,setOpen]=useState<Set<string>>(new Set())
  const [tid,setTid]=useState<string|null>(null)

  const load=useCallback(async(tenantId:string)=>{
    const {data}=await supabase.from('calls').select('*')
      .eq('tenant_id',tenantId).order('started_at',{ascending:false}).limit(200)
    setCalls(data||[]);setLoading(false)
  },[])

  useEffect(()=>{
    (async()=>{
      const {data:{user}}=await supabase.auth.getUser();if(!user)return
      const {data:p}=await supabase.from('profiles').select('tenant_id').eq('id',user.id).single();if(!p?.tenant_id)return
      setTid(p.tenant_id);await load(p.tenant_id)
    })()
  },[load])

  useEffect(()=>{
    if(!tid)return
    const ch=supabase.channel('calls-rt')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'calls',filter:'tenant_id=eq.'+tid},()=>load(tid))
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'calls',filter:'tenant_id=eq.'+tid},()=>load(tid))
      .subscribe()
    return()=>{supabase.removeChannel(ch)}
  },[tid,load])

  if(loading)return<PageLoader/>
  const groups=groupByDate(calls)
  const today=new Date().toISOString().slice(0,10)
  const toggle=(id:string)=>setOpen(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n})

  return(
    <div style={{background:'#f8fafc',minHeight:'100vh'}}>
      <div style={{background:'white',borderBottom:'1px solid #e2e8f0',padding:'16px 28px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <h1 style={{fontSize:18,fontWeight:700,color:'#0f172a'}}>Llamadas</h1>
          <p style={{fontSize:12,color:'#94a3b8',marginTop:2}}>{calls.length} total</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          {(['completed','in-progress','failed'] as const).map(s=>(
            <span key={s} style={{fontSize:11,padding:'3px 9px',borderRadius:10,background:SB[s],color:SC[s],fontWeight:600}}>
              {calls.filter(c=>c.status===s).length} {SL[s]}
            </span>
          ))}
        </div>
      </div>
      <div style={{maxWidth:800,margin:'0 auto',padding:'20px 24px'}}>
        {groups.length===0?(
          <div style={{background:'white',border:'1px solid #e2e8f0',borderRadius:14,padding:'60px 24px',textAlign:'center'}}>
            <div style={{fontSize:40,marginBottom:12}}>📞</div>
            <p style={{fontSize:16,fontWeight:600,color:'#374151',marginBottom:6}}>Sin llamadas aún</p>
            <p style={{fontSize:13,color:'#94a3b8',lineHeight:1.6}}>Las llamadas recibidas por tu recepcionista aparecerán aquí.</p>
          </div>
        ):groups.map(([date,cs])=>(
          <div key={date} style={{marginBottom:20}}>
            <p style={{fontSize:11,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:10}}>
              {date===today?'Hoy':new Date(date+'T12:00:00').toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'})}
              <span style={{marginLeft:8,fontWeight:400}}>({cs.length})</span>
            </p>
            <div style={{background:'white',border:'1px solid #e2e8f0',borderRadius:14,overflow:'hidden'}}>
              {cs.map((call,i)=>{
                const expanded=open.has(call.id)
                const phone=call.caller_phone||call.from_number||'Numero oculto'
                const status=call.status||'completed'
                const dur=fmt(call.duration_seconds||call.duration)
                return(
                  <div key={call.id} style={{borderTop:i>0?'1px solid #f1f5f9':'none'}}>
                    <div onClick={()=>toggle(call.id)} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',cursor:'pointer'}}
                      onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='#f9fafb'}
                      onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                      <div style={{width:36,height:36,borderRadius:'50%',background:SB[status]||'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill={SC[status]||'#64748b'}><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:2}}>
                          <p style={{fontSize:14,fontWeight:600,color:'#0f172a'}}>{phone}</p>
                          {call.caller_name&&<p style={{fontSize:12,color:'#64748b'}}>— {call.caller_name}</p>}
                          <span style={{fontSize:10,padding:'2px 7px',borderRadius:8,background:SB[status],color:SC[status],fontWeight:700,flexShrink:0}}>{SL[status]||status}</span>
                        </div>
                        {call.summary?<p style={{fontSize:12,color:'#64748b',lineHeight:1.5,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{call.summary}</p>:<p style={{fontSize:12,color:'#94a3b8'}}>Sin resumen</p>}
                      </div>
                      <div style={{flexShrink:0,textAlign:'right'}}>
                        <p style={{fontSize:11,color:'#94a3b8'}}>{(call.started_at||call.created_at)?new Date(call.started_at||call.created_at).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}):''}</p>
                        {dur&&<p style={{fontSize:11,fontWeight:600,color:'#374151',marginTop:2}}>{dur}</p>}
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" style={{flexShrink:0,transform:expanded?'rotate(180deg)':'none',transition:'transform 0.2s'}}><path d="M19 9l-7 7-7-7"/></svg>
                    </div>
                    {expanded&&(
                      <div style={{padding:'0 16px 14px',borderTop:'1px solid #f8fafc'}}>
                        {call.summary&&<div style={{background:'#f8fafc',borderRadius:9,padding:'10px 14px',marginBottom:10}}><p style={{fontSize:11,fontWeight:600,color:'#64748b',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.04em'}}>Resumen</p><p style={{fontSize:13,color:'#374151',lineHeight:1.6}}>{call.summary}</p></div>}
                        {call.action_suggested&&<div style={{background:'#eff6ff',borderRadius:9,padding:'8px 14px',marginBottom:10}}><p style={{fontSize:11,fontWeight:600,color:'#1d4ed8',marginBottom:2}}>Accion</p><p style={{fontSize:13,color:'#1d4ed8'}}>{call.action_suggested}</p></div>}
                        {call.intent&&<p style={{fontSize:12,color:'#64748b'}}>Intencion: <strong>{call.intent}</strong></p>}
                        {call.transcript&&<details style={{marginTop:8}}><summary style={{fontSize:12,color:'#94a3b8',cursor:'pointer'}}>Ver transcripcion</summary><p style={{fontSize:12,color:'#374151',lineHeight:1.6,marginTop:6,whiteSpace:'pre-wrap'}}>{call.transcript}</p></details>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}