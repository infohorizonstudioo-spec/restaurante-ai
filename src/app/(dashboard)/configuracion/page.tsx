'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { PageLoader, PageHeader, Button, Input, Select, Textarea, Alert } from '@/components/ui'
import Link from 'next/link'
import NotifSettings from './NotifSettings'

const C = {
  amber:'#F0A84E',amberDim:'rgba(240,168,78,0.10)',amberGlow:'rgba(240,168,78,0.20)',
  teal:'#2DD4BF',tealDim:'rgba(45,212,191,0.10)',
  green:'#34D399',greenDim:'rgba(52,211,153,0.10)',
  red:'#F87171',redDim:'rgba(248,113,113,0.10)',
  yellow:'#FBB53F',violet:'#A78BFA',
  text:'#E8EEF6',text2:'#8895A7',text3:'#49566A',
  bg:'#0C1018',surface:'#131920',surface2:'#1A2230',surface3:'#202C3E',
  border:'rgba(255,255,255,0.07)',borderMd:'rgba(255,255,255,0.11)',
}

const PD:Record<string,{label:string;calls:number;color:string}> = {
  free:{label:'Trial gratuito',calls:10,color:C.amber},
  trial:{label:'Trial gratuito',calls:10,color:C.amber},
  starter:{label:'Starter',calls:50,color:'#60A5FA'},
  pro:{label:'Pro',calls:200,color:C.violet},
  business:{label:'Business',calls:600,color:C.green},
}

