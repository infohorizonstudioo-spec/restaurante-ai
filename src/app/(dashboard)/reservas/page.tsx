'use client'
import{useEffect,useState,useCallback,useMemo}from'react'
import{supabase}from'@/lib/supabase'
import{BUSINESS_TEMPLATES}from'@/types'
import{PageLoader,Button,Input,Select,Textarea,Badge,Modal,EmptyState,PageHeader}from'@/components/ui'

const S={confirmada:{l:'Confirmada',v:'green'},pendiente:{l:'Pendiente',v:'amber'},cancelada:{l:'Cancelada',v:'red'},completada:{l:'Completada',v:'slate'}}
const EF={customer_name:'',customer_phone:'',reservation_date:'',reservation_time:'13:00',party_size:2,zone_id:'',table_id:'',notes:'',status:'confirmada'}

function CalIco(){return<svg width='15' height='15' viewBox='0 0 24 24' fill='#94a3b8'><path d='M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z'/></svg>}
function PlusIco(){return<svg width='14' height='14' viewBox='0 0 24 24' fill='white'><path d='M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z'/></svg>}
function BotIco(){return<svg width='10' height='10' viewBox='0 0 24 24' fill='currentColor'><path d='M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7H3a7 7 0 0 1 7-7h1V5.73A2 2 0 0 1 10 4a2 2 0 0 1 2-2M5 14v1a7 7 0 0 0 14 0v-1H5z'/></svg>}

