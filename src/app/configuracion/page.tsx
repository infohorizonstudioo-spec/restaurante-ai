'use client'
import{useEffect,useState,useCallback}from'react'
import{supabase}from'@/lib/supabase'
import{PageLoader,PageHeader,Button,Input,Select,Textarea,Badge,Alert,Card,CardHeader}from'@/components/ui'

const PC={trial:{l:'Trial gratuito',v:'amber',n:10},starter:{l:'Starter',v:'blue',n:50},pro:{l:'Pro',v:'indigo',n:200},business:{l:'Business',v:'green',n:600}}

function Sec({title,sub,children}){
  return<div style={{background:'white',border:'1px solid #e2e8f0',borderRadius:12,overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,0.04)'}}><div style={{padding:'14px 20px',borderBottom:'1px solid #f1f5f9'}}><p style={{fontSize:14,fontWeight:600,color:'#0f172a'}}>{title}</p>{sub&&<p style={{fontSize:12,color:'#94a3b8',marginTop:1}}>{sub}</p>}</div><div style={{padding:'20px'}}>{children}</div></div>
}

export default function ConfiguracionPage(){
  const[tenant,setTenant]=useState(null)
  const[loading,setLoading]=useState(true)
  const[saving,setSaving]=useState(false)
  const[saved,setSaved]=useState(false)
  const[form,setForm]=useState({agent_name:'',agent_phone:'',language:'es',business_description:''})
  const[errors,setErrors]=useState({})

  useEffect(()=>{
    let m=true
    async function load(){
      const{data:{user}}=await supabase.auth.getUser();if(!user)return
      const{data:p}=await supabase.from('profiles').select('tenant_id').eq('id',user.id).single();if(!p?.tenant_id)return
      const{data:t}=await supabase.from('tenants').select('*').eq('id',p.tenant_id).single()
      if(!m)return;setTenant(t);setForm({agent_name:t?.agent_name||'Gabriela',agent_phone:t?.agent_phone||'',language:t?.language||'es',business_description:t?.business_description||''});setLoading(false)
    }
    load();return()=>{m=false}
  },[])

  const save=useCallback(async()=>{
    if(!tenant)return
    const e={};if(!form.agent_name.trim())e.agent_name='Requerido'
    if(Object.keys(e).length){setErrors(e);return}
    setErrors({});setSaving(true)
    await supabase.from('tenants').update({agent_name:form.agent_name.trim(),agent_phone:form.agent_phone.trim(),language:form.language,business_description:form.business_description.trim()}).eq('id',tenant.id)
    setSaving(false);setSaved(true);setTenant({...tenant,...form});setTimeout(()=>setSaved(false),2500)
  },[tenant,form])

  if(loading)return<PageLoader/>
  if(!tenant)return null
  const plan=PC[tenant.plan]||PC.trial
  const isTrial=!tenant.plan||tenant.plan==='trial'||tenant.plan==='free'
  const cLeft=Math.max(0,(tenant.free_calls_limit||10)-(tenant.free_calls_used||0))
  const pct=!isTrial&&plan.n?Math.min(100,((tenant.plan_calls_used||0)/plan.n)*100):0

  return(
    <div style={{background:'#f8fafc',minHeight:'100vh'}}>
      <PageHeader title='Configuración'
        actions={<Button onClick={save} loading={saving} style={{background:saved?'#059669':undefined}}>{saved?'✓ Guardado':'Guardar cambios'}</Button>}/>
      <div style={{maxWidth:680,margin:'0 auto',padding:24,display:'flex',flexDirection:'column',gap:14}}>
        <Sec title='Plan activo'>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
            <Badge variant={plan.v}>{plan.l}</Badge>
            <a href='/precios' style={{fontSize:13,color:'#1d4ed8',textDecoration:'none',fontWeight:500}}>{isTrial?'Activar plan':'Cambiar plan'} →</a>
          </div>
          <div style={{marginBottom:6,display:'flex',justifyContent:'space-between'}}><span style={{fontSize:13,color:'#64748b'}}>{isTrial?'Llamadas gratuitas':'Uso mensual'}</span><span style={{fontSize:13,fontWeight:600,color:cLeft<=3?'#dc2626':'#0f172a'}}>{isTrial?cLeft+'/'+(tenant.free_calls_limit||10):(tenant.plan_calls_used||0)+'/'+plan.n}</span></div>
          <div style={{height:6,background:'#f1f5f9',borderRadius:3,overflow:'hidden'}}><div style={{height:'100%',width:isTrial?Math.round(((tenant.free_calls_used||0)/(tenant.free_calls_limit||10))*100)+'%':pct+'%',background:cLeft<=3?'#dc2626':pct>80?'#d97706':'#1d4ed8',borderRadius:3,transition:'width 0.4s'}}/></div>
          {isTrial&&cLeft<=3&&<Alert variant='warning' style={{marginTop:12}}>Quedan pocas llamadas. <a href='/precios' style={{fontWeight:600}}>Activa un plan →</a></Alert>}
        </Sec>
        <Sec title='Recepcionista AI' sub='Cómo se presenta al contestar llamadas'>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <Input label='Nombre del agente' value={form.agent_name} error={errors.agent_name} placeholder='Gabriela' hint={'Dirá: "Hola, soy '+form.agent_name+' de '+tenant.name+'"'} onChange={e=>setForm({...form,agent_name:e.target.value})}/>
            <Select label='Idioma' value={form.language} onChange={e=>setForm({...form,language:e.target.value})}><option value='es'>Español</option><option value='ca'>Català</option><option value='eu'>Euskera</option><option value='en'>English</option><option value='fr'>Français</option></Select>
            <div><label style={{display:'block',fontSize:11,fontWeight:600,color:'#374151',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.04em'}}>Descripción del negocio</label><textarea value={form.business_description} onChange={e=>setForm({...form,business_description:e.target.value})} rows={3} placeholder='Ej: Somos un restaurante mediterráneo en el centro de Madrid...' style={{width:'100%',fontFamily:'inherit',fontSize:14,color:'#0f172a',background:'#fafafa',border:'1px solid #d1d5db',borderRadius:9,padding:'9px 12px',outline:'none',resize:'none'}}/></div>
          </div>
        </Sec>
        <Sec title='Número de teléfono' sub='Número asignado al agente de voz'>
          <Input label='Número del agente' value={form.agent_phone} placeholder='+1 213 875 3573' onChange={e=>setForm({...form,agent_phone:e.target.value})}/>
          {form.agent_phone?<p style={{marginTop:8,fontSize:12,color:'#059669',display:'flex',alignItems:'center',gap:4}}>✓ Agente activo en {form.agent_phone}</p>:<Alert variant='warning' style={{marginTop:10}}>Sin número: el agente no puede recibir llamadas.</Alert>}
        </Sec>
        <Sec title='Información del negocio'>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
            {[{l:'Nombre',v:tenant.name},{l:'Tipo de negocio',v:(tenant.type||'otro').replace('_',' ')},{l:'ID de cuenta',v:tenant.id?.slice(0,8)+'...'},{l:'Plan actual',v:plan.l}].map(i=><div key={i.l}><p style={{fontSize:11,fontWeight:600,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:3}}>{i.l}</p><p style={{fontSize:14,fontWeight:500,textTransform:'capitalize'}}>{i.v}</p></div>)}
          </div>
        </Sec>
        <Button onClick={save} loading={saving} size='lg' style={{background:saved?'#059669':undefined,transition:'background 0.3s'}}>{saved?'✓ Cambios guardados':'Guardar configuración'}</Button>
      </div>
    </div>
  )
}