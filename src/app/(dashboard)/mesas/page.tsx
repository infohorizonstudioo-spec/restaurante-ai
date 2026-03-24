'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { PageLoader } from '@/components/ui'
import NotifBell from '@/components/NotifBell'
import { useTenant } from '@/contexts/TenantContext'

const C = {
  bg:'#0C1018', card:'#131920', card2:'#161D2A', border:'rgba(255,255,255,0.07)',
  text:'#E8EEF6', sub:'#8895A7', muted:'#49566A', amber:'#F0A84E',
  green:'#34D399', red:'#F87171', yellow:'#FBB53F', teal:'#2DD4BF',
  amberDim:'rgba(240,168,78,0.10)', greenDim:'rgba(52,211,153,0.10)',
  redDim:'rgba(248,113,113,0.10)',
}
const ZONE_COLORS = ['#2DD4BF','#F0A84E','#A78BFA','#34D399','#60A5FA','#F87171','#FBB53F']
const STATUS_CFG: Record<string,{label:string;color:string;bg:string}> = {
  libre:     { label:'Libre',     color:C.green, bg:C.greenDim },
  reservada: { label:'Reservada', color:C.amber, bg:C.amberDim },
  ocupada:   { label:'Ocupada',   color:C.red,   bg:C.redDim   },
  bloqueada: { label:'Bloqueada', color:C.muted, bg:'rgba(73,86,106,0.15)' },
}

interface TableItem {
  id:string; tenant_id:string; number:string; name?:string; zone_id?:string
  capacity:number; shape_type?:string; x_pos:number; y_pos:number
  w?:number; h?:number; status:string; combinable?:boolean; notes?:string
}
interface Zone { id:string; name:string; active:boolean }

