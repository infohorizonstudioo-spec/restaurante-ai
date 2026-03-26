'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

// ── COLORS ───────────────────────────────────────────────────────────────────
const C = {
  bg:'#0C1018',card:'#131920',card2:'#1A2230',border:'rgba(255,255,255,0.07)',
  text:'#E8EEF6',sub:'#8895A7',muted:'#49566A',amber:'#F0A84E',
  green:'#34D399',red:'#F87171',teal:'#2DD4BF',violet:'#A78BFA',blue:'#60A5FA',
  amberDim:'rgba(240,168,78,0.10)',greenDim:'rgba(52,211,153,0.10)',
  redDim:'rgba(248,113,113,0.10)',tealDim:'rgba(45,212,191,0.10)',
}

// ── BUSINESS TYPES ───────────────────────────────────────────────────────────
const BUSINESS_TYPES: {id:string;label:string;icon:string;desc:string}[] = [
  {id:'restaurante',label:'Restaurante',icon:'🍽️',desc:'Reservas de mesa, carta, pedidos'},
  {id:'bar',label:'Bar / Pub',icon:'🍸',desc:'Reservas, eventos, información'},
  {id:'cafeteria',label:'Cafetería',icon:'☕',desc:'Reservas, pedidos, información'},
  {id:'clinica_dental',label:'Clínica dental',icon:'🦷',desc:'Citas, tratamientos, urgencias'},
  {id:'clinica_medica',label:'Clínica médica',icon:'🩺',desc:'Consultas, especialidades'},
  {id:'veterinaria',label:'Veterinaria',icon:'🐾',desc:'Consultas, vacunas, urgencias'},
  {id:'peluqueria',label:'Peluquería',icon:'✂️',desc:'Citas, servicios, profesionales'},
  {id:'barberia',label:'Barbería',icon:'🪒',desc:'Citas, cortes, barba'},
  {id:'spa',label:'Spa / Centro estético',icon:'💆',desc:'Tratamientos, cabinas, circuitos'},
  {id:'fisioterapia',label:'Fisioterapia',icon:'🏋️',desc:'Sesiones, tratamientos'},
  {id:'psicologia',label:'Psicología',icon:'🧠',desc:'Sesiones, terapia'},
  {id:'asesoria',label:'Asesoría / Despacho',icon:'💼',desc:'Consultas, reuniones'},
  {id:'seguros',label:'Seguros',icon:'🛡️',desc:'Consultas, pólizas'},
  {id:'inmobiliaria',label:'Inmobiliaria',icon:'🏠',desc:'Visitas, gestión'},
  {id:'hotel',label:'Hotel',icon:'🏨',desc:'Reservas, habitaciones'},
  {id:'gimnasio',label:'Gimnasio',icon:'💪',desc:'Clases, reservas de espacio'},
  {id:'academia',label:'Academia',icon:'📚',desc:'Clases, inscripciones'},
  {id:'taller',label:'Taller mecánico',icon:'🔧',desc:'Citas, reparaciones'},
  {id:'ecommerce',label:'Ecommerce',icon:'🛒',desc:'Pedidos, envíos, atención'},
  {id:'otro',label:'Otro tipo',icon:'🏢',desc:'Configuración personalizada'},
]

