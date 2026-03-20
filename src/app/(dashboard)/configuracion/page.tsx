'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { PageLoader } from '@/components/ui'
import NotifBell from '@/components/NotifBell'

// ── Colores ───────────────────────────────────────────────────────────────
const C = {
  bg:'#0C1018', card:'#131920', card2:'#161D2A', border:'rgba(255,255,255,0.07)',
  borderMd:'rgba(255,255,255,0.12)', text:'#E8EEF6', sub:'#8895A7', muted:'#49566A',
  amber:'#F0A84E', teal:'#2DD4BF', green:'#34D399', red:'#F87171', violet:'#A78BFA',
  amberDim:'rgba(240,168,78,0.10)', greenDim:'rgba(52,211,153,0.10)',
  redDim:'rgba(248,113,113,0.10)', tealDim:'rgba(45,212,191,0.10)',
}

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
  knowledge: { services:'', menu:'', conditions:'', faqs:'' },
  conversation_flow: ['nombre','personas','fecha','hora','confirmar'],
  special_cases: { allergies:'review', birthdays:'confirm', events:'review', vip:'confirm' },
}

interface AgentConfig {
  automation: { max_auto_party:number; auto_simple_reservations:boolean; auto_cancellations:boolean; auto_info_queries:boolean }
  review: { large_groups:boolean; special_requests:boolean; allergies_mentioned:boolean; unusual_hours:boolean; first_time_customers:boolean }
  rejection: { out_of_hours:boolean; no_availability:boolean; unknown_service:boolean }
  alternatives: { offer_other_time:boolean; leave_pending:boolean; suggest_waitlist:boolean; max_alternatives:number }
  knowledge: { services:string; menu:string; conditions:string; faqs:string }
  conversation_flow: string[]
  special_cases: { allergies:string; birthdays:string; events:string; vip:string }
}


// ── Componentes UI ────────────────────────────────────────────────────────
function SectionCard({id,icon,title,sub,children,active,onClick}:{id:string,icon:string,title:string,sub:string,children:React.ReactNode,active:boolean,onClick:()=>void}) {
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

function KArea({label,sub,placeholder,value,onChange}:{label:string,sub?:string,placeholder:string,value:string,onChange:(v:string)=>void}) {
  const lines = value ? value.split('\n').length : 0
  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
        <div>
          <p style={{fontSize:13,fontWeight:600,color:C.text}}>{label}</p>
          {sub&&<p style={{fontSize:11,color:C.muted,marginTop:2}}>{sub}</p>}
        </div>
        <span style={{fontSize:10,color:C.muted}}>{lines} líneas</span>
      </div>
      <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        style={{width:'100%',minHeight:100,background:C.card2,border:`1px solid ${C.border}`,borderRadius:10,padding:'10px 12px',color:C.text,fontSize:13,fontFamily:'monospace',resize:'vertical',outline:'none',lineHeight:1.6}}
        className="rz-ta"
      />
    </div>
  )
}

