'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { PageLoader, PageHeader, Button, Input, Select, Textarea, Alert } from '@/components/ui'
import Link from 'next/link'

const PD:Record<string,{label:string;calls:number;color:string}> = {
  free:{label:'Trial gratuito',calls:10,color:'#d97706'},
  trial:{label:'Trial gratuito',calls:10,color:'#d97706'},
  starter:{label:'Starter',calls:50,color:'#1d4ed8'},
  pro:{label:'Pro',calls:200,color:'#7c3aed'},
  business:{label:'Business',calls:600,color:'#059669'},
}

function Section({title,sub,children}:{title:string;sub?:string;children:React.ReactNode}){
  return(
    <div style={{background:'white',border:'1px solid #e2e8f0',borderRadius:12,overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,0.04)'}}>
      <div style={{padding:'14px 20px',borderBottom:'1px solid #f1f5f9'}}>
        <p style={{fontSize:14,fontWeight:600,color:'#0f172a'}}>{title}</p>
        {sub&&<p style={{fontSize:12,color:'#94a3b8',marginTop:1}}>{sub}</p>}
      </div>
      <div style={{padding:20}}>{children}</div>
    </div>
  )
}

export default function ConfiguracionPage(){
  const [tenant,setTenant]  = useState<any>(null)
  const [loading,setLoading]= useState(true)
  const [saving,setSaving]  = useState(false)
  const [saved,setSaved]    = useState(false)
  const [form,setForm]      = useState({agent_name:'',agent_phone:'',language:'es',business_description:''})
  const [errors,setErrors]  = useState<Record<string,string>>({})

  useEffect(()=>{
    let m=true
    async function load(){
      const {data:{user}}=await supabase.auth.getUser();if(!user)return
      const {data:p}=await supabase.from('profiles').select('tenant_id').eq('id',user.id).single();if(!p?.tenant_id)return
      const {data:t}=await supabase.from('tenants').select('*').eq('id',p.tenant_id).single()
      if(!m)return
      setTenant(t)
      setForm({
        agent_name: t?.agent_name&&t.agent_name!=='Recepcionista IA'?t.agent_name:'Sofía',
        agent_phone: t?.agent_phone||'',
        language: t?.language||'es',
        business_description: t?.business_description||'',
      })
      setLoading(false)
    }
    load();return()=>{m=false}
  },[])

  const save=useCallback(async()=>{
    if(!tenant)return
    const e:Record<string,string>={}
    if(!form.agent_name.trim())e.agent_name='El nombre del agente es obligatorio'
    if(form.agent_name.trim().length<2)e.agent_name='Mínimo 2 caracteres'
    if(Object.keys(e).length){setErrors(e);return}
    setErrors({});setSaving(true)
    const phone=form.agent_phone.trim()||null
    await supabase.from('tenants').update({
      agent_name:form.agent_name.trim(),
      agent_phone:phone,
      language:form.language,
      business_description:form.business_description.trim()||null,
    }).eq('id',tenant.id)
    setSaving(false);setSaved(true)
    setTenant({...tenant,agent_name:form.agent_name.trim(),agent_phone:phone})
    setTimeout(()=>setSaved(false),2500)
  },[tenant,form])

  if(loading)return<PageLoader/>
  if(!tenant)return null

  const plan=tenant.plan||'free'
  const pd=PD[plan]||PD.free
  const isTrial=plan==='free'||plan==='trial'
  const used=isTrial?(tenant.free_calls_used||0):(tenant.plan_calls_used||0)
  const lim=isTrial?(tenant.free_calls_limit||10):(tenant.plan_calls_included||pd.calls)
  const pct=Math.min(100,Math.round((used/lim)*100))
  const left=Math.max(0,lim-used)

  return(
    <div style={{background:'#f8fafc',minHeight:'100vh'}}>
      <PageHeader title='Configuración'
        actions={<Button onClick={save} loading={saving} style={{background:saved?'#059669':undefined,transition:'background 0.3s'}}>{saved?'✓ Guardado':'Guardar cambios'}</Button>}/>
      <div style={{maxWidth:680,margin:'0 auto',padding:24,display:'flex',flexDirection:'column',gap:14}}>

        {/* Plan */}
        <Section title='Plan activo'>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:10,height:10,borderRadius:'50%',background:pd.color}}/>
              <span style={{fontSize:15,fontWeight:700,color:'#0f172a'}}>{pd.label}</span>
            </div>
            <Link href='/precios' style={{fontSize:13,color:'#1d4ed8',textDecoration:'none',fontWeight:500}}>{isTrial?'Activar plan':'Cambiar plan'} →</Link>
          </div>
          <div style={{marginBottom:6,display:'flex',justifyContent:'space-between'}}>
            <span style={{fontSize:13,color:'#64748b'}}>{isTrial?'Llamadas gratuitas':'Uso mensual'}</span>
            <span style={{fontSize:13,fontWeight:600,color:left<=3?'#dc2626':'#0f172a'}}>{used}/{lim}</span>
          </div>
          <div style={{height:6,background:'#f1f5f9',borderRadius:3,overflow:'hidden',marginBottom:8}}>
            <div style={{height:'100%',width:pct+'%',background:left<=3?'#dc2626':pct>80?'#d97706':pd.color,borderRadius:3,transition:'width 0.4s'}}/>
          </div>
          <p style={{fontSize:12,color:'#94a3b8'}}>{left} llamadas restantes</p>
          {isTrial&&left<=3&&<Alert variant='warning' style={{marginTop:10}}>Pocas llamadas restantes. <Link href='/precios' style={{fontWeight:600,color:'#1d4ed8'}}>Activa un plan →</Link></Alert>}
        </Section>

        {/* Agente */}
        <Section title='Recepcionista virtual' sub='Así se presenta al contestar las llamadas'>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div>
              <Input label='Nombre del agente *'
                value={form.agent_name}
                error={errors.agent_name}
                placeholder='Ej: Sofía, Lucía, Carmen...'
                hint={form.agent_name?'Dirá: "Hola, soy '+form.agent_name+' de '+tenant.name+'"':undefined}
                onChange={e=>setForm({...form,agent_name:e.target.value})}
              />
              {['arturo','admin','usuario','test','recepcionista ia','recepcionista'].includes(form.agent_name.toLowerCase())&&(
                <p style={{fontSize:12,color:'#d97706',marginTop:4}}>
                  Recomendamos usar un nombre natural como Sofía, Lucía o Carmen.
                </p>
              )}
            </div>
            <Select label='Idioma' value={form.language} onChange={e=>setForm({...form,language:e.target.value})}>
              <option value='es'>Español</option>
              <option value='ca'>Català</option>
              <option value='eu'>Euskera</option>
              <option value='en'>English</option>
              <option value='fr'>Français</option>
            </Select>
            <div>
              <label style={{display:'block',fontSize:11,fontWeight:600,color:'#374151',marginBottom:5,textTransform:'uppercase' as const,letterSpacing:'0.04em'}}>Descripción del negocio</label>
              <textarea value={form.business_description} onChange={e=>setForm({...form,business_description:e.target.value})} rows={3}
                placeholder='Ej: Restaurante mediterráneo especializado en arroces...'
                style={{width:'100%',fontFamily:'inherit',fontSize:14,color:'#0f172a',background:'#f9fafb',border:'1px solid #e2e8f0',borderRadius:9,padding:'9px 12px',outline:'none',resize:'vertical'}}/>
              <p style={{fontSize:11,color:'#94a3b8',marginTop:4}}>El agente usará esta información para responder preguntas sobre el negocio.</p>
            </div>
          </div>
        </Section>

        {/* Teléfono */}
        <Section title='Número de teléfono' sub='Número asignado al agente de voz'>
          <Input label='Número del agente' value={form.agent_phone}
            placeholder='+1 213 875 3573'
            onChange={e=>setForm({...form,agent_phone:e.target.value})}
          />
          {form.agent_phone.trim()
            ? <p style={{marginTop:8,fontSize:12,color:'#059669',display:'flex',alignItems:'center',gap:4}}>✓ Agente activo en {form.agent_phone}</p>
            : <Alert variant='warning' style={{marginTop:10}}>Sin número: el agente no puede recibir llamadas. Contacta con soporte para asignar un número.</Alert>
          }
        </Section>

        {/* Info negocio */}
        <Section title='Información del negocio'>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            {[
              {l:'Nombre',v:tenant.name},
              {l:'Tipo',v:(tenant.type||'otro').replace('_',' ')},
              {l:'ID de cuenta',v:tenant.id?.slice(0,8)+'...'},
              {l:'Plan',v:pd.label},
            ].map(i=>(
              <div key={i.l}>
                <p style={{fontSize:11,fontWeight:600,color:'#94a3b8',textTransform:'uppercase' as const,letterSpacing:'0.04em',marginBottom:3}}>{i.l}</p>
                <p style={{fontSize:14,fontWeight:500,textTransform:'capitalize' as const}}>{i.v}</p>
              </div>
            ))}
          </div>
        </Section>

        <Button onClick={save} loading={saving} size='lg' style={{background:saved?'#059669':undefined,transition:'background 0.3s'}}>
          {saved?'✓ Cambios guardados':'Guardar configuración'}
        </Button>
      </div>
    </div>
  )
}