export default function ReservasPage(){
  const[tenant,setTenant]=useState(null)
  const[reservations,setRes]=useState([])
  const[tables,setTables]=useState([])
  const[zones,setZones]=useState([])
  const[loading,setLoading]=useState(true)
  const[saving,setSaving]=useState(false)
  const[selectedDate,setDate]=useState(new Date().toISOString().split('T')[0])
  const[search,setSearch]=useState('')
  const[showModal,setShowModal]=useState(false)
  const[form,setForm]=useState({...EF,reservation_date:new Date().toISOString().split('T')[0]})
  const[formErr,setFormErr]=useState({})

  const loadData=useCallback(async()=>{
    const{data:{user}}=await supabase.auth.getUser();if(!user)return
    const{data:p}=await supabase.from('profiles').select('tenant_id').eq('id',user.id).single();if(!p?.tenant_id)return
    const tid=p.tenant_id
    const[{data:t},{data:r},{data:tb},{data:z}]=await Promise.all([
      supabase.from('tenants').select('*').eq('id',tid).single(),
      supabase.from('reservations').select('*').eq('tenant_id',tid).eq('reservation_date',selectedDate).order('reservation_time'),
      supabase.from('tables').select('*').eq('tenant_id',tid).order('name'),
      supabase.from('zones').select('*').eq('tenant_id',tid).order('name'),
    ])
    setTenant(t);setRes(r||[]);setTables(tb||[]);setZones(z||[]);setLoading(false)
  },[selectedDate])

  useEffect(()=>{loadData()},[loadData])

  const weekDays=useMemo(()=>{
    const t=new Date();return Array.from({length:7},(_,i)=>{const d=new Date(t);d.setDate(t.getDate()-3+i);const iso=d.toISOString().split('T')[0];return{iso,num:d.getDate(),wd:d.toLocaleDateString('es-ES',{weekday:'short'}).slice(0,2).toUpperCase(),isToday:iso===new Date().toISOString().split('T')[0]}})
  },[])

  const filtered=useMemo(()=>{if(!search)return reservations;const q=search.toLowerCase();return reservations.filter(r=>r.customer_name?.toLowerCase().includes(q)||r.customer_phone?.includes(search))},[reservations,search])

  async function create(){
    const e={};if(!form.customer_name.trim())e.customer_name='Requerido';if(!form.reservation_date)e.reservation_date='Requerida';if(!form.reservation_time)e.reservation_time='Requerida';setFormErr(e);if(Object.keys(e).length)return
    setSaving(true)
    const tbl=form.table_id?tables.find(t=>t.id===form.table_id):null
    await supabase.from('reservations').insert({tenant_id:tenant.id,customer_name:form.customer_name.trim(),customer_phone:form.customer_phone.trim(),reservation_date:form.reservation_date,reservation_time:form.reservation_time,party_size:Number(form.party_size),table_id:form.table_id||null,table_name:tbl?.name||null,notes:form.notes.trim()||null,status:form.status,source:'manual'})
    setSaving(false);setShowModal(false);setForm({...EF,reservation_date:selectedDate});setFormErr({});loadData()
  }

  async function updateStatus(id,status){
    await supabase.from('reservations').update({status}).eq('id',id)
    setRes(prev=>prev.map(r=>r.id===id?{...r,status}:r))
  }

  if(loading)return<PageLoader/>
  const template=BUSINESS_TEMPLATES[tenant?.type||'otro']||BUSINESS_TEMPLATES.otro
  const unit=template.reservationUnit==='mesa'?'reserva':'cita'
  const unitPl=unit==='reserva'?'Reservas':'Citas'
  const hasZones=template.hasTableManagement&&zones.length>0

  return(
    <div style={{background:'#f8fafc',minHeight:'100vh'}}>
      <PageHeader title={unitPl} subtitle={filtered.length+' '+unit+'s para hoy'}
        actions={<Button icon={<PlusIco/>} onClick={()=>setShowModal(true)}>Nueva {unit}</Button>}/>
      <div style={{maxWidth:1100,margin:'0 auto',padding:24}}>
        {/* Week nav */}
        <div style={{display:'flex',gap:4,background:'white',border:'1px solid #e2e8f0',borderRadius:12,padding:5,marginBottom:16}}>
          {weekDays.map(d=>(
            <button key={d.iso} onClick={()=>setDate(d.iso)} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',padding:'8px 4px',borderRadius:8,border:'none',cursor:'pointer',background:selectedDate===d.iso?'#1e40af':d.isToday?'#eff6ff':'transparent',color:selectedDate===d.iso?'white':d.isToday?'#1e40af':'#94a3b8',transition:'all 0.12s'}}>
              <span style={{fontSize:10,fontWeight:600,opacity:.75}}>{d.wd}</span>
              <span style={{fontSize:15,fontWeight:700,marginTop:2}}>{d.num}</span>
            </button>
          ))}
        </div>
        {/* Search */}
        <div style={{marginBottom:12}}>
          <Input placeholder={'Buscar '+unit+'s...'} value={search} onChange={e=>setSearch(e.target.value)} style={{maxWidth:320}}/>
        </div>
        {/* Table */}
        {filtered.length===0
          ?<div style={{background:'white',border:'1px solid #e2e8f0',borderRadius:12}}><EmptyState icon={<CalIco/>} title={'Sin '+unit+'s'} description={'No hay '+unit+'s para esta fecha'} action={<Button icon={<PlusIco/>} onClick={()=>setShowModal(true)}>Nueva {unit}</Button>}/></div>
          :<div style={{background:'white',border:'1px solid #e2e8f0',borderRadius:12,overflow:'hidden'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr style={{background:'#fafafa'}}>
                {['Hora','Cliente','Pers.','Mesa','Estado'].map(h=><th key={h} style={{textAlign:'left',padding:'10px 16px',fontSize:11,fontWeight:600,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.05em',borderBottom:'1px solid #e2e8f0'}}>{h}</th>)}
              </tr></thead>
              <tbody>
                {filtered.map((res,i)=>{
                  const sc=S[res.status]||S.confirmada
                  return(
                    <tr key={res.id} style={{borderTop:i>0?'1px solid #f1f5f9':'none'}}>
                      <td style={{padding:'13px 16px'}}><span style={{fontFamily:'monospace',fontWeight:600,fontSize:14}}>{res.reservation_time?.slice(0,5)}</span></td>
                      <td style={{padding:'13px 16px'}}>
                        <div style={{display:'flex',alignItems:'center',gap:10}}>
                          <div style={{width:30,height:30,borderRadius:'50%',background:'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'#1d4ed8',flexShrink:0}}>{res.customer_name?.[0]?.toUpperCase()||'?'}</div>
                          <div>
                            <div style={{display:'flex',alignItems:'center',gap:6}}><p style={{fontSize:13,fontWeight:500}}>{res.customer_name}</p>{res.source==='voice_agent'&&<span style={{display:'inline-flex',alignItems:'center',gap:3,fontSize:10,fontWeight:600,color:'#1d4ed8',background:'#eff6ff',padding:'1px 6px',borderRadius:20}}><BotIco/>IA</span>}</div>
                            {res.customer_phone&&<p style={{fontSize:11,color:'#94a3b8'}}>{res.customer_phone}</p>}
                            {res.notes&&<p style={{fontSize:11,color:'#94a3b8',fontStyle:'italic'}}>{res.notes}</p>}
                          </div>
                        </div>
                      </td>
                      <td style={{padding:'13px 16px'}}><span style={{fontSize:13,color:'#64748b'}}>{res.party_size}</span></td>
                      <td style={{padding:'13px 16px'}}>{res.table_name?<Badge variant='slate'>{res.table_name}</Badge>:<span style={{color:'#d1d5db'}}>—</span>}</td>
                      <td style={{padding:'13px 16px'}}>
                        <select value={res.status||'confirmada'} onChange={e=>updateStatus(res.id,e.target.value)} style={{fontFamily:'inherit',fontSize:11,fontWeight:600,border:'none',background:'none',cursor:'pointer',color:sc.v==='green'?'#065f46':sc.v==='amber'?'#92400e':sc.v==='red'?'#991b1b':'#475569'}}>
                          {Object.entries(S).map(([k,v])=><option key={k} value={k}>{v.l}</option>)}
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>}
      </div>
      <Modal open={showModal} onClose={()=>{setShowModal(false);setFormErr({})}} title={'Nueva '+unit} footer={<><Button variant='secondary' style={{flex:1}} onClick={()=>{setShowModal(false);setFormErr({})}}>Cancelar</Button><Button style={{flex:1}} loading={saving} onClick={create}>Crear {unit}</Button></>}>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><Input label='Nombre *' value={form.customer_name} error={formErr.customer_name} placeholder='Juan García' onChange={e=>setForm({...form,customer_name:e.target.value})}/><Input label='Teléfono' value={form.customer_phone} placeholder='+34 600 000 000' onChange={e=>setForm({...form,customer_phone:e.target.value})}/></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 80px',gap:12}}><Input label='Fecha *' type='date' value={form.reservation_date} error={formErr.reservation_date} onChange={e=>setForm({...form,reservation_date:e.target.value})}/><Input label='Hora *' type='time' value={form.reservation_time} error={formErr.reservation_time} onChange={e=>setForm({...form,reservation_time:e.target.value})}/><Input label='Personas' type='number' min='1' value={String(form.party_size)} onChange={e=>setForm({...form,party_size:parseInt(e.target.value)||1})}/></div>
          {hasZones&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><Select label='Zona' value={form.zone_id} onChange={e=>setForm({...form,zone_id:e.target.value,table_id:''})}><option value=''>Sin zona</option>{zones.map(z=><option key={z.id} value={z.id}>{z.name}</option>)}</Select><Select label='Mesa' value={form.table_id} onChange={e=>setForm({...form,table_id:e.target.value})}><option value=''>Sin asignar</option>{tables.filter(t=>!form.zone_id||t.zone_id===form.zone_id).map(t=><option key={t.id} value={t.id}>{t.name} ({t.capacity}p)</option>)}</Select></div>}
          <Select label='Estado' value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{Object.entries(S).map(([k,v])=><option key={k} value={k}>{v.l}</option>)}</Select>
          <Textarea label='Notas' value={form.notes} rows={2} placeholder='Alergias, peticiones especiales...' onChange={e=>setForm({...form,notes:e.target.value})}/>
        </div>
      </Modal>
    </div>
  )
}