// ── SERVICES BY TYPE ─────────────────────────────────────────────────────────
const SERVICES_MAP: Record<string,{id:string;label:string;icon:string}[]> = {
  restaurante: [{id:'reservas',label:'Reservas de mesa',icon:'📅'},{id:'pedidos',label:'Pedidos / Delivery',icon:'🛵'},{id:'informacion',label:'Información general',icon:'ℹ️'},{id:'cancelaciones',label:'Cancelaciones',icon:'❌'},{id:'eventos',label:'Eventos privados',icon:'🎉'},{id:'takeaway',label:'Para llevar',icon:'🥡'}],
  bar: [{id:'reservas',label:'Reservas',icon:'📅'},{id:'informacion',label:'Información',icon:'ℹ️'},{id:'eventos',label:'Eventos',icon:'🎉'},{id:'pedidos',label:'Pedidos barra',icon:'🍺'}],
  cafeteria: [{id:'reservas',label:'Reservas',icon:'📅'},{id:'pedidos',label:'Pedidos',icon:'☕'},{id:'informacion',label:'Información',icon:'ℹ️'},{id:'eventos',label:'Eventos',icon:'🎉'}],
  clinica_dental: [{id:'revision',label:'Revisión',icon:'🔍'},{id:'limpieza',label:'Limpieza dental',icon:'✨'},{id:'empaste',label:'Empaste',icon:'🦷'},{id:'extraccion',label:'Extracción',icon:'🔧'},{id:'ortodoncia',label:'Ortodoncia',icon:'😁'},{id:'implantes',label:'Implantes',icon:'🔩'},{id:'estetica',label:'Estética dental',icon:'💎'},{id:'endodoncia',label:'Endodoncia',icon:'🏥'}],
  clinica_medica: [{id:'medicina_general',label:'Medicina general',icon:'🩺'},{id:'pediatria',label:'Pediatría',icon:'👶'},{id:'ginecologia',label:'Ginecología',icon:'🩷'},{id:'traumatologia',label:'Traumatología',icon:'🦴'},{id:'cardiologia',label:'Cardiología',icon:'❤️'},{id:'dermatologia',label:'Dermatología',icon:'🧴'},{id:'nutricion',label:'Nutrición',icon:'🥗'},{id:'psicologia',label:'Psicología',icon:'🧠'}],
  veterinaria: [{id:'consulta',label:'Consulta general',icon:'🐾'},{id:'vacunas',label:'Vacunación',icon:'💉'},{id:'cirugia',label:'Cirugía',icon:'🏥'},{id:'peluqueria',label:'Peluquería canina',icon:'🐕'},{id:'radiografia',label:'Radiografía',icon:'📷'},{id:'hospitalizacion',label:'Hospitalización',icon:'🛏️'}],
  peluqueria: [{id:'corte_mujer',label:'Corte mujer',icon:'💇‍♀️'},{id:'corte_hombre',label:'Corte hombre',icon:'💇‍♂️'},{id:'tinte',label:'Tinte / Color',icon:'🎨'},{id:'mechas',label:'Mechas',icon:'✨'},{id:'alisado',label:'Alisado / Keratina',icon:'🪮'},{id:'peinado',label:'Peinado',icon:'💫'},{id:'manicura',label:'Manicura',icon:'💅'},{id:'tratamiento',label:'Tratamiento capilar',icon:'🧴'}],
  barberia: [{id:'corte_hombre',label:'Corte',icon:'💇‍♂️'},{id:'barba_perfilado',label:'Perfilado barba',icon:'🪒'},{id:'afeitado',label:'Afeitado clásico',icon:'🧔'},{id:'tinte_pelo',label:'Tinte',icon:'🎨'},{id:'barba_color',label:'Color barba',icon:'✨'},{id:'tratamiento',label:'Tratamiento',icon:'🧴'}],
  spa: [{id:'masaje',label:'Masaje',icon:'💆'},{id:'facial',label:'Tratamiento facial',icon:'✨'},{id:'corporal',label:'Tratamiento corporal',icon:'🧴'},{id:'circuito',label:'Circuito spa',icon:'🌊'},{id:'manicura',label:'Manicura / Pedicura',icon:'💅'},{id:'packs',label:'Packs especiales',icon:'🎁'}],
  fisioterapia: [{id:'manual',label:'Terapia manual',icon:'🤲'},{id:'deportiva',label:'Fisio deportiva',icon:'⚽'},{id:'traumatologica',label:'Traumatológica',icon:'🦴'},{id:'neurologica',label:'Neurológica',icon:'🧠'},{id:'suelo_pelvico',label:'Suelo pélvico',icon:'🩷'},{id:'puncion_seca',label:'Punción seca',icon:'📌'}],
  psicologia: [{id:'individual',label:'Terapia individual',icon:'🧠'},{id:'pareja',label:'Terapia de pareja',icon:'💑'},{id:'familiar',label:'Terapia familiar',icon:'👨‍👩‍👧'},{id:'infantil',label:'Infantojuvenil',icon:'👶'},{id:'ansiedad',label:'Ansiedad / Estrés',icon:'😰'},{id:'online',label:'Sesión online',icon:'💻'}],
  asesoria: [{id:'fiscal',label:'Fiscal / Tributario',icon:'📊'},{id:'laboral',label:'Laboral',icon:'👔'},{id:'contabilidad',label:'Contabilidad',icon:'🧮'},{id:'juridico',label:'Jurídico',icon:'⚖️'},{id:'mercantil',label:'Mercantil',icon:'🏢'},{id:'extranjeria',label:'Extranjería',icon:'🌍'}],
  hotel: [{id:'individual',label:'Habitación individual',icon:'🛏️'},{id:'doble',label:'Habitación doble',icon:'🛏️'},{id:'suite',label:'Suite',icon:'👑'},{id:'familiar',label:'Familiar',icon:'👨‍👩‍👧'},{id:'premium',label:'Premium',icon:'💎'},{id:'apartamento',label:'Apartamento',icon:'🏠'}],
  gimnasio: [{id:'sala_fitness',label:'Sala fitness',icon:'🏋️'},{id:'clases_dirigidas',label:'Clases dirigidas',icon:'🧘'},{id:'yoga',label:'Yoga / Pilates',icon:'🧘‍♀️'},{id:'crossfit',label:'CrossFit',icon:'💪'},{id:'natacion',label:'Natación',icon:'🏊'},{id:'personal_trainer',label:'Entrenador personal',icon:'🏃'}],
  academia: [{id:'idiomas',label:'Idiomas',icon:'🌍'},{id:'informatica',label:'Informática',icon:'💻'},{id:'oposiciones',label:'Oposiciones',icon:'📋'},{id:'refuerzo',label:'Refuerzo escolar',icon:'📖'},{id:'musica',label:'Música',icon:'🎵'},{id:'universidad',label:'Universidad',icon:'🎓'}],
  taller: [{id:'revision',label:'Revisión general',icon:'🔍'},{id:'aceite',label:'Cambio de aceite',icon:'🛢️'},{id:'neumaticos',label:'Neumáticos',icon:'🛞'},{id:'frenos',label:'Frenos',icon:'🛑'},{id:'electricidad',label:'Electricidad',icon:'⚡'},{id:'itv',label:'Pre-ITV',icon:'📋'}],
  seguros: [{id:'auto',label:'Auto',icon:'🚗'},{id:'hogar',label:'Hogar',icon:'🏠'},{id:'salud',label:'Salud',icon:'❤️'},{id:'vida',label:'Vida',icon:'🛡️'},{id:'negocio',label:'Negocio',icon:'🏢'},{id:'viaje',label:'Viaje',icon:'✈️'}],
  inmobiliaria: [{id:'venta',label:'Venta',icon:'🏠'},{id:'alquiler',label:'Alquiler',icon:'🔑'},{id:'vacacional',label:'Vacacional',icon:'🏖️'},{id:'tasaciones',label:'Tasaciones',icon:'📊'},{id:'obra_nueva',label:'Obra nueva',icon:'🏗️'},{id:'gestion',label:'Gestión patrimonial',icon:'💼'}],
  ecommerce: [{id:'estado_pedido',label:'Estado de pedido',icon:'📦'},{id:'productos',label:'Info productos',icon:'🛍️'},{id:'devoluciones',label:'Devoluciones',icon:'↩️'},{id:'pedidos_telefono',label:'Pedidos por teléfono',icon:'📞'},{id:'reclamaciones',label:'Reclamaciones',icon:'⚠️'},{id:'envios',label:'Envíos',icon:'🚚'}],
  otro: [{id:'citas',label:'Citas',icon:'📅'},{id:'informacion',label:'Información',icon:'ℹ️'},{id:'cancelaciones',label:'Cancelaciones',icon:'❌'},{id:'consultas',label:'Consultas',icon:'💬'}],
}

const TYPES_WITH_RESOURCES = ['restaurante','bar','cafeteria','clinica_dental','clinica_medica','peluqueria','barberia','spa','veterinaria','hotel','asesoria','academia','fisioterapia']

function getLabels(type:string) {
  const map: Record<string,{unit:string;units:string;zone:string;booking:string;client:string}> = {
    restaurante:{unit:'Mesa',units:'Mesas',zone:'Zona',booking:'Reserva',client:'Cliente'},
    bar:{unit:'Mesa',units:'Mesas',zone:'Zona',booking:'Reserva',client:'Cliente'},
    cafeteria:{unit:'Mesa',units:'Mesas',zone:'Zona',booking:'Reserva',client:'Cliente'},
    clinica_dental:{unit:'Gabinete',units:'Gabinetes',zone:'Planta',booking:'Cita',client:'Paciente'},
    clinica_medica:{unit:'Consulta',units:'Consultas',zone:'Planta',booking:'Cita',client:'Paciente'},
    veterinaria:{unit:'Consulta',units:'Consultas',zone:'Área',booking:'Cita',client:'Cliente'},
    peluqueria:{unit:'Sillón',units:'Sillones',zone:'Zona',booking:'Cita',client:'Cliente'},
    barberia:{unit:'Sillón',units:'Sillones',zone:'Zona',booking:'Cita',client:'Cliente'},
    spa:{unit:'Cabina',units:'Cabinas',zone:'Zona',booking:'Cita',client:'Cliente'},
    fisioterapia:{unit:'Box',units:'Boxes',zone:'Área',booking:'Cita',client:'Paciente'},
    psicologia:{unit:'Consulta',units:'Consultas',zone:'Área',booking:'Sesión',client:'Paciente'},
    hotel:{unit:'Habitación',units:'Habitaciones',zone:'Planta',booking:'Reserva',client:'Huésped'},
    asesoria:{unit:'Despacho',units:'Despachos',zone:'Planta',booking:'Cita',client:'Cliente'},
    gimnasio:{unit:'Sala',units:'Salas',zone:'Planta',booking:'Clase',client:'Socio'},
    academia:{unit:'Aula',units:'Aulas',zone:'Planta',booking:'Clase',client:'Alumno'},
    taller:{unit:'Puesto',units:'Puestos',zone:'Área',booking:'Cita',client:'Cliente'},
    seguros:{unit:'Despacho',units:'Despachos',zone:'Planta',booking:'Cita',client:'Cliente'},
    inmobiliaria:{unit:'Despacho',units:'Despachos',zone:'Planta',booking:'Visita',client:'Cliente'},
    ecommerce:{unit:'Espacio',units:'Espacios',zone:'Área',booking:'Pedido',client:'Cliente'},
    otro:{unit:'Espacio',units:'Espacios',zone:'Zona',booking:'Cita',client:'Cliente'},
  }
  return map[type] || map.otro
}

