'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { PageLoader } from '@/components/ui'

const SL:Record<string,string> = {
  completada:'Completada', completed:'Completada',
  activa:'En curso', 'in-progress':'En curso',
  fallida:'Fallida', failed:'Fallida', 'no-answer':'Perdida', perdida:'Perdida',
  pendiente:'Pendiente', pending:'Pendiente'
}
const SC:Record<string,string> = {
  completada:'#059669', completed:'#059669',
  activa:'#1d4ed8', 'in-progress':'#1d4ed8',
  fallida:'#dc2626', failed:'#dc2626', 'no-answer':'#dc2626', perdida:'#dc2626',
  pendiente:'#d97706', pending:'#d97706'
}
const SB:Record<string,string> = {
  completada:'#f0fdf4', completed:'#f0fdf4',
  activa:'#eff6ff', 'in-progress':'#eff6ff',
  fallida:'#fef2f2', failed:'#fef2f2', 'no-answer':'#fef2f2', perdida:'#fef2f2',
  pendiente:'#fffbeb', pending:'#fffbeb'
}

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
  const [loadingMore,setLoadingMore]=useState(false)
  const [hasMore,setHasMore]=useState(false)
  const [page,setPage]=useState(0)
  const PAGE_SIZE=50
  const [open,setOpen]=useState<Set<string>>(new Set())
  const [tid,setTid]=useState<string|null>(null)
  const [filter,setFilter]=useState<'all'|'completada'|'activa'|'fallida'|'perdida'>('all')

  const load=useCallback(async(tenantId:string, reset=true)=>{
    if(reset) setLoading(true)
    const from = reset ? 0 : page * PAGE_SIZE
    const {data, count}=await supabase.from('calls').select('*', {count:'exact'})
      .eq('tenant_id',tenantId).order('started_at',{ascending:false})
      .range(from, from + PAGE_SIZE - 1)
    if(reset){
      setCalls(data||[])
      setPage(1)
    } else {
      setCalls(prev=>[...prev,...(data||[])])
      setPage(p=>p+1)
    }
    setHasMore((count||0) > (reset ? PAGE_SIZE : (page+1)*PAGE_SIZE))
    setLoading(false); setLoadingMore(false)
  },[page])

  useEffect(()=>{
    (async()=>{
      const {data:{user}}=await supabase.auth.getUser();if(!user)return
      const {data:p}=await supabase.from('profiles').select('tenant_id').eq('id',user.id).single();if(!p?.tenant_id)return
      setTid(p.tenant_id);await load(p.tenant_id, true)
    })()
  },[])  // eslint-disable-line

  useEffect(()=>{
    if(!tid)return
    const ch=supabase.channel('calls-rt')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'calls',filter:'tenant_id=eq.'+tid},()=>load(tid,true))
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'calls',filter:'tenant_id=eq.'+tid},()=>load(tid,true))
      .subscribe()
    return()=>{supabase.removeChannel(ch)}
  },[tid])  // eslint-disable-line

  if(loading)return<PageLoader/>

  const filtered = filter==='all'
    ? calls
    : calls.filter(c => {
        const s = c.status||''
        if(filter==='completada') return s==='completada'||s==='completed'
        if(filter==='activa')     return s==='activa'||s==='in-progress'
        if(filter==='fallida')    return s==='fallida'||s==='failed'
        if(filter==='perdida')    return s==='perdida'||s==='no-answer'||s==='busy'
        return true
      })
  const groups=groupByDate(filtered)
  const today=new Date().toISOString().slice(0,10)
  const toggle=(id:string)=>setOpen(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n})

  return(
    <div style={{background:'#f8fafc',minHeight:'100vh'}}>
      <div style={{background:'white',borderBottom:'1px solid #e2e8f0',padding:'16px 28px',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
        <div>
          <h1 style={{fontSize:18,fontWeight:700,color:'#0f172a'}}>Llamadas</h1>
          <p style={{fontSize:12,color:'#94a3b8',marginTop:2}}>{calls.length} cargadas</p>
        </div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          {([
            {k:'all',    label:'Todas',      count:calls.length},
            {k:'completada', label:'Completadas', count:calls.filter(c=>c.status==='completada'||c.status==='completed').length},
            {k:'perdida',    label:'Perdidas',    count:calls.filter(c=>c.status==='perdida'||c.status==='no-answer'||c.status==='busy').length},
            {k:'fallida',    label:'Fallidas',    count:calls.filter(c=>c.status==='fallida'||c.status==='failed').length},
          ] as const).map(f=>(
            <button key={f.k} onClick={()=>setFilter(f.k as any)}
              style={{fontSize:11,padding:'4px 10px',borderRadius:10,border:'1px solid',
                borderColor: filter===f.k ? SC[f.k==='all'?'completada':f.k] : '#e2e8f0',
                background:  filter===f.k ? SB[f.k==='all'?'completada':f.k] : 'white',
                color:       filter===f.k ? SC[f.k==='all'?'completada':f.k] : '#64748b',
                fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
              {f.label} {f.count>0&&<span>({f.count})</span>}
            </button>
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
        {hasMore && filter==='all' && (
          <div style={{textAlign:'center',paddingTop:8}}>
            <button onClick={()=>{setLoadingMore(true);if(tid)load(tid,false)}} disabled={loadingMore}
              style={{padding:'9px 24px',fontSize:13,fontWeight:600,color:'#1d4ed8',background:'white',border:'1px solid #bfdbfe',borderRadius:9,cursor:'pointer',fontFamily:'inherit',opacity:loadingMore?0.6:1}}>
              {loadingMore?'Cargando...':'Cargar más llamadas'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}