// ── Mesa arrastrable ──────────────────────────────────────────────────────────
function TableBlock({ table, selected, onSelect, onDragEnd, onDoubleClick }:{
  table:TableItem; selected:boolean; onSelect:()=>void
  onDragEnd:(x:number,y:number)=>void; onDoubleClick:()=>void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef(false)
  const off  = useRef({x:0,y:0})
  const cfg  = STATUS_CFG[table.status] || STATUS_CFG.libre
  const w=table.w||80, h=table.h||70
  const isRound = table.shape_type==='round'

  function onMouseDown(e:React.MouseEvent){
    e.stopPropagation(); onSelect()
    drag.current=true; off.current={x:e.clientX-table.x_pos,y:e.clientY-table.y_pos}
    const move=(ev:MouseEvent)=>{
      if(!drag.current)return
      const nx=Math.max(0,ev.clientX-off.current.x), ny=Math.max(0,ev.clientY-off.current.y)
      if(ref.current){ref.current.style.left=nx+'px';ref.current.style.top=ny+'px'}
    }
    const up=(ev:MouseEvent)=>{
      drag.current=false
      onDragEnd(Math.max(0,ev.clientX-off.current.x),Math.max(0,ev.clientY-off.current.y))
      window.removeEventListener('mousemove',move); window.removeEventListener('mouseup',up)
    }
    window.addEventListener('mousemove',move); window.addEventListener('mouseup',up)
  }
  return (
    <div ref={ref} onMouseDown={onMouseDown} onDoubleClick={onDoubleClick} style={{
      position:'absolute',left:table.x_pos,top:table.y_pos,width:w,height:h,
      cursor:'grab',userSelect:'none',borderRadius:isRound?'50%':10,background:cfg.bg,
      border:`2px solid ${selected?C.amber:cfg.color+'44'}`,
      boxShadow:selected?`0 0 0 2px ${C.amber}66,0 4px 16px rgba(0,0,0,0.4)`:'0 2px 8px rgba(0,0,0,0.3)',
      display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
      transition:'box-shadow 0.15s,border-color 0.15s',zIndex:selected?10:1,
    }}>
      <span style={{fontSize:11,fontWeight:800,color:cfg.color,lineHeight:1}}>{table.name||`M${table.number}`}</span>
      <span style={{fontSize:10,color:C.muted,marginTop:2}}>{table.capacity}p</span>
      {table.status!=='libre'&&<span style={{fontSize:9,color:cfg.color,marginTop:1,fontWeight:700}}>{cfg.label.toUpperCase()}</span>}
    </div>
  )
}

// ── Modal edición de mesa ────────────────────────────────────────────────────
function TableModal({table,zones,onSave,onDelete,onClose}:{
  table:TableItem; zones:Zone[]; onSave:(t:Partial<TableItem>)=>void; onDelete:()=>void; onClose:()=>void
}) {
  const [form,setForm]=useState({
    number:table.number||'',name:table.name||'',capacity:table.capacity||2,
    zone_id:table.zone_id||'',shape_type:table.shape_type||'square',
    status:table.status||'libre',combinable:table.combinable||false,
  })
  const [confirmDel,setConfirmDel]=useState(false)
  const up=(k:string,v:any)=>setForm(f=>({...f,[k]:v}))
  const lbl={fontSize:11,fontWeight:600,color:C.sub,letterSpacing:'0.03em',display:'block',marginBottom:5}
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}} onClick={onClose}>
      <div style={{background:C.card,borderRadius:16,padding:24,width:'100%',maxWidth:400,boxShadow:'0 20px 60px rgba(0,0,0,0.7)'}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <p style={{fontSize:15,fontWeight:700,color:C.text}}>Mesa {table.number}</p>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:C.muted}}>✕</button>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div><label style={lbl}>NÚMERO</label><input className="rz-inp" value={form.number} onChange={e=>up('number',e.target.value)}/></div>
            <div><label style={lbl}>NOMBRE</label><input className="rz-inp" value={form.name} onChange={e=>up('name',e.target.value)} placeholder="Terraza A"/></div>
            <div><label style={lbl}>CAPACIDAD</label><input className="rz-inp" type="number" min={1} max={50} value={form.capacity} onChange={e=>up('capacity',parseInt(e.target.value)||1)}/></div>
            <div><label style={lbl}>ZONA</label>
              <select className="rz-inp" value={form.zone_id} onChange={e=>up('zone_id',e.target.value)} style={{cursor:'pointer'}}>
                <option value="">Sin zona</option>
                {zones.map(z=><option key={z.id} value={z.id} style={{background:C.card}}>{z.name}</option>)}
              </select>
            </div>
          </div>
          <div><label style={lbl}>FORMA</label>
            <div style={{display:'flex',gap:8}}>
              {([['square','Cuadrada'],['round','Redonda'],['rectangle','Rectangular']] as const).map(([k,l])=>(
                <button key={k} onClick={()=>up('shape_type',k)} style={{flex:1,padding:'8px',borderRadius:9,border:`1px solid ${form.shape_type===k?C.amber+'44':C.border}`,background:form.shape_type===k?C.amberDim:'transparent',color:form.shape_type===k?C.amber:C.sub,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>{l}</button>
              ))}
            </div>
          </div>
          <div><label style={lbl}>ESTADO</label>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {Object.entries(STATUS_CFG).map(([k,v])=>(
                <button key={k} onClick={()=>up('status',k)} style={{padding:'5px 12px',borderRadius:8,border:`1px solid ${form.status===k?v.color+'44':C.border}`,background:form.status===k?v.bg:'transparent',color:form.status===k?v.color:C.sub,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>{v.label}</button>
              ))}
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div><p style={{fontSize:13,fontWeight:600,color:C.text}}>Combinable</p><p style={{fontSize:11,color:C.muted}}>Se puede juntar con otras mesas</p></div>
            <button onClick={()=>up('combinable',!form.combinable)} style={{width:44,height:24,borderRadius:12,border:'none',cursor:'pointer',background:form.combinable?C.amber:'rgba(255,255,255,0.1)',position:'relative',transition:'background 0.2s'}}>
              <div style={{position:'absolute',top:2,left:form.combinable?20:2,width:20,height:20,borderRadius:'50%',background:'white',transition:'left 0.2s',boxShadow:'0 1px 4px rgba(0,0,0,0.3)'}}/>
            </button>
          </div>
          {confirmDel ? (
            <div style={{background:C.redDim,border:`1px solid ${C.red}33`,borderRadius:9,padding:'10px 12px'}}>
              <p style={{fontSize:12,color:C.red,marginBottom:8}}>¿Eliminar esta mesa?</p>
              <div style={{display:'flex',gap:6}}>
                <button onClick={()=>setConfirmDel(false)} style={{flex:1,padding:'7px',fontSize:12,background:'rgba(255,255,255,0.06)',border:`1px solid ${C.border}`,borderRadius:8,cursor:'pointer',color:C.sub,fontFamily:'inherit'}}>Cancelar</button>
                <button onClick={onDelete} style={{flex:1,padding:'7px',fontSize:12,background:C.red,border:'none',borderRadius:8,cursor:'pointer',color:'white',fontFamily:'inherit',fontWeight:700}}>Eliminar</button>
              </div>
            </div>
          ):(
            <div style={{display:'flex',gap:8,marginTop:4}}>
              <button onClick={()=>setConfirmDel(true)} style={{padding:'10px 14px',background:C.redDim,border:`1px solid ${C.red}33`,borderRadius:10,cursor:'pointer',color:C.red,fontSize:12,fontFamily:'inherit'}}>Eliminar</button>
              <button onClick={onClose} style={{flex:1,padding:'10px',background:'rgba(255,255,255,0.04)',border:`1px solid ${C.border}`,borderRadius:10,cursor:'pointer',color:C.sub,fontSize:13,fontFamily:'inherit'}}>Cancelar</button>
              <button onClick={()=>onSave(form)} style={{flex:2,padding:'10px',background:`linear-gradient(135deg,${C.amber},#E8923A)`,border:'none',borderRadius:10,cursor:'pointer',color:'#0C1018',fontSize:13,fontWeight:700,fontFamily:'inherit'}}>Guardar</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Fila de zona — componente propio para respetar reglas de hooks ───────────
function ZoneRow({zone,color,tableCount,onRename,onDelete}:{
  zone:Zone; color:string; tableCount:number; onRename:(n:string)=>void; onDelete:()=>void
}) {
  const [editing,setEditing]=useState(false)
  const [name,setName]=useState(zone.name)
  const [confirmDel,setConfirmDel]=useState(false)
  function commit(){ if(name.trim()&&name!==zone.name)onRename(name.trim()); setEditing(false) }
  return (
    <div style={{background:C.card,border:`1px solid ${color}22`,borderRadius:12,padding:'14px 16px',marginBottom:10}}>
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <div style={{width:14,height:14,borderRadius:'50%',background:color,flexShrink:0}}/>
        {editing?(
          <input value={name} onChange={e=>setName(e.target.value)} onBlur={commit}
            onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();if(e.key==='Escape')setEditing(false)}}
            autoFocus style={{flex:1,fontSize:13,border:`1px solid ${C.amber}`,borderRadius:7,padding:'4px 8px',outline:'none',fontFamily:'inherit',background:'rgba(255,255,255,0.04)',color:C.text}}/>
        ):(
          <p style={{flex:1,fontSize:14,fontWeight:600,color:C.text,cursor:'pointer'}} onClick={()=>setEditing(true)}>{zone.name}</p>
        )}
        <span style={{fontSize:12,color:C.muted}}>{tableCount} mesas</span>
        <button onClick={()=>{setEditing(true);setName(zone.name)}} style={{padding:'4px 10px',fontSize:11,background:'rgba(255,255,255,0.04)',border:`1px solid ${C.border}`,borderRadius:7,cursor:'pointer',color:C.sub,fontFamily:'inherit'}}>Editar</button>
        <button onClick={()=>setConfirmDel(true)} style={{padding:'4px 10px',fontSize:11,background:C.redDim,border:`1px solid ${C.red}33`,borderRadius:7,cursor:'pointer',color:C.red,fontFamily:'inherit'}}>Borrar</button>
      </div>
      {confirmDel&&(
        <div style={{marginTop:10,padding:'10px 12px',background:C.redDim,border:`1px solid ${C.red}33`,borderRadius:9,display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
          <p style={{fontSize:12,color:C.red}}>¿Eliminar &quot;{zone.name}&quot;? Las mesas quedarán sin zona.</p>
          <div style={{display:'flex',gap:6}}>
            <button onClick={()=>setConfirmDel(false)} style={{padding:'5px 12px',fontSize:11,background:'rgba(255,255,255,0.06)',border:`1px solid ${C.border}`,borderRadius:7,cursor:'pointer',color:C.sub,fontFamily:'inherit'}}>Cancelar</button>
            <button onClick={()=>{setConfirmDel(false);onDelete()}} style={{padding:'5px 12px',fontSize:11,background:C.red,border:'none',borderRadius:7,cursor:'pointer',color:'white',fontFamily:'inherit',fontWeight:700}}>Eliminar</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function MesasPage() {
  const { template } = useTenant()
  const unitS = template?.labels?.unit?.singular || 'Mesa'
  const unitP = template?.labels?.unit?.plural   || 'Mesas'
  const [tid,setTid]               = useState<string|null>(null)
  const [zones,setZones]           = useState<Zone[]>([])
  const [tables,setTables]         = useState<TableItem[]>([])
  const [loading,setLoading]       = useState(true)
  const [tab,setTab]               = useState<'floor'|'zones'>('floor')
  const [selectedId,setSelectedId] = useState<string|null>(null)
  const [editTable,setEditTable]   = useState<TableItem|null>(null)
  const [newZone,setNewZone]       = useState('')
  const [zoneFilter,setZoneFilter] = useState('all')
  const canvasRef = useRef<HTMLDivElement>(null)

  const load=useCallback(async(tenantId:string)=>{
    const [zr,tr]=await Promise.all([
      supabase.from('zones').select('*').eq('tenant_id',tenantId).eq('active',true).order('created_at'),
      supabase.from('tables').select('*').eq('tenant_id',tenantId).order('number'),
    ])
    setZones(zr.data||[])
    setTables((tr.data||[]).map((t:any)=>({...t,x_pos:t.x_pos||20,y_pos:t.y_pos||20,status:t.status||'libre'})))
    setLoading(false)
  },[])

  useEffect(()=>{
    (async()=>{
      const {data:{user}}=await supabase.auth.getUser(); if(!user)return
      const {data:p}=await supabase.from('profiles').select('tenant_id').eq('id',user.id).maybeSingle(); if(!p?.tenant_id)return
      setTid(p.tenant_id); await load(p.tenant_id)
    })()
  },[load])

  async function addTable(zoneId?:string){
    if(!tid)return
    const num=String(tables.length+1)
    const xBase=30+(tables.length%5)*100, yBase=30+Math.floor(tables.length/5)*100
    const {data}=await supabase.from('tables').insert({
      tenant_id:tid,number:num,capacity:2,status:'libre',
      zone_id:zoneId||null,shape_type:'square',x_pos:xBase,y_pos:yBase,w:80,h:70,
    }).select().maybeSingle()
    if(data)setTables(prev=>[...prev,{...data,x_pos:xBase,y_pos:yBase,status:'libre'}])
  }

  async function updateTablePos(id:string,x:number,y:number){
    setTables(prev=>prev.map(t=>t.id===id?{...t,x_pos:x,y_pos:y}:t))
    await supabase.from('tables').update({x_pos:x,y_pos:y}).eq('id',id)
  }

  async function saveTable(id:string,updates:Partial<TableItem>){
    await supabase.from('tables').update({...updates,zone_id:updates.zone_id||null}).eq('id',id)
    setTables(prev=>prev.map(t=>t.id===id?{...t,...updates}:t))
    setEditTable(null)
  }

  async function deleteTable(id:string){
    await supabase.from('tables').delete().eq('id',id)
    setTables(prev=>prev.filter(t=>t.id!==id))
    setEditTable(null)
  }

  async function addZone(){
    if(!tid||!newZone.trim())return
    const {data}=await supabase.from('zones').insert({tenant_id:tid,name:newZone.trim(),active:true}).select().maybeSingle()
    if(data)setZones(prev=>[...prev,data])
    setNewZone('')
  }

  async function deleteZone(zoneId:string){
    await supabase.from('tables').update({zone_id:null}).eq('zone_id',zoneId)
    await supabase.from('zones').update({active:false}).eq('id',zoneId)
    setZones(prev=>prev.filter(z=>z.id!==zoneId))
    setTables(prev=>prev.map(t=>t.zone_id===zoneId?{...t,zone_id:undefined}:t))
  }

  async function renameZone(zoneId:string,name:string){
    await supabase.from('zones').update({name}).eq('id',zoneId)
    setZones(prev=>prev.map(z=>z.id===zoneId?{...z,name}:z))
  }

  if(loading)return <PageLoader/>

  const visible=zoneFilter==='all'?tables:tables.filter(t=>t.zone_id===zoneFilter)
  const freeCount=tables.filter(t=>t.status==='libre').length
  const resCount=tables.filter(t=>t.status==='reservada').length
  const occCount=tables.filter(t=>t.status==='ocupada').length

  return (
    <div style={{background:C.bg,minHeight:'100vh',fontFamily:"'Sora',-apple-system,sans-serif",display:'flex',flexDirection:'column'}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&display=swap');*{box-sizing:border-box}.rz-inp{background:rgba(255,255,255,0.04);border:1px solid ${C.border};border-radius:10px;padding:9px 12px;color:${C.text};font-size:13px;font-family:inherit;outline:none;width:100%;transition:border-color 0.15s}.rz-inp:focus{border-color:${C.amber}!important}.rz-inp::placeholder{color:${C.muted}}`}</style>

      {/* Header */}
      <div style={{background:C.card,borderBottom:`1px solid ${C.border}`,padding:'12px 20px',position:'sticky',top:0,zIndex:30,display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          <div>
            <h1 style={{fontSize:16,fontWeight:700,color:C.text}}>Plano del local</h1>
            <p style={{fontSize:11,color:C.muted,marginTop:1}}>{tables.length} {unitP.toLowerCase()} · {zones.length} zonas</p>
          </div>
          <div style={{display:'flex',gap:8}}>
            {[{l:'Libres',v:freeCount,c:C.green},{l:'Reservadas',v:resCount,c:C.amber},{l:'Ocupadas',v:occCount,c:C.red}].map(s=>(
              <div key={s.l} style={{padding:'4px 10px',borderRadius:8,background:`${s.c}14`,border:`1px solid ${s.c}33`}}>
                <span style={{fontSize:13,fontWeight:800,color:s.c}}>{s.v}</span>
                <span style={{fontSize:10,color:C.muted,marginLeft:4}}>{s.l}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {([['floor','Plano'],['zones','Zonas']] as const).map(([k,l])=>(
            <button key={k} onClick={()=>setTab(k)} style={{padding:'6px 14px',fontSize:12,fontWeight:600,borderRadius:9,border:`1px solid ${tab===k?C.amber+'44':C.border}`,background:tab===k?C.amberDim:'transparent',color:tab===k?C.amber:C.sub,cursor:'pointer',fontFamily:'inherit'}}>{l}</button>
          ))}
          <button onClick={()=>addTable()} style={{padding:'7px 16px',fontSize:12,fontWeight:700,background:`linear-gradient(135deg,${C.amber},#E8923A)`,color:'#0C1018',border:'none',borderRadius:9,cursor:'pointer',fontFamily:'inherit'}}>+ {unitS}</button>
          <NotifBell/>
        </div>
      </div>

      {/* TAB PLANO */}
      {tab==='floor'&&(
        <div style={{flex:1,display:'flex',flexDirection:'column'}}>
          {zones.length>0&&(
            <div style={{padding:'10px 20px',background:C.card2,borderBottom:`1px solid ${C.border}`,display:'flex',gap:6,overflowX:'auto'}}>
              <button onClick={()=>setZoneFilter('all')} style={{padding:'4px 12px',fontSize:11,fontWeight:600,borderRadius:8,border:`1px solid ${zoneFilter==='all'?C.amber+'44':C.border}`,background:zoneFilter==='all'?C.amberDim:'transparent',color:zoneFilter==='all'?C.amber:C.sub,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}}>Todas ({tables.length})</button>
              {zones.map((z,zi)=>{
                const cnt=tables.filter(t=>t.zone_id===z.id).length
                const col=ZONE_COLORS[zi%ZONE_COLORS.length]
                return <button key={z.id} onClick={()=>setZoneFilter(z.id)} style={{padding:'4px 12px',fontSize:11,fontWeight:600,borderRadius:8,border:`1px solid ${zoneFilter===z.id?col+'44':C.border}`,background:zoneFilter===z.id?col+'14':'transparent',color:zoneFilter===z.id?col:C.sub,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}}>{z.name} ({cnt})</button>
              })}
              <button onClick={()=>addTable(zoneFilter!=='all'?zoneFilter:undefined)} style={{padding:'4px 12px',fontSize:11,fontWeight:600,borderRadius:8,border:`1px dashed ${C.border}`,background:'transparent',color:C.muted,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}}>+ Mesa aquí</button>
            </div>
          )}
          <div ref={canvasRef} onClick={()=>setSelectedId(null)} style={{flex:1,position:'relative',overflow:'auto',background:'#0C1018',backgroundImage:'radial-gradient(circle,rgba(255,255,255,0.04) 1px,transparent 1px)',backgroundSize:'24px 24px',minHeight:500}}>
            {visible.length===0?(
              <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:12}}>
                <p style={{fontSize:32}}>🍽️</p>
                <p style={{fontSize:15,fontWeight:600,color:C.text}}>Sin {unitP.toLowerCase()} en el plano</p>
                <p style={{fontSize:13,color:C.muted}}>Añade mesas para configurar tu local visualmente.</p>
                <button onClick={()=>addTable()} style={{padding:'10px 24px',fontSize:13,fontWeight:700,background:`linear-gradient(135deg,${C.amber},#E8923A)`,color:'#0C1018',border:'none',borderRadius:10,cursor:'pointer',fontFamily:'inherit'}}>+ Añadir primer {unitS.toLowerCase()}</button>
              </div>
            ):visible.map(t=>(
              <TableBlock key={t.id} table={t} selected={selectedId===t.id}
                onSelect={()=>setSelectedId(t.id)}
                onDragEnd={(x,y)=>updateTablePos(t.id,x,y)}
                onDoubleClick={()=>setEditTable(t)}/>
            ))}
          </div>
          <div style={{padding:'10px 20px',background:C.card,borderTop:`1px solid ${C.border}`,display:'flex',gap:16,alignItems:'center',flexWrap:'wrap'}}>
            {Object.entries(STATUS_CFG).map(([k,v])=>(
              <div key={k} style={{display:'flex',alignItems:'center',gap:5}}>
                <div style={{width:10,height:10,borderRadius:3,background:v.bg,border:`1px solid ${v.color}44`}}/>
                <span style={{fontSize:11,color:C.muted}}>{v.label}</span>
              </div>
            ))}
            <span style={{fontSize:11,color:C.muted,marginLeft:'auto'}}>Doble click para editar · Arrastra para mover</span>
          </div>
        </div>
      )}

      {/* TAB ZONAS */}
      {tab==='zones'&&(
        <div style={{maxWidth:600,margin:'0 auto',padding:'20px 24px',width:'100%'}}>
          <div style={{display:'flex',gap:8,marginBottom:20}}>
            <input className="rz-inp" value={newZone} onChange={e=>setNewZone(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addZone()} placeholder="Nueva zona: Terraza, Interior, Barra…"/>
            <button onClick={addZone} disabled={!newZone.trim()} style={{padding:'9px 18px',fontSize:13,fontWeight:700,background:newZone.trim()?`linear-gradient(135deg,${C.amber},#E8923A)`:'rgba(255,255,255,0.06)',border:'none',borderRadius:10,cursor:newZone.trim()?'pointer':'not-allowed',color:newZone.trim()?'#0C1018':C.muted,fontFamily:'inherit',flexShrink:0}}>+ Zona</button>
          </div>
          {zones.length===0?(
            <div style={{textAlign:'center',padding:'48px 0'}}>
              <p style={{fontSize:28,marginBottom:10}}>🏠</p>
              <p style={{fontSize:14,fontWeight:600,color:C.sub,marginBottom:6}}>Sin zonas configuradas</p>
              <p style={{fontSize:12,color:C.muted}}>Las zonas son opcionales. Puedes operar sin ellas.</p>
            </div>
          ):zones.map((z,zi)=>(
            <ZoneRow key={z.id} zone={z} color={ZONE_COLORS[zi%ZONE_COLORS.length]}
              tableCount={tables.filter(t=>t.zone_id===z.id).length}
              onRename={n=>renameZone(z.id,n)}
              onDelete={()=>deleteZone(z.id)}/>
          ))}
        </div>
      )}

      {editTable&&<TableModal table={editTable} zones={zones} onSave={u=>saveTable(editTable.id,u)} onDelete={()=>deleteTable(editTable.id)} onClose={()=>setEditTable(null)}/>}
    </div>
  )
}
