'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// ── Paleta ───────────────────────────────────────────────────────────────────
const C = {
  bg:'#0C1018', card:'#131920', card2:'#161D2A', border:'rgba(255,255,255,0.08)',
  text:'#E8EEF6', sub:'#8895A7', muted:'#49566A', amber:'#F0A84E',
  green:'#34D399', red:'#F87171', teal:'#2DD4BF', violet:'#A78BFA',
  amberDim:'rgba(240,168,78,0.12)', greenDim:'rgba(52,211,153,0.10)',
}

// ── Definición de flujos por tipo de negocio ─────────────────────────────────
const DAYS = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']

interface FlowConfig {
  emoji: string
  label: string
  agentDefaultName: string
  steps: StepConfig[]
}
interface StepConfig {
  id: string
  title: string
  subtitle: string
  fields: FieldConfig[]
}
interface FieldConfig {
  key: string
  type: 'text'|'number'|'select'|'multiselect'|'toggle'|'duration'|'hours'|'chips'
  label: string
  hint?: string
  placeholder?: string
  options?: {value:string;label:string;emoji?:string}[]
  defaultValue?: any
  min?: number; max?: number
}

const FLOWS: Record<string, FlowConfig> = {
  restaurante: {
    emoji:'🍽️', label:'Restaurante / Bar', agentDefaultName:'Sofía',
    steps: [
      {
        id:'agent', title:'¿Cómo se llamará tu recepcionista?',
        subtitle:'Es el nombre que escucharán tus clientes al llamar',
        fields: [
          {key:'agent_name', type:'text', label:'Nombre de la recepcionista', placeholder:'Ej: Sofía, Carmen, Lucía…', defaultValue:'Sofía'},
          {key:'language', type:'select', label:'¿En qué idioma habla?', defaultValue:'es',
            options:[{value:'es',label:'Español'},{value:'ca',label:'Català'},{value:'eu',label:'Euskera'},{value:'en',label:'English'}]},
        ]
      },
      {
        id:'hours', title:'¿Cuándo estáis abiertos?',
        subtitle:'Tu recepcionista avisará a los clientes si llaman fuera de horario',
        fields: [{key:'business_hours', type:'hours', label:'Horario semanal', defaultValue:null}]
      },
      {
        id:'capacity', title:'¿Cuántas mesas tenéis?',
        subtitle:'Así sabrá cuándo hay sitio disponible',
        fields: [
          {key:'total_tables', type:'number', label:'Número de mesas', placeholder:'Ej: 15', defaultValue:10, min:1, max:200},
          {key:'table_capacity', type:'number', label:'¿Cuántas personas caben por mesa de media?', placeholder:'Ej: 4', defaultValue:4, min:2, max:20},
          {key:'max_group', type:'number', label:'¿Cuál es el grupo más grande que podéis atender?', placeholder:'Ej: 20', defaultValue:12, min:2, max:100},
          {key:'reservation_duration', type:'duration', label:'¿Cuánto dura de media una comida o cena?', defaultValue:90,
            options:[{value:'60',label:'1 hora'},{value:'90',label:'1h 30min'},{value:'120',label:'2 horas'},{value:'150',label:'2h 30min'},{value:'180',label:'3 horas'}]},
        ]
      },
      {
        id:'services', title:'¿Qué servicios queréis gestionar por teléfono?',
        subtitle:'Marca todo lo que tu recepcionista debe ser capaz de gestionar',
        fields: [
          {key:'services', type:'multiselect', label:'Servicios', defaultValue:['reservas'],
            options:[
              {value:'reservas',label:'Reservas de mesa',emoji:'📅'},
              {value:'pedidos',label:'Pedidos para llevar',emoji:'📦'},
              {value:'informacion',label:'Preguntas sobre el menú y horario',emoji:'❓'},
              {value:'cancelaciones',label:'Cancelaciones de reserva',emoji:'✕'},
            ]
          },
        ]
      }
    ]
  },

  bar: {
    emoji:'🍺', label:'Bar / Cafetería', agentDefaultName:'Sofía',
    steps: [
      {
        id:'agent', title:'¿Cómo se llamará tu recepcionista?',
        subtitle:'Es el nombre que escucharán tus clientes al llamar',
        fields: [
          {key:'agent_name', type:'text', label:'Nombre de la recepcionista', placeholder:'Ej: Sofía, Carmen…', defaultValue:'Sofía'},
          {key:'language', type:'select', label:'Idioma', defaultValue:'es',
            options:[{value:'es',label:'Español'},{value:'ca',label:'Català'},{value:'eu',label:'Euskera'},{value:'en',label:'English'}]},
        ]
      },
      {
        id:'hours', title:'¿Cuándo estáis abiertos?', subtitle:'Horario de atención al cliente',
        fields: [{key:'business_hours', type:'hours', label:'Horario semanal', defaultValue:null}]
      },
      {
        id:'services', title:'¿Qué gestionáis por teléfono?',
        subtitle:'Tu recepcionista se centrará en esto',
        fields: [
          {key:'services', type:'multiselect', label:'Servicios', defaultValue:['informacion'],
            options:[
              {value:'reservas',label:'Reservar mesas o reservados',emoji:'📅'},
              {value:'pedidos',label:'Pedidos para llevar',emoji:'📦'},
              {value:'informacion',label:'Preguntas sobre carta y horario',emoji:'❓'},
              {value:'eventos',label:'Reservar para eventos privados',emoji:'🎉'},
            ]
          }
        ]
      }
    ]
  },

  clinica_dental: {
    emoji:'🦷', label:'Clínica Dental', agentDefaultName:'Sara',
    steps: [
      {
        id:'agent', title:'¿Cómo se llamará tu recepcionista?',
        subtitle:'Es quien atenderá las llamadas de tus pacientes',
        fields: [
          {key:'agent_name', type:'text', label:'Nombre de la recepcionista', placeholder:'Ej: Sara, Ana, Laura…', defaultValue:'Sara'},
          {key:'language', type:'select', label:'Idioma', defaultValue:'es',
            options:[{value:'es',label:'Español'},{value:'ca',label:'Català'},{value:'eu',label:'Euskera'},{value:'en',label:'English'}]},
        ]
      },
      {
        id:'hours', title:'¿Cuándo atiende la clínica?', subtitle:'La recepcionista informará a los pacientes que llamen fuera de horario',
        fields: [{key:'business_hours', type:'hours', label:'Horario de la clínica', defaultValue:null}]
      },
      {
        id:'consultations', title:'¿Qué tipo de tratamientos ofrecéis?',
        subtitle:'Solo marcad los principales — el paciente podrá preguntar por cualquier cosa',
        fields: [
          {key:'services', type:'multiselect', label:'Tratamientos principales', defaultValue:['limpieza','empaste'],
            options:[
              {value:'revision',label:'Revisión y diagnóstico',emoji:'🔍'},
              {value:'limpieza',label:'Limpieza dental',emoji:'✨'},
              {value:'empaste',label:'Empastes y obturaciones',emoji:'🦷'},
              {value:'extraccion',label:'Extracciones',emoji:'⚕️'},
              {value:'ortodoncia',label:'Ortodoncia / Brackets',emoji:'😁'},
              {value:'implantes',label:'Implantes',emoji:'🔩'},
              {value:'estetica',label:'Estética dental / Blanqueamiento',emoji:'⭐'},
              {value:'endodoncia',label:'Endodoncia / Nervio',emoji:'💊'},
            ]
          }
        ]
      },
      {
        id:'appointments', title:'¿Cómo son las citas?',
        subtitle:'Esto ayuda a la recepcionista a gestionar mejor los tiempos',
        fields: [
          {key:'appointment_duration', type:'duration', label:'¿Cuánto dura una visita normal?', defaultValue:30,
            options:[{value:'15',label:'15 minutos'},{value:'30',label:'30 minutos'},{value:'45',label:'45 minutos'},{value:'60',label:'1 hora'},{value:'90',label:'1h 30min'}]},
          {key:'has_urgencias', type:'toggle', label:'¿Atendéis urgencias dentales?',
            hint:'Si es así, la recepcionista dará prioridad a los pacientes con dolor', defaultValue:false},
          {key:'num_dentists', type:'number', label:'¿Cuántos dentistas trabajan en la clínica?', placeholder:'Ej: 3', defaultValue:2, min:1, max:50},
        ]
      }
    ]
  },

  clinica_medica: {
    emoji:'🏥', label:'Clínica Médica', agentDefaultName:'Elena',
    steps: [
      {
        id:'agent', title:'¿Cómo se llamará tu recepcionista?', subtitle:'El nombre que oirán tus pacientes al llamar',
        fields: [
          {key:'agent_name', type:'text', label:'Nombre de la recepcionista', placeholder:'Ej: Elena, Marta…', defaultValue:'Elena'},
          {key:'language', type:'select', label:'Idioma', defaultValue:'es',
            options:[{value:'es',label:'Español'},{value:'ca',label:'Català'},{value:'eu',label:'Euskera'},{value:'en',label:'English'}]},
        ]
      },
      {
        id:'hours', title:'¿Cuándo atiende la clínica?', subtitle:'Horario de atención',
        fields: [{key:'business_hours', type:'hours', label:'Horario', defaultValue:null}]
      },
      {
        id:'specialties', title:'¿Qué especialidades tenéis?',
        subtitle:'Marca las que ofrece vuestra clínica',
        fields: [
          {key:'services', type:'multiselect', label:'Especialidades', defaultValue:['medicina_general'],
            options:[
              {value:'medicina_general',label:'Medicina general / Médico de cabecera',emoji:'👨‍⚕️'},
              {value:'pediatria',label:'Pediatría',emoji:'👶'},
              {value:'ginecologia',label:'Ginecología',emoji:'⚕️'},
              {value:'traumatologia',label:'Traumatología / Huesos',emoji:'🦴'},
              {value:'cardiologia',label:'Cardiología',emoji:'❤️'},
              {value:'dermatologia',label:'Dermatología',emoji:'🔬'},
              {value:'nutricion',label:'Nutrición y dietética',emoji:'🥗'},
              {value:'psicologia',label:'Psicología',emoji:'🧠'},
            ]
          }
        ]
      },
      {
        id:'appointments', title:'¿Cómo son las consultas?',
        subtitle:'Para gestionar bien los tiempos',
        fields: [
          {key:'appointment_duration', type:'duration', label:'Duración media de una consulta', defaultValue:20,
            options:[{value:'10',label:'10 minutos'},{value:'15',label:'15 minutos'},{value:'20',label:'20 minutos'},{value:'30',label:'30 minutos'},{value:'45',label:'45 minutos'}]},
          {key:'has_urgencias', type:'toggle', label:'¿Atendéis urgencias?',
            hint:'La recepcionista priorizará los casos urgentes', defaultValue:false},
          {key:'num_professionals', type:'number', label:'¿Cuántos médicos o especialistas hay?', placeholder:'Ej: 4', defaultValue:2, min:1, max:100},
        ]
      }
    ]
  },

  peluqueria: {
    emoji:'✂️', label:'Peluquería / Barbería', agentDefaultName:'Marta',
    steps: [
      {
        id:'salon_tipo', title:'¿Qué tipo de salón tenéis?',
        subtitle:'Los servicios que verás a continuación dependen de esto',
        fields: [
          {key:'salon_tipo', type:'select', label:'Tipo de salón', defaultValue:'peluqueria',
            options:[
              {value:'peluqueria', label:'✂️ Peluquería'},
              {value:'barberia',   label:'🪒 Barbería'},
              {value:'ambos',      label:'✂️🪒 Peluquería y Barbería'},
            ]
          }
        ]
      },
      {
        id:'agent', title:'¿Cómo se llamará tu recepcionista?', subtitle:'El nombre que escucharán tus clientes',
        fields: [
          {key:'agent_name', type:'text', label:'Nombre de la recepcionista', placeholder:'Ej: Marta, Carlos, Paula…', defaultValue:'Marta'},
          {key:'language', type:'select', label:'Idioma', defaultValue:'es',
            options:[{value:'es',label:'Español'},{value:'ca',label:'Català'},{value:'eu',label:'Euskera'},{value:'en',label:'English'}]},
        ]
      },
      {
        id:'hours', title:'¿Cuándo abrís?', subtitle:'Horario del salón',
        fields: [{key:'business_hours', type:'hours', label:'Horario', defaultValue:null}]
      },
      {
        // Opciones dinámicas — se calculan en runtime según answers.salon_tipo
        id:'services', title:'¿Qué servicios ofrecéis?',
        subtitle:'Marca los que hacéis — la recepcionista los conocerá todos',
        fields: [
          {key:'services', type:'multiselect', label:'Servicios', defaultValue:['corte'],
            options:[] // placeholder — se sobrescribe dinámicamente en el render
          }
        ]
      },
      {
        id:'staff', title:'¿Cuántos profesionales tenéis?',
        subtitle:'La recepcionista distribuirá las citas entre ellos',
        fields: [
          {key:'num_professionals', type:'number', label:'Número de profesionales con agenda propia', placeholder:'Ej: 3', defaultValue:2, min:1, max:50},
          {key:'appointment_duration', type:'duration', label:'¿Cuánto dura de media una cita?', defaultValue:60,
            options:[{value:'30',label:'30 minutos'},{value:'45',label:'45 minutos'},{value:'60',label:'1 hora'},{value:'90',label:'1h 30min'},{value:'120',label:'2 horas'}]},
        ]
      }
    ]
  },

  veterinaria: {
    emoji:'🐾', label:'Clínica Veterinaria', agentDefaultName:'Nuria',
    steps: [
      {
        id:'agent', title:'¿Cómo se llamará tu recepcionista?', subtitle:'El nombre que oirán los dueños de mascotas',
        fields: [
          {key:'agent_name', type:'text', label:'Nombre de la recepcionista', placeholder:'Ej: Nuria, Clara…', defaultValue:'Nuria'},
          {key:'language', type:'select', label:'Idioma', defaultValue:'es',
            options:[{value:'es',label:'Español'},{value:'ca',label:'Català'},{value:'eu',label:'Euskera'},{value:'en',label:'English'}]},
        ]
      },
      {
        id:'hours', title:'¿Cuándo estáis abiertos?', subtitle:'Horario de la clínica',
        fields: [{key:'business_hours', type:'hours', label:'Horario', defaultValue:null}]
      },
      {
        id:'services', title:'¿Qué servicios ofrecéis?',
        subtitle:'La recepcionista sabrá qué puede y qué no puede gestionar',
        fields: [
          {key:'services', type:'multiselect', label:'Servicios', defaultValue:['consulta','vacunas'],
            options:[
              {value:'consulta',label:'Consulta general',emoji:'🩺'},
              {value:'vacunas',label:'Vacunas y desparasitación',emoji:'💉'},
              {value:'cirugia',label:'Cirugía',emoji:'⚕️'},
              {value:'peluqueria',label:'Peluquería canina / felina',emoji:'✂️'},
              {value:'radiografia',label:'Radiografías / Ecografías',emoji:'🔬'},
              {value:'dentadura',label:'Limpieza dental veterinaria',emoji:'🦷'},
              {value:'hospitalizacion',label:'Hospitalización',emoji:'🏥'},
            ]
          }
        ]
      },
      {
        id:'details', title:'Un par de preguntas más',
        subtitle:'Para que la recepcionista pueda atender mejor',
        fields: [
          {key:'has_urgencias', type:'toggle', label:'¿Atendéis urgencias veterinarias?',
            hint:'La recepcionista dará instrucciones específicas en casos de emergencia', defaultValue:true},
          {key:'animal_types', type:'multiselect', label:'¿Qué animales atendéis?', defaultValue:['perros','gatos'],
            options:[
              {value:'perros',label:'Perros',emoji:'🐕'},
              {value:'gatos',label:'Gatos',emoji:'🐈'},
              {value:'aves',label:'Aves / Pájaros',emoji:'🦜'},
              {value:'roedores',label:'Conejos y roedores',emoji:'🐰'},
              {value:'reptiles',label:'Reptiles',emoji:'🦎'},
              {value:'exoticos',label:'Animales exóticos',emoji:'🦔'},
            ]
          },
          {key:'appointment_duration', type:'duration', label:'¿Cuánto dura una consulta normal?', defaultValue:20,
            options:[{value:'15',label:'15 minutos'},{value:'20',label:'20 minutos'},{value:'30',label:'30 minutos'},{value:'45',label:'45 minutos'}]},
        ]
      }
    ]
  },

  asesoria: {
    emoji:'💼', label:'Asesoría / Consultoría', agentDefaultName:'Isabel',
    steps: [
      {
        id:'agent', title:'¿Cómo se llamará tu recepcionista?', subtitle:'El nombre que oirán tus clientes',
        fields: [
          {key:'agent_name', type:'text', label:'Nombre de la recepcionista', placeholder:'Ej: Isabel, Carmen…', defaultValue:'Isabel'},
          {key:'language', type:'select', label:'Idioma', defaultValue:'es',
            options:[{value:'es',label:'Español'},{value:'ca',label:'Català'},{value:'eu',label:'Euskera'},{value:'en',label:'English'}]},
        ]
      },
      {
        id:'hours', title:'¿Cuándo atendéis?', subtitle:'Horario de la asesoría',
        fields: [{key:'business_hours', type:'hours', label:'Horario', defaultValue:null}]
      },
      {
        id:'services', title:'¿En qué especialidades trabajáis?',
        subtitle:'La recepcionista informará a los clientes sobre lo que podéis ayudarles',
        fields: [
          {key:'services', type:'multiselect', label:'Especialidades', defaultValue:['fiscal'],
            options:[
              {value:'fiscal',label:'Fiscal y tributario (IRPF, IVA…)',emoji:'📊'},
              {value:'laboral',label:'Laboral (nóminas, contratos…)',emoji:'👷'},
              {value:'contabilidad',label:'Contabilidad y balances',emoji:'📚'},
              {value:'juridico',label:'Asesoría jurídica / Legal',emoji:'⚖️'},
              {value:'mercantil',label:'Constitución de empresas',emoji:'🏢'},
              {value:'extranjeria',label:'Extranjería y visados',emoji:'🌍'},
              {value:'herencias',label:'Herencias y sucesiones',emoji:'📜'},
            ]
          }
        ]
      },
      {
        id:'meetings', title:'¿Cómo son las reuniones con clientes?',
        subtitle:'Para gestionar bien la agenda',
        fields: [
          {key:'appointment_duration', type:'duration', label:'¿Cuánto dura de media una primera consulta?', defaultValue:60,
            options:[{value:'30',label:'30 minutos'},{value:'45',label:'45 minutos'},{value:'60',label:'1 hora'},{value:'90',label:'1h 30min'},{value:'120',label:'2 horas'}]},
          {key:'meeting_types', type:'multiselect', label:'¿Cómo podéis reuniros?', defaultValue:['presencial','videollamada'],
            options:[
              {value:'presencial',label:'En la oficina',emoji:'🏢'},
              {value:'videollamada',label:'Por videollamada',emoji:'💻'},
              {value:'telefono',label:'Por teléfono',emoji:'📞'},
            ]
          },
        ]
      }
    ]
  },
}

