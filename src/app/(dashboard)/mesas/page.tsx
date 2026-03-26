'use client'
import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { PageLoader } from '@/components/ui'
import NotifBell from '@/components/NotifBell'
import { useTenant } from '@/contexts/TenantContext'
import { getPresetsForType, type ElementPreset, type BusinessPresets } from '@/lib/space-presets'

// ── COLORES & CONSTANTES ─────────────────────────────────────────────────────
import { C } from '@/lib/colors'
const ZONE_COLORS = ['#2DD4BF','#F0A84E','#A78BFA','#34D399','#60A5FA','#F87171','#FBB53F']
const STATUS_CFG: Record<string,{label:string;color:string;bg:string;dim:string}> = {
  libre:     { label:'Libre',     color:C.green, bg:C.greenDim, dim:'rgba(52,211,153,0.06)' },
  reservada: { label:'Reservada', color:C.amber, bg:C.amberDim, dim:'rgba(240,168,78,0.06)' },
  ocupada:   { label:'Ocupada',   color:C.red,   bg:C.redDim,   dim:'rgba(248,113,113,0.06)' },
  bloqueada: { label:'Bloqueada', color:C.muted, bg:'rgba(73,86,106,0.15)', dim:'rgba(73,86,106,0.06)' },
}
const GRID = 20
const MIN_SZ = 40

interface TableItem {
  id:string; tenant_id:string; number:string; name?:string; zone_id?:string
  capacity:number; shape_type?:string; x_pos:number; y_pos:number
  w?:number; h?:number; rotation?:number; status:string; combinable?:boolean; notes?:string
  combo_group?:string|null  // UUID shared by tables that are joined together
}
interface Zone { id:string; name:string; active:boolean }

const snap = (v:number) => Math.round(v/GRID)*GRID

// ── SVG FLOOR ELEMENT ────────────────────────────────────────────────────────
function FloorElement({ table, selected, multiSelected, snapOn, onSelect, onDragEnd, onResize, onDoubleClick, unitIcon, zoneColor, comboCapacity }:{
  table:TableItem; selected:boolean; multiSelected:boolean; snapOn:boolean
  onSelect:(shiftKey:boolean)=>void; onDragEnd:(x:number,y:number)=>void
  onResize:(w:number,h:number)=>void; onDoubleClick:()=>void; unitIcon:string; zoneColor?:string
  comboCapacity?:number
}) {
  const cfg = STATUS_CFG[table.status] || STATUS_CFG.libre
  const w = table.w || 80, h = table.h || 70
  const x = table.x_pos, y = table.y_pos
  const rot = table.rotation || 0
  const isRound = table.shape_type === 'round'
  const dragRef = useRef(false)
  const offRef = useRef({x:0,y:0})
  const resizeRef = useRef(false)
  const startRef = useRef({w:0,h:0,mx:0,my:0})
  const sv = (v:number) => snapOn ? snap(v) : v

  function onMD(e:React.MouseEvent) {
    e.stopPropagation(); onSelect(e.shiftKey)
    const svg = (e.target as SVGElement).ownerSVGElement
    if (!svg) return
    const pt = svg.createSVGPoint(); pt.x=e.clientX; pt.y=e.clientY
    const sp = pt.matrixTransform(svg.getScreenCTM()!.inverse())
    dragRef.current = true; offRef.current = {x:sp.x-x, y:sp.y-y}
    const move = (ev:MouseEvent) => {
      if (!dragRef.current) return
      const mp = svg.createSVGPoint(); mp.x=ev.clientX; mp.y=ev.clientY
      const s = mp.matrixTransform(svg.getScreenCTM()!.inverse())
      const nx = sv(Math.max(0, s.x-offRef.current.x)), ny = sv(Math.max(0, s.y-offRef.current.y))
      const g = document.getElementById(`el-${table.id}`)
      if (g) g.setAttribute('transform', `translate(${nx},${ny})${rot?` rotate(${rot},${w/2},${h/2})`:''}`)
    }
    const up = (ev:MouseEvent) => {
      dragRef.current = false
      const mp = svg.createSVGPoint(); mp.x=ev.clientX; mp.y=ev.clientY
      const s = mp.matrixTransform(svg.getScreenCTM()!.inverse())
      onDragEnd(sv(Math.max(0, s.x-offRef.current.x)), sv(Math.max(0, s.y-offRef.current.y)))
      window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up)
  }

  function onRD(e:React.MouseEvent) {
    e.stopPropagation(); resizeRef.current = true
    startRef.current = {w, h, mx:e.clientX, my:e.clientY}
    const move = (ev:MouseEvent) => {
      if (!resizeRef.current) return
      const nw = sv(Math.max(MIN_SZ, startRef.current.w + ev.clientX - startRef.current.mx))
      const nh = sv(Math.max(MIN_SZ, startRef.current.h + ev.clientY - startRef.current.my))
      const shape = document.getElementById(`shape-${table.id}`)
      if (shape) {
        if (isRound) { shape.setAttribute('rx',String(nw/2)); shape.setAttribute('ry',String(nh/2)); shape.setAttribute('cx',String(nw/2)); shape.setAttribute('cy',String(nh/2)) }
        else { shape.setAttribute('width',String(nw)); shape.setAttribute('height',String(nh)) }
      }
    }
    const up = (ev:MouseEvent) => {
      resizeRef.current = false
      onResize(sv(Math.max(MIN_SZ, startRef.current.w + ev.clientX - startRef.current.mx)), sv(Math.max(MIN_SZ, startRef.current.h + ev.clientY - startRef.current.my)))
      window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up)
  }

  const isCombo = !!table.combo_group
  const borderColor = selected ? C.amber : multiSelected ? C.violet : isCombo ? C.teal : (zoneColor ? zoneColor+'55' : cfg.color+'44')
  const strokeW = selected ? 2.5 : multiSelected ? 2 : 1.5
  const glow = selected ? `drop-shadow(0 0 8px ${C.amber}55)` : multiSelected ? `drop-shadow(0 0 6px ${C.violet}44)` : isCombo ? `drop-shadow(0 0 6px ${C.teal}33)` : `drop-shadow(0 2px 6px rgba(0,0,0,0.4))`

  return (
    <g id={`el-${table.id}`}
      transform={`translate(${x},${y})${rot?` rotate(${rot},${w/2},${h/2})`:''}` }
      onMouseDown={onMD} onDoubleClick={onDoubleClick}
      style={{ cursor:'grab' }}>
      {isRound ? (
        <ellipse id={`shape-${table.id}`} cx={w/2} cy={h/2} rx={w/2} ry={h/2}
          fill={cfg.bg} stroke={borderColor} strokeWidth={strokeW}
          style={{ filter:glow, transition:'filter 0.15s' }} />
      ) : (
        <rect id={`shape-${table.id}`} x={0} y={0} width={w} height={h} rx={10}
          fill={cfg.bg} stroke={borderColor} strokeWidth={strokeW}
          style={{ filter:glow, transition:'filter 0.15s' }} />
      )}
      {/* Combo badge */}
      {isCombo && (
        <g>
          <rect x={w-18} y={-6} width={24} height={16} rx={8} fill={C.teal} />
          <text x={w-6} y={5} textAnchor="middle" fill="#0C1018"
            fontSize={9} fontWeight={800} style={{pointerEvents:'none',userSelect:'none'}}>
            🔗
          </text>
        </g>
      )}
      {/* Label */}
      <text x={w/2} y={h/2-8} textAnchor="middle" fill={cfg.color}
        fontSize={13} fontWeight={800} style={{pointerEvents:'none',userSelect:'none'}}>
        {table.name || `${unitIcon}${table.number}`}
      </text>
      {/* Capacity — show combined if in group */}
      <text x={w/2} y={h/2+8} textAnchor="middle" fill={C.muted}
        fontSize={10} fontWeight={600} style={{pointerEvents:'none',userSelect:'none'}}>
        {comboCapacity ? `${comboCapacity}p (combo)` : `${table.capacity}p`} · {STATUS_CFG[table.status]?.label || 'Libre'}
      </text>
      {/* Resize handle */}
      {selected && (
        <>
          <rect x={w-9} y={h-9} width={13} height={13} rx={3}
            fill={C.amber} stroke={C.bg} strokeWidth={1.5}
            style={{cursor:'se-resize'}} onMouseDown={onRD} />
          {isRound ? (
            <ellipse cx={w/2} cy={h/2} rx={w/2+3} ry={h/2+3}
              fill="none" stroke={C.amber+'33'} strokeWidth={1} strokeDasharray="4 3" />
          ) : (
            <rect x={-3} y={-3} width={w+6} height={h+6} rx={12}
              fill="none" stroke={C.amber+'33'} strokeWidth={1} strokeDasharray="4 3" />
          )}
        </>
      )}
      {/* Multi-select highlight */}
      {multiSelected && !selected && (
        isRound ? (
          <ellipse cx={w/2} cy={h/2} rx={w/2+3} ry={h/2+3}
            fill="none" stroke={C.violet+'44'} strokeWidth={1.5} strokeDasharray="5 3" />
        ) : (
          <rect x={-3} y={-3} width={w+6} height={h+6} rx={12}
            fill="none" stroke={C.violet+'44'} strokeWidth={1.5} strokeDasharray="5 3" />
        )
      )}
    </g>
  )
}