function CaseBadge({value,onChange}:{value:string,onChange:(v:string)=>void}) {
  const opts=[{v:'confirm',l:'Auto-confirmar',c:C.green},{v:'review',l:'Revisar',c:C.amber},{v:'reject',l:'Rechazar',c:C.red}]
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
  const [tenant, setTenant]   = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [openSection, setOpen]= useState<string|null>('automation')
  const [cfg, setCfg]         = useState<AgentConfig>(DEFAULT)
  const [basicForm, setBasic] = useState({agent_name:'',business_name:'',agent_phone:''})

  useEffect(()=>{
    (async()=>{
      const {data:{user}} = await supabase.auth.getUser(); if(!user) return
      const {data:p} = await supabase.from('profiles').select('tenant_id').eq('id',user.id).maybeSingle(); if(!p?.tenant_id) return
      const {data:t} = await supabase.from('tenants').select('*').eq('id',p.tenant_id).maybeSingle()
      if(!t) return
      setTenant(t)
      setBasic({agent_name:t.agent_name||'Sofía', business_name:t.name||'', agent_phone:t.agent_phone||''})
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
    await supabase.from('tenants').update({
      agent_name:  basicForm.agent_name.trim(),
      name:        basicForm.business_name.trim(),
      agent_phone: basicForm.agent_phone.trim()||null,
      agent_config: cfg,
    }).eq('id',tenant.id)
    setSaving(false); setSaved(true)
    setTimeout(()=>setSaved(false),3000)
  },[tenant,basicForm,cfg])

  const toggleSection = (id:string) => setOpen(o=>o===id?null:id)

  if(loading) return <PageLoader/>

  return (
    <div style={{background:C.bg,minHeight:'100vh',fontFamily:"'Sora',-apple-system,sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box}
        .rz-inp{background:rgba(255,255,255,0.04);border:1px solid ${C.border};border-radius:10px;padding:10px 14px;color:${C.text};font-size:13px;font-family:inherit;outline:none;width:100%;transition:border-color 0.15s}
        .rz-inp:focus{border-color:${C.amber}!important;box-shadow:0 0 0 3px rgba(240,168,78,0.1)!important}
        .rz-inp::placeholder{color:${C.muted}}
        .rz-ta{background:${C.card2};border:1px solid ${C.border};border-radius:10px;padding:10px 12px;color:${C.text};font-size:13px;font-family:monospace;resize:vertical;outline:none;width:100%;line-height:1.6;transition:border-color 0.15s}
        .rz-ta:focus{border-color:${C.amber}!important}
        .rz-ta::placeholder{color:${C.muted}}
        .save-btn{background:linear-gradient(135deg,#F0A84E,#E8923A);color:#0C1018;font-weight:700;font-size:14px;padding:11px 28px;border:none;border-radius:11px;cursor:pointer;font-family:inherit;transition:all 0.15s}
        .save-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 4px 16px rgba(240,168,78,0.3)}
        .save-btn:disabled{opacity:0.6;cursor:not-allowed}
        .flow-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.12s;user-select:none}
      `}</style>

      {/* Header */}
      <div style={{background:C.card,borderBottom:`1px solid ${C.border}`,padding:'14px 24px',position:'sticky',top:0,zIndex:30,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <h1 style={{fontSize:17,fontWeight:700,color:C.text}}>Comportamiento del agente</h1>
          <p style={{fontSize:12,color:C.muted,marginTop:2}}>Define cómo actúa tu recepcionista en cada situación</p>
        </div>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          {saved&&<span style={{fontSize:12,color:C.green,fontWeight:600}}>✓ Guardado</span>}
          <button className="save-btn" onClick={save} disabled={saving}>{saving?'Guardando...':'Guardar cambios'}</button>
          <NotifBell/>
        </div>
      </div>

      <div style={{maxWidth:760,margin:'0 auto',padding:'24px 20px',display:'flex',flexDirection:'column',gap:12}}>

        {/* Datos básicos */}
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:'20px'}}>
          <p style={{fontSize:13,fontWeight:700,color:C.amber,letterSpacing:'0.04em',marginBottom:14}}>⚙ CONFIGURACIÓN BÁSICA</p>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:C.muted,letterSpacing:'0.04em',display:'block',marginBottom:5}}>NOMBRE DEL NEGOCIO</label>
              <input className="rz-inp" value={basicForm.business_name} onChange={e=>setBasic(f=>({...f,business_name:e.target.value}))} placeholder="Mi negocio"/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:C.muted,letterSpacing:'0.04em',display:'block',marginBottom:5}}>NOMBRE DEL AGENTE</label>
              <input className="rz-inp" value={basicForm.agent_name} onChange={e=>setBasic(f=>({...f,agent_name:e.target.value}))} placeholder="Sofía"/>
            </div>
            <div style={{gridColumn:'1/-1'}}>
              <label style={{fontSize:11,fontWeight:600,color:C.muted,letterSpacing:'0.04em',display:'block',marginBottom:5}}>NÚMERO DE TELÉFONO DEL AGENTE</label>
              <input className="rz-inp" value={basicForm.agent_phone} onChange={e=>setBasic(f=>({...f,agent_phone:e.target.value}))} placeholder="+34 600 000 000"/>
            </div>
          </div>
        </div>


        {/* SECCIÓN 1 — AUTOMATIZACIÓN */}
        <SectionCard id="automation" icon="⚡" title="Automatización" sub="Qué confirma el agente sin necesitar revisión" active={openSection==='automation'} onClick={()=>toggleSection('automation')}>
          <Toggle label="Reservas simples automáticas" sub="El agente confirma reservas dentro de los límites sin consultar" value={cfg.automation.auto_simple_reservations} onChange={v=>upCfg('automation','auto_simple_reservations',v)}/>
          <Toggle label="Cancelaciones automáticas" sub="Permite al agente gestionar cancelaciones sin revisión" value={cfg.automation.auto_cancellations} onChange={v=>upCfg('automation','auto_cancellations',v)}/>
          <Toggle label="Consultas de información" sub="Preguntas sobre horario, menú, servicios — el agente responde directamente" value={cfg.automation.auto_info_queries} onChange={v=>upCfg('automation','auto_info_queries',v)}/>
          <Slider label="Máximo de personas para confirmación automática" sub="Por encima de este número, la reserva va a revisión" value={cfg.automation.max_auto_party} min={1} max={20} unit=" personas" onChange={v=>upCfg('automation','max_auto_party',v)}/>
          <div style={{background:C.amberDim,border:`1px solid ${C.amber}33`,borderRadius:10,padding:'10px 14px'}}>
            <p style={{fontSize:12,color:C.amber,fontWeight:600}}>Regla activa</p>
            <p style={{fontSize:12,color:C.sub,marginTop:3}}>
              Reservas hasta <strong style={{color:C.text}}>{cfg.automation.max_auto_party} personas</strong> → automático.{' '}
              Más de {cfg.automation.max_auto_party} → revisión manual.
            </p>
          </div>
        </SectionCard>

        {/* SECCIÓN 2 — REVISIÓN */}
        <SectionCard id="review" icon="👁" title="Casos que van a revisión" sub="Qué situaciones requieren que tú lo veas antes de confirmar" active={openSection==='review'} onClick={()=>toggleSection('review')}>
          <Toggle label="Grupos grandes" sub={`Más de ${cfg.automation.max_auto_party} personas — requiere revisión`} value={cfg.review.large_groups} onChange={v=>upCfg('review','large_groups',v)} color={C.amber}/>
          <Toggle label="Peticiones especiales" sub="El cliente menciona algo fuera de lo habitual" value={cfg.review.special_requests} onChange={v=>upCfg('review','special_requests',v)} color={C.amber}/>
          <Toggle label="Alergias mencionadas" sub="Si el cliente menciona alergias o intolerancias, va a revisión" value={cfg.review.allergies_mentioned} onChange={v=>upCfg('review','allergies_mentioned',v)} color={C.amber}/>
          <Toggle label="Horarios inusuales" sub="Reservas fuera del horario habitual de mayor demanda" value={cfg.review.unusual_hours} onChange={v=>upCfg('review','unusual_hours',v)} color={C.amber}/>
          <Toggle label="Clientes nuevos" sub="Primera vez que llama este número — requiere revisión" value={cfg.review.first_time_customers} onChange={v=>upCfg('review','first_time_customers',v)} color={C.amber}/>
        </SectionCard>

        {/* SECCIÓN 3 — RECHAZO */}
        <SectionCard id="rejection" icon="🚫" title="Cuándo decir NO" sub="Situaciones en que el agente no puede aceptar la solicitud" active={openSection==='rejection'} onClick={()=>toggleSection('rejection')}>
          <Toggle label="Fuera de horario" sub="Llamadas recibidas cuando el negocio está cerrado" value={cfg.rejection.out_of_hours} onChange={v=>upCfg('rejection','out_of_hours',v)} color={C.red}/>
          <Toggle label="Sin disponibilidad" sub="Cuando no hay mesas, sillones o huecos disponibles" value={cfg.rejection.no_availability} onChange={v=>upCfg('rejection','no_availability',v)} color={C.red}/>
          <Toggle label="Servicio no ofrecido" sub="Si el cliente pide algo que no está en tu catálogo" value={cfg.rejection.unknown_service} onChange={v=>upCfg('rejection','unknown_service',v)} color={C.red}/>
        </SectionCard>

        {/* SECCIÓN 4 — ALTERNATIVAS */}
        <SectionCard id="alternatives" icon="↩️" title="Qué ofrecer cuando no puede cumplir" sub="Comportamiento del agente cuando la primera opción no está disponible" active={openSection==='alternatives'} onClick={()=>toggleSection('alternatives')}>
          <Toggle label="Ofrecer otro horario" sub="Si la hora pedida no está libre, el agente propone alternativas" value={cfg.alternatives.offer_other_time} onChange={v=>upCfg('alternatives','offer_other_time',v)}/>
          <Toggle label="Dejar pendiente de confirmación" sub="Registrar la solicitud para que tú la gestiones más tarde" value={cfg.alternatives.leave_pending} onChange={v=>upCfg('alternatives','leave_pending',v)}/>
          <Toggle label="Lista de espera" sub="Ofrecer al cliente que le avises si se libera una plaza" value={cfg.alternatives.suggest_waitlist} onChange={v=>upCfg('alternatives','suggest_waitlist',v)}/>
          <Slider label="Máximo de alternativas a ofrecer" sub="Cuántas opciones distintas propone el agente antes de cerrar la llamada" value={cfg.alternatives.max_alternatives} min={1} max={5} unit="" onChange={v=>upCfg('alternatives','max_alternatives',v)}/>
        </SectionCard>


        {/* SECCIÓN 5 — CONOCIMIENTO */}
        <SectionCard id="knowledge" icon="🧠" title="Conocimiento del negocio" sub="Información real que el agente usa para responder preguntas" active={openSection==='knowledge'} onClick={()=>toggleSection('knowledge')}>
          <KArea label="Servicios / Menú" sub="Lista tus servicios, platos, precios. El agente lo usará para responder preguntas." placeholder={"Corte de pelo: 15€\nTinte completo: 45€\nManicura: 20€\n..."} value={cfg.knowledge.services} onChange={v=>upCfg('knowledge','services',v)}/>
          <KArea label="Condiciones y política" sub="Cancelaciones, reserva mínima, depósito, normas del negocio" placeholder={"Cancelación con 24h de antelación sin coste\nGrupos de más de 8 requieren señal\n..."} value={cfg.knowledge.conditions} onChange={v=>upCfg('knowledge','conditions',v)}/>
          <KArea label="Preguntas frecuentes" sub="Respuestas a lo que preguntan tus clientes más a menudo" placeholder={"¿Tenéis terraza? Sí, con capacidad para 20 personas\n¿Hay parking? Sí, en la calle lateral gratuito\n..."} value={cfg.knowledge.faqs} onChange={v=>upCfg('knowledge','faqs',v)}/>
          <div style={{background:C.tealDim,border:`1px solid ${C.teal}33`,borderRadius:10,padding:'10px 14px'}}>
            <p style={{fontSize:12,color:C.teal,fontWeight:600}}>💡 Cómo funciona</p>
            <p style={{fontSize:12,color:C.sub,marginTop:3,lineHeight:1.5}}>Esta información se inyecta al agente en cada llamada. Si un cliente pregunta "¿cuánto cuesta un corte?", el agente consultará aquí y responderá con el precio real.</p>
          </div>
        </SectionCard>

        {/* SECCIÓN 6 — FLUJO DE CONVERSACIÓN */}
        <SectionCard id="flow" icon="💬" title="Flujo de conversación" sub="Orden en que el agente pide la información al cliente" active={openSection==='flow'} onClick={()=>toggleSection('flow')}>
          <div>
            <p style={{fontSize:12,color:C.sub,marginBottom:12,lineHeight:1.5}}>El agente seguirá este orden al gestionar una solicitud. Arrastra para reordenar. Pulsa para activar/desactivar.</p>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:14}}>
              {cfg.conversation_flow.map((step,i)=>(
                <div key={step} className="flow-chip" style={{background:C.amberDim,border:`1px solid ${C.amber}44`,color:C.amber}}>
                  <span style={{fontSize:10,fontWeight:700,color:C.muted}}>{i+1}</span>
                  <span>{step}</span>
                  <button onClick={()=>setCfg(c=>({...c,conversation_flow:c.conversation_flow.filter(s=>s!==step)}))} style={{background:'none',border:'none',color:C.muted,cursor:'pointer',fontSize:12,padding:0,lineHeight:1}}>×</button>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {FLOW_OPTIONS.filter(o=>!cfg.conversation_flow.includes(o)).map(o=>(
                <button key={o} onClick={()=>setCfg(c=>({...c,conversation_flow:[...c.conversation_flow,o]}))} className="flow-chip" style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${C.border}`,color:C.muted}}>
                  + {o}
                </button>
              ))}
            </div>
          </div>
          <div style={{background:C.amberDim,border:`1px solid ${C.amber}33`,borderRadius:10,padding:'10px 14px'}}>
            <p style={{fontSize:12,color:C.amber,fontWeight:600}}>Flujo actual</p>
            <p style={{fontSize:13,color:C.text,marginTop:3,fontFamily:'monospace'}}>{cfg.conversation_flow.join(' → ')}</p>
          </div>
        </SectionCard>

        {/* SECCIÓN 7 — CASOS ESPECIALES */}
        <SectionCard id="special" icon="⚠️" title="Casos especiales" sub="Define qué hace el agente ante situaciones concretas" active={openSection==='special'} onClick={()=>toggleSection('special')}>
          {([['allergies','Alergias / intolerancias','Si el cliente menciona alergias o restricciones alimentarias'],['birthdays','Cumpleaños / celebraciones','Si el cliente menciona que es para una ocasión especial'],['events','Eventos / grupos especiales','Reservas para eventos, fiestas, reuniones de empresa'],['vip','Clientes VIP / frecuentes','Clientes con muchas visitas previas en el sistema']] as [keyof typeof DEFAULT.special_cases, string, string][]).map(([key,label,sub])=>(
            <div key={key} style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:16}}>
              <div style={{flex:1}}>
                <p style={{fontSize:13,fontWeight:600,color:C.text}}>{label}</p>
                <p style={{fontSize:11,color:C.muted,marginTop:2}}>{sub}</p>
              </div>
              <CaseBadge value={cfg.special_cases[key]} onChange={v=>upCfg('special_cases',key,v)}/>
            </div>
          ))}
          <div style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:10,padding:'12px 14px'}}>
            <p style={{fontSize:11,fontWeight:700,color:C.sub,marginBottom:8,letterSpacing:'0.04em'}}>LEYENDA</p>
            <div style={{display:'flex',gap:16}}>
              <span style={{fontSize:11,color:C.green}}>● Auto-confirmar — el agente lo gestiona solo</span>
              <span style={{fontSize:11,color:C.amber}}>● Revisar — va a tu panel para revisión</span>
              <span style={{fontSize:11,color:C.red}}>● Rechazar — el agente declina directamente</span>
            </div>
          </div>
        </SectionCard>

        <div style={{height:40}}/>
      </div>
    </div>
  )
}
