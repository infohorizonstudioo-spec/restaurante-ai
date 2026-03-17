'use client'
export const dynamic='force-dynamic'
import{useEffect,useState,useMemo}from'react'
import{supabase}from'@/lib/supabase'
import{Phone,PhoneIncoming,PhoneOff,Zap,Clock,Search}from'lucide-react'
import{PageLoader,PageHeader,Badge,Card,EmptyState,Input,Select}from'@/components/ui'
const SC:Record<string,{label:string;variant:'green'|'blue'|'red'|'slate';icon:any}>={completed:{label:'Completada',variant:'green',icon:PhoneIncoming},active:{label:'Activa',variant:'blue',icon:PhoneIncoming},missed:{label:'Perdida',variant:'red',icon:PhoneOff}}
export default function LlamadasPage(){
  const[calls,setCalls]=useState<any[]>([]);const[loading,setLoading]=useState(true);const[search,setSearch]=useState('');const[filter,setFilter]=useState('all')
  useEffect(()=>{
    let m=true
    async function load(){
      const{data:{user}}=await supabase.auth.getUser();if(!user)return
      const{data:p}=await supabase.from('profiles').select('tenant_id').eq('id',user.id).single();if(!p?.tenant_id)return
      const tid=(p as any).tenant_id
      const{data:c}=await supabase.from('calls').select('*').eq('tenant_id',tid).order('created_at',{ascending:false}).limit(100)
      if(m){setCalls(c||[]);setLoading(false)}
      const ch=supabase.channel('calls-rt').on('postgres_changes',{event:'INSERT',schema:'public',table:'calls',filter:`tenant_id=eq.${tid}`},pl=>setCalls(prev=>[pl.new as any,...prev])).subscribe()
      return()=>supabase.removeChannel(ch)
    }
    load();return()=>{m=false}
  },[])
  const filtered=useMemo(()=>calls.filter(c=>{if(filter!=='all'&&c.status!==filter)return false;if(search&&!c.from_number?.includes(search)&&!c.summary?.toLowerCase().includes(search.toLowerCase()))return false;return true}),[calls,search,filter])
  const grouped=useMemo(()=>{const g:Record<string,typeof calls>={};filtered.forEach(c=>{const d=c.created_at?c.created_at.split('T')[0]:'?';if(!g[d])g[d]=[];g[d].push(c)});return Object.entries(g).sort(([a],[b])=>b.localeCompare(a))},[filtered])
  if(loading)return<PageLoader/>
  const today=new Date().toISOString().split('T')[0];const yesterday=new Date(Date.now()-86400000).toISOString().split('T')[0]
  function dl(iso:string){if(iso===today)return'Hoy';if(iso===yesterday)return'Ayer';return new Date(iso+'T12:00').toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'})}
  return(
    <div style={{background:'var(--color-bg)',minHeight:'100vh'}}>
      <PageHeader title="Llamadas" subtitle={`${calls.length} registradas`} actions={<div style={{display:'flex',alignItems:'center',gap:5,fontSize:12,color:'var(--color-text-muted)'}}><div style={{width:7,height:7,borderRadius:'50%',background:'var(--color-success)'}}/>Tiempo real</div>}/>
      <div style={{maxWidth:800,margin:'0 auto',padding:'var(--content-pad)'}}>
        <div style={{display:'flex',gap:8,marginBottom:16}}>
          <Input icon={<Search size={14}/>} placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)} style={{maxWidth:260}}/>
          <Select value={filter} onChange={e=>setFilter(e.target.value)} style={{maxWidth:160}}>
            <option value="all">Todos</option><option value="completed">Completadas</option><option value="missed">Perdidas</option><option value="active">Activas</option>
          </Select>
        </div>
        {filtered.length===0?<div className="card"><EmptyState icon={<Phone size={22}/>} title="Sin llamadas" description="Las llamadas del agente aparecerán aquí en tiempo real"/></div>:
        <div style={{display:'flex',flexDirection:'column',gap:20}}>
          {grouped.map(([date,dc])=>(
            <div key={date}>
              <p className="text-label" style={{color:'var(--color-text-muted)',marginBottom:8,paddingLeft:4}}>{dl(date)} · {dc.length} llamada{dc.length!==1?'s':''}</p>
              <div className="card" style={{overflow:'hidden'}}>
                {dc.map((c:any,i:number)=>{
                  const sc=SC[c.status]||SC.completed;const Icon=sc.icon
                  return(
                    <div key={c.id} style={{display:'flex',alignItems:'flex-start',gap:12,padding:'14px 20px',borderTop:i>0?'1px solid var(--color-border-light)':'none'}}>
                      <div style={{width:36,height:36,borderRadius:10,flexShrink:0,marginTop:1,background:c.status==='completed'?'var(--color-success-light)':c.status==='missed'?'var(--color-danger-light)':'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center'}}>
                        <Icon size={15} style={{color:c.status==='completed'?'var(--color-success)':c.status==='missed'?'var(--color-danger)':'var(--color-info)'}}/>
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap' as any,marginBottom:3}}><p className="text-body" style={{fontWeight:600}}>{c.from_number||'Número desconocido'}</p><Badge variant={sc.variant} dot>{sc.label}</Badge></div>
                        {c.summary&&<p className="text-body-sm" style={{color:'var(--color-text-secondary)',marginBottom:4}}>{c.summary}</p>}
                        {c.action_suggested&&<div style={{display:'inline-flex',alignItems:'center',gap:5,background:'var(--color-brand-muted)',color:'var(--color-brand)',padding:'3px 9px',borderRadius:'var(--radius-full)',fontSize:11,fontWeight:600}}><Zap size={10}/>{c.action_suggested}</div>}
                      </div>
                      <div style={{textAlign:'right',flexShrink:0}}>
                        <p className="text-caption" style={{color:'var(--color-text-muted)'}}>{c.created_at?new Date(c.created_at).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}):''}</p>
                        {c.duration&&<p className="text-caption" style={{color:'var(--color-text-muted)',marginTop:3,display:'flex',alignItems:'center',gap:3,justifyContent:'flex-end'}}><Clock size={10}/>{Math.floor(c.duration/60)}:{String(c.duration%60).padStart(2,'0')}</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>}
      </div>
    </div>
  )
}