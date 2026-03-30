'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { PageLoader } from '@/components/ui'
import NotifBell from '@/components/NotifBell'
import { useTenant } from '@/contexts/TenantContext'

import { isHosteleria } from '@/lib/templates'
import { DEFAULT_CONFIG as DEFAULT_SCHED, parseReservationConfig } from '@/lib/scheduling-engine'
import type { ReservationConfig } from '@/lib/scheduling-engine'
import { C } from '@/lib/colors'
import { useToast } from '@/components/NotificationToast'

// ── Config por defecto ────────────────────────────────────────────────────
const DEFAULT: AgentConfig = {
  automation: {
    max_auto_party: 6,
    auto_simple_reservations: true,
    auto_cancellations: true,
    auto_info_queries: true,
  },
  review: {
    large_groups: true,
    special_requests: true,
    allergies_mentioned: true,
    unusual_hours: false,
    first_time_customers: false,
  },
  rejection: {
    out_of_hours: true,
    no_availability: true,
    unknown_service: true,
  },
  alternatives: {
    offer_other_time: true,
    leave_pending: true,
    suggest_waitlist: false,
    max_alternatives: 2,
  },
  knowledge: { services:'', menu:'', conditions:'', faqs:'', horarios:'' },
  conversation_flow: ['nombre','personas','fecha','hora','confirmar'],
  special_cases: { allergies:'review', birthdays:'confirm', events:'review', vip:'confirm' },
  order_alert_mode: 'banner' as 'none' | 'banner' | 'redirect',
}

interface AgentConfig {
  automation: { max_auto_party:number; auto_simple_reservations:boolean; auto_cancellations:boolean; auto_info_queries:boolean }
  review: { large_groups:boolean; special_requests:boolean; allergies_mentioned:boolean; unusual_hours:boolean; first_time_customers:boolean }
  rejection: { out_of_hours:boolean; no_availability:boolean; unknown_service:boolean }
  alternatives: { offer_other_time:boolean; leave_pending:boolean; suggest_waitlist:boolean; max_alternatives:number }
  knowledge: { services:string; menu:string; conditions:string; faqs:string; horarios:string }
  conversation_flow: string[]
  special_cases: { allergies:string; birthdays:string; events:string; vip:string }
  order_alert_mode?: 'none' | 'banner' | 'redirect'
}


// ── Componentes UI ────────────────────────────────────────────────────────
function SectionCard({icon,title,sub,children,active,onClick}:{id?:string,icon:string,title:string,sub:string,children:React.ReactNode,active:boolean,onClick:()=>void}) {
  return (
    <div style={{background:C.card,border:`1px solid ${active?C.amber+'44':C.border}`,borderRadius:14,overflow:'hidden',transition:'border-color 0.2s',boxShadow:active?`0 0 0 1px ${C.amber}22`:'none'}}>
      <button onClick={onClick} style={{width:'100%',padding:'16px 20px',background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'space-between',textAlign:'left'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <span style={{fontSize:20}}>{icon}</span>
          <div>
            <p style={{fontSize:14,fontWeight:700,color:C.text}}>{title}</p>
            <p style={{fontSize:12,color:C.muted,marginTop:1}}>{sub}</p>
          </div>
        </div>
        <span style={{color:active?C.amber:C.muted,fontSize:12,fontWeight:600,transition:'transform 0.2s',display:'inline-block',transform:active?'rotate(180deg)':'none'}}>▼</span>
      </button>
      {active&&<div style={{borderTop:`1px solid ${C.border}`,padding:'20px',display:'flex',flexDirection:'column',gap:16}}>{children}</div>}
    </div>
  )
}

function Toggle({label,sub,value,onChange,color=C.green}:{label:string,sub?:string,value:boolean,onChange:(v:boolean)=>void,color?:string}) {
  return (
    <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:16}}>
      <div>
        <p style={{fontSize:13,fontWeight:600,color:C.text}}>{label}</p>
        {sub&&<p style={{fontSize:11,color:C.muted,marginTop:2,lineHeight:1.4}}>{sub}</p>}
      </div>
      <button onClick={()=>onChange(!value)} style={{flexShrink:0,width:44,height:24,borderRadius:12,border:'none',cursor:'pointer',background:value?color:'rgba(255,255,255,0.1)',position:'relative',transition:'background 0.2s'}}>
        <div style={{position:'absolute',top:2,left:value?20:2,width:20,height:20,borderRadius:'50%',background:'white',transition:'left 0.2s',boxShadow:'0 1px 4px rgba(0,0,0,0.3)'}}/>
      </button>
    </div>
  )
}

function Slider({label,sub,value,min,max,unit,onChange}:{label:string,sub?:string,value:number,min:number,max:number,unit?:string,onChange:(v:number)=>void}) {
  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
        <div>
          <p style={{fontSize:13,fontWeight:600,color:C.text}}>{label}</p>
          {sub&&<p style={{fontSize:11,color:C.muted,marginTop:2}}>{sub}</p>}
        </div>
        <span style={{fontSize:15,fontWeight:700,color:C.amber}}>{value}{unit||''}</span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={e=>onChange(parseInt(e.target.value))}
        style={{width:'100%',accentColor:C.amber,cursor:'pointer'}}/>
      <div style={{display:'flex',justifyContent:'space-between',marginTop:4}}>
        <span style={{fontSize:10,color:C.muted}}>{min}{unit}</span>
        <span style={{fontSize:10,color:C.muted}}>{max}{unit}</span>
      </div>
    </div>
  )
}

function KArea({label,sub,placeholder,value,onChange,tx=(s:string)=>s}:{label:string,sub?:string,placeholder:string,value:string,onChange:(v:string)=>void,tx?:(s:string)=>string}) {
  const lines = value ? value.split('\n').length : 0
  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
        <div>
          <p style={{fontSize:13,fontWeight:600,color:C.text}}>{label}</p>
          {sub&&<p style={{fontSize:11,color:C.muted,marginTop:2}}>{sub}</p>}
        </div>
        <span style={{fontSize:10,color:C.muted}}>{lines} {tx('líneas')}</span>
      </div>
      <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        style={{width:'100%',minHeight:100,background:C.card2,border:`1px solid ${C.border}`,borderRadius:10,padding:'10px 12px',color:C.text,fontSize:13,fontFamily:'monospace',resize:'vertical',outline:'none',lineHeight:1.6}}
        className="rz-ta"
      />
    </div>
  )
}

