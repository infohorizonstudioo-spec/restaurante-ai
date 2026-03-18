'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { PageLoader, PageHeader, Button, Input, Select, Textarea, Alert } from '@/components/ui'
import Link from 'next/link'

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
      agent_name:  form.agent_name.trim(),
      agent_phone: phone,
      language:    form.language,
      business_description: form.business_description.trim()||null,
    }).eq('id',tenant.id)
    setSaving(false);setSaved(true)
    setTenant({...tenant, agent_name:form.agent_name.trim(), agent_phone:phone, business_description:form.business_description.trim()||null})
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