function Section({title,sub,children}:{title:string;sub?:string;children:React.ReactNode}){
  return(
    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:'hidden'}}>
      <div style={{padding:'14px 20px',borderBottom:`1px solid ${C.border}`}}>
        <p style={{fontSize:14,fontWeight:700,color:C.text,letterSpacing:'-0.01em'}}>{title}</p>
        {sub&&<p style={{fontSize:12,color:C.text3,marginTop:1}}>{sub}</p>}
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
        business_name: t?.name||'',
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
    if(!form.business_name.trim())e.business_name='El nombre del negocio es obligatorio'
    if(Object.keys(e).length){setErrors(e);return}
    setErrors({});setSaving(true)
    const phone=form.agent_phone.trim()||null
    await supabase.from('tenants').update({
      name:        form.business_name.trim(),
      agent_name:  form.agent_name.trim(),
      agent_phone: phone,
      language:    form.language,
      business_description: form.business_description.trim()||null,
    }).eq('id',tenant.id)
    setSaving(false);setSaved(true)
    setTenant({...tenant, name:form.business_name.trim(), agent_name:form.agent_name.trim(), agent_phone:phone, business_description:form.business_description.trim()||null})
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
    <div style={{background:C.bg,minHeight:'100vh'}}>

      <PageHeader title='Configuración'
        actions={<Button onClick={save} loading={saving} style={{background:saved?C.green:C.amber,color:'#0C1018',transition:'background 0.3s'}}>{saved?'✓ Guardado':'Guardar cambios'}</Button>}/>
      <div style={{maxWidth:680,margin:'0 auto',padding:24,display:'flex',flexDirection:'column',gap:14}}>

        <Section title='Plan activo'>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:9,height:9,borderRadius:'50%',background:pd.color}}/>
              <span style={{fontSize:15,fontWeight:700,color:C.text}}>{pd.label}</span>
            </div>
            <Link href='/precios' style={{fontSize:13,color:C.amber,textDecoration:'none',fontWeight:600}}>{isTrial?'Activar plan':'Cambiar plan'} →</Link>
          </div>
          <div style={{marginBottom:6,display:'flex',justifyContent:'space-between'}}>
            <span style={{fontSize:13,color:C.text2}}>{isTrial?'Llamadas gratuitas':'Uso mensual'}</span>
            <span style={{fontFamily:'var(--rz-mono)',fontSize:13,fontWeight:600,color:left<=3?C.red:C.text}}>{used}/{lim}</span>
          </div>
          <div style={{height:5,background:'rgba(255,255,255,0.05)',borderRadius:3,overflow:'hidden',marginBottom:8}}>
            <div style={{height:'100%',width:pct+'%',background:left<=3?C.red:pct>80?C.yellow:pd.color,borderRadius:3,transition:'width 0.4s'}}/>
          </div>
          <p style={{fontSize:12,color:C.text3}}>{left} llamadas restantes</p>
          {isTrial&&left<=3&&<div style={{marginTop:10,padding:'10px 14px',background:C.amberDim,border:`1px solid ${C.amber}30`,borderRadius:9,fontSize:12,color:C.amber}}>
            ⚡ Pocas llamadas. <Link href='/precios' style={{fontWeight:700,color:C.amber}}>Activar plan →</Link>
          </div>}
        </Section>

        <Section title='Tu negocio' sub='Nombre que aparece en el panel y en los avisos'>
          <Input label='Nombre del negocio *' value={form.business_name} error={errors.business_name}
            placeholder='Ej: Restaurante La Bahía'
            onChange={e=>setForm({...form,business_name:e.target.value})}/>
        </Section>

        <Section title='Recepcionista virtual' sub='Así se presenta al contestar las llamadas'>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div>
              <Input label='Nombre del agente *' value={form.agent_name} error={errors.agent_name}
                placeholder='Ej: Sofía, Lucía, Carmen...'
                hint={form.agent_name?'Dirá: "Hola, soy '+form.agent_name+' de '+tenant.name+'"':undefined}
                onChange={e=>setForm({...form,agent_name:e.target.value})}/>
              {['arturo','admin','usuario','test','recepcionista ia','recepcionista'].includes(form.agent_name.toLowerCase())&&(
                <p style={{fontSize:12,color:C.yellow,marginTop:4}}>Recomendamos un nombre natural como Sofía, Lucía o Carmen.</p>
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
              <label style={{display:'block',fontSize:11,fontWeight:600,color:C.text2,marginBottom:5,textTransform:'uppercase' as const,letterSpacing:'0.05em'}}>Descripción del negocio</label>
              <textarea value={form.business_description} onChange={e=>setForm({...form,business_description:e.target.value})} rows={3}
                placeholder='Ej: Restaurante mediterráneo especializado en arroces...'
                style={{width:'100%',fontFamily:'inherit',fontSize:14,color:C.text,background:C.surface2,border:`1px solid ${C.borderMd}`,borderRadius:9,padding:'9px 12px',outline:'none',resize:'vertical'}}/>
              <p style={{fontSize:11,color:C.text3,marginTop:4}}>El agente usará esta información para responder preguntas.</p>
            </div>
          </div>
        </Section>

        <Section title='Número de teléfono' sub='El asistente responde las llamadas que llegan a este número'>
          <div style={{background:C.tealDim,border:`1px solid rgba(45,212,191,0.2)`,borderRadius:10,padding:'10px 14px',marginBottom:18,display:'flex',gap:8}}>
            <span style={{fontSize:16,flexShrink:0}}>💡</span>
            <p style={{fontSize:12,color:C.teal,lineHeight:1.6,margin:0}}>Cuando alguien llame, <strong>el asistente responderá automáticamente</strong> y gestionará reservas, citas o consultas.</p>
          </div>
          {form.agent_phone.trim() ? (
            <div style={{marginBottom:16}}>
              <div style={{display:'flex',alignItems:'center',gap:10,background:C.greenDim,border:`1px solid rgba(52,211,153,0.2)`,borderRadius:10,padding:'10px 14px',marginBottom:12}}>
                <div style={{width:8,height:8,borderRadius:'50%',background:C.green}}/>
                <div style={{flex:1}}><p style={{fontSize:13,fontWeight:700,color:C.green}}>Asistente activo</p><p style={{fontSize:12,color:`${C.green}80`}}>Respondiendo en {form.agent_phone}</p></div>
                <span style={{fontSize:20}}>📞</span>
              </div>
              {(form.agent_phone.startsWith('+346')||form.agent_phone.startsWith('+347')) && (
                <div style={{background:'rgba(251,181,63,0.08)',border:'1px solid rgba(251,181,63,0.2)',borderRadius:10,padding:'10px 14px',marginBottom:12}}>
                  <p style={{fontSize:12,fontWeight:700,color:C.yellow,marginBottom:4}}>⚠ Posible número personal</p>
                  <p style={{fontSize:11,color:`${C.yellow}80`,lineHeight:1.6}}>El asistente responderá <strong>todas</strong> las llamadas, incluyendo las personales.</p>
                </div>
              )}
            </div>
          ) : (
            <div style={{background:C.redDim,border:`1px solid rgba(248,113,113,0.2)`,borderRadius:10,padding:'10px 14px',marginBottom:16}}>
              <p style={{fontSize:13,fontWeight:700,color:C.red,marginBottom:4}}>⚠ Sin número asignado</p>
              <p style={{fontSize:12,color:`${C.red}80`,lineHeight:1.6}}>El asistente no puede recibir llamadas.</p>
            </div>
          )}
          <div style={{marginBottom:14}}>
            <Input label='Número del asistente' value={form.agent_phone} placeholder='+1 213 875 3573' onChange={e=>setForm({...form,agent_phone:e.target.value})}/>
            <p style={{fontSize:11,color:C.text3,marginTop:5}}>Formato internacional (ej: +34 600 000 000)</p>
          </div>
        </Section>

        <Section title='Información del negocio'>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            {[{l:'Nombre',v:tenant.name},{l:'Tipo',v:(tenant.type||'otro').replace('_',' ')},{l:'ID',v:tenant.id?.slice(0,8)+'...'},{l:'Plan',v:pd.label}].map(i=>(
              <div key={i.l}>
                <p style={{fontSize:10,fontWeight:600,color:C.text3,textTransform:'uppercase' as const,letterSpacing:'0.06em',marginBottom:4}}>{i.l}</p>
                <p style={{fontSize:14,fontWeight:500,color:C.text,textTransform:'capitalize' as const}}>{i.v}</p>
              </div>
            ))}
          </div>
        </Section>

        <Button onClick={save} loading={saving} size='lg' style={{background:saved?C.green:C.amber,color:'#0C1018',transition:'background 0.3s'}}>
          {saved?'✓ Cambios guardados':'Guardar configuración'}
        </Button>
      </div>
    </div>
  )
}