// Fallback para tipos no reconocidos
const FALLBACK_FLOW: FlowConfig = {
  emoji:'🏪', label:'Negocio', agentDefaultName:'Sofía',
  steps: [
    {
      id:'agent', title:'¿Cómo se llamará tu recepcionista?', subtitle:'El nombre que escucharán tus clientes',
      fields: [
        {key:'agent_name', type:'text', label:'Nombre de la recepcionista', placeholder:'Ej: Sofía', defaultValue:'Sofía'},
        {key:'language', type:'select', label:'Idioma', defaultValue:'es',
          options:[{value:'es',label:'Español'},{value:'ca',label:'Català'},{value:'en',label:'English'}]},
      ]
    },
    {
      id:'hours', title:'¿Cuándo estáis abiertos?', subtitle:'Horario de atención',
      fields: [{key:'business_hours', type:'hours', label:'Horario', defaultValue:null}]
    },
    {
      id:'services', title:'¿Qué gestiona la recepcionista?',
      subtitle:'Lo básico para empezar',
      fields: [
        {key:'services', type:'multiselect', label:'Gestión', defaultValue:['citas','informacion'],
          options:[
            {value:'citas',label:'Citas y reservas',emoji:'📅'},
            {value:'informacion',label:'Preguntas e información',emoji:'❓'},
            {value:'cancelaciones',label:'Cancelaciones',emoji:'✕'},
          ]
        }
      ]
    }
  ]
}

