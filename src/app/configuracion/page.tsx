'use client'
import{useEffect,useState,useCallback}from'react'
import{supabase}from'@/lib/supabase'
import{Bot,Phone,CreditCard,Check,Shield,Zap,ChevronRight,Copy,CheckCheck}from'lucide-react'
import{PageLoader,PageHeader,Button,Input,Select,Badge,Alert,Card,CardHeader}from'@/components/ui'
const PC:Record<string,{label:string;variant:'amber'|'blue'|'indigo'|'green';calls:number;extra:string}>={trial:{label:'Trial gratuito',variant:'amber',calls:10,extra:'—'},starter:{label:'Starter',variant:'blue',calls:50,extra:'0,90€/llamada'},pro:{label:'Pro',variant:'indigo',calls:200,extra:'0,70€/llamada'},business:{label:'Business',variant:'green',calls:600,extra:'0,50€/llamada'}}
function Sec({title,subtitle,icon,children}:{title:string;subtitle?:string;icon:React.ReactNode;children:React.ReactNode}){return<Card><CardHeader title={title} subtitle={subtitle} icon={icon}/><div style={{padding:'20px'}}>{children}</div></Card>}
export default function ConfiguracionPage(){
  const[tenant,setTenant]=useState<any>(null);const[loading,setLoading]=useState(true);const[saving,setSaving]=useState(false);const[saved,setSaved]=useState(false);const[copied,setCopied]=useState(false)
  const[form,setForm]=useState({agent_name:'',agent_phone:'',language:'es',business_description:''});const[errors,setErrors]=useState<Record<string,string>>({})
  useEffect(()=>{
    let m=true
    async function load(){
      const{data:{user}}=await supabase.auth.getUser();if(!user)return
      const{data:p}=await supabase.from('profiles').select('tenant_id').eq('id',user.id).single();if(!p?.tenant_id)return
      const{data:t}=await supabase.from('tenants').select('*').eq('id',(p as any).tenant_id).single()
      if(!m)return;setTenant(t);setForm({agent_name:t?.agent_name||'Gabriela',agent_phone:t?.agent_phone||'',language:t?.language||'es',business_description:t?.business_description||''});setLoading(false)
    }
    load();return()=>{m=false}
  },[])
  const save=useCallback(async()=>{
    if(!tenant)return;const e:Record<string,string>={};if(!form.agent_name.trim())e.agent_name='Requerido'
    if(Object.keys(e).length){setErrors(e);return};setErrors({});setSaving(true)
    await supabase.from('tenants').update({agent_name:form.agent_name.trim(),agent_phone:form.agent_phone.trim(),language:form.language,business_description:form.business_description.trim()}).eq('id',tenant.id)
    setSaving(false);setSaved(true);setTenant({...tenant,...form});setTimeout(()=>setSaved(false),2500)
  },[tenant,form])
  if(loading)return<PageLoader/>;if(!tenant)return null
  const plan=PC[tenant.plan]||PC.trial;const isTrial=!tenant.plan||tenant.plan==='trial'||tenant.plan==='free'
  const cLeft=Math.max(0,(tenant.free_calls_limit||10)-(tenant.free_calls_used||0))
  const pct=!isTrial&&tenant.plan_calls_included?Math.min(100,((tenant.plan_calls_used||0)/tenant.plan_calls_included)*100):0
  return(
    <div style={{background:'var(--color-bg)',minHeight:'100vh'}}>
      <PageHeader title="Configuración" actions={<Button onClick={save} loading={saving} icon={saved?<Check size={14}/>:undefined} style={{background:saved?'var(--color-success)':undefined}}>{saved?'Guardado':'Guardar cambios'}</Button>}/>
      <div style={{maxWidth:680,margin:'0 auto',padding:'var(--content-pad)',display:'flex',flexDirection:'column',gap:14}}>
        <Sec title="Plan activo" icon={<CreditCard size={15}/>}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
            <Badge variant={plan.variant} dot>{plan.label}</Badge>
            <a href="/precios" className="btn btn-ghost btn-sm" style={{textDecoration:'none',color:'var(--color-brand)',gap:4}}>{isTrial?'Activar plan':'Cambiar plan'}<ChevronRight size={12}/></a>
          </div>
          {isTrial?(
            <div>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}><span className="text-body-sm" style={{color:'var(--color-text-secondary)'}}>Llamadas gratuitas</span><span className="text-body-sm" style={{fontWeight:600,color:cLeft<=3?'var(--color-danger)':'inherit'}}>{cLeft}/{tenant.free_calls_limit||10}</span></div>
              <div style={{height:6,background:'var(--color-surface-2)',borderRadius:3,overflow:'hidden'}}><div style={{height:'100%',width:`${Math.round(((tenant.free_calls_used||0)/(tenant.free_calls_limit||10))*100)}%`,background:cLeft<=3?'var(--color-danger)':'var(--color-brand)',borderRadius:3,transition:'width 0.4s'}}/></div>
              {cLeft<=3&&<Alert variant="warning" className="mt-3">Quedan pocas llamadas. <a href="/precios" style={{fontWeight:600}}>Activa un plan →</a></Alert>}
            </div>
          ):(
            <div>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}><span className="text-body-sm" style={{color:'var(--color-text-secondary)'}}>Uso mensual</span><span className="text-body-sm" style={{fontWeight:600}}>{tenant.plan_calls_used||0}/{plan.calls}</span></div>
              <div style={{height:6,background:'var(--color-surface-2)',borderRadius:3,overflow:'hidden'}}><div style={{height:'100%',width:`${pct}%`,background:pct>85?'var(--color-warning)':'var(--color-brand)',borderRadius:3,transition:'width 0.4s'}}/></div>
              <p className="text-body-sm" style={{color:'var(--color-text-muted)',marginTop:6}}>Extra: {plan.extra}</p>
            </div>
          )}
        </Sec>
        <Sec title="Recepcionista AI" subtitle="Personaliza el agente" icon={<Bot size={15}/>}>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <Input label="Nombre del agente" value={form.agent_name} error={errors.agent_name} placeholder="Gabriela" hint={`Se presentará como: "${form.agent_name||'Gabriela'} de ${tenant.name}"`} onChange={e=>setForm({...form,agent_name:e.target.value})}/>
            <Select label="Idioma" value={form.language} onChange={e=>setForm({...form,language:e.target.value})}>
              <option value="es">Español</option><option value="ca">Català</option><option value="eu">Euskera</option><option value="en">English</option><option value="fr">Français</option>
            </Select>
            <div>
              <label className="text-label" style={{color:'var(--color-text-muted)',marginBottom:6,display:'block'}}>Descripción del negocio</label>
              <textarea value={form.business_description} onChange={e=>setForm({...form,business_description:e.target.value})} rows={3} placeholder="Describe tu negocio..." className="input-base" style={{resize:'none'}}/>
            </div>
          </div>
        </Sec>
        <Sec title="Número de teléfono" subtitle="Número Twilio del agente" icon={<Phone size={15}/>}>
          <Input label="Número" value={form.agent_phone} placeholder="+1 213 875 3573" onChange={e=>setForm({...form,agent_phone:e.target.value})}
            iconRight={form.agent_phone?<button onClick={()=>{navigator.clipboard?.writeText(form.agent_phone);setCopied(true);setTimeout(()=>setCopied(false),2000)}} style={{background:'none',border:'none',cursor:'pointer',color:'var(--color-brand)'}}>{copied?<CheckCheck size={14}/>:<Copy size={14}/>}</button>:undefined}/>
          {form.agent_phone?<div style={{display:'flex',alignItems:'center',gap:5,marginTop:8,color:'var(--color-success)',fontSize:12}}><Check size={13}/>Activo en {form.agent_phone}</div>:<Alert variant="warning" className="mt-3">Sin número — el agente no puede recibir llamadas.</Alert>}
        </Sec>
        <Sec title="Información del negocio" icon={<Shield size={15}/>}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
            {[{l:'Nombre',v:tenant.name},{l:'Tipo',v:(tenant.type||'otro').replace('_',' ')},{l:'ID',v:tenant.id?.slice(0,8)+'...'},{l:'Plan',v:plan.label}].map(i=>(
              <div key={i.l}><p className="text-label" style={{color:'var(--color-text-muted)',marginBottom:3}}>{i.l}</p><p className="text-body" style={{fontWeight:500,textTransform:'capitalize'}}>{i.v}</p></div>
            ))}
          </div>
        </Sec>
        <Button onClick={save} loading={saving} size="lg" icon={saved?<Check size={16}/>:<Zap size={16}/>} style={{background:saved?'var(--color-success)':undefined,transition:'background 0.3s'}}>
          {saved?'Cambios guardados':'Guardar configuración'}
        </Button>
      </div>
    </div>
  )
}