'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { PageLoader, Button } from '@/components/ui'

const COLORS = ['#1d4ed8','#059669','#7c3aed','#d97706','#dc2626','#0891b2']
const SHAPES = ['circle','square','rectangle']

export default function MesasPage() {
  const [zones,setZones]   = useState<any[]>([])
  const [tables,setTables] = useState<any[]>([])
  const [loading,setLoading] = useState(true)
  const [tid,setTid]       = useState<string|null>(null)
  const [editZone,setEditZone] = useState<any|null>(null)
  const [newZone,setNewZone]   = useState('')
  const [saving,setSaving]     = useState(false)
  const [activeZone,setActiveZone] = useState<string|null>(null)

  const load = useCallback(async (tenantId:string) => {
    const [zr,tr] = await Promise.all([
      supabase.from('zones').select('*').eq('tenant_id',tenantId).eq('active',true).order('created_at'),
      supabase.from('tables').select('*').eq('tenant_id',tenantId).eq('active',true).order('number'),
    ])
    setZones(zr.data||[]); setTables(tr.data||[])
    if (zr.data?.length && !activeZone) setActiveZone(zr.data[0].id)
    setLoading(false)
  },[activeZone])

  useEffect(()=>{
    (async()=>{
      const {data:{user}} = await supabase.auth.getUser()
      if (!user) return
      const {data:p} = await supabase.from('profiles').select('tenant_id').eq('id',user.id).single()
      if (!p?.tenant_id) return
      setTid(p.tenant_id); await load(p.tenant_id)
    })()
  },[load])

  async function addZone() {
    if (!tid||!newZone.trim()) return
    setSaving(true)
    const {data} = await supabase.from('zones').insert({tenant_id:tid,name:newZone.trim(),active:true}).select().single()
    setNewZone('')
    if (data) setActiveZone(data.id)
    await load(tid!)
    setSaving(false)
  }

  async function deleteZone(id:string) {
    if (!confirm('¿Eliminar esta zona y sus mesas?')) return
    await supabase.from('tables').update({active:false}).eq('zone_id',id)
    await supabase.from('zones').update({active:false}).eq('id',id)
    if (activeZone===id) setActiveZone(zones.find(z=>z.id!==id)?.id||null)
    await load(tid!)
  }

  async function addTable(zoneId:string) {
    if (!tid) return
    const zoneTables = tables.filter(m=>m.zone_id===zoneId)
    const num = (zoneTables.length>0 ? Math.max(...zoneTables.map(m=>m.number||0)) : 0) + 1
    await supabase.from('tables').insert({
      tenant_id:tid, zone_id:zoneId, number:num, table_name:'Mesa '+num, name:'Mesa '+num,
      capacity:4, min_capacity:1, active:true, status:'available', shape:'rectangle'
    })
    await load(tid)
  }

  async function updateTable(id:string, updates:any) {
    await supabase.from('tables').update({...updates, name:updates.table_name||updates.name, table_name:updates.table_name||updates.name}).eq('id',id)
    await load(tid!)
  }

  async function deleteTable(id:string) {
    await supabase.from('tables').update({active:false}).eq('id',id)
    await load(tid!)
  }

  if (loading) return <PageLoader/>

  const activeZoneData = zones.find(z=>z.id===activeZone)
  const zoneTables = tables.filter(m=>m.zone_id===activeZone)

  return (
    <div style={{background:'#f8fafc',minHeight:'100vh'}}>
      <div style={{background:'white',borderBottom:'1px solid #e2e8f0',padding:'14px 24px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <h1 style={{fontSize:18,fontWeight:700,color:'#0f172a'}}>Local y mesas</h1>
          <p style={{fontSize:12,color:'#94a3b8',marginTop:1}}>{zones.length} zonas · {tables.length} mesas</p>
        </div>
      </div>
      <div style={{display:'flex',gap:0,height:'calc(100vh - 61px)'}}>
        {/* Zonas sidebar */}
        <div style={{width:200,background:'white',borderRight:'1px solid #e2e8f0',display:'flex',flexDirection:'column',overflow:'hidden'}}>
          <div style={{padding:'12px 14px',borderBottom:'1px solid #f1f5f9'}}>
            <p style={{fontSize:11,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:10}}>Zonas</p>
            {zones.map((z,i)=>(
              <div key={z.id} onClick={()=>setActiveZone(z.id)} style={{padding:'8px 10px',borderRadius:9,marginBottom:2,cursor:'pointer',display:'flex',alignItems:'center',gap:8,
                background:activeZone===z.id?'#eff6ff':'transparent',transition:'background 0.1s'}}
                onMouseEnter={e=>{if(activeZone!==z.id)(e.currentTarget as HTMLElement).style.background='#f9fafb'}}
                onMouseLeave={e=>{if(activeZone!==z.id)(e.currentTarget as HTMLElement).style.background='transparent'}}>
                <div style={{width:10,height:10,borderRadius:'50%',background:COLORS[i%COLORS.length],flexShrink:0}}/>
                <span style={{fontSize:13,fontWeight:activeZone===z.id?600:400,color:activeZone===z.id?'#1d4ed8':'#374151',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{z.name}</span>
                <span style={{fontSize:11,color:'#94a3b8'}}>{tables.filter(m=>m.zone_id===z.id).length}</span>
              </div>
            ))}
          </div>
          <div style={{padding:'12px 14px'}}>
            <input value={newZone} onChange={e=>setNewZone(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&addZone()}
              placeholder="Nueva zona..."
              style={{width:'100%',padding:'7px 10px',fontSize:12,border:'1px solid #e2e8f0',borderRadius:8,outline:'none',fontFamily:'inherit'}}/>
            <button onClick={addZone} disabled={!newZone.trim()||saving} style={{width:'100%',marginTop:6,padding:'7px',fontSize:12,fontWeight:600,color:'white',background:'#1d4ed8',border:'none',borderRadius:8,cursor:'pointer',opacity:!newZone.trim()?0.5:1}}>
              + Añadir zona
            </button>
          </div>
        </div>

        {/* Mesas */}
        <div style={{flex:1,padding:20,overflowY:'auto'}}>
          {!activeZone ? (
            <div style={{textAlign:'center',padding:'60px 0',color:'#94a3b8'}}>
              <div style={{fontSize:40,marginBottom:10}}>🗺️</div>
              <p>Crea una zona para empezar</p>
            </div>
          ) : (
            <>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{width:12,height:12,borderRadius:'50%',background:COLORS[zones.indexOf(activeZoneData!)%COLORS.length]}}/>
                  <p style={{fontSize:15,fontWeight:700,color:'#0f172a'}}>{activeZoneData?.name}</p>
                  <span style={{fontSize:12,color:'#94a3b8'}}>{zoneTables.length} mesa{zoneTables.length!==1?'s':''}</span>
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={()=>addTable(activeZone)} style={{padding:'7px 14px',fontSize:12,fontWeight:600,color:'white',background:'#1d4ed8',border:'none',borderRadius:8,cursor:'pointer'}}>
                    + Mesa
                  </button>
                  <button onClick={()=>deleteZone(activeZone)} style={{padding:'7px 14px',fontSize:12,fontWeight:600,color:'#dc2626',background:'#fef2f2',border:'1px solid #fecaca',borderRadius:8,cursor:'pointer'}}>
                    Eliminar zona
                  </button>
                </div>
              </div>

              {zoneTables.length===0 ? (
                <div style={{background:'white',border:'2px dashed #e2e8f0',borderRadius:14,padding:'40px 24px',textAlign:'center',cursor:'pointer'}} onClick={()=>addTable(activeZone)}>
                  <p style={{fontSize:14,color:'#94a3b8'}}>+ Añadir primera mesa a esta zona</p>
                </div>
              ) : (
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:12}}>
                  {zoneTables.map(m=>(
                    <div key={m.id} style={{background:'white',border:'1px solid #e2e8f0',borderRadius:12,padding:14,boxShadow:'0 1px 3px rgba(0,0,0,0.04)'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                        <div style={{width:40,height:40,borderRadius:m.shape==='circle'?'50%':m.shape==='square'?8:6,background:COLORS[zones.indexOf(activeZoneData!)%COLORS.length]+'22',border:'2px solid '+COLORS[zones.indexOf(activeZoneData!)%COLORS.length],display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:COLORS[zones.indexOf(activeZoneData!)%COLORS.length]}}>
                          {m.number||'M'}
                        </div>
                        <button onClick={()=>deleteTable(m.id)} style={{padding:'3px 7px',fontSize:11,color:'#dc2626',background:'#fef2f2',border:'1px solid #fecaca',borderRadius:6,cursor:'pointer'}}>✕</button>
                      </div>
                      <input value={m.table_name||m.name||''} onChange={e=>updateTable(m.id,{table_name:e.target.value})}
                        style={{width:'100%',fontSize:13,fontWeight:600,border:'none',background:'transparent',color:'#0f172a',outline:'none',marginBottom:6,fontFamily:'inherit'}}/>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <span style={{fontSize:11,color:'#94a3b8'}}>Cap:</span>
                        <input type='number' value={m.capacity||4} min={1} max={20}
                          onChange={e=>updateTable(m.id,{capacity:parseInt(e.target.value)||4})}
                          style={{width:45,fontSize:13,fontWeight:600,border:'1px solid #e2e8f0',borderRadius:6,padding:'2px 6px',outline:'none',fontFamily:'inherit'}}/>
                        <span style={{fontSize:11,color:'#94a3b8'}}>personas</span>
                      </div>
                      {m.notes!==undefined&&<input value={m.notes||''} onChange={e=>updateTable(m.id,{notes:e.target.value})}
                        placeholder="Notas..."
                        style={{width:'100%',marginTop:6,fontSize:11,color:'#64748b',border:'none',background:'transparent',outline:'none',fontFamily:'inherit'}}/>}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}