// ── Servicios dinámicos según tipo de salón ──────────────────────────────────
const SERVICIOS_PELUQUERIA = [
  {value:'corte_mujer',  label:'Corte de pelo (mujer)',    emoji:'✂️'},
  {value:'corte_hombre', label:'Corte de pelo (hombre)',   emoji:'💇'},
  {value:'tinte',        label:'Tinte y coloración',       emoji:'🎨'},
  {value:'mechas',       label:'Mechas / Balayage',        emoji:'✨'},
  {value:'alisado',      label:'Alisado / Keratina',       emoji:'💆'},
  {value:'peinado',      label:'Recogidos y peinados',     emoji:'👰'},
  {value:'manicura',     label:'Manicura / Pedicura',      emoji:'💅'},
  {value:'depilacion',   label:'Depilación',               emoji:'🌸'},
  {value:'facial',       label:'Tratamientos faciales',    emoji:'🧴'},
]
const SERVICIOS_BARBERIA = [
  {value:'corte_hombre', label:'Corte de pelo (hombre)',   emoji:'💇'},
  {value:'barba_perfilado', label:'Barba y perfilado',     emoji:'🪒'},
  {value:'afeitado',     label:'Afeitado clásico',         emoji:'🪞'},
  {value:'barba_color',  label:'Tinte de barba',           emoji:'🎨'},
  {value:'diseño_barba', label:'Diseño y arreglo de barba',emoji:'✏️'},
  {value:'tratamiento',  label:'Tratamiento capilar',      emoji:'💆'},
  {value:'cejas',        label:'Depilación de cejas',      emoji:'✨'},
]
const SERVICIOS_AMBOS = [
  {value:'corte_mujer',     label:'Corte de pelo (mujer)',      emoji:'✂️'},
  {value:'corte_hombre',    label:'Corte de pelo (hombre)',     emoji:'💇'},
  {value:'tinte',           label:'Tinte y coloración',         emoji:'🎨'},
  {value:'mechas',          label:'Mechas / Balayage',          emoji:'✨'},
  {value:'alisado',         label:'Alisado / Keratina',         emoji:'💆'},
  {value:'peinado',         label:'Recogidos y peinados',       emoji:'👰'},
  {value:'barba_perfilado', label:'Barba y perfilado',          emoji:'🪒'},
  {value:'afeitado',        label:'Afeitado clásico',           emoji:'🪞'},
  {value:'barba_color',     label:'Tinte de barba',             emoji:'🎨'},
  {value:'manicura',        label:'Manicura / Pedicura',        emoji:'💅'},
  {value:'depilacion',      label:'Depilación',                 emoji:'🌸'},
  {value:'facial',          label:'Tratamientos faciales',      emoji:'🧴'},
]
function getSalonServices(salonTipo: string) {
  if (salonTipo === 'barberia') return SERVICIOS_BARBERIA
  if (salonTipo === 'ambos')    return SERVICIOS_AMBOS
  return SERVICIOS_PELUQUERIA // default
}