function CaseBadge({value,onChange,tx}:{value:string,onChange:(v:string)=>void,tx:(s:string)=>string}) {
  const opts=[{v:'confirm',l:tx('Auto-confirmar'),c:C.green},{v:'review',l:tx('Revisar'),c:C.amber},{v:'reject',l:tx('Rechazar'),c:C.red}]
  return (
    <div style={{display:'flex',gap:6}}>
      {opts.map(o=>(
        <button key={o.v} onClick={()=>onChange(o.v)} style={{padding:'4px 12px',borderRadius:8,border:`1px solid ${value===o.v?o.c:C.border}`,background:value===o.v?o.c+'22':'transparent',color:value===o.v?o.c:C.muted,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit',transition:'all 0.12s'}}>{o.l}</button>
      ))}
    </div>
  )
}


// ── Página principal ──────────────────────────────────────────────────────
const FLOW_OPTIONS = ['nombre','teléfono','personas','fecha','hora','zona','servicio','notas','confirmar']

export default function ConfiguracionPage() {
  const toast = useToast()
  const { reload: reloadTenant, tx } = useTenant()
  const [tenant, setTenant]   = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [openSection, setOpen]= useState<string|null>('automation')
  const [cfg, setCfg]         = useState<AgentConfig>(DEFAULT)
  const [basicForm, setBasic] = useState({agent_name:'',business_name:'',agent_phone:'',transfer_phone:'',language:'es',address:'',phone:'',logo_url:''})
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [schedCfg, setSchedCfg] = useState<ReservationConfig>({...DEFAULT_SCHED})
  const [isHosb, setIsHosb]   = useState(false)

  useEffect(()=>{
    (async()=>{
      const {data:{user}} = await supabase.auth.getUser(); if(!user) return
      const {data:p} = await supabase.from('profiles').select('tenant_id').eq('id',user.id).maybeSingle(); if(!p?.tenant_id) return
      const {data:t} = await supabase.from('tenants').select('*').eq('id',p.tenant_id).maybeSingle()
      if(!t) return
      setTenant(t)
      setBasic({agent_name:t.agent_name||'Sofía', business_name:t.name||'', agent_phone:t.agent_phone||'', transfer_phone:t.transfer_phone||'', language:t.language||'es', address:t.address||'', phone:t.phone||'', logo_url:t.logo_url||''})
      setIsHosb(isHosteleria(t.type||'otro'))
      setSchedCfg(parseReservationConfig(t.reservation_config))
      const saved = t.agent_config && Object.keys(t.agent_config).length > 0 ? t.agent_config : DEFAULT
      setCfg({...DEFAULT,...saved, automation:{...DEFAULT.automation,...(saved.automation||{})}, review:{...DEFAULT.review,...(saved.review||{})}, rejection:{...DEFAULT.rejection,...(saved.rejection||{})}, alternatives:{...DEFAULT.alternatives,...(saved.alternatives||{})}, knowledge:{...DEFAULT.knowledge,...(saved.knowledge||{})}, special_cases:{...DEFAULT.special_cases,...(saved.special_cases||{})}})
      setLoading(false)
    })()
  },[])

  const upCfg = (section: keyof AgentConfig, key: string, val: any) =>
    setCfg(c=>({...c,[section]:{...(c[section] as any),[key]:val}}))

  const save = useCallback(async()=>{
    if(!tenant) return
    setSaving(true); setSaved(false)
    const newName = basicForm.business_name.trim()
    const newAgent = basicForm.agent_name.trim()
    const sess = await supabase.auth.getSession()
    const token = sess.data.session?.access_token || ''
    const updateData = {
      agent_name: newAgent,
      name: newName,
      agent_phone: basicForm.agent_phone.trim() || null,
      transfer_phone: basicForm.transfer_phone.trim() || null,
      language: basicForm.language || 'es',
      address: basicForm.address.trim() || null,
      phone: basicForm.phone.trim() || null,
      logo_url: basicForm.logo_url || null,
      agent_config: cfg,
      reservation_config: schedCfg,
    }

    // Intentar via API (bypasses RLS)
    const apiRes = await fetch('/api/tenant/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify(updateData)
    })

    // Si API falla, intentar directo con Supabase
    if (!apiRes.ok) {
      await supabase.from('tenants').update(updateData).eq('id', tenant.id)
    }

    // Sincronizar knowledge a business_knowledge y reprovisionar agente ElevenLabs
    try {
      // Guardar knowledge actualizado
      await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenant.id,
          agent_phone: basicForm.agent_phone.trim() || null,
          business_name: newName,
          agent_name: newAgent,
          services: cfg.knowledge.services || null,
          menu: cfg.knowledge.menu || null,
          faqs: cfg.knowledge.faqs || null,
          policies: cfg.knowledge.conditions || null,
          horarios: cfg.knowledge.horarios || null,
        })
      })
      // Reprovisionar agente ElevenLabs con datos actualizados
      // provision-agent incluye: prompt completo, tools, voz, webhook post-call
      // NO llamar a sync-agent porque sobreescribe el prompt con una versión vieja
      await fetch('/api/agent/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenant.id })
      })
    } catch { /* no crítico */ }

    setSaving(false); setSaved(true)
    toast.push({ title: 'Configuración guardada', body: 'Los cambios se han aplicado correctamente', type: 'config', priority: 'info', icon: '✅' })
    if (basicForm.language !== (tenant.language || 'es')) {
      setTimeout(() => {
        window.location.href = '/panel?t=' + Date.now()
      }, 800)
    } else {
      reloadTenant()
      setTimeout(()=>setSaved(false),3000)
    }
  },[tenant,basicForm,cfg,isHosb,schedCfg,reloadTenant])

  const toggleSection = (id:string) => setOpen(o=>o===id?null:id)

  const agentName = basicForm.agent_name || 'tu recepcionista'

  if(loading) return <PageLoader/>

  return (
    <div style={{background:C.bg,minHeight:'100vh',fontFamily:"'Sora',-apple-system,sans-serif"}}>
      <style>{`
        *{box-sizing:border-box}
        .rz-inp{background:${C.surface2};border:1px solid ${C.border};border-radius:10px;padding:10px 14px;color:${C.text};font-size:13px;font-family:inherit;outline:none;width:100%;transition:border-color 0.15s}
        .rz-inp:focus{border-color:${C.amber}!important;box-shadow:0 0 0 3px rgba(240,168,78,0.1)!important}
        .rz-inp::placeholder{color:${C.muted}}
        .rz-ta{background:${C.card2};border:1px solid ${C.border};border-radius:10px;padding:10px 12px;color:${C.text};font-size:13px;font-family:monospace;resize:vertical;outline:none;width:100%;line-height:1.6;transition:border-color 0.15s}
        .rz-ta:focus{border-color:${C.amber}!important}
        .rz-ta::placeholder{color:${C.muted}}
        .save-btn{background:linear-gradient(135deg,${C.amber},#E8923A);color:${C.bg};font-weight:700;font-size:14px;padding:11px 28px;border:none;border-radius:11px;cursor:pointer;font-family:inherit;transition:all 0.15s}
        .save-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 4px 16px rgba(240,168,78,0.3)}
        .save-btn:disabled{opacity:0.6;cursor:not-allowed}
        .flow-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.12s;user-select:none}
      `}</style>

      {/* Header */}
      <div style={{background:C.surface,backdropFilter:'blur(16px)',WebkitBackdropFilter:'blur(16px)',borderBottom:`1px solid ${C.border}`,padding:'14px 24px',position:'sticky',top:0,zIndex:30,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <h1 style={{fontSize:17,fontWeight:700,color:C.text}}>{tx('Cómo trabaja tu recepcionista')}</h1>
          <p style={{fontSize:12,color:C.muted,marginTop:2}}>{tx('Enséñale cómo funciona tu negocio y cómo quieres que actúe')}</p>
        </div>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          {saved&&<span style={{fontSize:12,color:C.green,fontWeight:600}}>✓ {tx('Guardado')}</span>}
          <button className="save-btn" onClick={save} disabled={saving}>{saving?tx('Guardando...'):tx('Guardar cambios')}</button>
          <NotifBell/>
        </div>
      </div>

      <div className="rz-page-enter" style={{maxWidth:760,margin:'0 auto',padding:'24px 20px',display:'flex',flexDirection:'column',gap:12}}>

        {/* Datos básicos */}
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:'20px'}}>
          <p style={{fontSize:13,fontWeight:700,color:C.amber,letterSpacing:'0.04em',marginBottom:14}}>⚙ {tx('CONFIGURACIÓN BÁSICA')}</p>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:C.muted,letterSpacing:'0.04em',display:'block',marginBottom:5}}>{tx('NOMBRE DEL NEGOCIO')}</label>
              <input className="rz-inp" value={basicForm.business_name} onChange={e=>setBasic(f=>({...f,business_name:e.target.value}))} placeholder={tx('Mi negocio')}/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:C.muted,letterSpacing:'0.04em',display:'block',marginBottom:5}}>{tx('NOMBRE DEL AGENTE')}</label>
              <input className="rz-inp" value={basicForm.agent_name} onChange={e=>setBasic(f=>({...f,agent_name:e.target.value}))} placeholder={agentName}/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:C.muted,letterSpacing:'0.04em',display:'block',marginBottom:5}}>DIRECCIÓN</label>
              <input className="rz-inp" value={basicForm.address} onChange={e=>setBasic(f=>({...f,address:e.target.value}))} placeholder="Calle Gran Vía 42, Madrid"/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:C.muted,letterSpacing:'0.04em',display:'block',marginBottom:5}}>TELÉFONO DEL LOCAL</label>
              <input className="rz-inp" value={basicForm.phone} onChange={e=>setBasic(f=>({...f,phone:e.target.value}))} placeholder="+34 912 345 678"/>
            </div>
            <div style={{gridColumn:'1/-1'}}>
              <label style={{fontSize:11,fontWeight:600,color:C.muted,letterSpacing:'0.04em',display:'block',marginBottom:5}}>LOGO DEL NEGOCIO</label>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                {basicForm.logo_url && (
                  <img src={basicForm.logo_url} alt="Logo" style={{width:48,height:48,objectFit:'contain',borderRadius:8,border:`1px solid ${C.border}`,background:C.surface2}}/>
                )}
                <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp" style={{display:'none'}} onChange={async e=>{
                  const file = e.target.files?.[0]; if(!file||!tenant) return
                  if(file.size>2*1024*1024){alert('Máximo 2MB');return}
                  setUploadingLogo(true)
                  const ext=file.name.split('.').pop()||'png'
                  const path=`${tenant.id}/logo.${ext}`
                  const {error}=await supabase.storage.from('product-images').upload(path,file,{upsert:true})
                  if(!error){
                    const url=`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${path}`
                    setBasic(f=>({...f,logo_url:url}))
                  }
                  setUploadingLogo(false)
                }}/>
                <button onClick={()=>logoInputRef.current?.click()} style={{padding:'8px 16px',fontSize:12,fontWeight:600,borderRadius:8,border:`1px solid ${C.border}`,background:C.surface2,color:C.text2,cursor:'pointer',fontFamily:'inherit'}}>
                  {uploadingLogo ? 'Subiendo...' : basicForm.logo_url ? 'Cambiar logo' : '📷 Subir logo'}
                </button>
                {basicForm.logo_url && (
                  <button onClick={()=>setBasic(f=>({...f,logo_url:''}))} style={{padding:'8px 12px',fontSize:11,borderRadius:8,border:'none',background:'rgba(248,113,113,0.1)',color:'#F87171',cursor:'pointer',fontFamily:'inherit',fontWeight:600}}>
                    Quitar
                  </button>
                )}
              </div>
              <p style={{fontSize:10,color:C.muted,marginTop:4}}>Aparecerá en los tickets de cobro. PNG, JPG o WebP, máximo 2MB.</p>
            </div>
            <div style={{gridColumn:'1/-1'}}>
              <label style={{fontSize:11,fontWeight:600,color:C.muted,letterSpacing:'0.04em',display:'block',marginBottom:5}}>{tx('NÚMERO DE TELÉFONO DEL AGENTE')}</label>
              <input className="rz-inp" value={basicForm.agent_phone} onChange={e=>setBasic(f=>({...f,agent_phone:e.target.value}))} placeholder="+34 600 000 000"/>
            </div>
            <div style={{gridColumn:'1/-1'}}>
              <label style={{fontSize:11,fontWeight:600,color:C.muted,letterSpacing:'0.04em',display:'block',marginBottom:5}}>{tx('NÚMERO DE TRANSFERENCIA')}</label>
              <input className="rz-inp" value={basicForm.transfer_phone} onChange={e=>setBasic(f=>({...f,transfer_phone:e.target.value}))} placeholder="+34 600 000 000"/>
              <p style={{fontSize:11,color:C.muted,marginTop:4}}>{tx('Cuando tu recepcionista no pueda resolver, transferirá la llamada a este número')}</p>
            </div>
            <div style={{gridColumn:'1/-1'}}>
              <label style={{fontSize:11,fontWeight:600,color:C.muted,letterSpacing:'0.04em',display:'block',marginBottom:5}}>{tx('IDIOMA DEL PANEL')}</label>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                {[{code:'es',flag:'🇪🇸',name:'Español'},{code:'en',flag:'🇬🇧',name:'English'},{code:'fr',flag:'🇫🇷',name:'Français'},{code:'pt',flag:'🇵🇹',name:'Português'},{code:'ca',flag:'🏴',name:'Català'}].map(lang=>(
                  <button key={lang.code} onClick={async()=>{
                    if(!tenant || lang.code === basicForm.language) return
                    setBasic(f=>({...f,language:lang.code}))
                    await fetch('/api/tenant/set-language', {
                      method:'POST', headers:{'Content-Type':'application/json'},
                      body: JSON.stringify({ tenant_id: tenant.id, language: lang.code })
                    })
                    window.location.href = '/configuracion?t=' + Date.now()
                  }}
                    style={{padding:'6px 14px',fontSize:12,fontWeight:600,borderRadius:8,cursor:'pointer',fontFamily:'inherit',
                      border:`1px solid ${basicForm.language===lang.code?C.amber+'44':C.border}`,
                      background:basicForm.language===lang.code?C.amberDim:'transparent',
                      color:basicForm.language===lang.code?C.amber:C.sub}}>
                    {lang.flag} {lang.name}
                  </button>
                ))}
              </div>
              <p style={{fontSize:11,color:C.muted,marginTop:4}}>{tx('Cambia el idioma de todo el panel de control')}</p>
            </div>
          </div>
        </div>


        {/* ── Horarios y capacidad ────────────────────────────────────── */}
        <SectionCard id="scheduling" icon="🕐" title={tx("Horarios y capacidad")} sub={tx("Configura cuándo atiendes y cuánta gente puedes recibir")} active={openSection==='scheduling'} onClick={()=>toggleSection('scheduling')}>
          {/* Horario */}
          <div>
            <p style={{fontSize:13,fontWeight:700,color:C.amber,letterSpacing:'0.03em',marginBottom:12}}>{tx('Horario de apertura')}</p>
            {tenant?.type === 'hotel' ? (
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <span style={{fontSize:12,fontWeight:600,color:C.sub,minWidth:70}}>Check-in</span>
                  <input type="time" className="rz-inp" style={{width:120,textAlign:'center'}} value={schedCfg.service_hours?.open||'14:00'} onChange={e=>setSchedCfg(s=>({...s,service_hours:{...s.service_hours,open:e.target.value}}))}/>
                  <span style={{fontSize:11,color:C.muted}}>({tx('hora a partir de la cual pueden entrar')})</span>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <span style={{fontSize:12,fontWeight:600,color:C.sub,minWidth:70}}>Check-out</span>
                  <input type="time" className="rz-inp" style={{width:120,textAlign:'center'}} value={schedCfg.service_hours?.close||'12:00'} onChange={e=>setSchedCfg(s=>({...s,service_hours:{...s.service_hours,close:e.target.value}}))}/>
                  <span style={{fontSize:11,color:C.muted}}>({tx('hora límite de salida')})</span>
                </div>
              </div>
            ) : isHosb ? (
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <span style={{fontSize:12,fontWeight:600,color:C.sub,minWidth:70}}>{tx('Comidas')}</span>
                  <input type="time" className="rz-inp" style={{width:120,textAlign:'center'}} value={schedCfg.service_hours?.lunch_start||'13:00'} onChange={e=>setSchedCfg(s=>({...s,service_hours:{...s.service_hours,lunch_start:e.target.value}}))}/>
                  <span style={{fontSize:12,color:C.muted}}>a</span>
                  <input type="time" className="rz-inp" style={{width:120,textAlign:'center'}} value={schedCfg.service_hours?.lunch_end||'16:00'} onChange={e=>setSchedCfg(s=>({...s,service_hours:{...s.service_hours,lunch_end:e.target.value}}))}/>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <span style={{fontSize:12,fontWeight:600,color:C.sub,minWidth:70}}>{tx('Cenas')}</span>
                  <input type="time" className="rz-inp" style={{width:120,textAlign:'center'}} value={schedCfg.service_hours?.dinner_start||'20:00'} onChange={e=>setSchedCfg(s=>({...s,service_hours:{...s.service_hours,dinner_start:e.target.value}}))}/>
                  <span style={{fontSize:12,color:C.muted}}>a</span>
                  <input type="time" className="rz-inp" style={{width:120,textAlign:'center'}} value={schedCfg.service_hours?.dinner_end||'23:30'} onChange={e=>setSchedCfg(s=>({...s,service_hours:{...s.service_hours,dinner_end:e.target.value}}))}/>
                </div>
              </div>
            ) : (
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <span style={{fontSize:12,fontWeight:600,color:C.sub,minWidth:70}}>{tx('Apertura')}</span>
                <input type="time" className="rz-inp" style={{width:120,textAlign:'center'}} value={schedCfg.service_hours?.open||'09:00'} onChange={e=>setSchedCfg(s=>({...s,service_hours:{...s.service_hours,open:e.target.value}}))}/>
                <span style={{fontSize:12,fontWeight:600,color:C.sub,minWidth:50,textAlign:'center'}}>{tx('Cierre')}</span>
                <input type="time" className="rz-inp" style={{width:120,textAlign:'center'}} value={schedCfg.service_hours?.close||'21:00'} onChange={e=>setSchedCfg(s=>({...s,service_hours:{...s.service_hours,close:e.target.value}}))}/>
              </div>
            )}
          </div>

          {/* Días cerrados */}
          <div>
            <p style={{fontSize:13,fontWeight:700,color:C.amber,letterSpacing:'0.03em',marginBottom:4}}>{tx('Días que abres')}</p>
            <p style={{fontSize:11,color:C.muted,marginBottom:10}}>{tx('Pulsa un día para cerrarlo. Los días activos aparecen en color.')}</p>
            <div style={{display:'flex',gap:6}}>
              {[{d:1,l:'L'},{d:2,l:'M'},{d:3,l:'X'},{d:4,l:'J'},{d:5,l:'V'},{d:6,l:'S'},{d:0,l:'D'}].map(day=>{
                const closed = schedCfg.service_hours?.closed_days||[]
                const isOpen = !closed.includes(day.d)
                return (
                  <button key={day.d} onClick={()=>{
                    const cur = schedCfg.service_hours?.closed_days||[]
                    const next = isOpen ? [...cur,day.d] : cur.filter(x=>x!==day.d)
                    setSchedCfg(s=>({...s,service_hours:{...s.service_hours,closed_days:next}}))
                  }} style={{width:42,height:42,borderRadius:10,border:`1px solid ${isOpen?C.teal+'66':C.border}`,background:isOpen?C.tealDim:'transparent',color:isOpen?C.teal:C.muted,fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit',transition:'all 0.15s'}}>
                    {day.l}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Capacidad por franja */}
          <div>
            <p style={{fontSize:13,fontWeight:700,color:C.amber,letterSpacing:'0.03em',marginBottom:12}}>{tx('Capacidad por franja')}</p>
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div>
                  <p style={{fontSize:13,fontWeight:600,color:C.text}}>{tx('Máximo de reservas por franja')}</p>
                  <p style={{fontSize:11,color:C.muted,marginTop:2}}>{tx('Cuántas reservas/citas puedes atender a la vez')}</p>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <button onClick={()=>setSchedCfg(s=>({...s,max_new_reservations_per_slot:Math.max(1,s.max_new_reservations_per_slot-1)}))} style={{width:32,height:32,borderRadius:8,border:`1px solid ${C.border}`,background:C.surface2,color:C.text,fontSize:16,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}} aria-label="Menos">−</button>
                  <span style={{fontSize:18,fontWeight:700,color:C.amber,minWidth:32,textAlign:'center'}}>{schedCfg.max_new_reservations_per_slot}</span>
                  <button onClick={()=>setSchedCfg(s=>({...s,max_new_reservations_per_slot:Math.min(50,s.max_new_reservations_per_slot+1)}))} style={{width:32,height:32,borderRadius:8,border:`1px solid ${C.border}`,background:C.surface2,color:C.text,fontSize:16,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}} aria-label="Más">+</button>
                </div>
              </div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div>
                  <p style={{fontSize:13,fontWeight:600,color:C.text}}>{tx('Máximo de personas por franja')}</p>
                  <p style={{fontSize:11,color:C.muted,marginTop:2}}>{tx('Total de personas que caben en una misma franja horaria')}</p>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <button onClick={()=>setSchedCfg(s=>({...s,max_new_people_per_slot:Math.max(1,s.max_new_people_per_slot-1)}))} style={{width:32,height:32,borderRadius:8,border:`1px solid ${C.border}`,background:C.surface2,color:C.text,fontSize:16,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}} aria-label="Menos">−</button>
                  <span style={{fontSize:18,fontWeight:700,color:C.amber,minWidth:32,textAlign:'center'}}>{schedCfg.max_new_people_per_slot}</span>
                  <button onClick={()=>setSchedCfg(s=>({...s,max_new_people_per_slot:Math.min(100,s.max_new_people_per_slot+1)}))} style={{width:32,height:32,borderRadius:8,border:`1px solid ${C.border}`,background:C.surface2,color:C.text,fontSize:16,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}} aria-label="Más">+</button>
                </div>
              </div>
            </div>
          </div>

          {/* Duración y tiempos */}
          <div>
            <p style={{fontSize:13,fontWeight:700,color:C.amber,letterSpacing:'0.03em',marginBottom:12}}>{tx('Duración y tiempos')}</p>
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div>
                <p style={{fontSize:13,fontWeight:600,color:C.text}}>{tx('Duración media de cada reserva/cita')}</p>
                <p style={{fontSize:11,color:C.muted,marginTop:2,marginBottom:8}}>{tx('Cuánto dura normalmente una visita o servicio')}</p>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {[15,20,30,45,60,90,120].map(m=>(
                    <button key={m} onClick={()=>setSchedCfg(s=>({...s,default_reservation_duration_minutes:m}))}
                      style={{padding:'7px 14px',borderRadius:8,border:`1px solid ${schedCfg.default_reservation_duration_minutes===m?C.amber+'66':C.border}`,
                        background:schedCfg.default_reservation_duration_minutes===m?C.amberDim:'transparent',
                        color:schedCfg.default_reservation_duration_minutes===m?C.amber:C.sub,
                        fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit',transition:'all 0.12s'}}>
                      {m} min
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p style={{fontSize:13,fontWeight:600,color:C.text}}>{tx('Tiempo entre reservas (descanso)')}</p>
                <p style={{fontSize:11,color:C.muted,marginTop:2,marginBottom:8}}>{tx('Minutos de margen entre una reserva y la siguiente')}</p>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {[0,5,10,15,20,30].map(m=>(
                    <button key={m} onClick={()=>setSchedCfg(s=>({...s,buffer_minutes:m}))}
                      style={{padding:'7px 14px',borderRadius:8,border:`1px solid ${schedCfg.buffer_minutes===m?C.violet+'66':C.border}`,
                        background:schedCfg.buffer_minutes===m?'rgba(167,139,250,0.10)':'transparent',
                        color:schedCfg.buffer_minutes===m?C.violet:C.sub,
                        fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit',transition:'all 0.12s'}}>
                      {m===0?tx('Sin pausa'):`${m} min`}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p style={{fontSize:13,fontWeight:600,color:C.text}}>{tx('Intervalo de franjas')}</p>
                <p style={{fontSize:11,color:C.muted,marginTop:2,marginBottom:8}}>{tx('Cada cuántos minutos se puede reservar (ej: 13:00, 13:30, 14:00...)')}</p>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {[15,30,60].map(m=>(
                    <button key={m} onClick={()=>setSchedCfg(s=>({...s,reservation_slot_interval_minutes:m}))}
                      style={{padding:'7px 14px',borderRadius:8,border:`1px solid ${schedCfg.reservation_slot_interval_minutes===m?C.teal+'66':C.border}`,
                        background:schedCfg.reservation_slot_interval_minutes===m?C.tealDim:'transparent',
                        color:schedCfg.reservation_slot_interval_minutes===m?C.teal:C.sub,
                        fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit',transition:'all 0.12s'}}>
                      {tx('Cada')} {m} min
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Resumen */}
          <div style={{background:C.tealDim,border:`1px solid ${C.teal}33`,borderRadius:10,padding:'10px 14px'}}>
            <p style={{fontSize:12,color:C.teal,fontWeight:600}}>{tx('Resumen de tu configuración')}</p>
            <p style={{fontSize:12,color:C.sub,marginTop:3,lineHeight:1.6}}>
              {isHosb
                ? <>{tx('Comidas de')} <strong style={{color:C.text}}>{schedCfg.service_hours?.lunch_start||'13:00'}</strong> {tx('a')} <strong style={{color:C.text}}>{schedCfg.service_hours?.lunch_end||'16:00'}</strong> · {tx('Cenas de')} <strong style={{color:C.text}}>{schedCfg.service_hours?.dinner_start||'20:00'}</strong> {tx('a')} <strong style={{color:C.text}}>{schedCfg.service_hours?.dinner_end||'23:30'}</strong></>
                : <>{tx('Abierto de')} <strong style={{color:C.text}}>{schedCfg.service_hours?.open||'09:00'}</strong> {tx('a')} <strong style={{color:C.text}}>{schedCfg.service_hours?.close||'21:00'}</strong></>
              }
              {' · '}{tx('Hasta')} <strong style={{color:C.text}}>{schedCfg.max_new_reservations_per_slot}</strong> {tx('reservas y')} <strong style={{color:C.text}}>{schedCfg.max_new_people_per_slot}</strong> {tx('personas por franja')}
              {' · '}<strong style={{color:C.text}}>{schedCfg.default_reservation_duration_minutes} min</strong> {tx('por reserva')}
              {schedCfg.buffer_minutes>0 && <> · <strong style={{color:C.text}}>{schedCfg.buffer_minutes} min</strong> {tx('de descanso')}</>}
            </p>
          </div>
        </SectionCard>

        <SectionCard id="automation" icon="⚡" title={tx("¿Qué puede hacer sin preguntarte?")} sub={`${tx('Decide en qué situaciones')} ${agentName} ${tx('puede actuar sola')}`} active={openSection==='automation'} onClick={()=>toggleSection('automation')}>
          <Toggle label={tx("¿Puede confirmar reservas pequeñas sin avisarte?")} sub={`${agentName} ${tx('confirma directamente cuando la reserva entra dentro de lo normal')}`} value={cfg.automation.auto_simple_reservations} onChange={v=>upCfg('automation','auto_simple_reservations',v)}/>
          <Toggle label={tx("¿Puede gestionar cancelaciones sin consultarte?")} sub={`${tx('Si un cliente cancela,')} ${agentName} ${tx('lo anota sin necesidad de avisarte')}`} value={cfg.automation.auto_cancellations} onChange={v=>upCfg('automation','auto_cancellations',v)}/>
          <Toggle label={tx("¿Puede contestar preguntas de horarios y precios?")} sub={`${tx('Horario, precios, servicios —')} ${agentName} ${tx('responde directamente sin molestarte')}`} value={cfg.automation.auto_info_queries} onChange={v=>upCfg('automation','auto_info_queries',v)}/>
          <Slider label={tx("¿Hasta cuántas personas puede aceptar sola?")} sub={`${tx('Si el grupo es más grande que esto,')} ${agentName} ${tx('te avisa para que decidas tú')}`} value={cfg.automation.max_auto_party} min={1} max={20} unit=" personas" onChange={v=>upCfg('automation','max_auto_party',v)}/>
          <div style={{background:C.amberDim,border:`1px solid ${C.amber}33`,borderRadius:10,padding:'10px 14px'}}>
            <p style={{fontSize:12,color:C.amber,fontWeight:600}}>{tx('Resumen de tu configuración')}</p>
            <p style={{fontSize:12,color:C.sub,marginTop:3}}>
              {tx('Grupos de hasta')} <strong style={{color:C.text}}>{cfg.automation.max_auto_party} {tx('personas')}</strong> → {agentName} {tx('confirma sola.')}{' '}
              {tx('Más de')} {cfg.automation.max_auto_party} → {tx('te avisa a ti.')}
            </p>
          </div>
        </SectionCard>

        <SectionCard id="review" icon="👁" title={tx("¿Cuándo quieres que te consulte?")} sub={tx("En estas situaciones siempre te pregunta antes de confirmar")} active={openSection==='review'} onClick={()=>toggleSection('review')}>
          <Toggle label={tx("Si viene un grupo grande")} sub={`${tx('Más de')} ${cfg.automation.max_auto_party} ${tx('personas — te avisa siempre')}`} value={cfg.review.large_groups} onChange={v=>upCfg('review','large_groups',v)} color={C.amber}/>
          <Toggle label={tx("Si piden algo especial, ¿te avisa?")} sub={tx("El cliente pide algo fuera de lo habitual (mesa concreta, decoración, etc.)")} value={cfg.review.special_requests} onChange={v=>upCfg('review','special_requests',v)} color={C.amber}/>
          <Toggle label={tx("Si mencionan alergias o intolerancias")} sub={tx("Te avisa para que lo tengas en cuenta y lo prepares")} value={cfg.review.allergies_mentioned} onChange={v=>upCfg('review','allergies_mentioned',v)} color={C.amber}/>
          <Toggle label={tx("Si quieren reservar en horarios raros")} sub={tx("Reservas muy fuera de tu hora punta")} value={cfg.review.unusual_hours} onChange={v=>upCfg('review','unusual_hours',v)} color={C.amber}/>
          <Toggle label={tx("Si es alguien que llama por primera vez")} sub={tx("Primera llamada de ese número — te avisa para que lo atiendas tú si quieres")} value={cfg.review.first_time_customers} onChange={v=>upCfg('review','first_time_customers',v)} color={C.amber}/>
        </SectionCard>

        <SectionCard id="rejection" icon="🚫" title={tx("¿Cuándo tiene que decir que no?")} sub={`${agentName} ${tx('rechazará educadamente en estas situaciones')}`} active={openSection==='rejection'} onClick={()=>toggleSection('rejection')}>
          <Toggle label={tx("Cuando estáis cerrados")} sub={`${tx('Si llaman fuera de horario,')} ${agentName} ${tx('les informa y les pide que llamen cuando estéis abiertos')}`} value={cfg.rejection.out_of_hours} onChange={v=>upCfg('rejection','out_of_hours',v)} color={C.red}/>
          <Toggle label={tx("Cuando no hay sitio")} sub={`${tx('Si no queda disponibilidad,')} ${agentName} ${tx('lo dice claramente y ofrece alternativas')}`} value={cfg.rejection.no_availability} onChange={v=>upCfg('rejection','no_availability',v)} color={C.red}/>
          <Toggle label={tx("Si piden algo que no ofrecéis")} sub={`${agentName} ${tx('responde que ese servicio no está disponible en vuestro negocio')}`} value={cfg.rejection.unknown_service} onChange={v=>upCfg('rejection','unknown_service',v)} color={C.red}/>
        </SectionCard>

        <SectionCard id="alternatives" icon="↩️" title={tx("¿Qué ofrece cuando no puede?")} sub={`${tx('Si no hay sitio en el horario pedido,')} ${agentName} ${tx('hará esto')}`} active={openSection==='alternatives'} onClick={()=>toggleSection('alternatives')}>
          <Toggle label={tx("Proponer otro horario disponible")} sub={`${agentName} ${tx('busca la siguiente hora libre y se la ofrece al cliente')}`} value={cfg.alternatives.offer_other_time} onChange={v=>upCfg('alternatives','offer_other_time',v)}/>
          <Toggle label={tx("Dejar la solicitud anotada")} sub={tx("Si el cliente prefiere esperar, queda guardada para que tú la gestiones")} value={cfg.alternatives.leave_pending} onChange={v=>upCfg('alternatives','leave_pending',v)}/>
          <Toggle label={tx("Apuntar en lista de espera")} sub={`${agentName} ${tx('ofrece avisar al cliente si se libera un hueco')}`} value={cfg.alternatives.suggest_waitlist} onChange={v=>upCfg('alternatives','suggest_waitlist',v)}/>
          <Slider label={tx("¿Cuántas opciones le ofrece como mucho?")} sub={`${agentName} ${tx('no propone más alternativas que este número para no agobiar al cliente')}`} value={cfg.alternatives.max_alternatives} min={1} max={5} unit="" onChange={v=>upCfg('alternatives','max_alternatives',v)}/>
        </SectionCard>


        <SectionCard id="knowledge" icon="🧠" title={tx("¿Qué sabe de tu negocio?")} sub={`${tx('Cuéntale a')} ${agentName} ${tx('todo lo que necesita para responder bien')}`} active={openSection==='knowledge'} onClick={()=>toggleSection('knowledge')}>
          <KArea tx={tx} label={tx('Horarios')} sub={tx('Cuándo abrís y cuándo cerráis. Escríbelo como lo dirías por teléfono.')} placeholder={"Lunes a viernes de 9 a 14 y de 17 a 20\nSábados de 10 a 14\nDomingos cerrado"} value={cfg.knowledge.horarios||''} onChange={v=>upCfg('knowledge','horarios',v)}/>
          {isHosb && <KArea tx={tx} label={tx('Carta / Menú')} sub={`${tx('Escribe los platos y precios.')} ${agentName} ${tx('se lo aprenderá de memoria.')}`} placeholder={"Arroz a banda: 14€\nPaella: 13€\nChuletón: 22€\nMenú del día: 13.50€ (primero, segundo, postre y pan)"} value={cfg.knowledge.menu||''} onChange={v=>upCfg('knowledge','menu',v)}/>}
          <KArea tx={tx} label={isHosb?tx('Otros servicios y precios'):tx('Tus servicios y precios')} sub={`${tx('Escribe qué ofreces y cuánto cuesta.')} ${agentName} ${tx('lo usará cuando los clientes pregunten.')}`} placeholder={
            tenant?.type === 'clinica_dental' ? "Revisión: 30€\nLimpieza dental: 60€\nEmpaste: 50€\nOrtodoncia: consultar" :
            tenant?.type === 'clinica_medica' ? "Consulta general: 50€\nEspecialista: 80€\nRevisión completa: 120€" :
            tenant?.type === 'veterinaria' ? "Consulta general: 35€\nVacunas: 25€\nDesparasitación: 15€\nCirugía: consultar" :
            tenant?.type === 'fisioterapia' ? "Sesión fisioterapia: 40€\nPunción seca: 45€\nPilates terapéutico: 30€" :
            tenant?.type === 'psicologia' ? "Primera consulta: 60€\nSesión individual: 55€\nTerapia de pareja: 70€\nOnline: 50€" :
            tenant?.type === 'gimnasio' ? "Matrícula: 30€\nAbono mensual: 45€\nClase suelta: 10€\nEntrenador personal: 35€/sesión" :
            tenant?.type === 'academia' ? "Inglés (grupo): 80€/mes\nRefuerzo escolar: 60€/mes\nClase particular: 25€/hora" :
            tenant?.type === 'spa' ? "Masaje relajante 60min: 55€\nFacial completo: 65€\nCircuito termal: 30€\nBono 5 masajes: 220€" :
            tenant?.type === 'taller' ? "Cambio aceite + filtros: 60€\nRevisión pre-ITV: 45€\nNeumáticos (desde): 50€/ud\nDiagnóstico: 30€" :
            tenant?.type === 'hotel' ? "Individual: 60€/noche\nDoble: 90€/noche\nSuite: 150€/noche\nDesayuno buffet: 12€" :
            tenant?.type === 'ecommerce' ? "Producto A: 29.99€\nProducto B: 49.99€\nEnvío gratis a partir de 50€" :
            tenant?.type === 'seguros' ? "Seguro auto (desde): 300€/año\nSeguro hogar (desde): 150€/año\nSeguro salud: consultar" :
            tenant?.type === 'inmobiliaria' ? "Piso 2 hab. centro: 850€/mes\nCasa adosada: 1.200€/mes\nEstudio: 550€/mes" :
            tenant?.type === 'asesoria' ? "Asesoría fiscal: 80€/trimestre\nDeclaración renta: 50€\nConstitución empresa: 300€" :
            isHosb ? "Entrantes: 8-12€\nCarnes: 15-22€\nPescados: 14-20€\nPostres: 5-8€" :
            "Servicio básico: 20€\nServicio completo: 40€\nPack especial: 60€\n..."
          } value={cfg.knowledge.services} onChange={v=>upCfg('knowledge','services',v)}/>
          <KArea tx={tx} label={tx('Condiciones y normas')} sub={tx('Política de cancelaciones, reserva mínima, señal, etc.')} placeholder={"Cancelación con 24h de antelación sin coste\nGrupos de más de 8 requieren señal\n..."} value={cfg.knowledge.conditions} onChange={v=>upCfg('knowledge','conditions',v)}/>
          <KArea tx={tx} label={tx('Preguntas que te hacen siempre')} sub={tx('Escribe las preguntas más frecuentes y sus respuestas')} placeholder={
            tenant?.type === 'clinica_dental' ? "¿Hacéis urgencias? Sí, con cita previa\n¿Aceptáis mutuas? Sí, Adeslas, Sanitas y DKV\n..." :
            tenant?.type === 'veterinaria' ? "¿Atendéis urgencias? Sí, de lunes a viernes\n¿Atendéis animales exóticos? Consultar\n..." :
            tenant?.type === 'hotel' ? "¿Hay parking? Sí, gratuito para huéspedes\n¿Admitís mascotas? Sí, con suplemento de 15€/noche\n¿A qué hora es el check-in? A partir de las 14:00" :
            tenant?.type === 'gimnasio' ? "¿Hay piscina? Sí, climatizada\n¿Puedo ir sin reservar? Sí, las clases dirigidas sí requieren reserva\n..." :
            tenant?.type === 'taller' ? "¿Hacéis presupuesto gratis? Sí, sin compromiso\n¿Tenéis coche de sustitución? Sí, bajo disponibilidad\n..." :
            "¿Tenéis terraza? Sí, con capacidad para 20 personas\n¿Hay parking? Sí, en la calle lateral gratuito\n..."
          } value={cfg.knowledge.faqs} onChange={v=>upCfg('knowledge','faqs',v)}/>
          <div style={{background:C.tealDim,border:`1px solid ${C.teal}33`,borderRadius:10,padding:'10px 14px'}}>
            <p style={{fontSize:12,color:C.teal,fontWeight:600}}>💡 {tx('Por qué es importante')}</p>
            <p style={{fontSize:12,color:C.sub,marginTop:3,lineHeight:1.5}}>{tx('Cuanto más le cuentes a')} {agentName}{tx(', mejor responderá. Piensa en')} {agentName} {tx('como una empleada nueva: necesita conocer tu negocio para atender bien.')}</p>
          </div>
        </SectionCard>

        <SectionCard id="flow" icon="💬" title={tx("¿En qué orden pregunta?")} sub={`${tx('El orden en que')} ${agentName} ${tx('pide los datos al cliente cuando gestiona una solicitud')}`} active={openSection==='flow'} onClick={()=>toggleSection('flow')}>
          <div>
            <p style={{fontSize:12,color:C.sub,marginBottom:12,lineHeight:1.5}}>{tx('El agente seguirá este orden al gestionar una solicitud. Arrastra para reordenar. Pulsa para activar/desactivar.')}</p>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:14}}>
              {cfg.conversation_flow.map((step,i)=>(
                <div key={step} className="flow-chip" style={{background:C.amberDim,border:`1px solid ${C.amber}44`,color:C.amber}}>
                  <span style={{fontSize:10,fontWeight:700,color:C.muted}}>{i+1}</span>
                  <span>{step}</span>
                  <button onClick={()=>setCfg(c=>({...c,conversation_flow:c.conversation_flow.filter(s=>s!==step)}))} style={{background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:12,padding:0,lineHeight:1}} aria-label="Cerrar">×</button>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {FLOW_OPTIONS.filter(o=>!cfg.conversation_flow.includes(o)).map(o=>(
                <button key={o} onClick={()=>setCfg(c=>({...c,conversation_flow:[...c.conversation_flow,o]}))} className="flow-chip" style={{background:C.surface2,border:`1px solid ${C.border}`,color:C.muted}}>
                  + {o}
                </button>
              ))}
            </div>
          </div>
          <div style={{background:C.amberDim,border:`1px solid ${C.amber}33`,borderRadius:10,padding:'10px 14px'}}>
            <p style={{fontSize:12,color:C.amber,fontWeight:600}}>{tx('Flujo actual')}</p>
            <p style={{fontSize:13,color:C.text,marginTop:3,fontFamily:'monospace'}}>{cfg.conversation_flow.join(' → ')}</p>
          </div>
        </SectionCard>

        <SectionCard id="special" icon="⚠️" title={tx("Situaciones especiales")} sub={`${tx('Dile a')} ${agentName} ${tx('exactamente qué hacer en estos casos')}`} active={openSection==='special'} onClick={()=>toggleSection('special')}>
          {([['allergies','El cliente menciona alergias','Alergias, intolerancias, restricciones alimentarias'],['birthdays','Es para una celebración','Cumpleaños, aniversarios, eventos especiales'],['events','Es un grupo o evento','Cenas de empresa, fiestas, grupos numerosos'],['vip','Es un cliente muy fiel','Clientes que llaman con mucha frecuencia']] as [keyof typeof DEFAULT.special_cases, string, string][]).map(([key,label,sub])=>(
            <div key={key} style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:16}}>
              <div style={{flex:1}}>
                <p style={{fontSize:13,fontWeight:600,color:C.text}}>{tx(label)}</p>
                <p style={{fontSize:11,color:C.muted,marginTop:2}}>{tx(sub)}</p>
              </div>
              <CaseBadge value={cfg.special_cases[key]} onChange={v=>upCfg('special_cases',key,v)} tx={tx}/>
            </div>
          ))}
          <div style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:10,padding:'12px 14px'}}>
            <p style={{fontSize:11,fontWeight:700,color:C.sub,marginBottom:8}}>{tx('¿Qué significa cada opción?')}</p>
            <div style={{display:'flex',flexDirection:'column',gap:4}}>
              <span style={{fontSize:11,color:C.green}}>● {tx('Confirmar sola')} — {agentName} {tx('lo gestiona sin avisarte')}</span>
              <span style={{fontSize:11,color:C.amber}}>● {tx('Revisar')} — {agentName} {tx('te avisa para que decidas tú')}</span>
              <span style={{fontSize:11,color:C.red}}>● {tx('No aceptar')} — {agentName} {tx('lo rechaza educadamente')}</span>
            </div>
          </div>
        </SectionCard>

        {/* Solo para hostelería */}
        {isHosb && (
        <SectionCard id="orders" icon="🛍️" title={tx("Alertas de pedidos")} sub={tx("Cómo te avisa cuando entra un pedido por teléfono")} active={openSection==='orders'} onClick={()=>toggleSection('orders')}>
          <p style={{fontSize:12,color:C.muted,marginBottom:14}}>{tx('Cuando un cliente hace un pedido por teléfono, ¿cómo quieres enterarte?')}</p>
          {([
            { value:'banner', label:tx('Banner + sonido'), desc:tx('Aparece un aviso arriba de la pantalla con sonido. Toca para ir a pedidos.'), icon:'🔔' },
            { value:'redirect', label:tx('Ir a pedidos automáticamente'), desc:tx('Te cambia directamente a la pantalla de pedidos cuando entra uno nuevo.'), icon:'📲' },
            { value:'none', label:tx('Sin alerta'), desc:tx('Solo aparece en el panel como actividad. Sin aviso especial.'), icon:'🔕' },
          ] as const).map(opt => (
            <div key={opt.value} onClick={()=>setCfg(c=>({...c,order_alert_mode:opt.value}))}
              style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',borderRadius:10,cursor:'pointer',
                border:`1px solid ${cfg.order_alert_mode===opt.value?C.amber+'44':C.border}`,
                background:cfg.order_alert_mode===opt.value?C.amberDim:'transparent',
                transition:'all 0.15s',marginBottom:8}}>
              <span style={{fontSize:20}}>{opt.icon}</span>
              <div style={{flex:1}}>
                <p style={{fontSize:13,fontWeight:600,color:cfg.order_alert_mode===opt.value?C.amber:C.text}}>{opt.label}</p>
                <p style={{fontSize:11,color:C.muted,marginTop:2}}>{opt.desc}</p>
              </div>
              {cfg.order_alert_mode===opt.value && <span style={{fontSize:16,color:C.amber}}>✓</span>}
            </div>
          ))}
        </SectionCard>
        )}

        {/* ── Alertas configurables ─────────────────────────────── */}
        <AlertRulesSection tenantId={tenant?.id} tx={tx} />

        {/* ── Link de reservas publico ─────────────────────────── */}
        {tenant?.slug && (
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:'20px'}}>
            <p style={{fontSize:13,fontWeight:700,color:C.teal,letterSpacing:'0.04em',marginBottom:10}}>{'\uD83C\uDF10'} {tx('LINK DE RESERVAS')}</p>
            <p style={{fontSize:12,color:C.muted,marginBottom:10,lineHeight:1.5}}>
              {tx('Comparte este enlace en Google Maps, Instagram, tu web o donde quieras. Los clientes podran reservar directamente.')}
            </p>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <input
                readOnly
                value={`https://restaurante-ai.vercel.app/reservar/${tenant.slug}`}
                style={{flex:1,padding:'10px 14px',background:C.surface2,border:`1px solid ${C.border}`,borderRadius:10,color:C.text,fontSize:13,fontFamily:'monospace',outline:'none'}}
                onClick={e=>(e.target as HTMLInputElement).select()}
              />
              <button
                onClick={()=>{
                  navigator.clipboard.writeText(`https://restaurante-ai.vercel.app/reservar/${tenant.slug}`)
                  const btn = document.getElementById('copy-link-btn')
                  if(btn){btn.textContent='\u2705';setTimeout(()=>{btn.textContent='\uD83D\uDCCB Copiar'},1500)}
                }}
                id="copy-link-btn"
                style={{padding:'10px 16px',borderRadius:10,border:`1px solid ${C.teal}40`,background:C.tealDim,color:C.teal,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}}
              >
                {'\uD83D\uDCCB'} Copiar
              </button>
            </div>
            <p style={{fontSize:11,color:C.muted,marginTop:8}}>
              {tx('Las reservas llegan con estado "pendiente" para que las confirmes manualmente.')}
            </p>
          </div>
        )}

        {/* ── Recordatorios configurables ─────────────────────── */}
        <RemindersSection tenantId={tenant?.id} tx={tx} />

        <div style={{height:40}}/>
      </div>
    </div>
  )
}

// ── Alert Rules Section Component ────────────────────────────────
function AlertRulesSection({ tenantId, tx: _tx }: { tenantId?: string; tx: (s: string) => string }) {
  const toast = useToast()
  const [rules, setRules] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const EVENT_LABELS: Record<string, { label: string; desc: string }> = {
    complaint:             { label: 'Queja / Reclamacion',  desc: 'Un cliente envia una queja' },
    cancellation:          { label: 'Cancelacion',          desc: 'Se cancela una reserva o cita' },
    escalation:            { label: 'Escalacion',           desc: 'Una conversacion es escalada a humano' },
    vip_message:           { label: 'Mensaje de VIP',       desc: 'Un cliente VIP escribe' },
    large_group:           { label: 'Grupo grande',         desc: 'Reserva de grupo grande' },
    crisis:                { label: 'Crisis',               desc: 'Deteccion de crisis (psicologia)' },
    likely_no_show:        { label: 'Probable ausencia',    desc: 'Riesgo de no-show' },
    critical_change:       { label: 'Cambio critico',       desc: 'Cambio importante en agenda' },
    missed_call:           { label: 'Llamada perdida',      desc: 'Se pierde una llamada' },
    new_reservation:       { label: 'Nueva reserva',        desc: 'Se crea una reserva' },
  }

  useEffect(() => {
    if (!tenantId) return
    fetch(`/api/tenant/alert-rules?tenant_id=${tenantId}`)
      .then(r => r.json())
      .then(d => setRules(d.rules || []))
      .catch(() => {
        toast.push({ title: 'Error al cargar reglas de alertas', type: 'error', priority: 'warning', icon: '⚠️' })
      })
  }, [tenantId])

  const toggleRule = (eventType: string, field: string, value: any) => {
    setRules(prev => prev.map(r => r.event_type === eventType ? { ...r, [field]: value } : r))
  }

  const toggleChannel = (eventType: string, channel: string) => {
    setRules(prev => prev.map(r => {
      if (r.event_type !== eventType) return r
      const channels = r.channels || ['in_app']
      return {
        ...r,
        channels: channels.includes(channel)
          ? channels.filter((c: string) => c !== channel)
          : [...channels, channel],
      }
    }))
  }

  const saveRules = async () => {
    if (!tenantId) return
    setSaving(true)
    await fetch('/api/tenant/alert-rules', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenantId, rules }),
    })
    setSaving(false)
  }

  if (rules.length === 0) return null

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
      <button onClick={() => setOpen(!open)} style={{
        width: '100%', padding: '16px 20px', border: 'none', background: 'transparent', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 15 }}>🔔</span>
          <span style={{ color: C.amber, fontSize: 13, fontWeight: 700, letterSpacing: '0.04em' }}>
            {_tx('ALERTAS AL RESPONSABLE')}
          </span>
        </div>
        <span style={{ color: C.muted, fontSize: 12, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▼</span>
      </button>

      {open && (
        <div style={{ padding: '0 20px 20px', borderTop: `1px solid ${C.border}` }}>
          <p style={{ fontSize: 12, color: C.muted, margin: '12px 0 16px' }}>
            {_tx('Elige que eventos generan aviso, con que prioridad y por que canal')}
          </p>

          {rules.map(rule => {
            const meta = EVENT_LABELS[rule.event_type]
            if (!meta) return null
            return (
              <div key={rule.event_type} style={{
                padding: '12px 14px', borderRadius: 10, marginBottom: 8,
                border: `1px solid ${rule.enabled ? C.amber + '30' : C.border}`,
                background: rule.enabled ? C.amberDim : 'transparent',
                transition: 'all 0.15s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: rule.enabled ? C.text : C.muted }}>
                        {meta.label}
                      </span>
                      <span style={{
                        fontSize: 10, padding: '1px 6px', borderRadius: 6, fontWeight: 600,
                        color: rule.priority === 'critical' ? C.red : rule.priority === 'warning' ? C.amber : C.teal,
                        background: (rule.priority === 'critical' ? C.red : rule.priority === 'warning' ? C.amber : C.teal) + '18',
                      }}>
                        {rule.priority === 'critical' ? 'Critico' : rule.priority === 'warning' ? 'Alerta' : 'Info'}
                      </span>
                    </div>
                    <p style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{meta.desc}</p>
                  </div>

                  {/* Toggle */}
                  <div onClick={() => toggleRule(rule.event_type, 'enabled', !rule.enabled)} style={{
                    width: 40, height: 22, borderRadius: 11, cursor: 'pointer',
                    background: rule.enabled ? C.amber : C.muted + '40',
                    position: 'relative', transition: 'background 0.15s',
                  }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%', background: '#fff',
                      position: 'absolute', top: 2,
                      left: rule.enabled ? 20 : 2,
                      transition: 'left 0.15s',
                    }} />
                  </div>
                </div>

                {/* Channels */}
                {rule.enabled && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    {(['in_app', 'sms', 'push'] as const).map(ch => {
                      const chLabels: Record<string, string> = { in_app: 'En app', sms: 'SMS', push: 'Push' }
                      const active = (rule.channels || []).includes(ch)
                      return (
                        <button key={ch} onClick={() => toggleChannel(rule.event_type, ch)} style={{
                          padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                          border: `1px solid ${active ? C.teal + '40' : C.border}`,
                          background: active ? C.tealDim : 'transparent',
                          color: active ? C.teal : C.muted,
                          cursor: 'pointer',
                        }}>
                          {chLabels[ch]}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          <button onClick={saveRules} disabled={saving} style={{
            marginTop: 12, padding: '10px 24px', borderRadius: 10, border: 'none',
            background: `linear-gradient(135deg, ${C.amber}, #E8923A)`,
            color: C.bg, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            opacity: saving ? 0.6 : 1,
          }}>
            {saving ? _tx('Guardando...') : _tx('Guardar alertas')}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Reminders Section Component ──────────────────────────────────
function RemindersSection({ tenantId, tx: _tx }: { tenantId?: string; tx: (s: string) => string }) {
  const [config, setConfig] = useState({ intervals: ['24h'], channel: 'sms', enabled: true })
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!tenantId) return
    fetch(`/api/tenant/reminders?tenant_id=${tenantId}`)
      .then(r => r.json())
      .then(d => { setConfig(d.config || config); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [tenantId])

  const toggleInterval = (interval: string) => {
    setConfig(prev => ({
      ...prev,
      intervals: prev.intervals.includes(interval)
        ? prev.intervals.filter(i => i !== interval)
        : [...prev.intervals, interval],
    }))
  }

  const saveConfig = async () => {
    if (!tenantId) return
    setSaving(true)
    await fetch('/api/tenant/reminders', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenantId, config }),
    })
    setSaving(false)
  }

  if (!loaded) return null

  const INTERVALS = [
    { key: '24h', label: '24 horas antes', desc: 'Recordatorio el dia anterior' },
    { key: '2h', label: '2 horas antes', desc: 'Recordatorio cercano' },
    { key: '30min', label: '30 minutos antes', desc: 'Recordatorio de ultima hora' },
  ]

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
      <button onClick={() => setOpen(!open)} style={{
        width: '100%', padding: '16px 20px', border: 'none', background: 'transparent', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 15 }}>⏰</span>
          <span style={{ color: C.teal, fontSize: 13, fontWeight: 700, letterSpacing: '0.04em' }}>
            {_tx('RECORDATORIOS AL CLIENTE')}
          </span>
        </div>
        <span style={{ color: C.muted, fontSize: 12, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▼</span>
      </button>

      {open && (
        <div style={{ padding: '0 20px 20px', borderTop: `1px solid ${C.border}` }}>
          <p style={{ fontSize: 12, color: C.muted, margin: '12px 0 16px' }}>
            {_tx('El sistema envia recordatorios automaticos a tus clientes antes de su cita')}
          </p>

          {/* Enable/disable */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{_tx('Recordatorios activados')}</span>
            <div onClick={() => setConfig(prev => ({ ...prev, enabled: !prev.enabled }))} style={{
              width: 40, height: 22, borderRadius: 11, cursor: 'pointer',
              background: config.enabled ? C.teal : C.muted + '40',
              position: 'relative', transition: 'background 0.15s',
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 2,
                left: config.enabled ? 20 : 2,
                transition: 'left 0.15s',
              }} />
            </div>
          </div>

          {config.enabled && (
            <>
              {/* Intervals */}
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 8, letterSpacing: '0.04em' }}>
                  {_tx('CUANDO ENVIAR')}
                </p>
                {INTERVALS.map(int => {
                  const active = config.intervals.includes(int.key)
                  return (
                    <div key={int.key} onClick={() => toggleInterval(int.key)} style={{
                      padding: '10px 14px', borderRadius: 10, marginBottom: 6, cursor: 'pointer',
                      border: `1px solid ${active ? C.teal + '40' : C.border}`,
                      background: active ? C.tealDim : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      transition: 'all 0.15s',
                    }}>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: active ? C.text : C.muted }}>{int.label}</span>
                        <p style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{int.desc}</p>
                      </div>
                      {active && <span style={{ color: C.teal, fontSize: 16 }}>✓</span>}
                    </div>
                  )
                })}
              </div>

              {/* Channel preference */}
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 8, letterSpacing: '0.04em' }}>
                  {_tx('CANAL PREFERIDO')}
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['sms', 'whatsapp'] as const).map(ch => (
                    <button key={ch} onClick={() => setConfig(prev => ({ ...prev, channel: ch }))} style={{
                      padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      border: `1px solid ${config.channel === ch ? C.teal + '40' : C.border}`,
                      background: config.channel === ch ? C.tealDim : 'transparent',
                      color: config.channel === ch ? C.teal : C.muted,
                      cursor: 'pointer',
                    }}>
                      {ch === 'sms' ? 'SMS' : 'WhatsApp'}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
                  {_tx('Si el canal principal falla, se intenta por el otro automaticamente')}
                </p>
              </div>
            </>
          )}

          <button onClick={saveConfig} disabled={saving} style={{
            padding: '10px 24px', borderRadius: 10, border: 'none',
            background: `linear-gradient(135deg, ${C.teal}, #1BB5A0)`,
            color: C.bg, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            opacity: saving ? 0.6 : 1,
          }}>
            {saving ? _tx('Guardando...') : _tx('Guardar recordatorios')}
          </button>
        </div>
      )}
    </div>
  )
}
