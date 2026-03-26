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
const GRID_SIZE = 20
const MIN_SIZE = 40

interface TableItem {
  id:string; tenant_id:string; number:string; name?:string; zone_id?:string
  capacity:number; shape_type?:string; x_pos:number; y_pos:number
  w?:number; h?:number; rotation?:number; status:string; combinable?:boolean; notes?:string
}
interface Zone { id:string; name:string; active:boolean }

// ── SVG Floor Element ─────────────────────────────────────────────────────
function FloorElement({ table, selected, snap, onSelect, onDragEnd, onResize, onDoubleClick, unitIcon }:{
  table:TableItem; selected:boolean; snap:boolean
  onSelect:()=>void; onDragEnd:(x:number,y:number)=>void
  onResize:(w:number,h:number)=>void; onDoubleClick:()=>void; unitIcon:string
}) {
  const cfg = STATUS_CFG[table.status] || STATUS_CFG.libre
  const w = table.w || 80, h = table.h || 70
  const x = table.x_pos, y = table.y_pos
  const rot = table.rotation || 0
  const isRound = table.shape_type === 'round'
  const dragRef = useRef(false)
  const offRef = useRef({ x: 0, y: 0 })
  const resizeRef = useRef(false)
  const startSizeRef = useRef({ w: 0, h: 0, mx: 0, my: 0 })

  function snapVal(v: number) { return snap ? Math.round(v / GRID_SIZE) * GRID_SIZE : v }

  function onMouseDown(e: React.MouseEvent) {
    e.stopPropagation(); onSelect()
    const svg = (e.target as SVGElement).ownerSVGElement
    if (!svg) return
    const pt = svg.createSVGPoint()
    pt.x = e.clientX; pt.y = e.clientY
    const svgPt = pt.matrixTransform(svg.getScreenCTM()!.inverse())
    dragRef.current = true
    offRef.current = { x: svgPt.x - x, y: svgPt.y - y }

    const move = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const mp = svg.createSVGPoint()
      mp.x = ev.clientX; mp.y = ev.clientY
      const sp = mp.matrixTransform(svg.getScreenCTM()!.inverse())
      const nx = snapVal(Math.max(0, sp.x - offRef.current.x))
      const ny = snapVal(Math.max(0, sp.y - offRef.current.y))
      // Live update via DOM for performance
      const g = document.getElementById(`el-${table.id}`)
      if (g) g.setAttribute('transform', `translate(${nx},${ny})${rot ? ` rotate(${rot},${w/2},${h/2})` : ''}`)
    }
    const up = (ev: MouseEvent) => {
      dragRef.current = false
      const mp = svg.createSVGPoint()
      mp.x = ev.clientX; mp.y = ev.clientY
      const sp = mp.matrixTransform(svg.getScreenCTM()!.inverse())
      onDragEnd(snapVal(Math.max(0, sp.x - offRef.current.x)), snapVal(Math.max(0, sp.y - offRef.current.y)))
      window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up)
  }

  function onResizeDown(e: React.MouseEvent) {
    e.stopPropagation()
    resizeRef.current = true
    startSizeRef.current = { w, h, mx: e.clientX, my: e.clientY }

    const move = (ev: MouseEvent) => {
      if (!resizeRef.current) return
      const dw = ev.clientX - startSizeRef.current.mx
      const dh = ev.clientY - startSizeRef.current.my
      const nw = snapVal(Math.max(MIN_SIZE, startSizeRef.current.w + dw))
      const nh = snapVal(Math.max(MIN_SIZE, startSizeRef.current.h + dh))
      const shape = document.getElementById(`shape-${table.id}`)
      if (shape) {
        if (isRound) {
          shape.setAttribute('rx', String(nw / 2)); shape.setAttribute('ry', String(nh / 2))
          shape.setAttribute('cx', String(nw / 2)); shape.setAttribute('cy', String(nh / 2))
        } else {
          shape.setAttribute('width', String(nw)); shape.setAttribute('height', String(nh))
        }
      }
    }
    const up = (ev: MouseEvent) => {
      resizeRef.current = false
      const dw = ev.clientX - startSizeRef.current.mx
      const dh = ev.clientY - startSizeRef.current.my
      onResize(snapVal(Math.max(MIN_SIZE, startSizeRef.current.w + dw)), snapVal(Math.max(MIN_SIZE, startSizeRef.current.h + dh)))
      window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up)
  }

  return (
    <g id={`el-${table.id}`}
       transform={`translate(${x},${y})${rot ? ` rotate(${rot},${w/2},${h/2})` : ''}`}
       onMouseDown={onMouseDown} onDoubleClick={onDoubleClick}
       style={{ cursor: 'grab' }}>
      {/* Shape */}
      {isRound ? (
        <ellipse id={`shape-${table.id}`} cx={w/2} cy={h/2} rx={w/2} ry={h/2}
          fill={cfg.bg} stroke={selected ? C.amber : cfg.color + '66'} strokeWidth={selected ? 2.5 : 1.5}
          style={{ filter: selected ? `drop-shadow(0 0 6px ${C.amber}66)` : 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }} />
      ) : (
        <rect id={`shape-${table.id}`} x={0} y={0} width={w} height={h} rx={8}
          fill={cfg.bg} stroke={selected ? C.amber : cfg.color + '66'} strokeWidth={selected ? 2.5 : 1.5}
          style={{ filter: selected ? `drop-shadow(0 0 6px ${C.amber}66)` : 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }} />
      )}
      {/* Label */}
      <text x={w/2} y={h/2 - 5} textAnchor="middle" fill={cfg.color}
        fontSize={11} fontWeight={800} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        {table.name || `${unitIcon}${table.number}`}
      </text>
      <text x={w/2} y={h/2 + 10} textAnchor="middle" fill={C.muted}
        fontSize={10} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        {table.capacity}p
      </text>
      {table.status !== 'libre' && (
        <text x={w/2} y={h/2 + 22} textAnchor="middle" fill={cfg.color}
          fontSize={8} fontWeight={700} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          {cfg.label.toUpperCase()}
        </text>
      )}
      {/* Resize handle (bottom-right corner) */}
      {selected && (
        <rect x={w - 8} y={h - 8} width={12} height={12} rx={2}
          fill={C.amber} stroke="#0C1018" strokeWidth={1}
          style={{ cursor: 'se-resize' }}
          onMouseDown={onResizeDown} />
      )}
    </g>
  )
}

