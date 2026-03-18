'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { PageLoader } from '@/components/ui'
import { useTenant } from '@/contexts/TenantContext'
import Link from 'next/link'

const ZC=['#1d4ed8','#059669','#7c3aed','#d97706','#dc2626','#0891b2','#be185d']

export default function MesasPage(){
  const [zones,setZones]=useState<any[]>([])
  const [units,setUnits]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [tid,setTid]=useState<string|null>(null)
  const [tab,setTab]=useState<'units'|'zones'>('units')
  const [newZone,setNewZone]=useState('')
  const [editUnit,setEditUnit]=useState<any|null>(null)
  const { template } = useTenant()

  // Etiquetas dinámicas 100% desde la plantilla — sin hardcoding
  const ut = template?.labels?.unit || { singular:'Mesa', plural:'Mesas', icon:'M', zoneLabel:'Zona', zonesLabel:'Zonas' }

  const load=useCallback(async(tenantId:string)=>{
    const [zr,ur]=await Promise.all([
      supabase.from('zones').select('*').eq('tenant_id',tenantId).eq('active',true).order('created_at'),
      supabase.from('tables').select('*').eq('tenant_id',tenantId).order('number'),
    ])
    setZones(zr.data||[]);setUnits(ur.data||[])
    setLoading(false)
  },[])

  useEffect(()=>{
    (async()=>{
      const {data:{user}}=await supabase.auth.getUser();if(!user)return
      const {data:p}=await supabase.from('profiles').select('tenant_id').eq('id',user.id).single();if(!p?.tenant_id)return
      setTid(p.tenant_id);await load(p.tenant_id)
    })()
  },[load])

  if(loading)return<PageLoader/>

  // GUARDIA: módulo de espacios no disponible para esta plantilla
  if(template && !template.hasSpaces){
    return(
      <div style={{background:'#f8fafc',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
        <div style={{textAlign:'center',maxWidth:400}}>
          <div style={{fontSize:48,marginBottom:16}}>🚫</div>
          <h2 style={{fontSize:20,fontWeight:700,color:'#0f172a',marginBottom:8}}>Módulo no disponible</h2>
          <p style={{fontSize:14,color:'#64748b',lineHeight:1.6,marginBottom:24}}>
            Este módulo no está activo para tu tipo de negocio.<br/>
            La plantilla <strong>{template.label}</strong> no incluye gestión de {ut.plural.toLowerCase()}.
          </p>
          <Link href="/panel" style={{padding:'10px 24px',fontSize:14,fontWeight:600,color:'white',background:'linear-gradient(135deg,#1e40af,#3b82f6)',borderRadius:9,textDecoration:'none'}}>
            Volver al panel
          </Link>
        </div>
      </div>
    )
  }

  async function addUnit(zoneId?:string){
    if(!tid)return
    const same=zoneId?units.filter(u=>(u.zone_id||u.zone)===zoneId):units.filter(u=>!u.zone_id&&!u.zone)
    const num=String((same.length>0?Math.max(...same.map(u=>parseInt(u.number)||0)):0)+1)
    const {data}=await supabase.from('tables').insert({
      tenant_id:tid,zone:zoneId||null,zone_id:zoneId||null,number:num,
      capacity:2,min_capacity:1,status:'libre',shape:'rectangle'
    }).select().single()
    if(data)setEditUnit(data)
    await load(tid)
  }

  async function saveUnit(id:string,updates:any){
    await supabase.from('tables').update({
      zone:updates.zone_id||null,zone_id:updates.zone_id||null,
      capacity:updates.capacity,notes:updates.notes||null
    }).eq('id',id)
    setEditUnit(null);await load(tid!)
  }

  async function delUnit(id:string){
    if(!confirm('¿Eliminar?'))return
    await supabase.from('tables').delete().eq('id',id)
    await load(tid!)
  }

  async function addZone(){
    if(!tid||!newZone.trim())return
    await supabase.from('zones').insert({tenant_id:tid,name:newZone.trim(),active:true})
    setNewZone('');await load(tid)
  }

  async function delZone(zoneId:string){
    if(!confirm('¿Eliminar zona?'))return
    await supabase.from('tables').update({zone:null,zone_id:null}).or('zone.eq.'+zoneId+',zone_id.eq.'+zoneId)
    await supabase.from('zones').update({active:false}).eq('id',zoneId)
    await load(tid!)
  }

  async function renZone(zoneId:string,name:string){
    await supabase.from('zones').update({name}).eq('id',zoneId);await load(tid!)
  }

  const byZone:Record<string,any[]>={'__none__':[]}
  zones.forEach(z=>{byZone[z.id]=[]})
  units.forEach(u=>{const zk=u.zone_id||u.zone;const k=zk&&byZone[zk]!==undefined?zk:'__none__';byZone[k].push(u)})

  return(
    <div style={{background:'#f8fafc',minHeight:'100vh'}}>
      <div style={{background:'white',borderBottom:'1px solid #e2e8f0',padding:'14px 24px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <h1 style={{fontSize:18,fontWeight:700,color:'#0f172a'}}>{ut.plural}</h1>
          <p style={{fontSize:12,color:'#94a3b8',marginTop:1}}>{units.length} {ut.plural.toLowerCase()} · {zones.length} {ut.zonesLabel.toLowerCase()}</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          {(['units','zones'] as const).map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{padding:'7px 16px',fontSize:13,fontWeight:600,border:'1px solid',borderColor:tab===t?'#1d4ed8':'#e2e8f0',background:tab===t?'#eff6ff':'white',color:tab===t?'#1d4ed8':'#64748b',borderRadius:8,cursor:'pointer',fontFamily:'inherit'}}>
              {t==='units'?ut.plural:ut.zonesLabel}
            </button>
          ))}
        </div>
      </div>

      {tab==='units'&&(
        <div style={{maxWidth:1000,margin:'0 auto',padding:'20px 24px'}}>
          {zones.length===0&&(
            <>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
                <p style={{fontSize:13,color:'#64748b'}}>{units.length===0?'Añade '+ut.plural.toLowerCase()+' para que el agente las asigne automáticamente':units.length+' '+ut.plural.toLowerCase()}</p>
                <button onClick={()=>addUnit()} style={{padding:'8px 18px',fontSize:13,fontWeight:600,color:'white',background:'linear-gradient(135deg,#1e40af,#3b82f6)',border:'none',borderRadius:9,cursor:'pointer'}}>+ {ut.singular}</button>
              </div>
              <Grid units={units} ut={ut} color='#1d4ed8' onEdit={setEditUnit} onDel={delUnit} onAdd={()=>addUnit()}/>
            </>
          )}
          {zones.length>0&&zones.map((z,zi)=>(
            <div key={z.id} style={{marginBottom:24}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{width:10,height:10,borderRadius:'50%',background:ZC[zi%ZC.length]}}/>
                  <p style={{fontSize:14,fontWeight:700,color:'#0f172a'}}>{z.name}</p>
                  <span style={{fontSize:12,color:'#94a3b8'}}>{(byZone[z.id]||[]).length}</span>
                </div>
                <button onClick={()=>addUnit(z.id)} style={{padding:'5px 12px',fontSize:12,fontWeight:600,color:ZC[zi%ZC.length],background:ZC[zi%ZC.length]+'14',border:'1px solid '+ZC[zi%ZC.length]+'33',borderRadius:7,cursor:'pointer'}}>+ {ut.singular}</button>
              </div>
              <Grid units={byZone[z.id]||[]} ut={ut} color={ZC[zi%ZC.length]} onEdit={setEditUnit} onDel={delUnit} onAdd={()=>addUnit(z.id)}/>
            </div>
          ))}
          {zones.length>0&&byZone['__none__']?.length>0&&(
            <div style={{marginBottom:24}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                <div style={{width:10,height:10,borderRadius:'50%',background:'#94a3b8'}}/>
                <p style={{fontSize:14,fontWeight:600,color:'#94a3b8'}}>Sin {ut.zoneLabel.toLowerCase()} · {byZone['__none__'].length}</p>
              </div>
              <Grid units={byZone['__none__']} ut={ut} color='#94a3b8' onEdit={setEditUnit} onDel={delUnit} onAdd={()=>addUnit()}/>
            </div>
          )}
        </div>
      )}

      {tab==='zones'&&(
        <div style={{maxWidth:600,margin:'0 auto',padding:'20px 24px'}}>
          <p style={{fontSize:13,color:'#64748b',marginBottom:16,lineHeight:1.6}}>Las {ut.zonesLabel.toLowerCase()} son opcionales. El agente puede sugerirlas al cliente.</p>
          <div style={{display:'flex',gap:8,marginBottom:20}}>
            <input value={newZone} onChange={e=>setNewZone(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addZone()} placeholder={'Nueva '+ut.zoneLabel.toLowerCase()+' (Terraza, Interior…)'} style={{flex:1,padding:'9px 14px',fontSize:14,border:'1px solid #e2e8f0',borderRadius:9,outline:'none',fontFamily:'inherit'}}/>
            <button onClick={addZone} disabled={!newZone.trim()} style={{padding:'9px 18px',fontSize:13,fontWeight:600,color:'white',background:'#1d4ed8',border:'none',borderRadius:9,cursor:'pointer',opacity:!newZone.trim()?0.5:1}}>+ {ut.zoneLabel}</button>
          </div>
          {zones.length===0&&<div style={{textAlign:'center',padding:'40px 0',color:'#94a3b8'}}><p>Sin {ut.zonesLabel.toLowerCase()}. Puedes operar sin ellas.</p></div>}
          {zones.map((z,zi)=>(
            <ZoneRow key={z.id} zone={z} color={ZC[zi%ZC.length]} count={units.filter(u=>(u.zone_id||u.zone)===z.id).length} onRename={(n:string)=>renZone(z.id,n)} onDelete={()=>delZone(z.id)}/>
          ))}
        </div>
      )}

      {editUnit&&<EditModal unit={editUnit} ut={ut} zones={zones} onSave={(u:any)=>saveUnit(editUnit.id,u)} onClose={()=>setEditUnit(null)}/>}
    </div>
  )
}

function Grid({units,ut,color,onEdit,onDel,onAdd}:any){
  return(
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:10}}>
      {units.map((u:any)=>(
        <div key={u.id} style={{background:'white',border:'1px solid #e2e8f0',borderRadius:12,padding:'12px 14px',position:'relative'}}>
          <div style={{width:34,height:34,borderRadius:10,background:color+'14',border:'1.5px solid '+color+'44',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color,marginBottom:8}}>{ut.icon}</div>
          <p style={{fontSize:13,fontWeight:700,color:'#0f172a',marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{u.number?ut.singular+' '+u.number:ut.singular}</p>
          <p style={{fontSize:11,color:'#94a3b8'}}>{u.capacity||1} persona{(u.capacity||1)!==1?'s':''}</p>
          <div style={{position:'absolute',top:8,right:8,display:'flex',gap:3}}>
            <button onClick={()=>onEdit(u)} style={{padding:'2px 6px',fontSize:11,background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:5,cursor:'pointer'}}>✎</button>
            <button onClick={()=>onDel(u.id)} style={{padding:'2px 6px',fontSize:11,background:'#fef2f2',border:'1px solid #fecaca',borderRadius:5,cursor:'pointer',color:'#dc2626'}}>✕</button>
          </div>
        </div>
      ))}
      <button onClick={onAdd} style={{height:90,border:'2px dashed #e2e8f0',borderRadius:12,background:'transparent',cursor:'pointer',fontSize:22,color:'#94a3b8',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2}}>
        <span>+</span><span style={{fontSize:11}}>{ut.singular}</span>
      </button>
    </div>
  )
}

function ZoneRow({zone,color,count,onRename,onDelete}:any){
  const [editing,setEditing]=useState(false)
  const [name,setName]=useState(zone.name)
  function save(){if(name.trim()&&name!==zone.name)onRename(name.trim());setEditing(false)}
  return(
    <div style={{background:'white',border:'1px solid #e2e8f0',borderRadius:12,padding:'14px 16px',marginBottom:10,display:'flex',alignItems:'center',gap:12}}>
      <div style={{width:12,height:12,borderRadius:'50%',background:color,flexShrink:0}}/>
      {editing?<input value={name} onChange={e=>setName(e.target.value)} onBlur={save} onKeyDown={e=>{if(e.key==='Enter')save();if(e.key==='Escape')setEditing(false)}} autoFocus style={{flex:1,fontSize:14,border:'1px solid #1d4ed8',borderRadius:7,padding:'4px 8px',outline:'none',fontFamily:'inherit'}}/>
        :<p style={{flex:1,fontSize:14,fontWeight:500,color:'#0f172a',cursor:'pointer'}} onClick={()=>setEditing(true)}>{zone.name}</p>}
      <span style={{fontSize:12,color:'#94a3b8'}}>{count} uds.</span>
      <button onClick={()=>setEditing(true)} style={{padding:'4px 8px',fontSize:12,background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:7,cursor:'pointer'}}>Editar</button>
      <button onClick={onDelete} style={{padding:'4px 8px',fontSize:12,background:'#fef2f2',border:'1px solid #fecaca',borderRadius:7,cursor:'pointer',color:'#dc2626'}}>Borrar</button>
    </div>
  )
}

function EditModal({unit,ut,zones,onSave,onClose}:any){
  const [cap,setCap]=useState(unit.capacity||2)
  const [zoneId,setZoneId]=useState(unit.zone_id||unit.zone||'')
  const [notes,setNotes]=useState(unit.notes||'')
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}} onClick={onClose}>
      <div style={{background:'white',borderRadius:16,padding:24,width:'100%',maxWidth:360,boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <p style={{fontSize:16,fontWeight:700,color:'#0f172a'}}>{ut.singular} {unit.number}</p>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#94a3b8'}}>✕</button>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div>
            <p style={{fontSize:11,fontWeight:600,color:'#374151',textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:5}}>Capacidad</p>
            <input type='number' value={cap} min={1} max={9999} onChange={e=>setCap(parseInt(e.target.value)||1)} style={{width:'100%',padding:'9px 12px',fontSize:14,border:'1px solid #e2e8f0',borderRadius:8,outline:'none',fontFamily:'inherit'}}/>
          </div>
          {zones.length>0&&(
            <div>
              <p style={{fontSize:11,fontWeight:600,color:'#374151',textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:5}}>{ut.zoneLabel} (opcional)</p>
              <select value={zoneId} onChange={e=>setZoneId(e.target.value)} style={{width:'100%',padding:'9px 12px',fontSize:14,border:'1px solid #e2e8f0',borderRadius:8,outline:'none',fontFamily:'inherit',background:'white'}}>
                <option value=''>Sin {ut.zoneLabel.toLowerCase()}</option>
                {zones.map((z:any)=><option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </div>
          )}
          <div style={{display:'flex',gap:8}}>
            <button onClick={onClose} style={{flex:1,padding:'10px',fontSize:13,background:'white',border:'1px solid #e2e8f0',borderRadius:9,cursor:'pointer',fontFamily:'inherit'}}>Cancelar</button>
            <button onClick={()=>onSave({zone_id:zoneId||null,capacity:Math.max(1,cap),notes:notes.trim()||null})} style={{flex:2,padding:'10px',fontSize:13,fontWeight:700,background:'linear-gradient(135deg,#1e40af,#3b82f6)',border:'none',borderRadius:9,cursor:'pointer',color:'white',fontFamily:'inherit'}}>Guardar</button>
          </div>
        </div>
      </div>
    </div>
  )
}