function getDurations(type:string): number[] {
  const map: Record<string,number[]> = {
    restaurante:[60,90,120,150,180],bar:[60,90,120],cafeteria:[30,60,90],
    clinica_dental:[15,30,45,60],clinica_medica:[10,15,20,30,45],
    veterinaria:[15,20,30,45],peluqueria:[30,45,60,90,120],barberia:[15,30,45,60],
    spa:[30,45,60,90,120],fisioterapia:[30,45,60,90],psicologia:[45,50,60,90],
    asesoria:[30,45,60,90,120],hotel:[1440],gimnasio:[45,60,90],
    academia:[45,60,90,120],taller:[60,120,180,240],
    seguros:[15,30,45,60],inmobiliaria:[30,45,60,90],ecommerce:[30],otro:[30,45,60],
  }
  return map[type] || [30,45,60]
}

function defaultDuration(type:string): number {
  const map: Record<string,number> = {
    restaurante:90,bar:90,cafeteria:60,clinica_dental:30,clinica_medica:20,
    veterinaria:20,peluqueria:45,barberia:30,spa:60,fisioterapia:45,psicologia:50,
    asesoria:60,hotel:1440,gimnasio:60,academia:60,taller:120,seguros:30,inmobiliaria:60,
    ecommerce:30,otro:45,
  }
  return map[type] || 45
}

// Steps
const STEPS = [
  {id:'welcome',label:'Bienvenida',icon:'👋'},
  {id:'type',label:'Tu negocio',icon:'🏢'},
  {id:'info',label:'Datos',icon:'📋'},
  {id:'describe',label:'Cuéntanos',icon:'💬'},
  {id:'hours',label:'Horarios',icon:'🕐'},
  {id:'services',label:'Servicios',icon:'⚙️'},
  {id:'rules',label:'Reglas',icon:'📐'},
  {id:'resources',label:'Espacios',icon:'🏗️'},
  {id:'channels',label:'Canales',icon:'📡'},
  {id:'notifications',label:'Avisos',icon:'🔔'},
  {id:'reminders',label:'Recordatorios',icon:'⏰'},
  {id:'agent',label:'Tu agente',icon:'🤖'},
  {id:'summary',label:'Resumen',icon:'📊'},
  {id:'activate',label:'Activar',icon:'🚀'},
]