// ── Modal edicion ───────────────────────────────────────────────────────────
function TableModal({table,zones,onSave,onDelete,onClose,unitS,unitP,zoneLabel,isRoom,tx=(s:string)=>s}:{
  table:TableItem; zones:Zone[]; onSave:(t:Partial<TableItem>)=>void; onDelete:()=>void; onClose:()=>void
  unitS:string; unitP:string; zoneLabel:string; isRoom:boolean; tx?:(s:string)=>string
}) {
  const [form,setForm]=useState({
    number:table.number||'',name:table.name||'',capacity:table.capacity||2,
    zone_id:table.zone_id||'',shape_type:table.shape_type||'square',
    status:table.status||'libre',combinable:table.combinable||false,
    rotation:table.rotation||0,
  })
  const [confirmDel,setConfirmDel]=useState(false)
  const up=(k:string,v:any)=>setForm(f=>({...f,[k]:v}))
  const lbl={fontSize:11,fontWeight:600 as const,color:C.sub,letterSpacing:'0.03em',display:'block' as const,marginBottom:5}
  const capacityLabel = isRoom ? 'AFORO' : 'CAPACIDAD'
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}} onClick={onClose}>
      <div style={{background:C.card,borderRadius:16,padding:24,width:'100%',maxWidth:420,boxShadow:'0 20px 60px rgba(0,0,0,0.7)'}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <p style={{fontSize:15,fontWeight:700,color:C.text}}>{unitS} {table.number}</p>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:C.muted}}>✕</button>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            <div><label style={lbl}>{tx('NUMERO')}</label><input className="rz-inp" value={form.number} onChange={e=>up('number',e.target.value)}/></div>
            <div><label style={lbl}>{tx('NOMBRE')}</label><input className="rz-inp" value={form.name} onChange={e=>up('name',e.target.value)} placeholder={isRoom ? 'Sala A' : 'Terraza A'}/></div>
            <div><label style={lbl}>{capacityLabel}</label><input className="rz-inp" type="number" min={1} max={50} value={form.capacity} onChange={e=>up('capacity',parseInt(e.target.value)||1)}/></div>
            <div><label style={lbl}>{zoneLabel.toUpperCase()}</label>
              <select className="rz-inp" value={form.zone_id} onChange={e=>up('zone_id',e.target.value)} style={{cursor:'pointer'}}>
                <option value="">{tx('Sin')} {zoneLabel.toLowerCase()}</option>
                {zones.map(z=><option key={z.id} value={z.id} style={{background:C.card}}>{z.name}</option>)}
              </select>
            </div>
          </div>
          <div><label style={lbl}>{tx('FORMA')}</label>
            <div style={{display:'flex',gap:8}}>
              {([['square',tx('Cuadrada')],['round',tx('Redonda')],['rectangle',tx('Rectangular')]] as [string,string][]).map(([k,l])=>(
                <button key={k} onClick={()=>up('shape_type',k)} style={{flex:1,padding:'8px',borderRadius:9,border:`1px solid ${form.shape_type===k?C.amber+'44':C.border}`,background:form.shape_type===k?C.amberDim:'transparent',color:form.shape_type===k?C.amber:C.sub,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>{l}</button>
              ))}
            </div>
          </div>
          {/* Rotation slider */}
          <div>
            <label style={lbl}>{tx('ROTACION')} ({form.rotation}°)</label>
            <input type="range" min={0} max={360} step={15} value={form.rotation}
              onChange={e => up('rotation', parseInt(e.target.value))}
              style={{ width: '100%', accentColor: C.amber }} />
          </div>
          <div><label style={lbl}>{tx('ESTADO')}</label>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {Object.entries(STATUS_CFG).map(([k,v])=>(
                <button key={k} onClick={()=>up('status',k)} style={{padding:'5px 12px',borderRadius:8,border:`1px solid ${form.status===k?v.color+'44':C.border}`,background:form.status===k?v.bg:'transparent',color:form.status===k?v.color:C.sub,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>{tx(v.label)}</button>
              ))}
            </div>
          </div>
          {!isRoom && (
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div><p style={{fontSize:13,fontWeight:600,color:C.text}}>{tx('Combinable')}</p><p style={{fontSize:11,color:C.muted}}>{tx('Se puede juntar con otros')} {unitP.toLowerCase()}</p></div>
              <button onClick={()=>up('combinable',!form.combinable)} style={{width:44,height:24,borderRadius:12,border:'none',cursor:'pointer',background:form.combinable?C.amber:'rgba(255,255,255,0.1)',position:'relative',transition:'background 0.2s'}}>
                <div style={{position:'absolute',top:2,left:form.combinable?20:2,width:20,height:20,borderRadius:'50%',background:'white',transition:'left 0.2s',boxShadow:'0 1px 4px rgba(0,0,0,0.3)'}}/>
              </button>
            </div>
          )}
          {confirmDel ? (
            <div style={{background:C.redDim,border:`1px solid ${C.red}33`,borderRadius:9,padding:'10px 12px'}}>
              <p style={{fontSize:12,color:C.red,marginBottom:8}}>{tx('Eliminar')} {unitS.toLowerCase()} &quot;{table.name||table.number}&quot;?</p>
              <div style={{display:'flex',gap:6}}>
                <button onClick={()=>setConfirmDel(false)} style={{flex:1,padding:'7px',fontSize:12,background:'rgba(255,255,255,0.06)',border:`1px solid ${C.border}`,borderRadius:8,cursor:'pointer',color:C.sub,fontFamily:'inherit'}}>{tx('Cancelar')}</button>
                <button onClick={onDelete} style={{flex:1,padding:'7px',fontSize:12,background:C.red,border:'none',borderRadius:8,cursor:'pointer',color:'white',fontFamily:'inherit',fontWeight:700}}>{tx('Eliminar')}</button>
              </div>
            </div>
          ):(
            <div style={{display:'flex',gap:8,marginTop:4}}>
              <button onClick={()=>setConfirmDel(true)} style={{padding:'10px 14px',background:C.redDim,border:`1px solid ${C.red}33`,borderRadius:10,cursor:'pointer',color:C.red,fontSize:12,fontFamily:'inherit'}}>{tx('Eliminar')}</button>
              <button onClick={onClose} style={{flex:1,padding:'10px',background:'rgba(255,255,255,0.04)',border:`1px solid ${C.border}`,borderRadius:10,cursor:'pointer',color:C.sub,fontSize:13,fontFamily:'inherit'}}>{tx('Cancelar')}</button>
              <button onClick={()=>onSave(form)} style={{flex:2,padding:'10px',background:`linear-gradient(135deg,${C.amber},#E8923A)`,border:'none',borderRadius:10,cursor:'pointer',color:'#0C1018',fontSize:13,fontWeight:700,fontFamily:'inherit'}}>{tx('Guardar')}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Fila de zona ───────────────────────────────────────────────────────
function ZoneRow({zone,color,tableCount,onRename,onDelete,unitP,tx=(s:string)=>s}:{
  zone:Zone; color:string; tableCount:number; onRename:(n:string)=>void; onDelete:()=>void; unitP:string; tx?:(s:string)=>string
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
        <span style={{fontSize:12,color:C.muted}}>{tableCount} {unitP.toLowerCase()}</span>
        <button onClick={()=>{setEditing(true);setName(zone.name)}} style={{padding:'4px 10px',fontSize:11,background:'rgba(255,255,255,0.04)',border:`1px solid ${C.border}`,borderRadius:7,cursor:'pointer',color:C.sub,fontFamily:'inherit'}}>{tx('Editar')}</button>
        <button onClick={()=>setConfirmDel(true)} style={{padding:'4px 10px',fontSize:11,background:C.redDim,border:`1px solid ${C.red}33`,borderRadius:7,cursor:'pointer',color:C.red,fontFamily:'inherit'}}>{tx('Borrar')}</button>
      </div>
      {confirmDel&&(
        <div style={{marginTop:10,padding:'10px 12px',background:C.redDim,border:`1px solid ${C.red}33`,borderRadius:9,display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
          <p style={{fontSize:12,color:C.red}}>{tx('Eliminar')} &quot;{zone.name}&quot;? {tx('Los')} {unitP.toLowerCase()} {tx('quedaran sin asignar.')}</p>
          <div style={{display:'flex',gap:6}}>
            <button onClick={()=>setConfirmDel(false)} style={{padding:'5px 12px',fontSize:11,background:'rgba(255,255,255,0.06)',border:`1px solid ${C.border}`,borderRadius:7,cursor:'pointer',color:C.sub,fontFamily:'inherit'}}>{tx('Cancelar')}</button>
            <button onClick={()=>{setConfirmDel(false);onDelete()}} style={{padding:'5px 12px',fontSize:11,background:C.red,border:'none',borderRadius:7,cursor:'pointer',color:'white',fontFamily:'inherit',fontWeight:700}}>{tx('Eliminar')}</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Pagina principal ──────────────────────────────────────────────────────────
export default function MesasPage() {
  const { template, tx } = useTenant()
  const unitS      = template?.labels?.unit?.singular  || 'Mesa'
  const unitP      = template?.labels?.unit?.plural    || 'Mesas'
  const unitIcon   = template?.labels?.unit?.icon      || 'M'
  const zoneLabel  = template?.labels?.unit?.zoneLabel  || 'Zona'
  const zonesLabel = template?.labels?.unit?.zonesLabel || 'Zonas'
  const isRoom     = ['Consulta','Cabina','Aula','Despacho','Sala'].some(r => unitS.startsWith(r))

  const [tid,setTid]               = useState<string|null>(null)
  const [zones,setZones]           = useState<Zone[]>([])
  const [tables,setTables]         = useState<TableItem[]>([])
  const [loading,setLoading]       = useState(true)
  const [tab,setTab]               = useState<'floor'|'zones'>('floor')
  const [selectedId,setSelectedId] = useState<string|null>(null)
  const [editTable,setEditTable]   = useState<TableItem|null>(null)
  const [newZone,setNewZone]       = useState('')
  const [zoneFilter,setZoneFilter] = useState('all')
  const [snapEnabled,setSnapEnabled] = useState(true)
  const [zoom,setZoom]             = useState(1)
  const [undoStack,setUndoStack]   = useState<TableItem[][]>([])
  const svgRef = useRef<SVGSVGElement>(null)

  const pushUndo = useCallback(() => {
    setUndoStack(prev => [...prev.slice(-9), tables.map(t => ({ ...t }))])
  }, [tables])

  const undo = useCallback(() => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev
      const last = prev[prev.length - 1]
      setTables(last)
      return prev.slice(0, -1)
    })
  }, [])

  const load = useCallback(async (tenantId: string) => {
    const [zr, tr] = await Promise.all([
      supabase.from('zones').select('*').eq('tenant_id', tenantId).eq('active', true).order('created_at'),
      supabase.from('tables').select('*').eq('tenant_id', tenantId).order('number'),
    ])
    setZones(zr.data || [])
    setTables((tr.data || []).map((t: any) => ({ ...t, x_pos: t.x_pos || 20, y_pos: t.y_pos || 20, status: t.status || 'libre', rotation: t.rotation || 0 })))
    setLoading(false)
  }, [])

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser(); if (!user) { setLoading(false); return }
      const { data: p } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).maybeSingle(); if (!p?.tenant_id) { setLoading(false); return }
      setTid(p.tenant_id); await load(p.tenant_id)
    })()
  }, [load])

  async function addTable(zoneId?: string) {
    if (!tid) return
    pushUndo()
    const num = String(tables.length + 1)
    const xBase = 40 + (tables.length % 6) * 100, yBase = 40 + Math.floor(tables.length / 6) * 100
    const { data } = await supabase.from('tables').insert({
      tenant_id: tid, number: num, capacity: 2, status: 'libre',
      zone_id: zoneId || null, shape_type: 'square', x_pos: xBase, y_pos: yBase, w: 80, h: 70, rotation: 0,
    }).select().maybeSingle()
    if (data) setTables(prev => [...prev, { ...data, x_pos: xBase, y_pos: yBase, status: 'libre', rotation: 0 }])
  }

  async function duplicateTable(id: string) {
    const source = tables.find(t => t.id === id)
    if (!source || !tid) return
    pushUndo()
    const num = String(tables.length + 1)
    const { data } = await supabase.from('tables').insert({
      tenant_id: tid, number: num, capacity: source.capacity, status: 'libre',
      zone_id: source.zone_id || null, shape_type: source.shape_type, rotation: source.rotation || 0,
      x_pos: source.x_pos + 30, y_pos: source.y_pos + 30, w: source.w, h: source.h,
    }).select().maybeSingle()
    if (data) setTables(prev => [...prev, { ...data, status: 'libre' }])
  }

  async function updateTablePos(id: string, x: number, y: number) {
    pushUndo()
    setTables(prev => prev.map(t => t.id === id ? { ...t, x_pos: x, y_pos: y } : t))
    await supabase.from('tables').update({ x_pos: x, y_pos: y }).eq('id', id)
  }

  async function updateTableSize(id: string, w: number, h: number) {
    pushUndo()
    setTables(prev => prev.map(t => t.id === id ? { ...t, w, h } : t))
    await supabase.from('tables').update({ w, h }).eq('id', id)
  }

  async function saveTable(id: string, updates: Partial<TableItem>) {
    pushUndo()
    await supabase.from('tables').update({ ...updates, zone_id: updates.zone_id || null }).eq('id', id)
    setTables(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
    setEditTable(null)
  }

  async function deleteTable(id: string) {
    pushUndo()
    await supabase.from('tables').delete().eq('id', id)
    setTables(prev => prev.filter(t => t.id !== id))
    setEditTable(null)
  }

  async function addZone() {
    if (!tid || !newZone.trim()) return
    const { data } = await supabase.from('zones').insert({ tenant_id: tid, name: newZone.trim(), active: true }).select().maybeSingle()
    if (data) setZones(prev => [...prev, data])
    setNewZone('')
  }

  async function deleteZone(zoneId: string) {
    if (!tid) return
    await supabase.from('tables').update({ zone_id: null }).eq('zone_id', zoneId).eq('tenant_id', tid)
    await supabase.from('zones').update({ active: false }).eq('id', zoneId).eq('tenant_id', tid)
    setZones(prev => prev.filter(z => z.id !== zoneId))
    setTables(prev => prev.map(t => t.zone_id === zoneId ? { ...t, zone_id: undefined } : t))
  }

  async function renameZone(zoneId: string, name: string) {
    if (!tid) return
    await supabase.from('zones').update({ name }).eq('id', zoneId).eq('tenant_id', tid)
    setZones(prev => prev.map(z => z.id === zoneId ? { ...z, name } : z))
  }

  if (loading) return <PageLoader />

  const visible = zoneFilter === 'all' ? tables : tables.filter(t => t.zone_id === zoneFilter)
  const freeCount = tables.filter(t => t.status === 'libre').length
  const resCount = tables.filter(t => t.status === 'reservada').length
  const occCount = tables.filter(t => t.status === 'ocupada').length

  // Build zone boundaries for visual overlay
  const zoneBounds: Record<string, { minX: number; minY: number; maxX: number; maxY: number }> = {}
  for (const t of tables) {
    if (!t.zone_id) continue
    const w = t.w || 80, h = t.h || 70
    if (!zoneBounds[t.zone_id]) {
      zoneBounds[t.zone_id] = { minX: t.x_pos, minY: t.y_pos, maxX: t.x_pos + w, maxY: t.y_pos + h }
    } else {
      const b = zoneBounds[t.zone_id]
      b.minX = Math.min(b.minX, t.x_pos); b.minY = Math.min(b.minY, t.y_pos)
      b.maxX = Math.max(b.maxX, t.x_pos + w); b.maxY = Math.max(b.maxY, t.y_pos + h)
    }
  }

  const zonePlaceholder = isRoom
    ? `Nuevo/a ${zoneLabel.toLowerCase()}: Planta 1, Ala norte...`
    : `Nuevo/a ${zoneLabel.toLowerCase()}: Terraza, Interior, Barra...`

  // Calculate SVG viewBox to fit all elements
  const maxX = Math.max(800, ...tables.map(t => (t.x_pos || 0) + (t.w || 80) + 40))
  const maxY = Math.max(500, ...tables.map(t => (t.y_pos || 0) + (t.h || 70) + 40))

  return (
    <div style={{ background: C.bg, minHeight: '100vh', fontFamily: "'Sora',-apple-system,sans-serif", display: 'flex', flexDirection: 'column' }}>
      <style>{`*{box-sizing:border-box}.rz-inp{background:rgba(255,255,255,0.04);border:1px solid ${C.border};border-radius:10px;padding:9px 12px;color:${C.text};font-size:13px;font-family:inherit;outline:none;width:100%;transition:border-color 0.15s}.rz-inp:focus{border-color:${C.amber}!important}.rz-inp::placeholder{color:${C.muted}}`}</style>

      {/* Header */}
      <div style={{ background: C.card, borderBottom: `1px solid ${C.border}`, padding: '12px 20px', position: 'sticky', top: 0, zIndex: 30, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{tx('Plano de')} {unitP.toLowerCase()}</h1>
            <p style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{tables.length} {unitP.toLowerCase()} · {zones.length} {zonesLabel.toLowerCase()}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[{ l: tx('Libres'), v: freeCount, c: C.green }, { l: tx('Reservados'), v: resCount, c: C.amber }, { l: tx('Ocupados'), v: occCount, c: C.red }].map(s => (
              <div key={s.l} style={{ padding: '4px 10px', borderRadius: 8, background: `${s.c}14`, border: `1px solid ${s.c}33` }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: s.c }}>{s.v}</span>
                <span style={{ fontSize: 10, color: C.muted, marginLeft: 4 }}>{s.l}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {([['floor', tx('Plano')], ['zones', zonesLabel]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k as 'floor' | 'zones')} style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 9, border: `1px solid ${tab === k ? C.amber + '44' : C.border}`, background: tab === k ? C.amberDim : 'transparent', color: tab === k ? C.amber : C.sub, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>
          ))}
          <button onClick={() => addTable()} style={{ padding: '7px 16px', fontSize: 12, fontWeight: 700, background: `linear-gradient(135deg,${C.amber},#E8923A)`, color: '#0C1018', border: 'none', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit' }}>+ {unitS}</button>
          <NotifBell />
        </div>
      </div>

      {/* TAB PLANO */}
      {tab === 'floor' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Toolbar */}
          <div style={{ padding: '8px 20px', background: C.card2, borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Zone filters */}
            <button onClick={() => setZoneFilter('all')} style={{ padding: '4px 12px', fontSize: 11, fontWeight: 600, borderRadius: 8, border: `1px solid ${zoneFilter === 'all' ? C.amber + '44' : C.border}`, background: zoneFilter === 'all' ? C.amberDim : 'transparent', color: zoneFilter === 'all' ? C.amber : C.sub, cursor: 'pointer', fontFamily: 'inherit' }}>{tx('Todos')} ({tables.length})</button>
            {zones.map((z, zi) => {
              const cnt = tables.filter(t => t.zone_id === z.id).length
              const col = ZONE_COLORS[zi % ZONE_COLORS.length]
              return <button key={z.id} onClick={() => setZoneFilter(z.id)} style={{ padding: '4px 12px', fontSize: 11, fontWeight: 600, borderRadius: 8, border: `1px solid ${zoneFilter === z.id ? col + '44' : C.border}`, background: zoneFilter === z.id ? col + '14' : 'transparent', color: zoneFilter === z.id ? col : C.sub, cursor: 'pointer', fontFamily: 'inherit' }}>{z.name} ({cnt})</button>
            })}

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
              {/* Snap toggle */}
              <button onClick={() => setSnapEnabled(!snapEnabled)} style={{
                padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                border: `1px solid ${snapEnabled ? C.teal + '44' : C.border}`,
                background: snapEnabled ? 'rgba(45,212,191,0.1)' : 'transparent',
                color: snapEnabled ? C.teal : C.sub,
              }}>Grid {snapEnabled ? 'ON' : 'OFF'}</button>
              {/* Zoom */}
              <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} style={{ padding: '4px 8px', fontSize: 13, background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 6, color: C.sub, cursor: 'pointer' }}>-</button>
              <span style={{ fontSize: 11, color: C.muted, minWidth: 35, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} style={{ padding: '4px 8px', fontSize: 13, background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 6, color: C.sub, cursor: 'pointer' }}>+</button>
              <button onClick={() => setZoom(1)} style={{ padding: '4px 8px', fontSize: 11, background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: 6, color: C.sub, cursor: 'pointer', fontFamily: 'inherit' }}>Fit</button>
              {/* Undo */}
              <button onClick={undo} disabled={undoStack.length === 0} style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 8, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.04)', color: undoStack.length > 0 ? C.sub : C.muted, cursor: undoStack.length > 0 ? 'pointer' : 'default', fontFamily: 'inherit', opacity: undoStack.length > 0 ? 1 : 0.5 }}>Undo</button>
              {/* Duplicate */}
              {selectedId && (
                <button onClick={() => duplicateTable(selectedId)} style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 8, border: `1px solid ${C.amber}44`, background: C.amberDim, color: C.amber, cursor: 'pointer', fontFamily: 'inherit' }}>Duplicar</button>
              )}
            </div>
          </div>

          {/* SVG Canvas */}
          <div style={{ flex: 1, overflow: 'auto', background: '#0C1018', minHeight: 500 }} onClick={() => setSelectedId(null)}>
            {visible.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 500, gap: 12 }}>
                <p style={{ fontSize: 32 }}>{unitIcon.length <= 2 ? unitIcon : '📋'}</p>
                <p style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{tx('Sin')} {unitP.toLowerCase()} {tx('en el plano')}</p>
                <p style={{ fontSize: 13, color: C.muted }}>{tx('Anade')} {unitP.toLowerCase()} {tx('para configurar tu espacio visualmente.')}</p>
                <button onClick={() => addTable()} style={{ padding: '10px 24px', fontSize: 13, fontWeight: 700, background: `linear-gradient(135deg,${C.amber},#E8923A)`, color: '#0C1018', border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit' }}>+ {tx('Anadir')} {unitS.toLowerCase()}</button>
              </div>
            ) : (
              <svg ref={svgRef}
                width="100%" height="100%"
                viewBox={`0 0 ${maxX / zoom} ${maxY / zoom}`}
                style={{ minHeight: 500 }}
                onClick={(e) => { if (e.target === e.currentTarget) setSelectedId(null) }}
              >
                {/* Grid pattern */}
                <defs>
                  <pattern id="grid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
                    <circle cx={GRID_SIZE / 2} cy={GRID_SIZE / 2} r={0.8} fill="rgba(255,255,255,0.06)" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />

                {/* Zone overlays */}
                {zones.map((z, zi) => {
                  const b = zoneBounds[z.id]
                  if (!b) return null
                  const pad = 16
                  const col = ZONE_COLORS[zi % ZONE_COLORS.length]
                  return (
                    <g key={z.id}>
                      <rect x={b.minX - pad} y={b.minY - pad}
                        width={b.maxX - b.minX + pad * 2} height={b.maxY - b.minY + pad * 2}
                        rx={12} fill={col + '08'} stroke={col + '22'} strokeWidth={1} strokeDasharray="6 3" />
                      <text x={b.minX - pad + 8} y={b.minY - pad + 14}
                        fontSize={10} fontWeight={600} fill={col + '66'}>
                        {z.name}
                      </text>
                    </g>
                  )
                })}

                {/* Table elements */}
                {visible.map(t => (
                  <FloorElement key={t.id} table={t}
                    selected={selectedId === t.id}
                    snap={snapEnabled}
                    onSelect={() => setSelectedId(t.id)}
                    onDragEnd={(x, y) => updateTablePos(t.id, x, y)}
                    onResize={(w, h) => updateTableSize(t.id, w, h)}
                    onDoubleClick={() => setEditTable(t)}
                    unitIcon={unitIcon} />
                ))}
              </svg>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '10px 20px', background: C.card, borderTop: `1px solid ${C.border}`, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            {Object.entries(STATUS_CFG).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: v.bg, border: `1px solid ${v.color}44` }} />
                <span style={{ fontSize: 11, color: C.muted }}>{tx(v.label)}</span>
              </div>
            ))}
            <span style={{ fontSize: 11, color: C.muted, marginLeft: 'auto' }}>{tx('Doble click para editar · Arrastra para mover · Esquina para redimensionar')}</span>
          </div>
        </div>
      )}

      {/* TAB ZONAS */}
      {tab === 'zones' && (
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px 24px', width: '100%' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <input className="rz-inp" value={newZone} onChange={e => setNewZone(e.target.value)} onKeyDown={e => e.key === 'Enter' && addZone()} placeholder={zonePlaceholder} />
            <button onClick={addZone} disabled={!newZone.trim()} style={{ padding: '9px 18px', fontSize: 13, fontWeight: 700, background: newZone.trim() ? `linear-gradient(135deg,${C.amber},#E8923A)` : 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 10, cursor: newZone.trim() ? 'pointer' : 'not-allowed', color: newZone.trim() ? '#0C1018' : C.muted, fontFamily: 'inherit', flexShrink: 0 }}>+ {zoneLabel}</button>
          </div>
          {zones.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <p style={{ fontSize: 28, marginBottom: 10 }}>🏠</p>
              <p style={{ fontSize: 14, fontWeight: 600, color: C.sub, marginBottom: 6 }}>{tx('Sin')} {zonesLabel.toLowerCase()} {tx('configuradas')}</p>
              <p style={{ fontSize: 12, color: C.muted }}>{tx('Las')} {zonesLabel.toLowerCase()} {tx('son opcionales. Puedes operar sin ellas.')}</p>
            </div>
          ) : zones.map((z, zi) => (
            <ZoneRow key={z.id} zone={z} color={ZONE_COLORS[zi % ZONE_COLORS.length]}
              tableCount={tables.filter(t => t.zone_id === z.id).length}
              onRename={n => renameZone(z.id, n)}
              onDelete={() => deleteZone(z.id)}
              unitP={unitP} tx={tx} />
          ))}
        </div>
      )}

      {editTable && <TableModal table={editTable} zones={zones} onSave={u => saveTable(editTable.id, u)} onDelete={() => deleteTable(editTable.id)} onClose={() => setEditTable(null)} unitS={unitS} unitP={unitP} zoneLabel={zoneLabel} isRoom={isRoom} tx={tx} />}
    </div>
  )
}