// ── Defaults de horario ───────────────────────────────────────────────────────
function defaultHours() {
  return Object.fromEntries(DAYS.map((d,i) => [d, { open:'09:00', close:'19:00', closed: i>=5 }]))
}

// ── Componente campo ─────────────────────────────────────────────────────────
function Field({ config, value, onChange }: { config: FieldConfig; value: any; onChange: (v:any)=>void }) {
  const inp = {
    width:'100%', background:'rgba(255,255,255,0.04)', border:`1px solid ${C.border}`,
    borderRadius:10, padding:'11px 14px', color:C.text, fontSize:14,
    fontFamily:'inherit', outline:'none', transition:'border-color 0.15s'
  }

  if (config.type === 'text') return (
    <div>
      <label style={{display:'block',fontSize:11,fontWeight:700,color:C.sub,textTransform:'uppercase' as const,letterSpacing:'0.05em',marginBottom:6}}>{config.label}</label>
      <input style={inp} value={value||''} onChange={e=>onChange(e.target.value)} placeholder={config.placeholder}
        onFocus={e=>e.currentTarget.style.borderColor=C.amber} onBlur={e=>e.currentTarget.style.borderColor='rgba(255,255,255,0.08)'}/>
      {config.hint && <p style={{fontSize:12,color:C.muted,marginTop:5}}>{config.hint}</p>}
    </div>
  )

  if (config.type === 'number') return (
    <div>
      <label style={{display:'block',fontSize:11,fontWeight:700,color:C.sub,textTransform:'uppercase' as const,letterSpacing:'0.05em',marginBottom:6}}>{config.label}</label>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <button onClick={()=>onChange(Math.max(config.min||1,(value||config.defaultValue||1)-1))}
          style={{width:36,height:36,borderRadius:9,border:`1px solid ${C.border}`,background:'rgba(255,255,255,0.04)',color:C.text,fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>−</button>
        <input type="number" style={{...inp,textAlign:'center' as const,width:80,flexShrink:0}} min={config.min||1} max={config.max||999}
          value={value||config.defaultValue||1} onChange={e=>onChange(parseInt(e.target.value)||1)}/>
        <button onClick={()=>onChange(Math.min(config.max||999,(value||config.defaultValue||1)+1))}
          style={{width:36,height:36,borderRadius:9,border:`1px solid ${C.border}`,background:'rgba(255,255,255,0.04)',color:C.text,fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>+</button>
        {config.hint && <p style={{fontSize:12,color:C.muted}}>{config.hint}</p>}
      </div>
    </div>
  )

  if (config.type === 'select') return (
    <div>
      <label style={{display:'block',fontSize:11,fontWeight:700,color:C.sub,textTransform:'uppercase' as const,letterSpacing:'0.05em',marginBottom:6}}>{config.label}</label>
      <div style={{display:'flex',gap:8,flexWrap:'wrap' as const}}>
        {config.options?.map(o=>(
          <button key={o.value} onClick={()=>onChange(o.value)}
            style={{padding:'7px 16px',borderRadius:9,border:`1px solid ${value===o.value?C.amber+'44':C.border}`,background:value===o.value?C.amberDim:'rgba(255,255,255,0.03)',color:value===o.value?C.amber:C.sub,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit',transition:'all 0.12s'}}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )

  if (config.type === 'duration') return (
    <div>
      <label style={{display:'block',fontSize:11,fontWeight:700,color:C.sub,textTransform:'uppercase' as const,letterSpacing:'0.05em',marginBottom:6}}>{config.label}</label>
      <div style={{display:'flex',gap:8,flexWrap:'wrap' as const}}>
        {config.options?.map(o=>(
          <button key={o.value} onClick={()=>onChange(parseInt(o.value))}
            style={{padding:'8px 16px',borderRadius:9,border:`1px solid ${String(value)===o.value?C.amber+'44':C.border}`,background:String(value)===o.value?C.amberDim:'rgba(255,255,255,0.03)',color:String(value)===o.value?C.amber:C.sub,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit',transition:'all 0.12s'}}>
            {o.label}
          </button>
        ))}
      </div>
      {config.hint && <p style={{fontSize:12,color:C.muted,marginTop:6}}>{config.hint}</p>}
    </div>
  )

  if (config.type === 'toggle') return (
    <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:16,padding:'14px',background:'rgba(255,255,255,0.02)',borderRadius:12,border:`1px solid ${C.border}`}}>
      <div>
        <p style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:3}}>{config.label}</p>
        {config.hint && <p style={{fontSize:12,color:C.muted,lineHeight:1.5}}>{config.hint}</p>}
      </div>
      <button onClick={()=>onChange(!value)}
        style={{flexShrink:0,width:48,height:26,borderRadius:13,border:'none',cursor:'pointer',background:value?C.amber:'rgba(255,255,255,0.1)',position:'relative' as const,transition:'background 0.2s'}}>
        <div style={{position:'absolute' as const,top:3,left:value?22:3,width:20,height:20,borderRadius:'50%',background:'white',transition:'left 0.2s',boxShadow:'0 1px 4px rgba(0,0,0,0.3)'}}/>
      </button>
    </div>
  )

  if (config.type === 'multiselect') return (
    <div>
      <label style={{display:'block',fontSize:11,fontWeight:700,color:C.sub,textTransform:'uppercase' as const,letterSpacing:'0.05em',marginBottom:10}}>{config.label}</label>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
        {config.options?.map(o=>{
          const selected = Array.isArray(value) && value.includes(o.value)
          return (
            <button key={o.value} onClick={()=>{
              const arr = Array.isArray(value)?[...value]:[]
              onChange(selected ? arr.filter(v=>v!==o.value) : [...arr,o.value])
            }}
              style={{padding:'10px 12px',borderRadius:10,border:`1px solid ${selected?C.amber+'44':C.border}`,background:selected?C.amberDim:'rgba(255,255,255,0.02)',cursor:'pointer',fontFamily:'inherit',textAlign:'left' as const,transition:'all 0.12s',display:'flex',alignItems:'center',gap:8}}>
              {o.emoji && <span style={{fontSize:18}}>{o.emoji}</span>}
              <span style={{fontSize:12,fontWeight:selected?700:500,color:selected?C.amber:C.sub,lineHeight:1.3}}>{o.label}</span>
              {selected && <span style={{marginLeft:'auto',color:C.amber,fontSize:14}}>✓</span>}
            </button>
          )
        })}
      </div>
    </div>
  )

  if (config.type === 'hours') {
    const h = value || defaultHours()
    return (
      <div>
        <div style={{display:'flex',flexDirection:'column' as const,gap:3,maxHeight:280,overflowY:'auto' as const}}>
          {DAYS.map(day=>(
            <div key={day} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',background:'rgba(255,255,255,0.02)',borderRadius:9}}>
              <span style={{fontSize:12,color:C.sub,width:80,flexShrink:0}}>{day}</span>
              <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',flexShrink:0}}>
                <input type="checkbox" checked={!h[day]?.closed}
                  onChange={e=>onChange({...h,[day]:{...h[day],closed:!e.target.checked}})}
                  style={{accentColor:C.amber,cursor:'pointer'}}/>
                <span style={{fontSize:12,color:h[day]?.closed?C.muted:C.green,fontWeight:600,width:55}}>
                  {h[day]?.closed?'Cerrado':'Abierto'}
                </span>
              </label>
              {!h[day]?.closed && (
                <>
                  <input type="time" value={h[day]?.open||'09:00'}
                    onChange={e=>onChange({...h,[day]:{...h[day],open:e.target.value}})}
                    style={{background:'rgba(255,255,255,0.04)',border:`1px solid ${C.border}`,borderRadius:8,padding:'5px 8px',color:C.text,fontSize:12,outline:'none',fontFamily:'inherit'}}/>
                  <span style={{color:C.muted,fontSize:11}}>—</span>
                  <input type="time" value={h[day]?.close||'19:00'}
                    onChange={e=>onChange({...h,[day]:{...h[day],close:e.target.value}})}
                    style={{background:'rgba(255,255,255,0.04)',border:`1px solid ${C.border}`,borderRadius:8,padding:'5px 8px',color:C.text,fontSize:12,outline:'none',fontFamily:'inherit'}}/>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return null
}

// ── Simulación por tipo de negocio ───────────────────────────────────────────
function SimulationStep({ tenant, answers, flow }: { tenant:any; answers:Record<string,any>; flow:FlowConfig }) {
  const agentName = answers.agent_name || flow.agentDefaultName
  const businessName = tenant?.name || 'tu negocio'
  const [simStep, setSimStep] = useState(0)
  const type = tenant?.type || 'otro'

  // Diálogos adaptados por tipo de negocio
  const getConversation = () => {
    const services = answers.services || []
    if (type.includes('clinica') || type.includes('veterinaria')) {
      return [
        {from:'cliente', text:'Hola, quería pedir cita para esta semana.'},
        {from:'agent', text:`${businessName}, buenos días. Soy ${agentName}, ¿para qué tipo de consulta necesita cita?`},
        {from:'cliente', text:'Para una revisión general.'},
        {from:'agent', text:`Perfecto. ¿Qué día le va mejor? Tengo disponibilidad el martes a las 10:00 o el jueves a las 11:30.`},
        {from:'cliente', text:'El jueves me va bien.'},
        {from:'agent', text:`Anotado. Cita confirmada el jueves a las 11:30. Le llegará una confirmación. ¿Necesita algo más?`},
        {from:'cliente', text:'No, muchas gracias.'},
        {from:'agent', text:`Hasta el jueves. ¡Que tenga un buen día!`},
      ]
    }
    if (type === 'peluqueria') {
      const salonTipo = answers.salon_tipo || 'peluqueria'
      const isBarberia = salonTipo === 'barberia'
      const isAmbos = salonTipo === 'ambos'
      if (isBarberia) return [
        {from:'cliente', text:'Hola, quería pedir cita para un corte y arreglo de barba.'},
        {from:'agent', text:`${businessName}, buenas. Soy ${agentName}. Claro, ¿tienes alguna preferencia de día o barbero?`},
        {from:'cliente', text:'El sábado por la mañana si puede ser.'},
        {from:'agent', text:`El sábado tengo disponibilidad a las 10:00 y a las 11:30. ¿Cuál te va mejor?`},
        {from:'cliente', text:'A las 10 perfecto.'},
        {from:'agent', text:`Apuntado. Cita el sábado a las 10:00 para corte y barba. ¿A nombre de quién?`},
        {from:'cliente', text:'A nombre de Javier.'},
        {from:'agent', text:`Perfecto Javier, hasta el sábado. ¡Nos vemos!`},
      ]
      if (isAmbos) return [
        {from:'cliente', text:'Buenas, quería reservar para un corte de pelo y también arreglar la barba.'},
        {from:'agent', text:`${businessName}, buenas. Soy ${agentName}. ¿Es para mujer o para hombre?`},
        {from:'cliente', text:'Para hombre, corte y barba.'},
        {from:'agent', text:`Perfecto. ¿Tienes preferencia de día? Tengo disponible el jueves a las 17:00 o el viernes a las 10:00.`},
        {from:'cliente', text:'El viernes a las 10.'},
        {from:'agent', text:`Anotado. Viernes a las 10:00, corte y barba. ¿A nombre de quién?`},
        {from:'cliente', text:'Miguel Sánchez.'},
        {from:'agent', text:`Perfecto Miguel. Hasta el viernes. ¡Nos vemos!`},
      ]
      return [
        {from:'cliente', text:'Buenas, quería reservar cita para un corte.'},
        {from:'agent', text:`${businessName}, buenas. Soy ${agentName}. ¿Corte de pelo para mujer?`},
        {from:'cliente', text:'Sí, con lavado también.'},
        {from:'agent', text:`Claro. ¿Tienes algún día preferido? Puedo darte el miércoles a las 16:00 o el viernes por la mañana.`},
        {from:'cliente', text:'El viernes perfecto.'},
        {from:'agent', text:`Apuntado. Cita el viernes a primera hora. ¿A nombre de quién?`},
        {from:'cliente', text:'Laura García.'},
        {from:'agent', text:`Perfecto Laura. Hasta el viernes. ¡Nos vemos!`},
      ]
    }
    if (type === 'asesoria') {
      return [
        {from:'cliente', text:'Hola, llamo porque tengo una duda sobre la declaración de la renta.'},
        {from:'agent', text:`${businessName}, buenos días. Soy ${agentName}. ¿Prefiere que le concierte una cita con un asesor o tiene una pregunta rápida?`},
        {from:'cliente', text:'Mejor una cita, es algo complicado.'},
        {from:'agent', text:`Por supuesto. Tengo disponibilidad el lunes a las 10:00 o el miércoles a las 17:00. ¿Qué le va mejor?`},
        {from:'cliente', text:'El lunes.'},
        {from:'agent', text:`Cita anotada para el lunes a las 10:00. ¿Me da su nombre y número de teléfono por si hay algún cambio?`},
        {from:'cliente', text:'Claro, soy Carlos Ruiz, 666 123 456.'},
        {from:'agent', text:`Perfecto Carlos. Hasta el lunes. ¡Que tenga buen día!`},
      ]
    }
    // Restaurante / Bar por defecto
    const hasOrders = services.includes('pedidos')
    if (hasOrders) {
      return [
        {from:'cliente', text:'Hola, ¿podría reservar mesa para esta noche?'},
        {from:'agent', text:`${businessName}, buenas tardes. Soy ${agentName}. ¿Para cuántas personas?`},
        {from:'cliente', text:'Para 4 personas, a las 21:00.'},
        {from:'agent', text:`Perfecto, tengo disponibilidad para 4 personas a las 21:00. ¿A nombre de quién hago la reserva?`},
        {from:'cliente', text:'A nombre de Martínez.'},
        {from:'agent', text:`Reserva confirmada: 4 personas, esta noche a las 21:00, a nombre de Martínez. ¡Hasta esta noche!`},
      ]
    }
    return [
      {from:'cliente', text:'Hola, quería reservar mesa para mañana.'},
      {from:'agent', text:`${businessName}, buenas. Soy ${agentName}. ¿Para cuántas personas y a qué hora?`},
      {from:'cliente', text:'Somos 3, sobre las 14:00.'},
      {from:'agent', text:`Tengo mesa disponible para 3 a las 14:00. ¿A nombre de quién?`},
      {from:'cliente', text:'A nombre de López.'},
      {from:'agent', text:`Perfecto. Reserva confirmada mañana a las 14:00 para 3 personas, a nombre de López. ¡Hasta mañana!`},
    ]
  }

  const conversation = getConversation()
  const current = conversation.slice(0, simStep + 1)

  return (
    <div>
      <div style={{background:'rgba(255,255,255,0.02)',border:`1px solid ${C.border}`,borderRadius:14,padding:'16px',marginBottom:20,maxHeight:320,overflowY:'auto' as const}}>
        <div style={{display:'flex',flexDirection:'column' as const,gap:10}}>
          {current.map((msg,i)=>(
            <div key={i} style={{display:'flex',gap:10,justifyContent:msg.from==='agent'?'flex-start':'flex-end',animation:'rz-slide-in 0.3s ease'}}>
              {msg.from==='agent' && (
                <div style={{width:30,height:30,borderRadius:'50%',background:`linear-gradient(135deg,${C.amber},#E8923A)`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:14}}>
                  {flow.emoji}
                </div>
              )}
              <div style={{maxWidth:'75%',padding:'10px 14px',borderRadius:msg.from==='agent'?'4px 14px 14px 14px':'14px 4px 14px 14px',background:msg.from==='agent'?'rgba(255,255,255,0.05)':C.amberDim,border:`1px solid ${msg.from==='agent'?C.border:C.amber+'33'}`}}>
                {msg.from==='agent' && <p style={{fontSize:10,fontWeight:700,color:C.amber,marginBottom:4}}>{agentName.toUpperCase()}</p>}
                <p style={{fontSize:13,color:C.text,lineHeight:1.5}}>{msg.text}</p>
              </div>
            </div>
          ))}
          {simStep < conversation.length - 1 && (
            <div style={{display:'flex',gap:4,paddingLeft:40}}>
              {[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:'50%',background:C.muted,animation:`rz-bounce 1s ${i*0.2}s infinite`}}/>)}
            </div>
          )}
        </div>
      </div>
      <div style={{display:'flex',gap:10}}>
        {simStep < conversation.length - 1 ? (
          <button onClick={()=>setSimStep(s=>s+1)}
            style={{flex:1,padding:'11px',background:`linear-gradient(135deg,${C.amber},#E8923A)`,border:'none',borderRadius:10,cursor:'pointer',color:'#0C1018',fontSize:14,fontWeight:700,fontFamily:'inherit'}}>
            Siguiente mensaje →
          </button>
        ) : (
          <div style={{flex:1,padding:'11px 14px',background:C.greenDim,border:`1px solid ${C.green}33`,borderRadius:10,textAlign:'center' as const}}>
            <p style={{fontSize:13,color:C.green,fontWeight:700}}>✓ ¡Así de fácil! Tu recepcionista ya sabe cómo gestionar esto.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const [tenant, setTenant] = useState<any>(null)
  const [step, setStep] = useState(0) // 0-based sobre los steps del flow
  const [saving, setSaving] = useState(false)
  const [answers, setAnswers] = useState<Record<string,any>>({})
  const [showSim, setShowSim] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(()=>{
    (async()=>{
      const {data:{user}} = await supabase.auth.getUser()
      if(!user){window.location.href='/login';return}
      const {data:p} = await supabase.from('profiles').select('tenant_id').eq('id',user.id).maybeSingle()
      if(!p?.tenant_id)return
      const {data:t} = await supabase.from('tenants').select('*').eq('id',p.tenant_id).maybeSingle()
      if(t?.onboarding_complete){window.location.href='/panel';return}
      setTenant(t)
      // Pre-rellenar con datos existentes
      const init: Record<string,any> = {}
      if(t?.agent_name) init.agent_name = t.agent_name
      if(t?.language) init.language = t.language
      if(t?.business_hours) init.business_hours = t.business_hours
      setAnswers(init)
    })()
  },[])

  const flow = tenant ? (FLOWS[tenant.type] || FALLBACK_FLOW) : FALLBACK_FLOW
  const totalSteps = flow.steps.length + 2 // +1 simulación +1 final
  const currentStep = flow.steps[step]

  function getFieldValue(key: string, defaultValue: any) {
    return answers[key] !== undefined ? answers[key] : defaultValue
  }

  function setFieldValue(key: string, value: any) {
    setAnswers(prev => ({ ...prev, [key]: value }))
  }

  const canContinue = () => {
    if (!currentStep) return true
    return currentStep.fields.every(f => {
      const v = getFieldValue(f.key, f.defaultValue)
      if (f.type === 'text') return !!(v?.toString().trim())
      if (f.type === 'multiselect') return Array.isArray(v) && v.length > 0
      return v !== undefined && v !== null
    })
  }

  const saveAndNext = useCallback(async () => {
    if (!tenant || saving) return
    setSaving(true)
    try {
      const hours = answers.business_hours || defaultHours()
      await supabase.from('tenants').update({
        agent_name: answers.agent_name || flow.agentDefaultName,
        language: answers.language || 'es',
        business_hours: hours,
        onboarding_step: step + 1,
        agent_config: {
          automation: {
            auto_simple_reservations: true,
            auto_cancellations: true,
            auto_info_queries: true,
            max_auto_party: answers.max_group || 8,
          },
          knowledge: {
            services: answers.services?.join(', ') || '',
            conditions: '',
            faqs: '',
          },
          special_cases: {
            allergies: 'review',
            birthdays: 'confirm',
            events: 'review',
            vip: 'confirm',
          }
        },
      }).eq('id', tenant.id)
    } catch(e) { console.error('save error:', e) }
    setSaving(false)
    if (step >= flow.steps.length - 1) {
      setShowSim(true)
    } else {
      setStep(s => s + 1)
    }
  }, [tenant, saving, answers, step, flow])

  const completeOnboarding = useCallback(async () => {
    if (!tenant) return
    setSaving(true)
    await supabase.from('tenants').update({ onboarding_complete: true }).eq('id', tenant.id)
    setSaving(false)
    window.location.href = '/panel'
  }, [tenant])

  if (!tenant) return (
    <div style={{minHeight:'100vh',background:C.bg,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{width:36,height:36,border:`3px solid ${C.amber}`,borderTopColor:'transparent',borderRadius:'50%',animation:'rz-spin 0.7s linear infinite'}}/>
      <style>{`@keyframes rz-spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const progressSteps = [...flow.steps.map(s=>s.title.split('?')[0].replace('¿','')), 'Prueba en vivo', '¡Listo!']
  const currentProgressStep = showSim ? flow.steps.length : done ? flow.steps.length+1 : step

  return (
    <div style={{minHeight:'100vh',background:C.bg,fontFamily:"'Sora',-apple-system,sans-serif",display:'flex',flexDirection:'column' as const,alignItems:'center',justifyContent:'flex-start',padding:'24px 16px',overflowY:'auto' as const}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box}
        @keyframes rz-spin{to{transform:rotate(360deg)}}
        @keyframes rz-fade-up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes rz-slide-in{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}
        @keyframes rz-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
        .rz-ob-card{animation:rz-fade-up 0.35s ease}
      `}</style>

      {/* Header mínimo */}
      <div style={{marginBottom:28,textAlign:'center' as const}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginBottom:4}}>
          <div style={{width:30,height:30,borderRadius:9,background:`linear-gradient(135deg,${C.amber},#E8923A)`,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#0C1018"><path d="M22 17a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A2 2 0 014 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 17z"/></svg>
          </div>
          <span style={{fontSize:16,fontWeight:800,color:C.text,letterSpacing:'-0.02em'}}>Reservo<span style={{color:C.amber}}>.AI</span></span>
        </div>
        <p style={{fontSize:13,color:C.muted}}>
          Configurando para <strong style={{color:C.sub}}>{flow.emoji} {tenant.name}</strong>
        </p>
      </div>

      {/* Progress */}
      <div style={{width:'100%',maxWidth:580,marginBottom:24,overflowX:'auto' as const,paddingBottom:4}}>
        <div style={{display:'flex',alignItems:'flex-start',gap:0,minWidth:'max-content'}}>
          {progressSteps.map((label,i)=>{
            const isActive=currentProgressStep===i
            const isDone=currentProgressStep>i
            return (
              <div key={i} style={{display:'flex',alignItems:'center'}}>
                <div style={{display:'flex',flexDirection:'column' as const,alignItems:'center',gap:5}}>
                  <div style={{width:26,height:26,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,background:isDone?C.green:isActive?C.amber:'rgba(255,255,255,0.06)',color:isDone||isActive?'#0C1018':C.muted,transition:'all 0.25s',flexShrink:0}}>
                    {isDone?'✓':i+1}
                  </div>
                  <span style={{fontSize:9,color:isActive?C.amber:isDone?C.green:C.muted,fontWeight:isActive?700:400,whiteSpace:'nowrap' as const,maxWidth:70,textAlign:'center' as const,lineHeight:1.2}}>
                    {label.slice(0,18)}{label.length>18?'…':''}
                  </span>
                </div>
                {i<progressSteps.length-1 && <div style={{width:28,height:2,background:isDone?C.green:'rgba(255,255,255,0.06)',margin:'0 3px',marginBottom:18,flexShrink:0,transition:'background 0.3s'}}/>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Contenido */}
      <div style={{width:'100%',maxWidth:580}}>

        {/* PASOS DEL FLOW */}
        {!showSim && !done && currentStep && (
          <div className="rz-ob-card" key={step} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:18,padding:28}}>
            <h2 style={{fontSize:20,fontWeight:800,color:C.text,letterSpacing:'-0.02em',marginBottom:6}}>
              {currentStep.title}
            </h2>
            <p style={{fontSize:13,color:C.muted,marginBottom:24,lineHeight:1.5}}>{currentStep.subtitle}</p>

            <div style={{display:'flex',flexDirection:'column' as const,gap:20}}>
              {currentStep.fields.map(f=>{
                // Inyectar opciones dinámicas para servicios de peluquería
                const fieldConfig = (tenant?.type === 'peluqueria' && f.key === 'services')
                  ? { ...f, options: getSalonServices(answers.salon_tipo || 'peluqueria') }
                  : f
                return (
                  <Field key={f.key} config={fieldConfig}
                    value={getFieldValue(f.key, f.defaultValue)}
                    onChange={v=>setFieldValue(f.key,v)}/>
                )
              })}
            </div>

            <div style={{display:'flex',gap:10,marginTop:28}}>
              {step > 0 && (
                <button onClick={()=>setStep(s=>s-1)}
                  style={{padding:'11px 20px',background:'rgba(255,255,255,0.04)',border:`1px solid ${C.border}`,borderRadius:10,cursor:'pointer',color:C.sub,fontSize:13,fontWeight:600,fontFamily:'inherit'}}>
                  ← Atrás
                </button>
              )}
              <button onClick={saveAndNext} disabled={saving||!canContinue()}
                style={{flex:1,padding:'12px',background:canContinue()?`linear-gradient(135deg,${C.amber},#E8923A)`:'rgba(255,255,255,0.06)',border:'none',borderRadius:10,cursor:canContinue()?'pointer':'not-allowed',color:canContinue()?'#0C1018':C.muted,fontSize:14,fontWeight:700,fontFamily:'inherit',transition:'all 0.15s',opacity:saving?0.7:1}}>
                {saving ? 'Guardando…' : step >= flow.steps.length-1 ? 'Ver demostración →' : 'Continuar →'}
              </button>
            </div>
          </div>
        )}

        {/* SIMULACIÓN */}
        {showSim && !done && (
          <div className="rz-ob-card" style={{background:C.card,border:`1px solid ${C.amber}22`,borderRadius:18,padding:28}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
              <div style={{width:36,height:36,borderRadius:10,background:C.amberDim,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>
                {flow.emoji}
              </div>
              <div>
                <h2 style={{fontSize:18,fontWeight:800,color:C.text,letterSpacing:'-0.02em'}}>Así suena tu recepcionista</h2>
                <p style={{fontSize:12,color:C.muted}}>Ejemplo real de una llamada en {flow.label}</p>
              </div>
            </div>
            <div style={{width:'100%',height:1,background:C.border,margin:'16px 0'}}/>
            <SimulationStep tenant={tenant} answers={answers} flow={flow}/>
            <button onClick={()=>setDone(true)}
              style={{width:'100%',marginTop:16,padding:'12px',background:`linear-gradient(135deg,${C.green},#16a34a)`,border:'none',borderRadius:10,cursor:'pointer',color:'white',fontSize:14,fontWeight:700,fontFamily:'inherit'}}>
              Ir al panel →
            </button>
            <button onClick={()=>setStep(flow.steps.length-1)}
              style={{width:'100%',marginTop:8,padding:'8px',background:'none',border:'none',cursor:'pointer',color:C.muted,fontSize:12,fontFamily:'inherit'}}>
              ← Volver a configurar
            </button>
          </div>
        )}

        {/* PANTALLA FINAL */}
        {done && (
          <div className="rz-ob-card" style={{background:C.card,border:`1px solid ${C.green}22`,borderRadius:18,padding:28,textAlign:'center' as const}}>
            <div style={{width:72,height:72,background:C.greenDim,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px',fontSize:36}}>🎉</div>
            <h2 style={{fontSize:24,fontWeight:800,color:C.text,letterSpacing:'-0.02em',marginBottom:8}}>¡Todo listo!</h2>
            <p style={{fontSize:14,color:C.muted,marginBottom:24,lineHeight:1.6}}>
              <strong style={{color:C.text}}>{answers.agent_name || flow.agentDefaultName}</strong> está lista para atender las llamadas de <strong style={{color:C.text}}>{tenant.name}</strong>.
            </p>

            <div style={{background:'rgba(255,255,255,0.02)',border:`1px solid ${C.border}`,borderRadius:12,padding:16,marginBottom:20,textAlign:'left' as const}}>
              {[
                {icon:'✓',color:C.green,text:`Recepcionista configurada: ${answers.agent_name || flow.agentDefaultName}`},
                {icon:'✓',color:C.green,text:'Horario de atención guardado'},
                {icon:'✓',color:C.green,text:`Tipo de negocio: ${flow.label}`},
                {icon:'✓',color:C.green,text:`Servicios activados: ${(answers.services||[]).length > 0 ? (answers.services||[]).length+' seleccionados' : 'configurados'}`},
                {icon:'🎁',color:C.amber,text:'10 llamadas gratuitas disponibles para probar'},
              ].map((item,i)=>(
                <div key={i} style={{display:'flex',gap:10,alignItems:'flex-start',marginBottom:i<4?8:0}}>
                  <span style={{color:item.color,fontWeight:700,fontSize:14,flexShrink:0}}>{item.icon}</span>
                  <span style={{fontSize:13,color:C.sub,lineHeight:1.5}}>{item.text}</span>
                </div>
              ))}
            </div>

            <div style={{background:C.amberDim,border:`1px solid ${C.amber}33`,borderRadius:10,padding:'12px 16px',marginBottom:20,textAlign:'left' as const}}>
              <p style={{fontSize:12,fontWeight:700,color:C.amber,marginBottom:6}}>Próximos pasos recomendados:</p>
              {[
                '📞 Configura el número de teléfono en Configuración',
                '📋 Añade tu carta o servicios en "Carta y productos"',
                '⚙️ Ajusta cómo gestiona reservas especiales',
              ].map((t,i)=>(
                <div key={i} style={{display:'flex',gap:8,alignItems:'center',marginBottom:i<2?6:0}}>
                  <span style={{fontSize:12,color:C.sub}}>{t}</span>
                </div>
              ))}
            </div>

            <button onClick={completeOnboarding} disabled={saving}
              style={{width:'100%',padding:'14px',background:`linear-gradient(135deg,${C.amber},#E8923A)`,border:'none',borderRadius:12,cursor:'pointer',color:'#0C1018',fontSize:15,fontWeight:800,fontFamily:'inherit',transition:'all 0.15s',opacity:saving?0.7:1}}>
              {saving ? 'Activando…' : 'Ir al centro de control →'}
            </button>
          </div>
        )}

      </div>{/* maxWidth */}
    </div>
  )
}