const DEFAULT_HOURS: Record<string,{open:string;close:string;closed:boolean}> = {
  Lunes:{open:'09:00',close:'20:00',closed:false},Martes:{open:'09:00',close:'20:00',closed:false},
  Miércoles:{open:'09:00',close:'20:00',closed:false},Jueves:{open:'09:00',close:'20:00',closed:false},
  Viernes:{open:'09:00',close:'20:00',closed:false},Sábado:{open:'10:00',close:'14:00',closed:false},
  Domingo:{open:'10:00',close:'14:00',closed:true},
}
const DAYS = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']
const TIMES = Array.from({length:48},(_,i)=>{const h=Math.floor(i/2);const m=i%2===0?'00':'30';return `${String(h).padStart(2,'0')}:${m}`})

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
export default function OnboardingPage() {
  const router = useRouter()
  const [step,setStep] = useState(0)
  const [saving,setSaving] = useState(false)
  const [tid,setTid] = useState<string|null>(null)
  const autoSaveRef = useRef<ReturnType<typeof setTimeout>>()

  const [d, setD] = useState({
    business_type:'', business_name:'', phone:'', address:'', email:'',
    contact_person:'', language:'es',
    business_description:'', what_you_do:'', what_not_to_do:'', important_info:'',
    hours:{...DEFAULT_HOURS} as Record<string,{open:string;close:string;closed:boolean}>,
    services:[] as string[], appointment_duration:0, num_professionals:2,
    total_resources:0, has_urgencias:false,
    auto_confirm:true, max_auto_party:8, offer_alternatives:true,
    review_cases:['large_group'] as string[], cancellation_policy:'flexible',
    advance_booking_hours:2, max_advance_days:60,
    resource_names:[] as {name:string;capacity:number}[], zone_names:[] as string[],
    channels:['voice'] as string[], whatsapp_phone:'', email_channel:'',
    notify_new_booking:true, notify_cancellation:true, notify_urgency:true,
    notify_no_show:false, notify_channel:'in_app',
    reminders_enabled:true, reminder_intervals:['24h'] as string[],
    reminder_channel:'sms', send_confirmation:true,
    agent_name:'Sofía', agent_tone:'friendly', agent_autonomy:'balanced', agent_phone:'',
  })
  const up = useCallback((key:string,val:any) => setD(p=>({...p,[key]:val})),[])

  // Auth
  useEffect(()=>{
    (async()=>{
      const {data:{user}} = await supabase.auth.getUser()
      if(!user){router.push('/login');return}
      const {data:p} = await supabase.from('profiles').select('tenant_id').eq('id',user.id).maybeSingle()
      if(!p?.tenant_id){router.push('/registro');return}
      setTid(p.tenant_id)
      const {data:t} = await supabase.from('tenants').select('onboarding_complete,type,name,agent_name,language').eq('id',p.tenant_id).maybeSingle()
      if(t?.onboarding_complete){router.push('/panel');return}
      if(t?.type)up('business_type',t.type)
      if(t?.name)up('business_name',t.name)
      if(t?.agent_name)up('agent_name',t.agent_name)
      if(t?.language)up('language',t.language)
    })()
  },[router,up])

  // Auto-save draft
  useEffect(()=>{
    clearTimeout(autoSaveRef.current)
    autoSaveRef.current=setTimeout(()=>{
      if(typeof window!=='undefined')localStorage.setItem('reservo_onboarding_draft',JSON.stringify(d))
    },1000)
  },[d])

  // Load draft
  useEffect(()=>{
    try{const dr=localStorage.getItem('reservo_onboarding_draft');if(dr){const p=JSON.parse(dr);if(p.business_type)setD(prev=>({...prev,...p}))}}catch{}
  },[])

  // Default duration on type change
  useEffect(()=>{if(d.business_type)up('appointment_duration',defaultDuration(d.business_type))},[d.business_type,up])

  // Navigation
  const hasRes = TYPES_WITH_RESOURCES.includes(d.business_type)
  const activeSteps = STEPS.filter(s=>!(s.id==='resources'&&!hasRes))
  const cur = activeSteps[step]
  const total = activeSteps.length
  const progress = Math.round(((step+1)/total)*100)

  function canAdvance():boolean {
    switch(cur?.id){
      case 'type':return !!d.business_type
      case 'info':return !!d.business_name.trim()
      case 'services':return d.services.length>0
      default:return true
    }
  }
  function next(){if(step<total-1&&canAdvance())setStep(step+1)}
  function prev(){if(step>0)setStep(step-1)}

  // Submit
  async function activate(){
    if(!tid||saving)return; setSaving(true)
    try{
      const res=await fetch('/api/onboarding/complete',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({tenant_id:tid,...d,total_tables:d.total_resources||d.resource_names.length||undefined,reservation_duration:d.appointment_duration}),
      })
      if(res.ok){localStorage.removeItem('reservo_onboarding_draft');router.push('/panel')}
    }finally{setSaving(false)}
  }

  const L = d.business_type ? getLabels(d.business_type) : getLabels('otro')
  const lbl:React.CSSProperties = {fontSize:10,fontWeight:700,color:C.muted,letterSpacing:'0.06em',textTransform:'uppercase',display:'block',marginBottom:6}

  function Inp({label,value,onChange,placeholder,type='text',hint}:{label:string;value:string;onChange:(v:string)=>void;placeholder?:string;type?:string;hint?:string}){
    return(<div><label style={lbl}>{label}</label><input className="rz-inp" type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/>{hint&&<p style={{fontSize:10,color:C.muted,marginTop:3}}>{hint}</p>}</div>)
  }
  function Chips({options,selected,onToggle}:{options:{id:string;label:string;icon?:string}[];selected:string[];onToggle:(id:string)=>void}){
    return(<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>{options.map(o=>{const sel=selected.includes(o.id);return(<button key={o.id} onClick={()=>onToggle(o.id)} style={{display:'flex',alignItems:'center',gap:8,padding:'10px 12px',borderRadius:10,border:`1px solid ${sel?C.amber+'44':C.border}`,background:sel?C.amberDim:'rgba(255,255,255,0.02)',color:sel?C.amber:C.sub,cursor:'pointer',fontFamily:'inherit',fontSize:12,fontWeight:sel?700:500,textAlign:'left',transition:'all 0.15s'}}>{o.icon&&<span style={{fontSize:16}}>{o.icon}</span>}<span>{o.label}</span>{sel&&<span style={{marginLeft:'auto',fontSize:14}}>✓</span>}</button>)})}</div>)
  }
  function Toggle({label,hint,value,onChange}:{label:string;hint?:string;value:boolean;onChange:(v:boolean)=>void}){
    return(<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 0',borderBottom:`1px solid ${C.border}`}}><div><p style={{fontSize:13,fontWeight:600,color:C.text}}>{label}</p>{hint&&<p style={{fontSize:11,color:C.muted,marginTop:2}}>{hint}</p>}</div><button onClick={()=>onChange(!value)} style={{width:44,height:24,borderRadius:12,border:'none',cursor:'pointer',background:value?C.amber:'rgba(255,255,255,0.1)',position:'relative',transition:'background 0.2s',flexShrink:0}}><div style={{position:'absolute',top:2,left:value?20:2,width:20,height:20,borderRadius:'50%',background:'white',transition:'left 0.2s',boxShadow:'0 1px 4px rgba(0,0,0,0.3)'}}/></button></div>)
  }
  function NumStep({label,value,onChange,min=1,max=100,hint}:{label:string;value:number;onChange:(v:number)=>void;min?:number;max?:number;hint?:string}){
    return(<div><label style={lbl}>{label}</label><div style={{display:'flex',alignItems:'center',gap:10}}><button onClick={()=>onChange(Math.max(min,value-1))} style={{width:36,height:36,borderRadius:9,border:`1px solid ${C.border}`,background:'rgba(255,255,255,0.04)',color:C.sub,fontSize:18,cursor:'pointer',fontFamily:'inherit'}}>−</button><span style={{fontSize:22,fontWeight:800,color:C.amber,minWidth:40,textAlign:'center'}}>{value}</span><button onClick={()=>onChange(Math.min(max,value+1))} style={{width:36,height:36,borderRadius:9,border:`1px solid ${C.border}`,background:'rgba(255,255,255,0.04)',color:C.sub,fontSize:18,cursor:'pointer',fontFamily:'inherit'}}>+</button></div>{hint&&<p style={{fontSize:10,color:C.muted,marginTop:4}}>{hint}</p>}</div>)
  }
  function DurPick({value,onChange,options}:{value:number;onChange:(v:number)=>void;options:number[]}){
    return(<div style={{display:'flex',flexWrap:'wrap',gap:6}}>{options.map(dur=>(<button key={dur} onClick={()=>onChange(dur)} style={{padding:'8px 14px',borderRadius:8,fontSize:12,fontWeight:600,border:`1px solid ${value===dur?C.amber+'44':C.border}`,background:value===dur?C.amberDim:'transparent',color:value===dur?C.amber:C.sub,cursor:'pointer',fontFamily:'inherit'}}>{dur>=60?`${dur/60}h`:`${dur} min`}{dur===1440?' (día)':''}</button>))}</div>)
  }

  // ── RENDER STEP ────────────────────────────────────────────────────────────
  function renderStep(){switch(cur?.id){

  case 'welcome':return(<div style={{textAlign:'center',maxWidth:500,margin:'0 auto'}}><div style={{fontSize:64,marginBottom:16}}>🤖</div><h1 style={{fontSize:28,fontWeight:800,color:C.text,lineHeight:1.3}}>Vamos a crear tu<br/><span style={{color:C.amber}}>recepcionista virtual</span></h1><p style={{fontSize:15,color:C.sub,marginTop:16,lineHeight:1.6}}>En unos minutos tendrás todo listo para que tu negocio reciba llamadas, mensajes y reservas automáticamente.</p><div style={{marginTop:32,display:'flex',flexDirection:'column',gap:12,textAlign:'left',background:C.card2,borderRadius:14,padding:'20px 24px'}}>{['Solo te pediremos lo importante','Todo se guarda automáticamente','Puedes cambiar cualquier cosa después','En 10 minutos tendrás tu sistema listo'].map((t,i)=>(<div key={i} style={{display:'flex',alignItems:'center',gap:10}}><span style={{color:C.green,fontSize:16}}>✓</span><span style={{fontSize:13,color:C.text}}>{t}</span></div>))}</div></div>)

  case 'type':return(<div><h2 style={{fontSize:22,fontWeight:800,color:C.text,marginBottom:6}}>¿Qué tipo de negocio tienes?</h2><p style={{fontSize:13,color:C.sub,marginBottom:24}}>Esto adaptará todo el sistema a tu actividad</p><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(170px,1fr))',gap:10}}>{BUSINESS_TYPES.map(bt=>{const sel=d.business_type===bt.id;return(<button key={bt.id} onClick={()=>up('business_type',bt.id)} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6,padding:'16px 12px',borderRadius:12,cursor:'pointer',fontFamily:'inherit',border:`2px solid ${sel?C.amber:C.border}`,background:sel?C.amberDim:'rgba(255,255,255,0.02)',transition:'all 0.15s'}}><span style={{fontSize:28}}>{bt.icon}</span><span style={{fontSize:13,fontWeight:700,color:sel?C.amber:C.text}}>{bt.label}</span><span style={{fontSize:10,color:C.muted,textAlign:'center'}}>{bt.desc}</span></button>)})}</div></div>)

  case 'info':return(<div><h2 style={{fontSize:22,fontWeight:800,color:C.text,marginBottom:6}}>Datos de tu negocio</h2><p style={{fontSize:13,color:C.sub,marginBottom:24}}>Lo básico para que tu recepcionista sepa quién eres</p><div style={{display:'flex',flexDirection:'column',gap:16,maxWidth:500}}><Inp label="Nombre del negocio" value={d.business_name} onChange={v=>up('business_name',v)} placeholder="Ej: Restaurante La Tahona"/><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}><Inp label="Teléfono" value={d.phone} onChange={v=>up('phone',v)} placeholder="+34 612 345 678"/><Inp label="Email" value={d.email} onChange={v=>up('email',v)} placeholder="info@minegocio.com" type="email"/></div><Inp label="Dirección" value={d.address} onChange={v=>up('address',v)} placeholder="Calle Mayor 12, Madrid" hint="Opcional — útil para que el agente la diga"/><Inp label="Persona responsable" value={d.contact_person} onChange={v=>up('contact_person',v)} placeholder="Tu nombre" hint="¿A quién contactar si hay algo urgente?"/><div><label style={lbl}>Idioma principal</label><div style={{display:'flex',gap:8}}>{[{id:'es',l:'Español 🇪🇸'},{id:'ca',l:'Catalán'},{id:'eu',l:'Euskera'},{id:'en',l:'English 🇬🇧'}].map(lang=>(<button key={lang.id} onClick={()=>up('language',lang.id)} style={{padding:'8px 14px',borderRadius:8,fontSize:12,fontWeight:600,border:`1px solid ${d.language===lang.id?C.amber+'44':C.border}`,background:d.language===lang.id?C.amberDim:'transparent',color:d.language===lang.id?C.amber:C.sub,cursor:'pointer',fontFamily:'inherit'}}>{lang.l}</button>))}</div></div></div></div>)

  case 'describe':return(<div><h2 style={{fontSize:22,fontWeight:800,color:C.text,marginBottom:6}}>Cuéntanos sobre tu negocio</h2><p style={{fontSize:13,color:C.sub,marginBottom:4}}>Imagina que estás explicándole a un empleado nuevo cómo funciona todo</p><p style={{fontSize:12,color:C.amber,marginBottom:24}}>Esto es lo que tu recepcionista usará para responder a tus clientes</p><div style={{display:'flex',flexDirection:'column',gap:18,maxWidth:600}}><div><label style={lbl}>¿Qué hace tu negocio? ¿Qué ofreces?</label><textarea className="rz-inp" rows={4} value={d.business_description} onChange={e=>up('business_description',e.target.value)} placeholder={`Ej: Somos un ${BUSINESS_TYPES.find(b=>b.id===d.business_type)?.label.toLowerCase()||'negocio'} en el centro...`} style={{resize:'vertical'}}/></div><div><label style={lbl}>¿Qué es importante que sepa tu recepcionista?</label><textarea className="rz-inp" rows={3} value={d.important_info} onChange={e=>up('important_info',e.target.value)} placeholder="Ej: No aceptamos grupos de más de 12. Los viernes hay menú especial..." style={{resize:'vertical'}}/></div><div><label style={lbl}>¿Qué debe hacer o decir siempre?</label><textarea className="rz-inp" rows={3} value={d.what_you_do} onChange={e=>up('what_you_do',e.target.value)} placeholder="Ej: Siempre confirmar dirección. Ofrecer terraza si hay buen tiempo..." style={{resize:'vertical'}}/></div><div><label style={lbl}>¿Qué NO debe hacer o decir nunca?</label><textarea className="rz-inp" rows={2} value={d.what_not_to_do} onChange={e=>up('what_not_to_do',e.target.value)} placeholder="Ej: No dar precios por teléfono. No aceptar más de 20 personas..." style={{resize:'vertical'}}/></div></div></div>)

  case 'hours':return(<div><h2 style={{fontSize:22,fontWeight:800,color:C.text,marginBottom:6}}>Horario de tu negocio</h2><p style={{fontSize:13,color:C.sub,marginBottom:24}}>Tu recepcionista solo ofrecerá horas dentro de este horario</p><div style={{display:'flex',flexDirection:'column',gap:8,maxWidth:550}}>{DAYS.map(day=>{const h=d.hours[day]||{open:'09:00',close:'20:00',closed:false};return(<div key={day} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderRadius:10,background:h.closed?'rgba(255,255,255,0.02)':C.card2,border:`1px solid ${C.border}`,opacity:h.closed?0.5:1}}><span style={{fontSize:13,fontWeight:700,color:C.text,width:90}}>{day}</span><button onClick={()=>{const n={...d.hours};n[day]={...h,closed:!h.closed};up('hours',n)}} style={{padding:'4px 10px',borderRadius:6,fontSize:10,fontWeight:700,border:`1px solid ${h.closed?C.red+'33':C.green+'33'}`,background:h.closed?C.redDim:C.greenDim,color:h.closed?C.red:C.green,cursor:'pointer',fontFamily:'inherit'}}>{h.closed?'Cerrado':'Abierto'}</button>{!h.closed&&(<><select value={h.open} onChange={e=>{const n={...d.hours};n[day]={...h,open:e.target.value};up('hours',n)}} className="rz-inp" style={{width:80,padding:'4px 6px',fontSize:12,cursor:'pointer'}}>{TIMES.map(t=><option key={t} value={t}>{t}</option>)}</select><span style={{color:C.muted,fontSize:12}}>a</span><select value={h.close} onChange={e=>{const n={...d.hours};n[day]={...h,close:e.target.value};up('hours',n)}} className="rz-inp" style={{width:80,padding:'4px 6px',fontSize:12,cursor:'pointer'}}>{TIMES.map(t=><option key={t} value={t}>{t}</option>)}</select></>)}</div>)})}</div></div>)

  case 'services':return(<div><h2 style={{fontSize:22,fontWeight:800,color:C.text,marginBottom:6}}>¿Qué servicios ofreces?</h2><p style={{fontSize:13,color:C.sub,marginBottom:24}}>Selecciona todo lo que aplique</p><Chips options={SERVICES_MAP[d.business_type]||SERVICES_MAP.otro} selected={d.services} onToggle={id=>up('services',d.services.includes(id)?d.services.filter((s:string)=>s!==id):[...d.services,id])}/><div style={{marginTop:24,display:'flex',flexDirection:'column',gap:16,maxWidth:400}}><div><label style={lbl}>Duración habitual de cada {L.booking.toLowerCase()}</label><DurPick value={d.appointment_duration} onChange={v=>up('appointment_duration',v)} options={getDurations(d.business_type)}/></div><NumStep label="Profesionales / atención simultánea" value={d.num_professionals} onChange={v=>up('num_professionals',v)} min={1} max={100} hint="¿Cuántas personas atienden a la vez?"/>{['clinica_dental','clinica_medica','veterinaria','taller'].includes(d.business_type)&&(<Toggle label="¿Atiendes urgencias?" hint="El agente podrá dar prioridad a casos urgentes" value={d.has_urgencias} onChange={v=>up('has_urgencias',v)}/>)}</div></div>)

  case 'rules':return(<div><h2 style={{fontSize:22,fontWeight:800,color:C.text,marginBottom:6}}>¿Cómo quieres que funcione?</h2><p style={{fontSize:13,color:C.sub,marginBottom:24}}>Define las reglas de tu negocio en lenguaje sencillo</p><div style={{display:'flex',flexDirection:'column',gap:4,maxWidth:550}}><Toggle label={`¿Confirmar ${L.booking.toLowerCase()}s automáticamente?`} hint="Si está activado, el agente confirmará sin preguntarte" value={d.auto_confirm} onChange={v=>up('auto_confirm',v)}/>{d.auto_confirm&&['restaurante','bar','cafeteria','hotel'].includes(d.business_type)&&(<NumStep label="¿Hasta cuántas personas confirmar sin revisar?" value={d.max_auto_party} onChange={v=>up('max_auto_party',v)} min={1} max={50} hint="Grupos más grandes los revisarás tú"/>)}<Toggle label="¿Ofrecer alternativas si no hay hueco?" hint="El agente propondrá otra hora si la pedida no está disponible" value={d.offer_alternatives} onChange={v=>up('offer_alternatives',v)}/><div style={{padding:'14px 0'}}><label style={lbl}>¿Qué casos quieres revisar tú?</label><Chips options={[{id:'large_group',label:'Grupos grandes',icon:'👥'},{id:'special_occasion',label:'Ocasiones especiales',icon:'🎉'},{id:'first_visit',label:'Primera visita',icon:'👋'},{id:'vip',label:'Clientes VIP',icon:'⭐'},{id:'cancellation',label:'Cancelaciones',icon:'❌'}]} selected={d.review_cases} onToggle={id=>up('review_cases',d.review_cases.includes(id)?d.review_cases.filter((r:string)=>r!==id):[...d.review_cases,id])}/></div><div><label style={lbl}>Política de cancelación</label><div style={{display:'flex',gap:8}}>{[{id:'flexible',l:'Flexible',d:'Hasta 2h antes'},{id:'moderate',l:'Moderada',d:'Hasta 24h antes'},{id:'strict',l:'Estricta',d:'No se admiten'}].map(p=>(<button key={p.id} onClick={()=>up('cancellation_policy',p.id)} style={{flex:1,padding:'10px 8px',borderRadius:10,border:`1px solid ${d.cancellation_policy===p.id?C.amber+'44':C.border}`,background:d.cancellation_policy===p.id?C.amberDim:'transparent',color:d.cancellation_policy===p.id?C.amber:C.sub,cursor:'pointer',fontFamily:'inherit',textAlign:'center'}}><p style={{fontSize:12,fontWeight:700}}>{p.l}</p><p style={{fontSize:10,marginTop:3,opacity:0.7}}>{p.d}</p></button>))}</div></div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginTop:8}}><NumStep label="Antelación mínima (horas)" value={d.advance_booking_hours} onChange={v=>up('advance_booking_hours',v)} min={0} max={72}/><NumStep label="Máximo días de antelación" value={d.max_advance_days} onChange={v=>up('max_advance_days',v)} min={1} max={365}/></div></div></div>)

  case 'resources':return(<div><h2 style={{fontSize:22,fontWeight:800,color:C.text,marginBottom:6}}>Tus espacios y recursos</h2><p style={{fontSize:13,color:C.sub,marginBottom:4}}>Configura tus {L.units.toLowerCase()} para que el sistema sepa qué tienes</p><p style={{fontSize:11,color:C.amber,marginBottom:24}}>Podrás diseñar tu plano visual después en el editor de espacios</p><div style={{display:'flex',flexDirection:'column',gap:16,maxWidth:550}}><NumStep label={`¿Cuántos/as ${L.units.toLowerCase()} tienes?`} value={d.total_resources||d.resource_names.length||4} onChange={v=>{up('total_resources',v);const n=[...d.resource_names];while(n.length<v)n.push({name:`${L.unit} ${n.length+1}`,capacity:2});up('resource_names',n.slice(0,v))}} min={1} max={200}/>{(d.resource_names.length>0)&&(<div><label style={lbl}>Personaliza los nombres</label><div style={{display:'flex',flexDirection:'column',gap:6,maxHeight:300,overflow:'auto'}}>{d.resource_names.map((r,i)=>(<div key={i} style={{display:'flex',gap:8,alignItems:'center'}}><input className="rz-inp" value={r.name} onChange={e=>{const n=[...d.resource_names];n[i]={...n[i],name:e.target.value};up('resource_names',n)}} style={{flex:1}} placeholder={`${L.unit} ${i+1}`}/><div style={{display:'flex',alignItems:'center',gap:4}}><button onClick={()=>{const n=[...d.resource_names];n[i]={...n[i],capacity:Math.max(1,r.capacity-1)};up('resource_names',n)}} style={{width:28,height:28,borderRadius:6,border:`1px solid ${C.border}`,background:'transparent',color:C.sub,cursor:'pointer',fontSize:14}}>−</button><span style={{fontSize:13,fontWeight:700,color:C.amber,minWidth:20,textAlign:'center'}}>{r.capacity}</span><button onClick={()=>{const n=[...d.resource_names];n[i]={...n[i],capacity:Math.min(50,r.capacity+1)};up('resource_names',n)}} style={{width:28,height:28,borderRadius:6,border:`1px solid ${C.border}`,background:'transparent',color:C.sub,cursor:'pointer',fontSize:14}}>+</button><span style={{fontSize:10,color:C.muted}}>p</span></div></div>))}</div></div>)}<div><label style={lbl}>{L.zone}s (opcional)</label><p style={{fontSize:11,color:C.muted,marginBottom:8}}>Ej: Terraza, Interior, Planta 1...</p><div style={{display:'flex',flexWrap:'wrap',gap:6}}>{d.zone_names.map((z:string,i:number)=>(<div key={i} style={{display:'flex',alignItems:'center',gap:4,padding:'4px 10px',borderRadius:8,background:C.amberDim,border:`1px solid ${C.amber}33`}}><span style={{fontSize:12,color:C.amber}}>{z}</span><button onClick={()=>up('zone_names',d.zone_names.filter((_:any,j:number)=>j!==i))} style={{background:'none',border:'none',color:C.amber,cursor:'pointer',fontSize:12,padding:0}}>✕</button></div>))}<input className="rz-inp" placeholder={`+ Añadir ${L.zone.toLowerCase()}`} style={{width:160,padding:'4px 8px',fontSize:12}} onKeyDown={e=>{if(e.key==='Enter'&&(e.target as HTMLInputElement).value.trim()){up('zone_names',[...d.zone_names,(e.target as HTMLInputElement).value.trim()]);(e.target as HTMLInputElement).value=''}}}/></div></div></div></div>)

  case 'channels':return(<div><h2 style={{fontSize:22,fontWeight:800,color:C.text,marginBottom:6}}>Canales de atención</h2><p style={{fontSize:13,color:C.sub,marginBottom:24}}>¿Por dónde quieres que tu recepcionista atienda?</p><div style={{display:'flex',flexDirection:'column',gap:12,maxWidth:500}}>{[{id:'voice',label:'Llamadas telefónicas',icon:'📞',desc:'Tu recepcionista contestará al teléfono',always:true},{id:'whatsapp',label:'WhatsApp',icon:'💬',desc:'Responder mensajes de WhatsApp',always:false},{id:'email',label:'Email',icon:'📧',desc:'Responder correos electrónicos',always:false},{id:'sms',label:'SMS',icon:'📱',desc:'Enviar y recibir mensajes',always:false}].map(ch=>{const sel=d.channels.includes(ch.id);return(<div key={ch.id} style={{padding:'14px 16px',borderRadius:12,border:`1px solid ${sel?C.amber+'44':C.border}`,background:sel?C.amberDim:'rgba(255,255,255,0.02)',display:'flex',alignItems:'center',gap:12,cursor:'pointer'}} onClick={()=>{if(ch.always)return;up('channels',sel?d.channels.filter((c:string)=>c!==ch.id):[...d.channels,ch.id])}}><span style={{fontSize:24}}>{ch.icon}</span><div style={{flex:1}}><p style={{fontSize:14,fontWeight:700,color:sel?C.amber:C.text}}>{ch.label}</p><p style={{fontSize:11,color:C.muted}}>{ch.desc}</p></div>{ch.always?(<span style={{fontSize:10,fontWeight:700,color:C.green,background:C.greenDim,padding:'3px 8px',borderRadius:6}}>Incluido</span>):(<div style={{width:40,height:22,borderRadius:11,background:sel?C.amber:'rgba(255,255,255,0.1)',position:'relative',transition:'background 0.2s'}}><div style={{position:'absolute',top:2,left:sel?18:2,width:18,height:18,borderRadius:'50%',background:'white',transition:'left 0.2s',boxShadow:'0 1px 3px rgba(0,0,0,0.3)'}}/></div>)}</div>)})}</div></div>)

  case 'notifications':return(<div><h2 style={{fontSize:22,fontWeight:800,color:C.text,marginBottom:6}}>Avisos para ti</h2><p style={{fontSize:13,color:C.sub,marginBottom:24}}>¿De qué quieres que te avisemos?</p><div style={{display:'flex',flexDirection:'column',gap:2,maxWidth:500}}><Toggle label={`Nueva ${L.booking.toLowerCase()}`} hint="Cada vez que un cliente reserve" value={d.notify_new_booking} onChange={v=>up('notify_new_booking',v)}/><Toggle label="Cancelación" hint="Si alguien cancela" value={d.notify_cancellation} onChange={v=>up('notify_cancellation',v)}/><Toggle label="Caso urgente" hint="El agente detecta algo que necesita tu atención" value={d.notify_urgency} onChange={v=>up('notify_urgency',v)}/><Toggle label="No-show" hint="Si alguien no se presenta" value={d.notify_no_show} onChange={v=>up('notify_no_show',v)}/></div><div style={{marginTop:20}}><label style={lbl}>¿Cómo recibir los avisos?</label><div style={{display:'flex',gap:8}}>{[{id:'in_app',l:'En la app'},{id:'email',l:'Email'},{id:'sms',l:'SMS'},{id:'whatsapp',l:'WhatsApp'}].map(ch=>(<button key={ch.id} onClick={()=>up('notify_channel',ch.id)} style={{padding:'8px 16px',borderRadius:8,fontSize:12,fontWeight:600,border:`1px solid ${d.notify_channel===ch.id?C.amber+'44':C.border}`,background:d.notify_channel===ch.id?C.amberDim:'transparent',color:d.notify_channel===ch.id?C.amber:C.sub,cursor:'pointer',fontFamily:'inherit'}}>{ch.l}</button>))}</div></div></div>)

  case 'reminders':return(<div><h2 style={{fontSize:22,fontWeight:800,color:C.text,marginBottom:6}}>Recordatorios a tus {L.client.toLowerCase()}s</h2><p style={{fontSize:13,color:C.sub,marginBottom:24}}>Reduce los no-shows recordándoles su {L.booking.toLowerCase()}</p><div style={{display:'flex',flexDirection:'column',gap:4,maxWidth:500}}><Toggle label="Enviar recordatorios automáticos" hint="Se envían antes de la cita" value={d.reminders_enabled} onChange={v=>up('reminders_enabled',v)}/>{d.reminders_enabled&&(<><div style={{padding:'12px 0'}}><label style={lbl}>¿Cuándo recordar?</label><Chips options={[{id:'24h',label:'24 horas antes',icon:'📅'},{id:'2h',label:'2 horas antes',icon:'⏰'},{id:'30m',label:'30 minutos antes',icon:'🔔'},{id:'48h',label:'48 horas antes',icon:'📆'}]} selected={d.reminder_intervals} onToggle={id=>up('reminder_intervals',d.reminder_intervals.includes(id)?d.reminder_intervals.filter((r:string)=>r!==id):[...d.reminder_intervals,id])}/></div><div><label style={lbl}>Canal del recordatorio</label><div style={{display:'flex',gap:8}}>{[{id:'sms',l:'SMS'},{id:'whatsapp',l:'WhatsApp'},{id:'email',l:'Email'}].map(ch=>(<button key={ch.id} onClick={()=>up('reminder_channel',ch.id)} style={{padding:'8px 16px',borderRadius:8,fontSize:12,fontWeight:600,border:`1px solid ${d.reminder_channel===ch.id?C.amber+'44':C.border}`,background:d.reminder_channel===ch.id?C.amberDim:'transparent',color:d.reminder_channel===ch.id?C.amber:C.sub,cursor:'pointer',fontFamily:'inherit'}}>{ch.l}</button>))}</div></div><Toggle label="Enviar confirmación al reservar" hint="El cliente recibe mensaje confirmando" value={d.send_confirmation} onChange={v=>up('send_confirmation',v)}/></>)}</div></div>)

  case 'agent':return(<div><h2 style={{fontSize:22,fontWeight:800,color:C.text,marginBottom:6}}>Tu recepcionista virtual</h2><p style={{fontSize:13,color:C.sub,marginBottom:24}}>Dale personalidad. Esto cambia cómo habla y actúa</p><div style={{display:'flex',flexDirection:'column',gap:18,maxWidth:500}}><Inp label="¿Cómo se llama?" value={d.agent_name} onChange={v=>up('agent_name',v)} placeholder="Sofía" hint="El nombre que usará al contestar"/><div><label style={lbl}>Tono de comunicación</label><div style={{display:'flex',gap:8}}>{[{id:'friendly',l:'Cercano y cálido',e:'😊',d:'Como hablar con un amigo'},{id:'professional',l:'Profesional',e:'👔',d:'Serio pero amable'},{id:'direct',l:'Directo y eficiente',e:'⚡',d:'Al grano, sin rodeos'}].map(t=>(<button key={t.id} onClick={()=>up('agent_tone',t.id)} style={{flex:1,padding:'12px 10px',borderRadius:10,textAlign:'center',border:`2px solid ${d.agent_tone===t.id?C.amber:C.border}`,background:d.agent_tone===t.id?C.amberDim:'rgba(255,255,255,0.02)',cursor:'pointer',fontFamily:'inherit'}}><span style={{fontSize:24}}>{t.e}</span><p style={{fontSize:12,fontWeight:700,color:d.agent_tone===t.id?C.amber:C.text,marginTop:6}}>{t.l}</p><p style={{fontSize:10,color:C.muted,marginTop:3}}>{t.d}</p></button>))}</div></div><div><label style={lbl}>Nivel de autonomía</label><div style={{display:'flex',gap:8}}>{[{id:'cautious',l:'Prudente',e:'🛡️',d:'Consulta antes de decidir'},{id:'balanced',l:'Equilibrado',e:'⚖️',d:'Rutinario solo, consulta lo especial'},{id:'autonomous',l:'Autónomo',e:'🚀',d:'Gestiona casi todo solo'}].map(a=>(<button key={a.id} onClick={()=>up('agent_autonomy',a.id)} style={{flex:1,padding:'12px 10px',borderRadius:10,textAlign:'center',border:`2px solid ${d.agent_autonomy===a.id?C.amber:C.border}`,background:d.agent_autonomy===a.id?C.amberDim:'rgba(255,255,255,0.02)',cursor:'pointer',fontFamily:'inherit'}}><span style={{fontSize:24}}>{a.e}</span><p style={{fontSize:12,fontWeight:700,color:d.agent_autonomy===a.id?C.amber:C.text,marginTop:6}}>{a.l}</p><p style={{fontSize:10,color:C.muted,marginTop:3}}>{a.d}</p></button>))}</div></div></div></div>)

  case 'summary':{const bt=BUSINESS_TYPES.find(b=>b.id===d.business_type);const openDays=DAYS.filter(day=>!d.hours[day]?.closed);const svcL=(SERVICES_MAP[d.business_type]||[]).filter(s=>d.services.includes(s.id)).map(s=>s.label);return(<div><h2 style={{fontSize:22,fontWeight:800,color:C.text,marginBottom:6}}>Todo listo. Revisa antes de activar</h2><p style={{fontSize:13,color:C.sub,marginBottom:24}}>Puedes volver atrás para corregir cualquier cosa</p><div style={{display:'flex',flexDirection:'column',gap:10,maxWidth:600}}>{[{l:'Negocio',v:`${bt?.icon} ${d.business_name} (${bt?.label})`,s:1},{l:'Contacto',v:[d.phone,d.email].filter(Boolean).join(' · ')||'No configurado',s:2},{l:'Horario',v:`${openDays.length} días abierto`,s:4},{l:'Servicios',v:svcL.length?svcL.join(', '):'Ninguno',s:5},{l:'Duración',v:d.appointment_duration>=60?`${d.appointment_duration/60}h`:`${d.appointment_duration} min`,s:5},{l:'Confirmación',v:d.auto_confirm?'Automática':'Manual',s:6},...(hasRes?[{l:L.units,v:`${d.total_resources||d.resource_names.length||0} ${L.units.toLowerCase()}`,s:7}]:[]),{l:'Canales',v:d.channels.map((c:string)=>({voice:'📞',whatsapp:'💬',email:'📧',sms:'📱'}[c]||c)).join(' '),s:8},{l:'Recordatorios',v:d.reminders_enabled?d.reminder_intervals.join(', '):'Desactivados',s:10},{l:'Recepcionista',v:`${d.agent_name} · ${{friendly:'Cercano',professional:'Profesional',direct:'Directo'}[d.agent_tone]||d.agent_tone}`,s:11}].map((item,i)=>(<div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderRadius:10,background:C.card2,border:`1px solid ${C.border}`}}><div><p style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:'0.06em'}}>{item.l}</p><p style={{fontSize:13,color:C.text,marginTop:2}}>{item.v}</p></div><button onClick={()=>setStep(item.s)} style={{padding:'4px 10px',fontSize:10,borderRadius:6,border:`1px solid ${C.border}`,background:'transparent',color:C.sub,cursor:'pointer',fontFamily:'inherit'}}>Editar</button></div>))}</div></div>)}

  case 'activate':return(<div style={{textAlign:'center',maxWidth:500,margin:'0 auto'}}><div style={{fontSize:64,marginBottom:16}}>🚀</div><h1 style={{fontSize:28,fontWeight:800,color:C.text,lineHeight:1.3}}>¡Tu recepcionista <span style={{color:C.amber}}>{d.agent_name}</span> está lista!</h1><p style={{fontSize:15,color:C.sub,marginTop:16,lineHeight:1.6}}>Al activar, tu negocio empezará a recibir {L.booking.toLowerCase()}s automáticamente.</p><div style={{marginTop:32,display:'flex',flexDirection:'column',gap:12,textAlign:'left',background:C.card2,borderRadius:14,padding:'20px 24px'}}>{[`${d.agent_name} atenderá tus llamadas`,`Gestionará ${L.booking.toLowerCase()}s automáticamente`,d.reminders_enabled?`Enviará recordatorios a tus ${L.client.toLowerCase()}s`:null,d.channels.length>1?`Atenderá por ${d.channels.length} canales`:null,'Puedes cambiar todo después'].filter(Boolean).map((t,i)=>(<div key={i} style={{display:'flex',alignItems:'center',gap:10}}><span style={{color:C.green,fontSize:16}}>✓</span><span style={{fontSize:13,color:C.text}}>{t}</span></div>))}</div><button onClick={activate} disabled={saving} style={{marginTop:32,padding:'16px 48px',fontSize:16,fontWeight:800,background:saving?C.muted:`linear-gradient(135deg,${C.amber},#E8923A)`,color:saving?C.sub:'#0C1018',border:'none',borderRadius:14,cursor:saving?'wait':'pointer',fontFamily:'inherit',boxShadow:saving?'none':'0 4px 20px rgba(240,168,78,0.3)',transition:'all 0.2s'}}>{saving?'⏳ Activando...':'🚀 Activar recepcionista'}</button><p style={{fontSize:11,color:C.muted,marginTop:12}}>Puedes pausar o desactivar en cualquier momento</p></div>)

  default:return null}}

  // ── MAIN RENDER ────────────────────────────────────────────────────────────
  return(
    <div style={{background:C.bg,minHeight:'100vh',fontFamily:"'Sora',-apple-system,sans-serif",display:'flex',flexDirection:'column'}}>
      <style>{`.rz-inp{background:rgba(255,255,255,0.04);border:1px solid ${C.border};border-radius:10px;padding:10px 12px;color:${C.text};font-size:13px;font-family:inherit;outline:none;width:100%;transition:border-color 0.15s}.rz-inp:focus{border-color:${C.amber}!important}.rz-inp::placeholder{color:${C.muted}}textarea.rz-inp{line-height:1.5}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:3px}`}</style>

      {/* TOP BAR */}
      <div style={{background:C.card,borderBottom:`1px solid ${C.border}`,padding:'12px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}><span style={{fontSize:20,fontWeight:800,color:C.amber}}>RESERVO</span><span style={{fontSize:11,color:C.muted}}>Configuración inicial</span></div>
        <div style={{display:'flex',alignItems:'center',gap:12}}><span style={{fontSize:11,color:C.muted}}>Paso {step+1} de {total}</span><span style={{fontSize:11,fontWeight:700,color:C.amber}}>{progress}%</span></div>
      </div>

      {/* PROGRESS BAR */}
      <div style={{height:3,background:'rgba(255,255,255,0.04)'}}><div style={{height:'100%',width:`${progress}%`,background:`linear-gradient(90deg,${C.amber},#E8923A)`,transition:'width 0.4s ease',borderRadius:2}}/></div>

      {/* STEP INDICATORS */}
      <div style={{padding:'12px 24px',background:C.card,borderBottom:`1px solid ${C.border}`,overflowX:'auto',flexShrink:0}}>
        <div style={{display:'flex',gap:4,minWidth:'max-content'}}>
          {activeSteps.map((s,i)=>{const done=i<step;const current=i===step;return(<button key={s.id} onClick={()=>{if(i<=step)setStep(i)}} style={{display:'flex',alignItems:'center',gap:4,padding:'4px 10px',borderRadius:7,fontSize:10,fontWeight:600,border:`1px solid ${current?C.amber+'44':done?C.green+'22':C.border}`,background:current?C.amberDim:done?C.greenDim:'transparent',color:current?C.amber:done?C.green:C.muted,cursor:i<=step?'pointer':'default',fontFamily:'inherit',opacity:i>step?0.4:1,transition:'all 0.15s',whiteSpace:'nowrap'}}><span>{done?'✓':s.icon}</span><span>{s.label}</span></button>)})}
        </div>
      </div>

      {/* CONTENT */}
      <div style={{flex:1,overflow:'auto',padding:'32px 24px'}}><div style={{maxWidth:700,margin:'0 auto'}}>{renderStep()}</div></div>

      {/* FOOTER NAV */}
      {cur?.id!=='activate'&&(
        <div style={{background:C.card,borderTop:`1px solid ${C.border}`,padding:'12px 24px',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
          <button onClick={prev} disabled={step===0} style={{padding:'10px 24px',fontSize:13,fontWeight:600,borderRadius:10,border:`1px solid ${C.border}`,background:'transparent',color:step===0?C.muted:C.sub,cursor:step===0?'default':'pointer',fontFamily:'inherit',opacity:step===0?0.3:1}}>← Anterior</button>
          <p style={{fontSize:10,color:C.green}}>✓ Guardado automático</p>
          <button onClick={next} disabled={!canAdvance()} style={{padding:'10px 28px',fontSize:13,fontWeight:700,borderRadius:10,background:canAdvance()?`linear-gradient(135deg,${C.amber},#E8923A)`:'rgba(255,255,255,0.06)',color:canAdvance()?'#0C1018':C.muted,border:'none',cursor:canAdvance()?'pointer':'not-allowed',fontFamily:'inherit'}}>Siguiente →</button>
        </div>
      )}
    </div>
  )
}