// ── PROPERTIES PANEL (DERECHA) ───────────────────────────────────────────────
function PropertiesPanel({table,zones,onSave,onDelete,onDuplicate,onClose,onSeparate,unitS,zoneLabel,isRoom,tx,comboMembers,comboCapacity}:{
  table:TableItem; zones:Zone[]; onSave:(u:Partial<TableItem>)=>void; onDelete:()=>void
  onDuplicate:()=>void; onClose:()=>void; onSeparate?:()=>void
  unitS:string; zoneLabel:string; isRoom:boolean; tx:(s:string)=>string
  comboMembers?:TableItem[]; comboCapacity?:number
}) {
  const [f,setF] = useState({
    number:table.number||'', name:table.name||'', capacity:table.capacity||2,
    zone_id:table.zone_id||'', shape_type:table.shape_type||'square',
    status:table.status||'libre', combinable:table.combinable||false,
    rotation:table.rotation||0,
  })
  const [confirmDel,setConfirmDel] = useState(false)
  const up = (k:string,v:any) => setF(p=>({...p,[k]:v}))

  // Auto-save on change (debounced)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => {
    timerRef.current = setTimeout(() => onSave(f), 600)
    return () => clearTimeout(timerRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f])

  // Reset form when table changes
  useEffect(() => {
    setF({
      number:table.number||'', name:table.name||'', capacity:table.capacity||2,
      zone_id:table.zone_id||'', shape_type:table.shape_type||'square',
      status:table.status||'libre', combinable:table.combinable||false,
      rotation:table.rotation||0,
    })
    setConfirmDel(false)
  }, [table.id, table.number, table.name, table.capacity, table.zone_id, table.shape_type, table.status, table.combinable, table.rotation])

  const lbl:React.CSSProperties = {fontSize:10,fontWeight:700,color:C.muted,letterSpacing:'0.06em',textTransform:'uppercase',display:'block',marginBottom:4}

  return (
    <div style={{width:280,background:C.card,borderLeft:`1px solid ${C.border}`,display:'flex',flexDirection:'column',overflow:'auto',flexShrink:0}}>
      {/* Header */}
      <div style={{padding:'14px 16px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <p style={{fontSize:13,fontWeight:700,color:C.text}}>{unitS} {table.number}</p>
        <button onClick={onClose} style={{background:'none',border:'none',fontSize:16,cursor:'pointer',color:C.muted,padding:4}}>✕</button>
      </div>

      <div style={{padding:'14px 16px',display:'flex',flexDirection:'column',gap:14,flex:1}}>
        {/* Name & Number */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          <div>
            <label style={lbl}>Nombre</label>
            <input className="rz-inp" value={f.name} onChange={e=>up('name',e.target.value)} placeholder={isRoom?'Sala A':'Mesa 1'} />
          </div>
          <div>
            <label style={lbl}>Número</label>
            <input className="rz-inp" value={f.number} onChange={e=>up('number',e.target.value)} />
          </div>
        </div>

        {/* Capacity */}
        <div>
          <label style={lbl}>{isRoom?'Aforo':'Capacidad'}</label>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <button onClick={()=>up('capacity',Math.max(1,f.capacity-1))} style={{width:32,height:32,borderRadius:8,border:`1px solid ${C.border}`,background:'rgba(255,255,255,0.04)',color:C.sub,fontSize:16,cursor:'pointer',fontFamily:'inherit'}}>−</button>
            <span style={{fontSize:18,fontWeight:800,color:C.amber,minWidth:30,textAlign:'center'}}>{f.capacity}</span>
            <button onClick={()=>up('capacity',Math.min(100,f.capacity+1))} style={{width:32,height:32,borderRadius:8,border:`1px solid ${C.border}`,background:'rgba(255,255,255,0.04)',color:C.sub,fontSize:16,cursor:'pointer',fontFamily:'inherit'}}>+</button>
            <span style={{fontSize:11,color:C.muted,marginLeft:4}}>personas</span>
          </div>
        </div>

        {/* Zone */}
        <div>
          <label style={lbl}>{zoneLabel}</label>
          <select className="rz-inp" value={f.zone_id} onChange={e=>up('zone_id',e.target.value)} style={{cursor:'pointer'}}>
            <option value="">Sin {zoneLabel.toLowerCase()}</option>
            {zones.map(z=><option key={z.id} value={z.id} style={{background:C.card}}>{z.name}</option>)}
          </select>
        </div>

        {/* Shape */}
        <div>
          <label style={lbl}>Forma</label>
          <div style={{display:'flex',gap:6}}>
            {([['square','□','Cuadrada'],['round','○','Redonda'],['rectangle','▬','Rectangular']] as const).map(([k,ico,l])=>(
              <button key={k} onClick={()=>up('shape_type',k)} style={{
                flex:1,padding:'7px 4px',borderRadius:8,
                border:`1px solid ${f.shape_type===k?C.amber+'44':C.border}`,
                background:f.shape_type===k?C.amberDim:'transparent',
                color:f.shape_type===k?C.amber:C.sub,
                fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit',
                display:'flex',flexDirection:'column',alignItems:'center',gap:2,
              }}>
                <span style={{fontSize:16}}>{ico}</span>
                <span>{l}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Rotation */}
        <div>
          <label style={lbl}>Rotación ({f.rotation}°)</label>
          <input type="range" min={0} max={360} step={15} value={f.rotation}
            onChange={e=>up('rotation',parseInt(e.target.value))}
            style={{width:'100%',accentColor:C.amber}} />
        </div>

        {/* Status */}
        <div>
          <label style={lbl}>Estado</label>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5}}>
            {Object.entries(STATUS_CFG).map(([k,v])=>(
              <button key={k} onClick={()=>up('status',k)} style={{
                padding:'6px 8px',borderRadius:8,
                border:`1px solid ${f.status===k?v.color+'44':C.border}`,
                background:f.status===k?v.bg:'transparent',
                color:f.status===k?v.color:C.sub,
                fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'inherit',
              }}>{tx(v.label)}</button>
            ))}
          </div>
        </div>

        {/* Combinable */}
        {!isRoom && (
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 0'}}>
            <div>
              <p style={{fontSize:12,fontWeight:600,color:C.text}}>Combinable</p>
              <p style={{fontSize:10,color:C.muted}}>Se puede juntar</p>
            </div>
            <button onClick={()=>up('combinable',!f.combinable)} style={{
              width:40,height:22,borderRadius:11,border:'none',cursor:'pointer',
              background:f.combinable?C.amber:'rgba(255,255,255,0.1)',
              position:'relative',transition:'background 0.2s',
            }}>
              <div style={{position:'absolute',top:2,left:f.combinable?18:2,width:18,height:18,borderRadius:'50%',background:'white',transition:'left 0.2s',boxShadow:'0 1px 3px rgba(0,0,0,0.3)'}}/>
            </button>
          </div>
        )}
      </div>

      {/* Combo group info */}
      {comboMembers && comboMembers.length > 0 && (
        <div style={{padding:'0 16px 10px'}}>
          <div style={{background:C.tealDim,border:`1px solid ${C.teal}33`,borderRadius:10,padding:'10px 12px'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
              <p style={{fontSize:11,fontWeight:700,color:C.teal}}>🔗 Mesas juntas</p>
              <span style={{fontSize:12,fontWeight:800,color:C.teal}}>{comboCapacity}p</span>
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:8}}>
              {comboMembers.map(m=>(
                <span key={m.id} style={{
                  padding:'2px 8px',fontSize:10,fontWeight:600,borderRadius:6,
                  background:m.id===table.id?C.teal+'22':'rgba(255,255,255,0.04)',
                  color:m.id===table.id?C.teal:C.sub,
                  border:`1px solid ${m.id===table.id?C.teal+'44':C.border}`,
                }}>{m.name||`#${m.number}`}</span>
              ))}
            </div>
            {onSeparate && (
              <button onClick={onSeparate} style={{
                width:'100%',padding:'6px',fontSize:11,fontWeight:600,borderRadius:7,
                border:`1px solid ${C.red}33`,background:C.redDim,color:C.red,
                cursor:'pointer',fontFamily:'inherit',
              }}>✂️ Separar mesas</button>
            )}
          </div>
        </div>
      )}

      {/* Actions footer */}
      <div style={{padding:'12px 16px',borderTop:`1px solid ${C.border}`,display:'flex',flexDirection:'column',gap:8}}>
        <div style={{display:'flex',gap:6}}>
          <button onClick={onDuplicate} style={{flex:1,padding:'8px',fontSize:11,fontWeight:600,borderRadius:8,border:`1px solid ${C.teal}33`,background:C.tealDim,color:C.teal,cursor:'pointer',fontFamily:'inherit'}}>
            Duplicar
          </button>
          {!confirmDel ? (
            <button onClick={()=>setConfirmDel(true)} style={{flex:1,padding:'8px',fontSize:11,fontWeight:600,borderRadius:8,border:`1px solid ${C.red}33`,background:C.redDim,color:C.red,cursor:'pointer',fontFamily:'inherit'}}>
              Eliminar
            </button>
          ) : (
            <button onClick={onDelete} style={{flex:1,padding:'8px',fontSize:11,fontWeight:700,borderRadius:8,border:'none',background:C.red,color:'white',cursor:'pointer',fontFamily:'inherit'}}>
              Confirmar
            </button>
          )}
        </div>
        <p style={{fontSize:9,color:C.muted,textAlign:'center'}}>Los cambios se guardan automáticamente</p>
      </div>
    </div>
  )
}

// ── ELEMENT LIBRARY ITEM ─────────────────────────────────────────────────────
function LibraryItem({preset,onAdd}:{preset:ElementPreset;onAdd:()=>void}) {
  return (
    <button onClick={onAdd} draggable onDragStart={e => {
      e.dataTransfer.setData('preset-id', preset.id)
      e.dataTransfer.effectAllowed = 'copy'
    }} style={{
      display:'flex',alignItems:'center',gap:10,padding:'10px 12px',
      background:'rgba(255,255,255,0.02)',border:`1px solid ${C.border}`,borderRadius:10,
      cursor:'grab',width:'100%',textAlign:'left',fontFamily:'inherit',
      transition:'all 0.15s',
    }}
    onMouseOver={e=>(e.currentTarget.style.background='rgba(255,255,255,0.05)',e.currentTarget.style.borderColor=C.amber+'33')}
    onMouseOut={e=>(e.currentTarget.style.background='rgba(255,255,255,0.02)',e.currentTarget.style.borderColor=C.border)}
    >
      <span style={{fontSize:20,width:32,textAlign:'center'}}>{preset.icon}</span>
      <div style={{flex:1}}>
        <p style={{fontSize:12,fontWeight:600,color:C.text}}>{preset.label}</p>
        <p style={{fontSize:10,color:C.muted}}>{preset.capacity}p · {preset.shape==='round'?'Redondo':'Rectangular'}</p>
      </div>
      <span style={{fontSize:16,color:C.muted}}>+</span>
    </button>
  )
}

// ── STARTER LAYOUT CARD ──────────────────────────────────────────────────────
function StarterCard({layout,onApply}:{layout:{label:string;description:string;icon:string};onApply:()=>void}) {
  return (
    <button onClick={onApply} style={{
      display:'flex',flexDirection:'column',alignItems:'center',gap:8,
      padding:'20px 16px',background:'rgba(255,255,255,0.02)',
      border:`1px solid ${C.border}`,borderRadius:14,cursor:'pointer',
      width:'100%',textAlign:'center',fontFamily:'inherit',transition:'all 0.15s',
    }}
    onMouseOver={e=>(e.currentTarget.style.background=C.amberDim,e.currentTarget.style.borderColor=C.amber+'33')}
    onMouseOut={e=>(e.currentTarget.style.background='rgba(255,255,255,0.02)',e.currentTarget.style.borderColor=C.border)}
    >
      <span style={{fontSize:36}}>{layout.icon}</span>
      <p style={{fontSize:14,fontWeight:700,color:C.text}}>{layout.label}</p>
      <p style={{fontSize:12,color:C.muted}}>{layout.description}</p>
      <span style={{fontSize:11,fontWeight:600,color:C.amber,marginTop:4}}>Usar esta plantilla →</span>
    </button>
  )
}

// ── ZONE ROW ─────────────────────────────────────────────────────────────────
function ZoneRow({zone,color,tableCount,onRename,onDelete,unitP,tx}:{
  zone:Zone; color:string; tableCount:number; onRename:(n:string)=>void; onDelete:()=>void; unitP:string; tx:(s:string)=>string
}) {
  const [editing,setEditing] = useState(false)
  const [name,setName] = useState(zone.name)
  const [confirmDel,setConfirmDel] = useState(false)
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
        <button onClick={()=>{setEditing(true);setName(zone.name)}} style={{padding:'4px 10px',fontSize:11,background:'rgba(255,255,255,0.04)',border:`1px solid ${C.border}`,borderRadius:7,cursor:'pointer',color:C.sub,fontFamily:'inherit'}}>Editar</button>
        <button onClick={()=>setConfirmDel(true)} style={{padding:'4px 10px',fontSize:11,background:C.redDim,border:`1px solid ${C.red}33`,borderRadius:7,cursor:'pointer',color:C.red,fontFamily:'inherit'}}>Borrar</button>
      </div>
      {confirmDel&&(
        <div style={{marginTop:10,padding:'10px 12px',background:C.redDim,border:`1px solid ${C.red}33`,borderRadius:9,display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
          <p style={{fontSize:12,color:C.red}}>Eliminar &quot;{zone.name}&quot;?</p>
          <div style={{display:'flex',gap:6}}>
            <button onClick={()=>setConfirmDel(false)} style={{padding:'5px 12px',fontSize:11,background:'rgba(255,255,255,0.06)',border:`1px solid ${C.border}`,borderRadius:7,cursor:'pointer',color:C.sub,fontFamily:'inherit'}}>Cancelar</button>
            <button onClick={()=>{setConfirmDel(false);onDelete()}} style={{padding:'5px 12px',fontSize:11,background:C.red,border:'none',borderRadius:7,cursor:'pointer',color:'white',fontFamily:'inherit',fontWeight:700}}>Eliminar</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN PAGE — SPACE DESIGNER
// ═════════════════════════════════════════════════════════════════════════════
export default function MesasPage() {
  const { tenant, template, tx } = useTenant()
  const unitS      = template?.labels?.unit?.singular  || 'Mesa'
  const unitP      = template?.labels?.unit?.plural    || 'Mesas'
  const unitIcon   = template?.labels?.unit?.icon      || 'M'
  const zoneLabel  = template?.labels?.unit?.zoneLabel  || 'Zona'
  const zonesLabel = template?.labels?.unit?.zonesLabel || 'Zonas'
  const isRoom     = ['Consulta','Cabina','Aula','Despacho','Sala','Habitación','Silla','Sillón'].some(r => unitS.startsWith(r))
  const businessType = tenant?.type || 'restaurante'

  // Presets for this business type
  const presets: BusinessPresets = useMemo(() => getPresetsForType(businessType), [businessType])

  const [tid,setTid]               = useState<string|null>(null)
  const [zones,setZones]           = useState<Zone[]>([])
  const [tables,setTables]         = useState<TableItem[]>([])
  const [loading,setLoading]       = useState(true)
  const [tab,setTab]               = useState<'floor'|'zones'>('floor')
  const [selectedId,setSelectedId] = useState<string|null>(null)
  const [multiSelect,setMultiSelect] = useState<Set<string>>(new Set())
  const [newZone,setNewZone]       = useState('')
  const [zoneFilter,setZoneFilter] = useState('all')
  const [snapEnabled,setSnapEnabled] = useState(true)
  const [zoom,setZoom]             = useState(1)
  const [undoStack,setUndoStack]   = useState<TableItem[][]>([])
  const [showLibrary,setShowLibrary] = useState(true)
  const [panOffset,setPanOffset]   = useState({x:0,y:0})
  const [isPanning,setIsPanning]   = useState(false)
  const panStart = useRef({x:0,y:0,ox:0,oy:0})
  const svgRef = useRef<SVGSVGElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()

  // Zone color map
  const zoneColorMap = useMemo(() => {
    const m: Record<string,string> = {}
    zones.forEach((z,i) => { m[z.id] = ZONE_COLORS[i % ZONE_COLORS.length] })
    return m
  }, [zones])

  const pushUndo = useCallback(() => {
    setUndoStack(prev => [...prev.slice(-14), tables.map(t => ({...t}))])
  }, [tables])

  const undo = useCallback(() => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev
      setTables(prev[prev.length-1])
      return prev.slice(0,-1)
    })
  }, [])

  const load = useCallback(async (tenantId:string) => {
    const [zr,tr] = await Promise.all([
      supabase.from('zones').select('*').eq('tenant_id',tenantId).eq('active',true).order('created_at'),
      supabase.from('tables').select('*').eq('tenant_id',tenantId).order('number'),
    ])
    setZones(zr.data||[])
    setTables((tr.data||[]).map((t:any)=>({...t, x_pos:t.x_pos||20, y_pos:t.y_pos||20, status:t.status||'libre', rotation:t.rotation||0})))
    setLoading(false)
  }, [])

  useEffect(() => {
    (async () => {
      const {data:{user}} = await supabase.auth.getUser(); if(!user){setLoading(false);return}
      const {data:p} = await supabase.from('profiles').select('tenant_id').eq('id',user.id).maybeSingle(); if(!p?.tenant_id){setLoading(false);return}
      setTid(p.tenant_id); await load(p.tenant_id)
    })()
  }, [load])

  // Realtime subscription
  useEffect(() => {
    if (!tid) return
    const ch = supabase.channel('tables-rt-'+tid)
      .on('postgres_changes', {event:'*',schema:'public',table:'tables',filter:'tenant_id=eq.'+tid}, ()=>load(tid))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [tid, load])

  // ── CRUD Operations ────────────────────────────────────────────────────────
  async function addFromPreset(preset:ElementPreset, x?:number, y?:number) {
    if (!tid) return
    pushUndo()
    const num = String(tables.length + 1)
    const posX = x ?? (40 + (tables.length%6)*120)
    const posY = y ?? (40 + Math.floor(tables.length/6)*120)
    const {data} = await supabase.from('tables').insert({
      tenant_id:tid, number:num, name:preset.label, capacity:preset.capacity,
      status:'libre', zone_id:null, shape_type:preset.shape,
      x_pos:snap(posX), y_pos:snap(posY), w:preset.w, h:preset.h, rotation:0,
    }).select().maybeSingle()
    if (data) {
      setTables(prev=>[...prev, {...data, status:'libre', rotation:0}])
      setSelectedId(data.id)
    }
  }

  async function addQuick() {
    const defaultPreset = presets.elements[0]
    if (defaultPreset) await addFromPreset(defaultPreset)
  }

  async function duplicateTable(id:string) {
    const src = tables.find(t=>t.id===id)
    if (!src || !tid) return
    pushUndo()
    const num = String(tables.length+1)
    const {data} = await supabase.from('tables').insert({
      tenant_id:tid, number:num, name:src.name?src.name+' (copia)':undefined,
      capacity:src.capacity, status:'libre', zone_id:src.zone_id||null,
      shape_type:src.shape_type, rotation:src.rotation||0,
      x_pos:src.x_pos+40, y_pos:src.y_pos+40, w:src.w, h:src.h,
    }).select().maybeSingle()
    if (data) {
      setTables(prev=>[...prev,{...data,status:'libre'}])
      setSelectedId(data.id)
    }
  }

  async function updatePos(id:string,x:number,y:number) {
    pushUndo()
    setTables(prev=>prev.map(t=>t.id===id?{...t,x_pos:x,y_pos:y}:t))
    await supabase.from('tables').update({x_pos:x,y_pos:y}).eq('id',id)
  }

  async function updateSize(id:string,w:number,h:number) {
    pushUndo()
    setTables(prev=>prev.map(t=>t.id===id?{...t,w,h}:t))
    await supabase.from('tables').update({w,h}).eq('id',id)
  }

  async function saveTable(id:string,updates:Partial<TableItem>) {
    setTables(prev=>prev.map(t=>t.id===id?{...t,...updates}:t))
    // Debounced save to DB
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async()=>{
      await supabase.from('tables').update({...updates, zone_id:updates.zone_id||null}).eq('id',id)
    }, 400)
  }

  async function deleteTable(id:string) {
    pushUndo()
    await supabase.from('tables').delete().eq('id',id)
    setTables(prev=>prev.filter(t=>t.id!==id))
    setSelectedId(null)
  }

  async function addZone(name?:string) {
    if (!tid) return
    const zoneName = name || newZone.trim()
    if (!zoneName) return
    const {data} = await supabase.from('zones').insert({tenant_id:tid,name:zoneName,active:true}).select().maybeSingle()
    if (data) setZones(prev=>[...prev,data])
    setNewZone('')
    return data
  }

  async function deleteZone(zoneId:string) {
    if (!tid) return
    await supabase.from('tables').update({zone_id:null}).eq('zone_id',zoneId).eq('tenant_id',tid)
    await supabase.from('zones').update({active:false}).eq('id',zoneId).eq('tenant_id',tid)
    setZones(prev=>prev.filter(z=>z.id!==zoneId))
    setTables(prev=>prev.map(t=>t.zone_id===zoneId?{...t,zone_id:undefined}:t))
  }

  async function renameZone(zoneId:string,name:string) {
    if (!tid) return
    await supabase.from('zones').update({name}).eq('id',zoneId).eq('tenant_id',tid)
    setZones(prev=>prev.map(z=>z.id===zoneId?{...z,name}:z))
  }

  // ── Table combining (juntar/separar) ────────────────────────────────────
  function handleSelect(id:string, shiftKey:boolean) {
    if (shiftKey) {
      // Multi-select mode
      setMultiSelect(prev => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        // Also add current selectedId if exists and not in set
        if (selectedId && !next.has(selectedId)) next.add(selectedId)
        return next
      })
      setSelectedId(id)
    } else {
      setMultiSelect(new Set())
      setSelectedId(id)
    }
  }

  function clearSelection() {
    setSelectedId(null)
    setMultiSelect(new Set())
  }

  // Get all tables in the same combo group
  function getComboGroup(groupId:string): TableItem[] {
    return tables.filter(t=>t.combo_group===groupId)
  }

  // Combined capacity for a combo group
  function getComboCapacity(groupId:string): number {
    return getComboGroup(groupId).reduce((sum,t)=>sum+t.capacity, 0)
  }

  // Join selected tables into a combo group
  async function joinTables() {
    const ids = multiSelect.size >= 2 ? [...multiSelect] : []
    if (ids.length < 2 || !tid) return

    // Check all are combinable (or force it)
    const selected = tables.filter(t=>ids.includes(t.id))

    // Use existing group if any table already has one, otherwise generate new
    const existingGroup = selected.find(t=>t.combo_group)?.combo_group
    const groupId = existingGroup || crypto.randomUUID()

    pushUndo()
    // Update all selected tables
    for (const id of ids) {
      await supabase.from('tables').update({combo_group:groupId, combinable:true}).eq('id',id)
    }
    setTables(prev=>prev.map(t=>ids.includes(t.id)?{...t,combo_group:groupId,combinable:true}:t))
    setMultiSelect(new Set())
  }

  // Separate a table from its combo group
  async function separateTable(id:string) {
    const table = tables.find(t=>t.id===id)
    if (!table?.combo_group) return

    pushUndo()
    const group = getComboGroup(table.combo_group)

    if (group.length <= 2) {
      // If only 2 in group, dissolve the entire group
      for (const t of group) {
        await supabase.from('tables').update({combo_group:null}).eq('id',t.id)
      }
      setTables(prev=>prev.map(t=>t.combo_group===table.combo_group?{...t,combo_group:null}:t))
    } else {
      // Just remove this one from the group
      await supabase.from('tables').update({combo_group:null}).eq('id',id)
      setTables(prev=>prev.map(t=>t.id===id?{...t,combo_group:null}:t))
    }
  }

  // Separate ALL tables in a combo group
  async function separateGroup(groupId:string) {
    const group = getComboGroup(groupId)
    pushUndo()
    for (const t of group) {
      await supabase.from('tables').update({combo_group:null}).eq('id',t.id)
    }
    setTables(prev=>prev.map(t=>t.combo_group===groupId?{...t,combo_group:null}:t))
  }

  // ── Apply starter layout ─────────────────────────────────────────────────
  async function applyStarter(layoutIdx:number) {
    if (!tid) return
    const layout = presets.starterLayouts[layoutIdx]
    if (!layout) return

    // Create zones first
    const zoneMap: Record<string,string> = {}
    for (const zName of layout.zones) {
      const z = await addZone(zName)
      if (z) zoneMap[zName] = z.id
    }

    // Create elements
    for (const el of layout.elements) {
      const preset = presets.elements.find(p=>p.id===el.preset)
      if (!preset) continue
      const num = String(tables.length + Object.keys(zoneMap).length + 1)
      const zoneId = el.zone ? zoneMap[el.zone] : null
      const {data} = await supabase.from('tables').insert({
        tenant_id:tid, number:num, name:el.name, capacity:preset.capacity,
        status:'libre', zone_id:zoneId||null, shape_type:preset.shape,
        x_pos:el.x, y_pos:el.y, w:preset.w, h:preset.h, rotation:0,
      }).select().maybeSingle()
      if (data) setTables(prev=>[...prev, {...data, status:'libre', rotation:0}])
    }
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e:KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key==='Delete' && selectedId) { deleteTable(selectedId) }
      if (e.key==='Escape') { clearSelection() }
      if (e.ctrlKey && e.key==='z') { e.preventDefault(); undo() }
      if (e.ctrlKey && e.key==='d' && selectedId) { e.preventDefault(); duplicateTable(selectedId) }
      if (e.ctrlKey && e.key==='j' && multiSelect.size>=2) { e.preventDefault(); joinTables() }
      if (e.key===' ') { e.preventDefault() } // prevent scroll on space
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, undo])

  // ── Mouse wheel zoom on canvas ─────────────────────────────────────────────
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const handler = (e:WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        setZoom(z => Math.max(0.3, Math.min(3, z - e.deltaY*0.002)))
      }
    }
    el.addEventListener('wheel', handler, {passive:false})
    return () => el.removeEventListener('wheel', handler)
  }, [])

  // ── Canvas panning (middle click or space+drag) ────────────────────────────
  function onCanvasMouseDown(e:React.MouseEvent) {
    if (e.button===1 || (e.button===0 && e.altKey)) {
      e.preventDefault()
      setIsPanning(true)
      panStart.current = {x:e.clientX, y:e.clientY, ox:panOffset.x, oy:panOffset.y}
    } else if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'svg' || (e.target as SVGElement).id === 'canvas-bg') {
      clearSelection()
    }
  }

  useEffect(() => {
    if (!isPanning) return
    const move = (e:MouseEvent) => {
      setPanOffset({
        x: panStart.current.ox + (e.clientX - panStart.current.x),
        y: panStart.current.oy + (e.clientY - panStart.current.y),
      })
    }
    const up = () => setIsPanning(false)
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up)
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
  }, [isPanning])

  // ── Drop from library ──────────────────────────────────────────────────────
  function onCanvasDrop(e:React.DragEvent) {
    e.preventDefault()
    const presetId = e.dataTransfer.getData('preset-id')
    const preset = presets.elements.find(p=>p.id===presetId)
    if (!preset || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / zoom - panOffset.x / zoom
    const y = (e.clientY - rect.top) / zoom - panOffset.y / zoom
    addFromPreset(preset, Math.max(0,x), Math.max(0,y))
  }

  if (loading) return <PageLoader />

  const visible = zoneFilter==='all' ? tables : tables.filter(t=>t.zone_id===zoneFilter)
  const freeCount = tables.filter(t=>t.status==='libre').length
  const resCount = tables.filter(t=>t.status==='reservada').length
  const occCount = tables.filter(t=>t.status==='ocupada').length
  const selectedTable = selectedId ? tables.find(t=>t.id===selectedId) : null

  // Zone boundary overlays
  const zoneBounds: Record<string,{minX:number;minY:number;maxX:number;maxY:number}> = {}
  for (const t of tables) {
    if (!t.zone_id) continue
    const w=t.w||80, h=t.h||70
    if (!zoneBounds[t.zone_id]) zoneBounds[t.zone_id] = {minX:t.x_pos,minY:t.y_pos,maxX:t.x_pos+w,maxY:t.y_pos+h}
    else {
      const b=zoneBounds[t.zone_id]
      b.minX=Math.min(b.minX,t.x_pos); b.minY=Math.min(b.minY,t.y_pos)
      b.maxX=Math.max(b.maxX,t.x_pos+w); b.maxY=Math.max(b.maxY,t.y_pos+h)
    }
  }

  const maxX = Math.max(1200, ...tables.map(t=>(t.x_pos||0)+(t.w||80)+80))
  const maxY = Math.max(700, ...tables.map(t=>(t.y_pos||0)+(t.h||70)+80))
  const isEmpty = tables.length === 0

  const zonePlaceholder = isRoom
    ? `Nueva ${zoneLabel.toLowerCase()}: Planta 1, Ala norte...`
    : `Nueva ${zoneLabel.toLowerCase()}: Terraza, Interior, Barra...`

  return (
    <div style={{background:C.bg,height:'100vh',fontFamily:"'Sora',-apple-system,sans-serif",display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0}.rz-inp{background:rgba(255,255,255,0.04);border:1px solid ${C.border};border-radius:9px;padding:8px 10px;color:${C.text};font-size:12px;font-family:inherit;outline:none;width:100%;transition:border-color 0.15s}.rz-inp:focus{border-color:${C.amber}!important}.rz-inp::placeholder{color:${C.muted}}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:3px}::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.14)}@keyframes pulse-glow{0%,100%{box-shadow:0 0 0 0 rgba(45,212,191,0)}50%{box-shadow:0 0 8px 2px rgba(45,212,191,0.3)}}`}</style>

      {/* ── HEADER ──────────────────────────────────────────────────────────────── */}
      <div style={{background:C.card,borderBottom:`1px solid ${C.border}`,padding:'10px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexShrink:0,zIndex:20}}>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <div>
            <h1 style={{fontSize:15,fontWeight:700,color:C.text}}>
              {tx('Diseñador de espacio')}
            </h1>
            <p style={{fontSize:10,color:C.muted,marginTop:1}}>
              {tables.length} {unitP.toLowerCase()} · {zones.length} {zonesLabel.toLowerCase()}
            </p>
          </div>
          <div style={{display:'flex',gap:6}}>
            {[{l:'Libres',v:freeCount,c:C.green},{l:'Reservados',v:resCount,c:C.amber},{l:'Ocupados',v:occCount,c:C.red}].map(s=>(
              <div key={s.l} style={{padding:'3px 8px',borderRadius:7,background:`${s.c}12`,border:`1px solid ${s.c}28`}}>
                <span style={{fontSize:12,fontWeight:800,color:s.c}}>{s.v}</span>
                <span style={{fontSize:9,color:C.muted,marginLeft:3}}>{s.l}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{display:'flex',gap:6,alignItems:'center'}}>
          {/* Tabs */}
          {(['floor','zones'] as const).map(k=>(
            <button key={k} onClick={()=>setTab(k)} style={{
              padding:'5px 12px',fontSize:11,fontWeight:600,borderRadius:8,
              border:`1px solid ${tab===k?C.amber+'44':C.border}`,
              background:tab===k?C.amberDim:'transparent',
              color:tab===k?C.amber:C.sub,cursor:'pointer',fontFamily:'inherit',
            }}>{k==='floor'?tx('Plano'):zonesLabel}</button>
          ))}
          <div style={{width:1,height:20,background:C.border,margin:'0 2px'}}/>
          <button onClick={addQuick} style={{
            padding:'6px 14px',fontSize:11,fontWeight:700,
            background:`linear-gradient(135deg,${C.amber},#E8923A)`,
            color:'#0C1018',border:'none',borderRadius:8,cursor:'pointer',fontFamily:'inherit',
          }}>+ {unitS}</button>
          <NotifBell />
        </div>
      </div>

      {/* ── FLOOR TAB ─────────────────────────────────────────────────────────── */}
      {tab === 'floor' && (
        <div style={{flex:1,display:'flex',overflow:'hidden'}}>

          {/* LEFT — Element Library */}
          {showLibrary && (
            <div style={{width:220,background:C.card,borderRight:`1px solid ${C.border}`,display:'flex',flexDirection:'column',flexShrink:0,overflow:'hidden'}}>
              <div style={{padding:'10px 12px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <p style={{fontSize:11,fontWeight:700,color:C.sub,letterSpacing:'0.06em',textTransform:'uppercase'}}>Elementos</p>
                <button onClick={()=>setShowLibrary(false)} style={{background:'none',border:'none',fontSize:14,cursor:'pointer',color:C.muted,padding:2}}>◀</button>
              </div>
              <div style={{flex:1,overflow:'auto',padding:'8px 10px',display:'flex',flexDirection:'column',gap:6}}>
                {presets.categories.map(cat=>(
                  <div key={cat}>
                    <p style={{fontSize:9,fontWeight:700,color:C.muted,letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:6,marginTop:8}}>{cat}</p>
                    {presets.elements.filter(e=>e.category===cat).map(preset=>(
                      <LibraryItem key={preset.id} preset={preset} onAdd={()=>addFromPreset(preset)} />
                    ))}
                  </div>
                ))}
              </div>
              <div style={{padding:'8px 10px',borderTop:`1px solid ${C.border}`}}>
                <p style={{fontSize:9,color:C.muted,textAlign:'center',lineHeight:1.4}}>
                  Arrastra al plano o haz click para añadir
                </p>
              </div>
            </div>
          )}

          {/* CENTER — Canvas Area */}
          <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
            {/* Toolbar */}
            <div style={{padding:'6px 12px',background:C.card2,borderBottom:`1px solid ${C.border}`,display:'flex',gap:6,alignItems:'center',flexWrap:'wrap',flexShrink:0}}>
              {!showLibrary && (
                <button onClick={()=>setShowLibrary(true)} style={{padding:'3px 8px',fontSize:11,background:'rgba(255,255,255,0.04)',border:`1px solid ${C.border}`,borderRadius:6,color:C.sub,cursor:'pointer',fontFamily:'inherit',marginRight:4}}>▶ Elementos</button>
              )}
              {/* Zone filters */}
              <button onClick={()=>setZoneFilter('all')} style={{
                padding:'3px 10px',fontSize:10,fontWeight:600,borderRadius:7,
                border:`1px solid ${zoneFilter==='all'?C.amber+'44':C.border}`,
                background:zoneFilter==='all'?C.amberDim:'transparent',
                color:zoneFilter==='all'?C.amber:C.sub,cursor:'pointer',fontFamily:'inherit',
              }}>Todos ({tables.length})</button>
              {zones.map((z,zi)=>{
                const cnt=tables.filter(t=>t.zone_id===z.id).length
                const col=ZONE_COLORS[zi%ZONE_COLORS.length]
                return <button key={z.id} onClick={()=>setZoneFilter(z.id)} style={{
                  padding:'3px 10px',fontSize:10,fontWeight:600,borderRadius:7,
                  border:`1px solid ${zoneFilter===z.id?col+'44':C.border}`,
                  background:zoneFilter===z.id?col+'14':'transparent',
                  color:zoneFilter===z.id?col:C.sub,cursor:'pointer',fontFamily:'inherit',
                }}>{z.name} ({cnt})</button>
              })}

              <div style={{marginLeft:'auto',display:'flex',gap:5,alignItems:'center'}}>
                <button onClick={()=>setSnapEnabled(!snapEnabled)} style={{
                  padding:'3px 8px',fontSize:10,fontWeight:600,borderRadius:6,cursor:'pointer',fontFamily:'inherit',
                  border:`1px solid ${snapEnabled?C.teal+'44':C.border}`,
                  background:snapEnabled?'rgba(45,212,191,0.08)':'transparent',
                  color:snapEnabled?C.teal:C.sub,
                }}>⊞ Grid</button>
                <button onClick={()=>setZoom(z=>Math.max(0.3,z-0.15))} style={{padding:'3px 7px',fontSize:12,background:'rgba(255,255,255,0.04)',border:`1px solid ${C.border}`,borderRadius:5,color:C.sub,cursor:'pointer'}}>−</button>
                <span style={{fontSize:10,color:C.muted,minWidth:32,textAlign:'center'}}>{Math.round(zoom*100)}%</span>
                <button onClick={()=>setZoom(z=>Math.min(3,z+0.15))} style={{padding:'3px 7px',fontSize:12,background:'rgba(255,255,255,0.04)',border:`1px solid ${C.border}`,borderRadius:5,color:C.sub,cursor:'pointer'}}>+</button>
                <button onClick={()=>{setZoom(1);setPanOffset({x:0,y:0})}} style={{padding:'3px 7px',fontSize:10,background:'rgba(255,255,255,0.04)',border:`1px solid ${C.border}`,borderRadius:5,color:C.sub,cursor:'pointer',fontFamily:'inherit'}}>Fit</button>
                <div style={{width:1,height:16,background:C.border}}/>
                <button onClick={undo} disabled={undoStack.length===0} style={{
                  padding:'3px 8px',fontSize:10,fontWeight:600,borderRadius:6,
                  border:`1px solid ${C.border}`,background:'rgba(255,255,255,0.04)',
                  color:undoStack.length>0?C.sub:C.muted,cursor:undoStack.length>0?'pointer':'default',
                  fontFamily:'inherit',opacity:undoStack.length>0?1:0.4,
                }}>↩ Deshacer</button>
                {/* Join/Separate buttons */}
                {multiSelect.size >= 2 && (
                  <button onClick={joinTables} style={{
                    padding:'3px 10px',fontSize:10,fontWeight:700,borderRadius:6,cursor:'pointer',fontFamily:'inherit',
                    border:`1px solid ${C.teal}44`,background:C.tealDim,color:C.teal,
                    animation:'pulse-glow 1.5s ease-in-out infinite',
                  }}>🔗 Juntar ({multiSelect.size})</button>
                )}
                {selectedId && tables.find(t=>t.id===selectedId)?.combo_group && (
                  <button onClick={()=>separateGroup(tables.find(t=>t.id===selectedId)!.combo_group!)} style={{
                    padding:'3px 10px',fontSize:10,fontWeight:700,borderRadius:6,cursor:'pointer',fontFamily:'inherit',
                    border:`1px solid ${C.red}44`,background:C.redDim,color:C.red,
                  }}>✂️ Separar</button>
                )}
                {multiSelect.size > 0 && (
                  <span style={{fontSize:9,color:C.violet,fontWeight:600}}>{multiSelect.size} seleccionados</span>
                )}
              </div>
            </div>

            {/* SVG Canvas */}
            <div ref={canvasRef}
              style={{flex:1,overflow:'hidden',background:C.bg,position:'relative',cursor:isPanning?'grabbing':'default'}}
              onMouseDown={onCanvasMouseDown}
              onDragOver={e=>e.preventDefault()}
              onDrop={onCanvasDrop}
            >
              {isEmpty ? (
                /* ── EMPTY STATE: starter templates ─────────────────────────── */
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:16,padding:32}}>
                  <div style={{fontSize:48,marginBottom:8}}>🏗️</div>
                  <h2 style={{fontSize:20,fontWeight:700,color:C.text}}>Diseña tu espacio</h2>
                  <p style={{fontSize:14,color:C.sub,textAlign:'center',maxWidth:450,lineHeight:1.5}}>
                    Crea el plano de tu negocio arrastrando elementos desde el panel izquierdo, o empieza con una plantilla.
                  </p>

                  {presets.starterLayouts.length > 0 && (
                    <div style={{marginTop:12,width:'100%',maxWidth:500}}>
                      <p style={{fontSize:11,fontWeight:700,color:C.muted,textAlign:'center',marginBottom:12,letterSpacing:'0.06em',textTransform:'uppercase'}}>
                        Empezar con plantilla
                      </p>
                      <div style={{display:'grid',gridTemplateColumns:`repeat(${Math.min(presets.starterLayouts.length, 3)}, 1fr)`,gap:12}}>
                        {presets.starterLayouts.map((layout,i)=>(
                          <StarterCard key={i} layout={layout} onApply={()=>applyStarter(i)} />
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{marginTop:16,display:'flex',gap:10}}>
                    <button onClick={addQuick} style={{
                      padding:'10px 24px',fontSize:13,fontWeight:700,
                      background:`linear-gradient(135deg,${C.amber},#E8923A)`,
                      color:'#0C1018',border:'none',borderRadius:10,cursor:'pointer',fontFamily:'inherit',
                    }}>+ Añadir {unitS.toLowerCase()}</button>
                  </div>

                  <p style={{fontSize:11,color:C.muted,marginTop:16}}>
                    Ctrl+Z deshacer · Ctrl+D duplicar · Delete eliminar · Scroll zoom · Shift+Click juntar mesas
                  </p>
                </div>
              ) : (
                /* ── SVG CANVAS ──────────────────────────────────────────────── */
                <svg ref={svgRef}
                  width="100%" height="100%"
                  viewBox={`${-panOffset.x/zoom} ${-panOffset.y/zoom} ${maxX/zoom} ${maxY/zoom}`}
                  style={{display:'block'}}
                >
                  <defs>
                    <pattern id="grid-dots" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
                      <circle cx={GRID/2} cy={GRID/2} r={0.7} fill="rgba(255,255,255,0.05)" />
                    </pattern>
                    <pattern id="grid-major" width={GRID*5} height={GRID*5} patternUnits="userSpaceOnUse">
                      <circle cx={GRID*5/2} cy={GRID*5/2} r={1.2} fill="rgba(255,255,255,0.08)" />
                    </pattern>
                  </defs>
                  <rect id="canvas-bg" x={-1000} y={-1000} width={maxX+2000} height={maxY+2000} fill={C.bg}
                    onClick={clearSelection} />
                  <rect x={-1000} y={-1000} width={maxX+2000} height={maxY+2000} fill="url(#grid-dots)" />
                  <rect x={-1000} y={-1000} width={maxX+2000} height={maxY+2000} fill="url(#grid-major)" />

                  {/* Zone overlays */}
                  {zones.map((z,zi) => {
                    const b = zoneBounds[z.id]
                    if (!b) return null
                    const pad = 20
                    const col = ZONE_COLORS[zi % ZONE_COLORS.length]
                    return (
                      <g key={z.id}>
                        <rect x={b.minX-pad} y={b.minY-pad}
                          width={b.maxX-b.minX+pad*2} height={b.maxY-b.minY+pad*2}
                          rx={14} fill={col+'06'} stroke={col+'20'} strokeWidth={1.5} strokeDasharray="8 4" />
                        <text x={b.minX-pad+10} y={b.minY-pad+16}
                          fontSize={11} fontWeight={700} fill={col+'55'} style={{textTransform:'uppercase',letterSpacing:'0.05em'}}>
                          {z.name}
                        </text>
                      </g>
                    )
                  })}

                  {/* Combo connection lines */}
                  {(() => {
                    const groups = new Map<string,TableItem[]>()
                    for (const t of tables) {
                      if (t.combo_group) {
                        if (!groups.has(t.combo_group)) groups.set(t.combo_group, [])
                        groups.get(t.combo_group)!.push(t)
                      }
                    }
                    const lines: React.ReactNode[] = []
                    groups.forEach((members, gid) => {
                      if (members.length < 2) return
                      // Draw lines between consecutive combo members
                      for (let i = 0; i < members.length - 1; i++) {
                        const a = members[i], b = members[i+1]
                        const aw = a.w||80, ah = a.h||70, bw = b.w||80, bh = b.h||70
                        const ax = a.x_pos+aw/2, ay = a.y_pos+ah/2
                        const bx = b.x_pos+bw/2, by = b.y_pos+bh/2
                        lines.push(
                          <line key={`combo-${gid}-${i}`}
                            x1={ax} y1={ay} x2={bx} y2={by}
                            stroke={C.teal} strokeWidth={2.5} strokeDasharray="8 4"
                            opacity={0.5} style={{pointerEvents:'none'}} />
                        )
                      }
                      // Draw combo capacity badge at centroid
                      const cx = members.reduce((s,t)=>s+t.x_pos+(t.w||80)/2,0)/members.length
                      const cy = members.reduce((s,t)=>s+t.y_pos+(t.h||70)/2,0)/members.length
                      const totalCap = members.reduce((s,t)=>s+t.capacity,0)
                      lines.push(
                        <g key={`combo-label-${gid}`} style={{pointerEvents:'none'}}>
                          <rect x={cx-28} y={cy-11} width={56} height={22} rx={11}
                            fill={C.teal} opacity={0.9} />
                          <text x={cx} y={cy+4} textAnchor="middle"
                            fill="#0C1018" fontSize={11} fontWeight={800}
                            style={{userSelect:'none'}}>
                            🔗 {totalCap}p
                          </text>
                        </g>
                      )
                    })
                    return lines
                  })()}

                  {/* Elements */}
                  {visible.map(t=>(
                    <FloorElement key={t.id} table={t}
                      selected={selectedId===t.id}
                      multiSelected={multiSelect.has(t.id)}
                      snapOn={snapEnabled}
                      onSelect={(shift)=>handleSelect(t.id, shift)}
                      onDragEnd={(x,y)=>updatePos(t.id,x,y)}
                      onResize={(w,h)=>updateSize(t.id,w,h)}
                      onDoubleClick={()=>handleSelect(t.id, false)}
                      unitIcon={unitIcon}
                      zoneColor={t.zone_id ? zoneColorMap[t.zone_id] : undefined}
                      comboCapacity={t.combo_group ? getComboCapacity(t.combo_group) : undefined}
                    />
                  ))}
                </svg>
              )}

              {/* Footer overlay */}
              {!isEmpty && (
                <div style={{
                  position:'absolute',bottom:0,left:0,right:0,
                  padding:'8px 16px',background:'linear-gradient(transparent, rgba(12,16,24,0.9))',
                  display:'flex',gap:14,alignItems:'center',pointerEvents:'none',
                }}>
                  {Object.entries(STATUS_CFG).map(([k,v])=>(
                    <div key={k} style={{display:'flex',alignItems:'center',gap:4}}>
                      <div style={{width:8,height:8,borderRadius:2,background:v.bg,border:`1px solid ${v.color}44`}} />
                      <span style={{fontSize:10,color:C.muted}}>{tx(v.label)}</span>
                    </div>
                  ))}
                  <span style={{fontSize:10,color:C.muted,marginLeft:'auto'}}>
                    Arrastra · Shift+Click multi-selección · 🔗 Juntar mesas · Ctrl+Scroll zoom
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — Properties Panel */}
          {selectedTable && (
            <PropertiesPanel
              table={selectedTable}
              zones={zones}
              onSave={u=>saveTable(selectedTable.id,u)}
              onDelete={()=>deleteTable(selectedTable.id)}
              onDuplicate={()=>duplicateTable(selectedTable.id)}
              onClose={clearSelection}
              onSeparate={selectedTable.combo_group ? ()=>separateGroup(selectedTable.combo_group!) : undefined}
              unitS={unitS}
              zoneLabel={zoneLabel}
              isRoom={isRoom}
              tx={tx}
              comboMembers={selectedTable.combo_group ? getComboGroup(selectedTable.combo_group) : undefined}
              comboCapacity={selectedTable.combo_group ? getComboCapacity(selectedTable.combo_group) : undefined}
            />
          )}
        </div>
      )}

      {/* ── ZONES TAB ─────────────────────────────────────────────────────────── */}
      {tab === 'zones' && (
        <div style={{flex:1,overflow:'auto'}}>
          <div style={{maxWidth:600,margin:'0 auto',padding:'24px'}}>
            <div style={{display:'flex',gap:8,marginBottom:20}}>
              <input className="rz-inp" value={newZone} onChange={e=>setNewZone(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&addZone()} placeholder={zonePlaceholder} />
              <button onClick={()=>addZone()} disabled={!newZone.trim()} style={{
                padding:'9px 18px',fontSize:12,fontWeight:700,
                background:newZone.trim()?`linear-gradient(135deg,${C.amber},#E8923A)`:'rgba(255,255,255,0.06)',
                border:'none',borderRadius:10,cursor:newZone.trim()?'pointer':'not-allowed',
                color:newZone.trim()?'#0C1018':C.muted,fontFamily:'inherit',flexShrink:0,
              }}>+ {zoneLabel}</button>
            </div>
            {zones.length === 0 ? (
              <div style={{textAlign:'center',padding:'48px 0'}}>
                <p style={{fontSize:28,marginBottom:10}}>🏠</p>
                <p style={{fontSize:14,fontWeight:600,color:C.sub,marginBottom:6}}>Sin {zonesLabel.toLowerCase()} configuradas</p>
                <p style={{fontSize:12,color:C.muted}}>Las {zonesLabel.toLowerCase()} son opcionales. Puedes operar sin ellas.</p>
              </div>
            ) : zones.map((z,zi)=>(
              <ZoneRow key={z.id} zone={z} color={ZONE_COLORS[zi%ZONE_COLORS.length]}
                tableCount={tables.filter(t=>t.zone_id===z.id).length}
                onRename={n=>renameZone(z.id,n)}
                onDelete={()=>deleteZone(z.id)}
                unitP={unitP} tx={tx} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
