'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// ââ Paleta âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const C = {
  bg:'#0C1018', card:'#131920', card2:'#161D2A', border:'rgba(255,255,255,0.08)',
  text:'#E8EEF6', sub:'#8895A7', muted:'#49566A', amber:'#F0A84E',
  green:'#34D399', red:'#F87171', teal:'#2DD4BF', violet:'#A78BFA',
  amberDim:'rgba(240,168,78,0.12)', greenDim:'rgba(52,211,153,0.10)',
}

// ââ Definición de flujos por tipo de negocio âââââââââââââââââââââââââââââââââ
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
    emoji:'½️', label:'Restaurante / Bar', agentDefaultName:'Sofía',
    steps: [
      {
        id:'agent', title:'¿Cómo se llamará tu recepcionista?',
        subtitle:'Es el nombre que escucharán tus clientes al llamar',
        fields: [
          {key:'agent_name', type:'text', label:'Nombre de la recepcionista', placeholder:'Ej: Sofía, Carmen, Lucíaâ¦', defaultValue:'Sofía'},
          {key:'language', type:'select', label:'¿En qué idioma habla?', defaultValue:'es',
            options:[{value:'es',label:'Español'},{value:'ca',label:'Català'},{value:'eu',label:'Euskera'},{value:'en',label:'English'}]},
        ]
      },
      {
        id:'phone', title:'¿Cuál es el número de teléfono del agente?',
        subtitle:'El número Twilio que comprarás para que los clientes llamen a tu recepcionista IA',
        fields: [
          {key:'agent_phone', type:'text', label:'Número de teléfono (formato internacional)', placeholder:'Ej: +12138753573', defaultValue:''},
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
              {value:'reservas',label:'Reservas de mesa',emoji:''},
              {value:'pedidos',label:'Pedidos para llevar',emoji:'¦'},
              {value:'informacion',label:'Preguntas sobre el menú y horario',emoji:'â'},
              {value:'cancelaciones',label:'Cancelaciones de reserva',emoji:'â'},
            ]
          },
        ]
      }
    ]
  },

  bar: {
    emoji:'º', label:'Bar / Cafetería', agentDefaultName:'Sofía',
    steps: [
      {
        id:'agent', title:'¿Cómo se llamará tu recepcionista?',
        subtitle:'Es el nombre que escucharán tus clientes al llamar',
        fields: [
          {key:'agent_name', type:'text', label:'Nombre de la recepcionista', placeholder:'Ej: Sofía, Carmenâ¦', defaultValue:'Sofía'},
          {key:'language', type:'select', label:'Idioma', defaultValue:'es',
            options:[{value:'es',label:'Español'},{value:'ca',label:'Català'},{value:'eu',label:'Euskera'},{value:'en',label:'English'}]},
        ]
      },
      {
        id:'phone', title:'¿Cuál es el número de teléfono del agente?',
        subtitle:'El número Twilio que comprarás para que los clientes llamen a tu recepcionista IA',
        fields: [
          {key:'agent_phone', type:'text', label:'Número de teléfono (formato internacional)', placeholder:'Ej: +12138753573', defaultValue:''},
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
              {value:'reservas',label:'Reservar mesas o reservados',emoji:''},
              {value:'pedidos',label:'Pedidos para llevar',emoji:'¦'},
              {value:'informacion',label:'Preguntas sobre carta y horario',emoji:'â'},
              {value:'eventos',label:'Reservar para eventos privados',emoji:''},
            ]
          }
        ]
      }
    ]
  },

  clinica_dental: {
    emoji:'¦·', label:'Clínica Dental', agentDefaultName:'Sara',
    steps: [
      {
        id:'agent', title:'¿Cómo se llamará tu recepcionista?',
        subtitle:'Es quien atenderá las llamadas de tus pacientes',
        fields: [
          {key:'agent_name', type:'text', label:'Nombre de la recepcionista', placeholder:'Ej: Sara, Ana, Lauraâ¦', defaultValue:'Sara'},
          {key:'language', type:'select', label:'Idioma', defaultValue:'es',
            options:[{value:'es',label:'Español'},{value:'ca',label:'Català'},{value:'eu',label:'Euskera'},{value:'en',label:'English'}]},
        ]
      },
      {
        id:'phone', title:'¿Cuál es el número de teléfono del agente?',
        subtitle:'El número Twilio que comprarás para que los clientes llamen a tu recepcionista IA',
        fields: [
          {key:'agent_phone', type:'text', label:'Número de teléfono (formato internacional)', placeholder:'Ej: +12138753573', defaultValue:''},
        ]
      },
      {
        id:'hours', title:'¿Cuándo atiende la clínica?', subtitle:'La recepcionista informará a los pacientes que llamen fuera de horario',
        fields: [{key:'business_hours', type:'hours', label:'Horario de la clínica', defaultValue:null}]
      },
      {
        id:'consultations', title:'¿Qué tipo de tratamientos ofrecéis?',
        subtitle:'Solo marcad los principales â el paciente podrá preguntar por cualquier cosa',
        fields: [
          {key:'services', type:'multiselect', label:'Tratamientos principales', defaultValue:['limpieza','empaste'],
            options:[
              {value:'revision',label:'Revisión y diagnóstico',emoji:''},
              {value:'limpieza',label:'Limpieza dental',emoji:'â¨'},
              {value:'empaste',label:'Empastes y obturaciones',emoji:'¦·'},
              {value:'extraccion',label:'Extracciones',emoji:'â️'},
              {value:'ortodoncia',label:'Ortodoncia / Brackets',emoji:''},
              {value:'implantes',label:'Implantes',emoji:'©'},
              {value:'estetica',label:'Estética dental / Blanqueamiento',emoji:'â­'},
              {value:'endodoncia',label:'Endodoncia / Nervio',emoji:''},
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
    emoji:'¥', label:'Clínica Médica', agentDefaultName:'Elena',
    steps: [
      {
        id:'agent', title:'¿Cómo se llamará tu recepcionista?', subtitle:'El nombre que oirán tus pacientes al llamar',
        fields: [
          {key:'agent_name', type:'text', label:'Nombre de la recepcionista', placeholder:'Ej: Elena, Martaâ¦', defaultValue:'Elena'},
          {key:'language', type:'select', label:'Idioma', defaultValue:'es',
            options:[{value:'es',label:'Español'},{value:'ca',label:'Català'},{value:'eu',label:'Euskera'},{value:'en',label:'English'}]},
        ]
      },
      {
        id:'phone', title:'¿Cuál es el número de teléfono del agente?',
        subtitle:'El número Twilio que comprarás para que los clientes llamen a tu recepcionista IA',
        fields: [
          {key:'agent_phone', type:'text', label:'Número de teléfono (formato internacional)', placeholder:'Ej: +12138753573', defaultValue:''},
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
              {value:'medicina_general',label:'Medicina general / Médico de cabecera',emoji:'¨ââ️'},
              {value:'pediatria',label:'Pediatría',emoji:'¶'},
              {value:'ginecologia',label:'Ginecología',emoji:'â️'},
              {value:'traumatologia',label:'Traumatología / Huesos',emoji:'¦´'},
              {value:'cardiologia',label:'Cardiología',emoji:'â¤️'},
              {value:'dermatologia',label:'Dermatología',emoji:'¬'},
              {value:'nutricion',label:'Nutrición y dietética',emoji:'¥'},
              {value:'psicologia',label:'Psicología',emoji:'§ '},
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
    emoji:'â️', label:'Peluquería / Barbería', agentDefaultName:'Marta',
    steps: [
      {
        id:'salon_tipo', title:'¿Qué tipo de salón tenéis?',
        subtitle:'Los servicios que verás a continuación dependen de esto',
        fields: [
          {key:'salon_tipo', type:'select', label:'Tipo de salón', defaultValue:'peluqueria',
            options:[
              {value:'peluqueria', label:'â️ Peluquería'},
              {value:'barberia',   label:'ª Barbería'},
              {value:'ambos',      label:'â️ª Peluquería y Barbería'},
            ]
          }
        ]
      },
      {
        id:'agent', title:'¿Cómo se llamará tu recepcionista?', subtitle:'El nombre que escucharán tus clientes',
        fields: [
          {key:'agent_name', type:'text', label:'Nombre de la recepcionista', placeholder:'Ej: Marta, Carlos, Paulaâ¦', defaultValue:'Marta'},
          {key:'language', type:'select', label:'Idioma', defaultValue:'es',
            options:[{value:'es',label:'Español'},{value:'ca',label:'Català'},{value:'eu',label:'Euskera'},{value:'en',label:'English'}]},
        ]
      },
      {
        id:'phone', title:'¿Cuál es el número de teléfono del agente?',
        subtitle:'El número Twilio que comprarás para que los clientes llamen a tu recepcionista IA',
        fields: [
          {key:'agent_phone', type:'text', label:'Número de teléfono (formato internacional)', placeholder:'Ej: +12138753573', defaultValue:''},
        ]
      },
      {
        id:'hours', title:'¿Cuándo abrís?', subtitle:'Horario del salón',
        fields: [{key:'business_hours', type:'hours', label:'Horario', defaultValue:null}]
      },
      {
        // Opciones dinámicas â se calculan en runtime según answers.salon_tipo
        id:'services', title:'¿Qué servicios ofrecéis?',
        subtitle:'Marca los que hacéis â la recepcionista los conocerá todos',
        fields: [
          {key:'services', type:'multiselect', label:'Servicios', defaultValue:['corte'],
            options:[] // placeholder â se sobrescribe dinámicamente en el render
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
    emoji:'¾', label:'Clínica Veterinaria', agentDefaultName:'Nuria',
    steps: [
      {
        id:'agent', title:'¿Cómo se llamará tu recepcionista?', subtitle:'El nombre que oirán los dueños de mascotas',
        fields: [
          {key:'agent_name', type:'text', label:'Nombre de la recepcionista', placeholder:'Ej: Nuria, Claraâ¦', defaultValue:'Nuria'},
          {key:'language', type:'select', label:'Idioma', defaultValue:'es',
            options:[{value:'es',label:'Español'},{value:'ca',label:'Català'},{value:'eu',label:'Euskera'},{value:'en',label:'English'}]},
        ]
      },
      {
        id:'phone', title:'¿Cuál es el número de teléfono del agente?',
        subtitle:'El número Twilio que comprarás para que los clientes llamen a tu recepcionista IA',
        fields: [
          {key:'agent_phone', type:'text', label:'Número de teléfono (formato internacional)', placeholder:'Ej: +12138753573', defaultValue:''},
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
              {value:'consulta',label:'Consulta general',emoji:'©º'},
              {value:'vacunas',label:'Vacunas y desparasitación',emoji:''},
              {value:'cirugia',label:'Cirugía',emoji:'â️'},
              {value:'peluqueria',label:'Peluquería canina / felina',emoji:'â️'},
              {value:'radiografia',label:'Radiografías / Ecografías',emoji:'¬'},
              {value:'dentadura',label:'Limpieza dental veterinaria',emoji:'¦·'},
              {value:'hospitalizacion',label:'Hospitalización',emoji:'¥'},
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
              {value:'perros',label:'Perros',emoji:''},
              {value:'gatos',label:'Gatos',emoji:''},
              {value:'aves',label:'Aves / Pájaros',emoji:'¦'},
              {value:'roedores',label:'Conejos y roedores',emoji:'°'},
              {value:'reptiles',label:'Reptiles',emoji:'¦'},
              {value:'exoticos',label:'Animales exóticos',emoji:'¦'},
            ]
          },
          {key:'appointment_duration', type:'duration', label:'¿Cuánto dura una consulta normal?', defaultValue:20,
            options:[{value:'15',label:'15 minutos'},{value:'20',label:'20 minutos'},{value:'30',label:'30 minutos'},{value:'45',label:'45 minutos'}]},
        ]
      }
    ]
  },

  asesoria: {
    emoji:'¼', label:'Asesoría / Consultoría', agentDefaultName:'Isabel',
    steps: [
      {
        id:'agent', title:'¿Cómo se llamará tu recepcionista?', subtitle:'El nombre que oirán tus clientes',
        fields: [
          {key:'agent_name', type:'text', label:'Nombre de la recepcionista', placeholder:'Ej: Isabel, Carmenâ¦', defaultValue:'Isabel'},
          {key:'language', type:'select', label:'Idioma', defaultValue:'es',
            options:[{value:'es',label:'Español'},{value:'ca',label:'Català'},{value:'eu',label:'Euskera'},{value:'en',label:'English'}]},
        ]
      },
      {
        id:'phone', title:'¿Cuál es el número de teléfono del agente?',
        subtitle:'El número Twilio que comprarás para que los clientes llamen a tu recepcionista IA',
        fields: [
          {key:'agent_phone', type:'text', label:'Número de teléfono (formato internacional)', placeholder:'Ej: +12138753573', defaultValue:''},
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
              {value:'fiscal',label:'Fiscal y tributario (IRPF, IVAâ¦)',emoji:''},
              {value:'laboral',label:'Laboral (nóminas, contratosâ¦)',emoji:'·'},
              {value:'contabilidad',label:'Contabilidad y balances',emoji:''},
              {value:'juridico',label:'Asesoría jurídica / Legal',emoji:'â️'},
              {value:'mercantil',label:'Constitución de empresas',emoji:'¢'},
              {value:'extranjeria',label:'Extranjería y visados',emoji:''},
              {value:'herencias',label:'Herencias y sucesiones',emoji:''},
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
              {value:'presencial',label:'En la oficina',emoji:'¢'},
              {value:'videollamada',label:'Por videollamada',emoji:'»'},
              {value:'telefono',label:'Por teléfono',emoji:''},
            ]
          },
        ]
      }
    ]
  },

  barberia: {
    emoji:'💈', label:'Barbería', agentDefaultName:'Carlos',
    steps: [
      {
        id:'agent', title:'¿Cómo se llamará tu recepcionista?', subtitle:'El nombre que escucharán tus clientes al llamar',
        fields: [
          {key:'agent_name', type:'text', label:'Nombre del recepcionista', placeholder:'Ej: Carlos, Álex…', defaultValue:'Carlos'},
          {key:'language', type:'select', label:'Idioma', defaultValue:'es',
            options:[{value:'es',label:'Español'},{value:'ca',label:'Català'},{value:'eu',label:'Euskera'},{value:'en',label:'English'}]},
        ]
      },
      {
        id:'phone', title:'¿Cuál es el número de teléfono del agente?',
        subtitle:'El número Twilio que comprarás para que los clientes llamen a tu recepcionista IA',
        fields: [{key:'agent_phone', type:'text', label:'Número de teléfono (formato internacional)', placeholder:'Ej: +12138753573', defaultValue:''}]
      },
      {
        id:'hours', title:'¿Cuándo abrís?', subtitle:'Horario de la barbería',
        fields: [{key:'business_hours', type:'hours', label:'Horario', defaultValue:null}]
      },
      {
        id:'services', title:'¿Qué servicios ofrecéis?',
        subtitle:'La recepcionista los conocerá todos y podrá informar a los clientes',
        fields: [
          {key:'services', type:'multiselect', label:'Servicios', defaultValue:['corte_hombre','barba_perfilado'],
            options:[
              {value:'corte_hombre',label:'Corte de pelo',emoji:'💇'},
              {value:'barba_perfilado',label:'Barba y perfilado',emoji:'🪒'},
              {value:'afeitado',label:'Afeitado clásico',emoji:'🪒'},
              {value:'barba_color',label:'Tinte de barba',emoji:'🎨'},
              {value:'tinte_pelo',label:'Tinte de pelo',emoji:'🎨'},
              {value:'tratamiento',label:'Tratamiento capilar',emoji:'💆'},
              {value:'cejas',label:'Depilación de cejas',emoji:'✨'},
            ]
          }
        ]
      },
      {
        id:'staff', title:'¿Cuántos barberos tenéis?',
        subtitle:'La recepcionista distribuirá las citas entre ellos',
        fields: [
          {key:'num_professionals', type:'number', label:'Número de barberos', placeholder:'Ej: 2', defaultValue:2, min:1, max:20},
          {key:'appointment_duration', type:'duration', label:'¿Cuánto dura de media una cita?', defaultValue:30,
            options:[{value:'20',label:'20 minutos'},{value:'30',label:'30 minutos'},{value:'45',label:'45 minutos'},{value:'60',label:'1 hora'}]},
        ]
      }
    ]
  },

  fisioterapia: {
    emoji:'💪', label:'Fisioterapia', agentDefaultName:'Ana',
    steps: [
      {
        id:'agent', title:'¿Cómo se llamará tu recepcionista?', subtitle:'El nombre que oirán tus pacientes al llamar',
        fields: [
          {key:'agent_name', type:'text', label:'Nombre de la recepcionista', placeholder:'Ej: Ana, Laura…', defaultValue:'Ana'},
          {key:'language', type:'select', label:'Idioma', defaultValue:'es',
            options:[{value:'es',label:'Español'},{value:'ca',label:'Català'},{value:'eu',label:'Euskera'},{value:'en',label:'English'}]},
        ]
      },
      {
        id:'phone', title:'¿Cuál es el número de teléfono del agente?',
        subtitle:'El número Twilio que comprarás para que los clientes llamen a tu recepcionista IA',
        fields: [{key:'agent_phone', type:'text', label:'Número de teléfono (formato internacional)', placeholder:'Ej: +12138753573', defaultValue:''}]
      },
      {
        id:'hours', title:'¿Cuándo atendéis?', subtitle:'Horario de la clínica',
        fields: [{key:'business_hours', type:'hours', label:'Horario', defaultValue:null}]
      },
      {
        id:'services', title:'¿Qué tratamientos ofrecéis?',
        subtitle:'Los principales — el paciente podrá preguntar por cualquiera',
        fields: [
          {key:'services', type:'multiselect', label:'Tratamientos', defaultValue:['manual','deportiva'],
            options:[
              {value:'manual',label:'Fisioterapia manual',emoji:'🤲'},
              {value:'deportiva',label:'Fisioterapia deportiva',emoji:'⚽'},
              {value:'traumatologica',label:'Traumatología / Rehabilitación',emoji:'🦴'},
              {value:'neurologica',label:'Neurológica',emoji:'🧠'},
              {value:'suelo_pelvico',label:'Suelo pélvico',emoji:'🩺'},
              {value:'puncion_seca',label:'Punción seca',emoji:'📌'},
              {value:'electroterapia',label:'Electroterapia / Ultrasonidos',emoji:'⚡'},
              {value:'pilates',label:'Pilates terapéutico',emoji:'🧘'},
            ]
          }
        ]
      },
      {
        id:'details', title:'Detalles de la consulta',
        subtitle:'Para gestionar bien la agenda',
        fields: [
          {key:'appointment_duration', type:'duration', label:'¿Cuánto dura una sesión?', defaultValue:45,
            options:[{value:'30',label:'30 minutos'},{value:'45',label:'45 minutos'},{value:'60',label:'1 hora'},{value:'90',label:'1h 30min'}]},
          {key:'num_professionals', type:'number', label:'¿Cuántos fisioterapeutas hay?', placeholder:'Ej: 2', defaultValue:2, min:1, max:30},
        ]
      }
    ]
  },

  psicologia: {
    emoji:'🧠', label:'Psicología', agentDefaultName:'María',
    steps: [
      {
        id:'agent', title:'¿Cómo se llamará tu recepcionista?', subtitle:'El nombre que oirán tus pacientes al llamar',
        fields: [
          {key:'agent_name', type:'text', label:'Nombre de la recepcionista', placeholder:'Ej: María, Elena…', defaultValue:'María'},
          {key:'language', type:'select', label:'Idioma', defaultValue:'es',
            options:[{value:'es',label:'Español'},{value:'ca',label:'Català'},{value:'eu',label:'Euskera'},{value:'en',label:'English'}]},
        ]
      },
      {
        id:'phone', title:'¿Cuál es el número de teléfono del agente?',
        subtitle:'El número Twilio que comprarás para que los clientes llamen a tu recepcionista IA',
        fields: [{key:'agent_phone', type:'text', label:'Número de teléfono (formato internacional)', placeholder:'Ej: +12138753573', defaultValue:''}]
      },
      {
        id:'hours', title:'¿Cuándo atendéis?', subtitle:'Horario de la consulta',
        fields: [{key:'business_hours', type:'hours', label:'Horario', defaultValue:null}]
      },
      {
        id:'services', title:'¿Qué servicios ofrecéis?',
        subtitle:'La recepcionista sabrá orientar a los pacientes',
        fields: [
          {key:'services', type:'multiselect', label:'Servicios', defaultValue:['individual'],
            options:[
              {value:'individual',label:'Terapia individual',emoji:'🧠'},
              {value:'pareja',label:'Terapia de pareja',emoji:'💑'},
              {value:'familiar',label:'Terapia familiar',emoji:'👨‍👩‍👧'},
              {value:'infantil',label:'Psicología infantil / adolescente',emoji:'🧒'},
              {value:'ansiedad',label:'Ansiedad y estrés',emoji:'😰'},
              {value:'online',label:'Sesiones online',emoji:'💻'},
            ]
          }
        ]
      },
      {
        id:'details', title:'Detalles de las sesiones',
        subtitle:'Para gestionar la agenda correctamente',
        fields: [
          {key:'appointment_duration', type:'duration', label:'¿Cuánto dura una sesión?', defaultValue:50,
            options:[{value:'45',label:'45 minutos'},{value:'50',label:'50 minutos'},{value:'60',label:'1 hora'},{value:'90',label:'1h 30min'}]},
          {key:'num_professionals', type:'number', label:'¿Cuántos psicólogos hay?', placeholder:'Ej: 1', defaultValue:1, min:1, max:20},
        ]
      }
    ]
  },

  hotel: {
    emoji:'🏨', label:'Hotel / Alojamiento', agentDefaultName:'Lucía',
    steps: [
      {
        id:'agent', title:'¿Cómo se llamará tu recepcionista?', subtitle:'El nombre que oirán tus huéspedes al llamar',
        fields: [
          {key:'agent_name', type:'text', label:'Nombre de la recepcionista', placeholder:'Ej: Lucía, Andrea…', defaultValue:'Lucía'},
          {key:'language', type:'select', label:'Idioma', defaultValue:'es',
            options:[{value:'es',label:'Español'},{value:'ca',label:'Català'},{value:'eu',label:'Euskera'},{value:'en',label:'English'}]},
        ]
      },
      {
        id:'phone', title:'¿Cuál es el número de teléfono del agente?',
        subtitle:'El número Twilio que comprarás para que los huéspedes llamen a tu recepcionista IA',
        fields: [{key:'agent_phone', type:'text', label:'Número de teléfono (formato internacional)', placeholder:'Ej: +12138753573', defaultValue:''}]
      },
      {
        id:'hours', title:'¿Cuándo atendéis llamadas?', subtitle:'Normalmente 24h, pero puedes ajustar',
        fields: [{key:'business_hours', type:'hours', label:'Horario de recepción', defaultValue:null}]
      },
      {
        id:'rooms', title:'¿Qué tipo de habitaciones tenéis?',
        subtitle:'La recepcionista informará sobre disponibilidad',
        fields: [
          {key:'services', type:'multiselect', label:'Tipos de habitación', defaultValue:['doble','individual'],
            options:[
              {value:'individual',label:'Individual',emoji:'🛏️'},
              {value:'doble',label:'Doble',emoji:'🛏️'},
              {value:'suite',label:'Suite',emoji:'👑'},
              {value:'familiar',label:'Familiar',emoji:'👨‍👩‍👧'},
              {value:'premium',label:'Premium / Deluxe',emoji:'⭐'},
              {value:'apartamento',label:'Apartamento',emoji:'🏠'},
            ]
          }
        ]
      },
      {
        id:'capacity', title:'Capacidad del hotel',
        subtitle:'Para gestionar la disponibilidad',
        fields: [
          {key:'total_tables', type:'number', label:'Número total de habitaciones', placeholder:'Ej: 30', defaultValue:20, min:1, max:500},
          {key:'checkin_time', type:'select', label:'Hora de check-in', defaultValue:'14:00',
            options:[{value:'12:00',label:'12:00'},{value:'13:00',label:'13:00'},{value:'14:00',label:'14:00'},{value:'15:00',label:'15:00'},{value:'16:00',label:'16:00'}]},
          {key:'checkout_time', type:'select', label:'Hora de check-out', defaultValue:'12:00',
            options:[{value:'10:00',label:'10:00'},{value:'11:00',label:'11:00'},{value:'12:00',label:'12:00'},{value:'13:00',label:'13:00'}]},
        ]
      }
    ]
  },

  ecommerce: {
    emoji:'🛒', label:'Ecommerce / Tienda Online', agentDefaultName:'Paula',
    steps: [
      {
        id:'agent', title:'¿Cómo se llamará tu recepcionista?', subtitle:'El nombre que oirán tus clientes al llamar',
        fields: [
          {key:'agent_name', type:'text', label:'Nombre de la recepcionista', placeholder:'Ej: Paula, Marta…', defaultValue:'Paula'},
          {key:'language', type:'select', label:'Idioma', defaultValue:'es',
            options:[{value:'es',label:'Español'},{value:'ca',label:'Català'},{value:'eu',label:'Euskera'},{value:'en',label:'English'}]},
        ]
      },
      {
        id:'phone', title:'¿Cuál es el número de teléfono del agente?',
        subtitle:'El número Twilio que comprarás para que los clientes llamen a tu recepcionista IA',
        fields: [{key:'agent_phone', type:'text', label:'Número de teléfono (formato internacional)', placeholder:'Ej: +12138753573', defaultValue:''}]
      },
      {
        id:'hours', title:'¿Cuándo atendéis llamadas?', subtitle:'Horario de atención telefónica',
        fields: [{key:'business_hours', type:'hours', label:'Horario', defaultValue:null}]
      },
      {
        id:'services', title:'¿Qué gestiona tu recepcionista?',
        subtitle:'Marca todo lo que debe poder atender por teléfono',
        fields: [
          {key:'services', type:'multiselect', label:'Gestiones', defaultValue:['estado_pedido','productos'],
            options:[
              {value:'estado_pedido',label:'Estado de pedidos',emoji:'📦'},
              {value:'productos',label:'Información sobre productos',emoji:'🛍️'},
              {value:'devoluciones',label:'Devoluciones y cambios',emoji:'🔄'},
              {value:'pedidos_telefono',label:'Pedidos por teléfono',emoji:'📞'},
              {value:'reclamaciones',label:'Reclamaciones',emoji:'📋'},
              {value:'envios',label:'Información de envíos',emoji:'🚚'},
            ]
          }
        ]
      }
    ]
  },

  gimnasio: {
    emoji:'🏋️', label:'Gimnasio / Centro Deportivo', agentDefaultName:'Álex',
    steps: [
      {
        id:'agent', title:'¿Cómo se llamará tu recepcionista?', subtitle:'El nombre que oirán tus socios al llamar',
        fields: [
          {key:'agent_name', type:'text', label:'Nombre del recepcionista', placeholder:'Ej: Álex, Sergio…', defaultValue:'Álex'},
          {key:'language', type:'select', label:'Idioma', defaultValue:'es',
            options:[{value:'es',label:'Español'},{value:'ca',label:'Català'},{value:'eu',label:'Euskera'},{value:'en',label:'English'}]},
        ]
      },
      {
        id:'phone', title:'¿Cuál es el número de teléfono del agente?',
        subtitle:'El número Twilio que comprarás para que los socios llamen a tu recepcionista IA',
        fields: [{key:'agent_phone', type:'text', label:'Número de teléfono (formato internacional)', placeholder:'Ej: +12138753573', defaultValue:''}]
      },
      {
        id:'hours', title:'¿Cuándo abrís?', subtitle:'Horario del gimnasio',
        fields: [{key:'business_hours', type:'hours', label:'Horario', defaultValue:null}]
      },
      {
        id:'services', title:'¿Qué actividades ofrecéis?',
        subtitle:'La recepcionista informará sobre horarios y disponibilidad',
        fields: [
          {key:'services', type:'multiselect', label:'Actividades', defaultValue:['sala_fitness','clases_dirigidas'],
            options:[
              {value:'sala_fitness',label:'Sala de musculación / Fitness',emoji:'🏋️'},
              {value:'clases_dirigidas',label:'Clases dirigidas (spinning, body pump…)',emoji:'🚴'},
              {value:'yoga',label:'Yoga / Pilates',emoji:'🧘'},
              {value:'crossfit',label:'CrossFit / Funcional',emoji:'💪'},
              {value:'natacion',label:'Natación / Piscina',emoji:'🏊'},
              {value:'artes_marciales',label:'Artes marciales / Boxeo',emoji:'🥊'},
              {value:'personal_trainer',label:'Entrenador personal',emoji:'👨‍🏫'},
              {value:'nutricion',label:'Nutrición deportiva',emoji:'🥗'},
            ]
          }
        ]
      },
      {
        id:'capacity', title:'Capacidad',
        subtitle:'Para gestionar reservas de clases',
        fields: [
          {key:'max_group', type:'number', label:'Plazas máximas por clase', placeholder:'Ej: 20', defaultValue:20, min:5, max:100},
          {key:'appointment_duration', type:'duration', label:'¿Cuánto dura una clase?', defaultValue:60,
            options:[{value:'45',label:'45 minutos'},{value:'60',label:'1 hora'},{value:'90',label:'1h 30min'}]},
        ]
      }
    ]
  },

  academia: {
    emoji:'📚', label:'Academia / Centro de Formación', agentDefaultName:'Clara',
    steps: [
      {
        id:'agent', title:'¿Cómo se llamará tu recepcionista?', subtitle:'El nombre que oirán tus alumnos al llamar',
        fields: [
          {key:'agent_name', type:'text', label:'Nombre de la recepcionista', placeholder:'Ej: Clara, Raquel…', defaultValue:'Clara'},
          {key:'language', type:'select', label:'Idioma', defaultValue:'es',
            options:[{value:'es',label:'Español'},{value:'ca',label:'Català'},{value:'eu',label:'Euskera'},{value:'en',label:'English'}]},
        ]
      },
      {
        id:'phone', title:'¿Cuál es el número de teléfono del agente?',
        subtitle:'El número Twilio que comprarás para que los alumnos llamen a tu recepcionista IA',
        fields: [{key:'agent_phone', type:'text', label:'Número de teléfono (formato internacional)', placeholder:'Ej: +12138753573', defaultValue:''}]
      },
      {
        id:'hours', title:'¿Cuándo atendéis?', subtitle:'Horario de la academia',
        fields: [{key:'business_hours', type:'hours', label:'Horario', defaultValue:null}]
      },
      {
        id:'services', title:'¿Qué cursos o materias ofrecéis?',
        subtitle:'La recepcionista informará sobre disponibilidad y horarios',
        fields: [
          {key:'services', type:'multiselect', label:'Áreas', defaultValue:['idiomas'],
            options:[
              {value:'idiomas',label:'Idiomas (inglés, francés…)',emoji:'🌍'},
              {value:'informatica',label:'Informática / Programación',emoji:'💻'},
              {value:'oposiciones',label:'Oposiciones',emoji:'📋'},
              {value:'refuerzo',label:'Refuerzo escolar',emoji:'📖'},
              {value:'universidad',label:'Preparación universitaria',emoji:'🎓'},
              {value:'musica',label:'Música / Arte',emoji:'🎵'},
              {value:'fp',label:'Formación profesional',emoji:'🔧'},
            ]
          }
        ]
      },
      {
        id:'details', title:'Detalles de las clases',
        subtitle:'Para gestionar la agenda',
        fields: [
          {key:'appointment_duration', type:'duration', label:'¿Cuánto dura una clase?', defaultValue:60,
            options:[{value:'45',label:'45 minutos'},{value:'60',label:'1 hora'},{value:'90',label:'1h 30min'},{value:'120',label:'2 horas'}]},
          {key:'max_group', type:'number', label:'Alumnos máximos por clase', placeholder:'Ej: 12', defaultValue:12, min:1, max:50},
        ]
      }
    ]
  },

  spa: {
    emoji:'💆', label:'Spa / Centro de Bienestar', agentDefaultName:'Nerea',
    steps: [
      {
        id:'agent', title:'¿Cómo se llamará tu recepcionista?', subtitle:'El nombre que oirán tus clientes al llamar',
        fields: [
          {key:'agent_name', type:'text', label:'Nombre de la recepcionista', placeholder:'Ej: Nerea, Silvia…', defaultValue:'Nerea'},
          {key:'language', type:'select', label:'Idioma', defaultValue:'es',
            options:[{value:'es',label:'Español'},{value:'ca',label:'Català'},{value:'eu',label:'Euskera'},{value:'en',label:'English'}]},
        ]
      },
      {
        id:'phone', title:'¿Cuál es el número de teléfono del agente?',
        subtitle:'El número Twilio que comprarás para que los clientes llamen a tu recepcionista IA',
        fields: [{key:'agent_phone', type:'text', label:'Número de teléfono (formato internacional)', placeholder:'Ej: +12138753573', defaultValue:''}]
      },
      {
        id:'hours', title:'¿Cuándo abrís?', subtitle:'Horario del spa',
        fields: [{key:'business_hours', type:'hours', label:'Horario', defaultValue:null}]
      },
      {
        id:'services', title:'¿Qué tratamientos ofrecéis?',
        subtitle:'La recepcionista informará sobre disponibilidad y precios',
        fields: [
          {key:'services', type:'multiselect', label:'Tratamientos', defaultValue:['masaje','facial'],
            options:[
              {value:'masaje',label:'Masajes (relajante, descontracturante…)',emoji:'💆'},
              {value:'facial',label:'Tratamientos faciales',emoji:'🧖'},
              {value:'corporal',label:'Tratamientos corporales',emoji:'✨'},
              {value:'circuito',label:'Circuito termal / Aguas',emoji:'🌊'},
              {value:'manicura',label:'Manicura / Pedicura',emoji:'💅'},
              {value:'depilacion',label:'Depilación',emoji:'🌸'},
              {value:'packs',label:'Packs y bonos',emoji:'🎁'},
            ]
          }
        ]
      },
      {
        id:'details', title:'Detalles del spa',
        subtitle:'Para gestionar bien las citas',
        fields: [
          {key:'appointment_duration', type:'duration', label:'¿Cuánto dura un tratamiento medio?', defaultValue:60,
            options:[{value:'30',label:'30 minutos'},{value:'45',label:'45 minutos'},{value:'60',label:'1 hora'},{value:'90',label:'1h 30min'},{value:'120',label:'2 horas'}]},
          {key:'num_professionals', type:'number', label:'¿Cuántos terapeutas / cabinas tenéis?', placeholder:'Ej: 3', defaultValue:3, min:1, max:20},
        ]
      }
    ]
  },

  taller: {
    emoji:'🔧', label:'Taller Mecánico', agentDefaultName:'Javi',
    steps: [
      {
        id:'agent', title:'¿Cómo se llamará tu recepcionista?', subtitle:'El nombre que oirán tus clientes al llamar',
        fields: [
          {key:'agent_name', type:'text', label:'Nombre del recepcionista', placeholder:'Ej: Javi, Miguel…', defaultValue:'Javi'},
          {key:'language', type:'select', label:'Idioma', defaultValue:'es',
            options:[{value:'es',label:'Español'},{value:'ca',label:'Català'},{value:'eu',label:'Euskera'},{value:'en',label:'English'}]},
        ]
      },
      {
        id:'phone', title:'¿Cuál es el número de teléfono del agente?',
        subtitle:'El número Twilio que comprarás para que los clientes llamen a tu recepcionista IA',
        fields: [{key:'agent_phone', type:'text', label:'Número de teléfono (formato internacional)', placeholder:'Ej: +12138753573', defaultValue:''}]
      },
      {
        id:'hours', title:'¿Cuándo abrís?', subtitle:'Horario del taller',
        fields: [{key:'business_hours', type:'hours', label:'Horario', defaultValue:null}]
      },
      {
        id:'services', title:'¿Qué servicios ofrecéis?',
        subtitle:'La recepcionista informará sobre lo que hacéis',
        fields: [
          {key:'services', type:'multiselect', label:'Servicios', defaultValue:['revision','neumaticos'],
            options:[
              {value:'revision',label:'Revisión general / Pre-ITV',emoji:'🔍'},
              {value:'aceite',label:'Cambio de aceite y filtros',emoji:'🛢️'},
              {value:'neumaticos',label:'Neumáticos',emoji:'🛞'},
              {value:'frenos',label:'Frenos y embrague',emoji:'🛑'},
              {value:'electricidad',label:'Electricidad / Batería',emoji:'⚡'},
              {value:'chapa_pintura',label:'Chapa y pintura',emoji:'🎨'},
              {value:'aire_acondicionado',label:'Aire acondicionado',emoji:'❄️'},
              {value:'itv',label:'Preparación ITV',emoji:'📋'},
            ]
          }
        ]
      },
      {
        id:'capacity', title:'Capacidad del taller',
        subtitle:'Para gestionar las citas',
        fields: [
          {key:'total_tables', type:'number', label:'¿Cuántos coches podéis atender a la vez?', placeholder:'Ej: 4', defaultValue:4, min:1, max:30},
          {key:'has_urgencias', type:'toggle', label:'¿Atendéis urgencias / averías?',
            hint:'La recepcionista ofrecerá cita urgente o servicio de grúa', defaultValue:true},
        ]
      }
    ]
  },

  seguros: {
    emoji:'🛡️', label:'Correduría de Seguros', agentDefaultName:'Carmen',
    steps: [
      {
        id:'agent', title:'¿Cómo se llamará tu recepcionista?', subtitle:'El nombre que oirán tus clientes al llamar',
        fields: [
          {key:'agent_name', type:'text', label:'Nombre de la recepcionista', placeholder:'Ej: Carmen, Teresa…', defaultValue:'Carmen'},
          {key:'language', type:'select', label:'Idioma', defaultValue:'es',
            options:[{value:'es',label:'Español'},{value:'ca',label:'Català'},{value:'eu',label:'Euskera'},{value:'en',label:'English'}]},
        ]
      },
      {
        id:'phone', title:'¿Cuál es el número de teléfono del agente?',
        subtitle:'El número Twilio que comprarás para que los clientes llamen a tu recepcionista IA',
        fields: [{key:'agent_phone', type:'text', label:'Número de teléfono (formato internacional)', placeholder:'Ej: +12138753573', defaultValue:''}]
      },
      {
        id:'hours', title:'¿Cuándo atendéis?', subtitle:'Horario de la correduría',
        fields: [{key:'business_hours', type:'hours', label:'Horario', defaultValue:null}]
      },
      {
        id:'services', title:'¿Qué tipos de seguros ofrecéis?',
        subtitle:'La recepcionista orientará a los clientes según su necesidad',
        fields: [
          {key:'services', type:'multiselect', label:'Tipos de seguro', defaultValue:['auto','hogar'],
            options:[
              {value:'auto',label:'Seguro de coche / Moto',emoji:'🚗'},
              {value:'hogar',label:'Seguro de hogar',emoji:'🏠'},
              {value:'salud',label:'Seguro de salud',emoji:'🏥'},
              {value:'vida',label:'Seguro de vida',emoji:'❤️'},
              {value:'negocio',label:'Seguro de negocio / RC',emoji:'🏢'},
              {value:'viaje',label:'Seguro de viaje',emoji:'✈️'},
              {value:'decesos',label:'Decesos',emoji:'🕊️'},
            ]
          }
        ]
      },
      {
        id:'details', title:'Detalles de las citas',
        subtitle:'Para gestionar la agenda',
        fields: [
          {key:'appointment_duration', type:'duration', label:'¿Cuánto dura una cita media?', defaultValue:30,
            options:[{value:'15',label:'15 minutos'},{value:'30',label:'30 minutos'},{value:'45',label:'45 minutos'},{value:'60',label:'1 hora'}]},
          {key:'has_urgencias', type:'toggle', label:'¿Atendéis siniestros urgentes?',
            hint:'La recepcionista transferirá los siniestros al departamento correspondiente', defaultValue:true},
        ]
      }
    ]
  },

  inmobiliaria: {
    emoji:'🏠', label:'Inmobiliaria', agentDefaultName:'Patricia',
    steps: [
      {
        id:'agent', title:'¿Cómo se llamará tu recepcionista?', subtitle:'El nombre que oirán tus clientes al llamar',
        fields: [
          {key:'agent_name', type:'text', label:'Nombre de la recepcionista', placeholder:'Ej: Patricia, Rosa…', defaultValue:'Patricia'},
          {key:'language', type:'select', label:'Idioma', defaultValue:'es',
            options:[{value:'es',label:'Español'},{value:'ca',label:'Català'},{value:'eu',label:'Euskera'},{value:'en',label:'English'}]},
        ]
      },
      {
        id:'phone', title:'¿Cuál es el número de teléfono del agente?',
        subtitle:'El número Twilio que comprarás para que los clientes llamen a tu recepcionista IA',
        fields: [{key:'agent_phone', type:'text', label:'Número de teléfono (formato internacional)', placeholder:'Ej: +12138753573', defaultValue:''}]
      },
      {
        id:'hours', title:'¿Cuándo atendéis?', subtitle:'Horario de la inmobiliaria',
        fields: [{key:'business_hours', type:'hours', label:'Horario', defaultValue:null}]
      },
      {
        id:'services', title:'¿Qué servicios ofrecéis?',
        subtitle:'La recepcionista orientará a los clientes según su interés',
        fields: [
          {key:'services', type:'multiselect', label:'Servicios', defaultValue:['venta','alquiler'],
            options:[
              {value:'venta',label:'Venta de inmuebles',emoji:'🏘️'},
              {value:'alquiler',label:'Alquiler',emoji:'🔑'},
              {value:'alquiler_vacacional',label:'Alquiler vacacional',emoji:'🏖️'},
              {value:'tasaciones',label:'Tasaciones',emoji:'📊'},
              {value:'gestion_patrimonial',label:'Gestión patrimonial',emoji:'🏛️'},
              {value:'obra_nueva',label:'Obra nueva / Promociones',emoji:'🏗️'},
            ]
          }
        ]
      },
      {
        id:'details', title:'¿Cómo organizáis las visitas?',
        subtitle:'Para gestionar bien la agenda de los agentes',
        fields: [
          {key:'appointment_duration', type:'duration', label:'¿Cuánto dura una visita a un inmueble?', defaultValue:60,
            options:[{value:'30',label:'30 minutos'},{value:'45',label:'45 minutos'},{value:'60',label:'1 hora'},{value:'90',label:'1h 30min'}]},
          {key:'num_professionals', type:'number', label:'¿Cuántos agentes inmobiliarios hay?', placeholder:'Ej: 3', defaultValue:3, min:1, max:50},
        ]
      }
    ]
  },

  cafeteria: {
    emoji:'☕', label:'Cafetería', agentDefaultName:'Sofía',
    steps: [
      {
        id:'agent', title:'¿Cómo se llamará tu recepcionista?', subtitle:'El nombre que oirán tus clientes al llamar',
        fields: [
          {key:'agent_name', type:'text', label:'Nombre de la recepcionista', placeholder:'Ej: Sofía, Carmen…', defaultValue:'Sofía'},
          {key:'language', type:'select', label:'Idioma', defaultValue:'es',
            options:[{value:'es',label:'Español'},{value:'ca',label:'Català'},{value:'eu',label:'Euskera'},{value:'en',label:'English'}]},
        ]
      },
      {
        id:'phone', title:'¿Cuál es el número de teléfono del agente?',
        subtitle:'El número Twilio que comprarás para que los clientes llamen a tu recepcionista IA',
        fields: [{key:'agent_phone', type:'text', label:'Número de teléfono (formato internacional)', placeholder:'Ej: +12138753573', defaultValue:''}]
      },
      {
        id:'hours', title:'¿Cuándo abrís?', subtitle:'Horario de la cafetería',
        fields: [{key:'business_hours', type:'hours', label:'Horario', defaultValue:null}]
      },
      {
        id:'services', title:'¿Qué gestionáis por teléfono?',
        subtitle:'Tu recepcionista se centrará en esto',
        fields: [
          {key:'services', type:'multiselect', label:'Servicios', defaultValue:['reservas','informacion'],
            options:[
              {value:'reservas',label:'Reservar mesas',emoji:'🍽️'},
              {value:'pedidos',label:'Pedidos para llevar',emoji:'📦'},
              {value:'informacion',label:'Preguntas sobre carta y horario',emoji:'ℹ️'},
              {value:'eventos',label:'Reservar para eventos',emoji:'🎉'},
            ]
          }
        ]
      }
    ]
  },
}

// Fallback para tipos no reconocidos
const FALLBACK_FLOW: FlowConfig = {
  emoji:'ª', label:'Negocio', agentDefaultName:'Sofía',
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
        id:'phone', title:'¿Cuál es el número de teléfono del agente?',
        subtitle:'El número Twilio que comprarás para que los clientes llamen a tu recepcionista IA',
        fields: [
          {key:'agent_phone', type:'text', label:'Número de teléfono (formato internacional)', placeholder:'Ej: +12138753573', defaultValue:''},
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
            {value:'citas',label:'Citas y reservas',emoji:''},
            {value:'informacion',label:'Preguntas e información',emoji:'â'},
            {value:'cancelaciones',label:'Cancelaciones',emoji:'â'},
          ]
        }
      ]
    }
  ]
}

// ââ Servicios dinámicos según tipo de salón ââââââââââââââââââââââââââââââââââ
const SERVICIOS_PELUQUERIA = [
  {value:'corte_mujer',  label:'Corte de pelo (mujer)',    emoji:'â️'},
  {value:'corte_hombre', label:'Corte de pelo (hombre)',   emoji:''},
  {value:'tinte',        label:'Tinte y coloración',       emoji:'¨'},
  {value:'mechas',       label:'Mechas / Balayage',        emoji:'â¨'},
  {value:'alisado',      label:'Alisado / Keratina',       emoji:''},
  {value:'peinado',      label:'Recogidos y peinados',     emoji:'°'},
  {value:'manicura',     label:'Manicura / Pedicura',      emoji:''},
  {value:'depilacion',   label:'Depilación',               emoji:'¸'},
  {value:'facial',       label:'Tratamientos faciales',    emoji:'§´'},
]
const SERVICIOS_BARBERIA = [
  {value:'corte_hombre',   label:'Corte de pelo (hombre)',    emoji:''},
  {value:'tinte_pelo',     label:'Tinte y coloración de pelo',emoji:'¨'},
  {value:'barba_perfilado',label:'Barba y perfilado',          emoji:'ª'},
  {value:'afeitado',       label:'Afeitado clásico',           emoji:'ª'},
  {value:'barba_color',    label:'Tinte de barba',             emoji:'️'},
  {value:'diseño_barba',   label:'Diseño y arreglo de barba',  emoji:'â️'},
  {value:'tratamiento',    label:'Tratamiento capilar',        emoji:''},
  {value:'cejas',          label:'Depilación de cejas',        emoji:'â¨'},
]
const SERVICIOS_AMBOS = [
  {value:'corte_mujer',     label:'Corte de pelo (mujer)',       emoji:'â️'},
  {value:'corte_hombre',    label:'Corte de pelo (hombre)',      emoji:''},
  {value:'tinte_pelo',      label:'Tinte y coloración de pelo',  emoji:'¨'},
  {value:'mechas',          label:'Mechas / Balayage',           emoji:'â¨'},
  {value:'alisado',         label:'Alisado / Keratina',          emoji:''},
  {value:'peinado',         label:'Recogidos y peinados',        emoji:'°'},
  {value:'barba_perfilado', label:'Barba y perfilado',           emoji:'ª'},
  {value:'afeitado',        label:'Afeitado clásico',            emoji:'ª'},
  {value:'barba_color',     label:'Tinte de barba',              emoji:'️'},
  {value:'diseño_barba',    label:'Diseño y arreglo de barba',   emoji:'â️'},
  {value:'manicura',        label:'Manicura / Pedicura',         emoji:''},
  {value:'depilacion',      label:'Depilación',                  emoji:'¸'},
  {value:'facial',          label:'Tratamientos faciales',       emoji:'§´'},
]
function getSalonServices(salonTipo: string) {
  if (salonTipo === 'barberia') return SERVICIOS_BARBERIA
  if (salonTipo === 'ambos')    return SERVICIOS_AMBOS
  return SERVICIOS_PELUQUERIA // default
}

// ââ Defaults de horario âââââââââââââââââââââââââââââââââââââââââââââââââââââââ
function defaultHours() {
  return Object.fromEntries(DAYS.map((d,i) => [d, { open:'09:00', close:'19:00', closed: i>=5 }]))
}

// ââ Componente campo âââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
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
          style={{width:36,height:36,borderRadius:9,border:`1px solid ${C.border}`,background:'rgba(255,255,255,0.04)',color:C.text,fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>â</button>
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
              {selected && <span style={{marginLeft:'auto',color:C.amber,fontSize:14}}>â</span>}
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
                  <span style={{color:C.muted,fontSize:11}}>â</span>
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

// ââ Simulación por tipo de negocio âââââââââââââââââââââââââââââââââââââââââââ
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
    if (type === 'barberia') {
      return [
        {from:'cliente', text:'Buenas, quería pedir cita para corte y barba.'},
        {from:'agent', text:`${businessName}, buenas. Soy ${agentName}. ¿Tienes preferencia de día o de barbero?`},
        {from:'cliente', text:'El viernes por la tarde si puede ser.'},
        {from:'agent', text:`El viernes tengo hueco a las 17:00 y a las 18:30. ¿Cuál prefieres?`},
        {from:'cliente', text:'A las 17:00.'},
        {from:'agent', text:`Apuntado. Viernes a las 17:00, corte y barba. ¿A nombre de quién?`},
        {from:'cliente', text:'David.'},
        {from:'agent', text:`Hecho David. Nos vemos el viernes. ¡Hasta luego!`},
      ]
    }
    if (type === 'fisioterapia') {
      return [
        {from:'cliente', text:'Hola, necesito una cita de fisioterapia para la espalda.'},
        {from:'agent', text:`${businessName}, buenas. Soy ${agentName}. ¿Es una lesión reciente o un tratamiento que ya llevas?`},
        {from:'cliente', text:'Me duele desde hace una semana, creo que es una contractura.'},
        {from:'agent', text:`Vale, te apunto para fisioterapia manual. ¿Qué día te viene bien?`},
        {from:'cliente', text:'El miércoles por la mañana.'},
        {from:'agent', text:`Tengo hueco el miércoles a las 10:00. ¿Te viene bien?`},
        {from:'cliente', text:'Perfecto.'},
        {from:'agent', text:`Anotado. Miércoles a las 10:00. ¿Me das tu nombre?`},
        {from:'cliente', text:'Pedro Martín.'},
        {from:'agent', text:`Genial Pedro. Hasta el miércoles. ¡Que vaya bien!`},
      ]
    }
    if (type === 'psicologia') {
      return [
        {from:'cliente', text:'Hola, quería pedir cita con un psicólogo.'},
        {from:'agent', text:`${businessName}, buenas. Soy ${agentName}. ¿Es tu primera consulta con nosotros?`},
        {from:'cliente', text:'Sí, es la primera vez.'},
        {from:'agent', text:`Perfecto. ¿Qué día y hora te vendrían mejor?`},
        {from:'cliente', text:'El jueves por la tarde si puede ser.'},
        {from:'agent', text:`El jueves tengo disponible a las 17:00. ¿Te parece bien?`},
        {from:'cliente', text:'Sí, perfecto.'},
        {from:'agent', text:`Anotado. Jueves a las 17:00, primera consulta. ¿Me das tu nombre?`},
        {from:'cliente', text:'Ana López.'},
        {from:'agent', text:`Perfecto Ana. Hasta el jueves. ¡Un saludo!`},
      ]
    }
    if (type === 'hotel') {
      return [
        {from:'cliente', text:'Hola, quería reservar una habitación para el fin de semana.'},
        {from:'agent', text:`${businessName}, buenas. Soy ${agentName}. ¿Para cuántas personas y qué tipo de habitación busca?`},
        {from:'cliente', text:'Somos dos, una doble estaría bien.'},
        {from:'agent', text:`Perfecto. ¿Del viernes al domingo? Tengo habitación doble disponible.`},
        {from:'cliente', text:'Sí, viernes y sábado.'},
        {from:'agent', text:`Reserva anotada: habitación doble del viernes al domingo. Check-in a partir de las 14:00. ¿A nombre de quién?`},
        {from:'cliente', text:'A nombre de García.'},
        {from:'agent', text:`Hecho. Reserva confirmada a nombre de García. ¡Les esperamos el viernes!`},
      ]
    }
    if (type === 'ecommerce') {
      return [
        {from:'cliente', text:'Hola, quería saber el estado de mi pedido.'},
        {from:'agent', text:`${businessName}, buenas. Soy ${agentName}. ¿Me das tu nombre o número de pedido?`},
        {from:'cliente', text:'Soy María González, pedí unas zapatillas la semana pasada.'},
        {from:'agent', text:`Vale María, dame un segundo que lo miro... Tu pedido está en camino, debería llegarte mañana o pasado.`},
        {from:'cliente', text:'Genial, muchas gracias.'},
        {from:'agent', text:`De nada María. Si necesitas algo más, aquí estamos. ¡Hasta luego!`},
      ]
    }
    if (type === 'gimnasio') {
      return [
        {from:'cliente', text:'Hola, quería apuntarme a una clase de spinning.'},
        {from:'agent', text:`${businessName}, buenas. Soy ${agentName}. Las clases de spinning son los martes y jueves a las 19:00. ¿Cuál te viene mejor?`},
        {from:'cliente', text:'El martes.'},
        {from:'agent', text:`Perfecto. ¿Eres socio ya o es tu primera vez?`},
        {from:'cliente', text:'Soy socio.'},
        {from:'agent', text:`Genial. Te apunto al spinning del martes a las 19:00. ¿Me das tu nombre?`},
        {from:'cliente', text:'Roberto Díaz.'},
        {from:'agent', text:`Apuntado Roberto. ¡Nos vemos el martes!`},
      ]
    }
    if (type === 'taller') {
      return [
        {from:'cliente', text:'Hola, quería pedir cita para la revisión del coche.'},
        {from:'agent', text:`${businessName}, buenas. Soy ${agentName}. ¿Qué coche es?`},
        {from:'cliente', text:'Un Seat León de 2019.'},
        {from:'agent', text:`Vale. ¿Es revisión general o algo concreto? Aceite, frenos, pre-ITV...`},
        {from:'cliente', text:'Revisión general, que me toca la ITV pronto.'},
        {from:'agent', text:`Perfecto, revisión pre-ITV. ¿Qué día te viene bien traerlo?`},
        {from:'cliente', text:'El lunes si puede ser.'},
        {from:'agent', text:`El lunes por la mañana te lo puedo coger. ¿A nombre de quién?`},
        {from:'cliente', text:'Antonio Ruiz.'},
        {from:'agent', text:`Hecho Antonio. Te esperamos el lunes con el León. ¡Hasta luego!`},
      ]
    }
    if (type === 'seguros') {
      return [
        {from:'cliente', text:'Hola, quería informarme sobre un seguro de hogar.'},
        {from:'agent', text:`${businessName}, buenas. Soy ${agentName}. ¿Busca contratar uno nuevo o quiere comparar con el que tiene?`},
        {from:'cliente', text:'Quiero ver opciones, acabo de comprar un piso.'},
        {from:'agent', text:`Enhorabuena. Lo mejor es que hable con un asesor. ¿Le viene bien el miércoles a las 11:00?`},
        {from:'cliente', text:'Sí, perfecto.'},
        {from:'agent', text:`Cita anotada el miércoles a las 11:00 para seguro de hogar. ¿Me da su nombre?`},
        {from:'cliente', text:'Luis Fernández.'},
        {from:'agent', text:`Perfecto Luis. Hasta el miércoles. ¡Un saludo!`},
      ]
    }
    if (type === 'inmobiliaria') {
      return [
        {from:'cliente', text:'Hola, estoy buscando un piso en alquiler por la zona centro.'},
        {from:'agent', text:`${businessName}, buenas. Soy ${agentName}. ¿Tiene alguna preferencia de precio o número de habitaciones?`},
        {from:'cliente', text:'Dos habitaciones, hasta 900 euros al mes.'},
        {from:'agent', text:`Tenemos varias opciones. Lo mejor es que un agente le enseñe los pisos. ¿Le viene bien el jueves por la tarde?`},
        {from:'cliente', text:'Sí, a las 17:00 podría.'},
        {from:'agent', text:`Perfecto. ¿Me da su nombre y teléfono para confirmarle la visita?`},
        {from:'cliente', text:'Soy Elena Mora, 612 345 678.'},
        {from:'agent', text:`Anotado Elena. Un agente le llamará para confirmar. ¡Hasta pronto!`},
      ]
    }
    if (type === 'spa') {
      return [
        {from:'cliente', text:'Hola, quería reservar un masaje relajante.'},
        {from:'agent', text:`${businessName}, buenas. Soy ${agentName}. ¿De cuánto tiempo lo quieres, de 30, 60 o 90 minutos?`},
        {from:'cliente', text:'De una hora.'},
        {from:'agent', text:`Perfecto. ¿Qué día te vendría bien?`},
        {from:'cliente', text:'El sábado si puede ser.'},
        {from:'agent', text:`El sábado tengo hueco a las 11:00 y a las 16:00. ¿Cuál prefieres?`},
        {from:'cliente', text:'A las 11.'},
        {from:'agent', text:`Anotado. Masaje relajante de 60 min el sábado a las 11:00. ¿A nombre de quién?`},
        {from:'cliente', text:'Cristina.'},
        {from:'agent', text:`Perfecto Cristina. Te recomiendo llegar 10 minutitos antes. ¡Hasta el sábado!`},
      ]
    }
    if (type === 'academia') {
      return [
        {from:'cliente', text:'Hola, quería apuntar a mi hijo a clases de inglés.'},
        {from:'agent', text:`${businessName}, buenas. Soy ${agentName}. ¿Qué edad tiene y qué nivel tiene más o menos?`},
        {from:'cliente', text:'Tiene 12 años, está en primero de ESO.'},
        {from:'agent', text:`Perfecto. Tenemos grupo de inglés para ESO los martes y jueves de 17:00 a 18:00. ¿Le vendría bien?`},
        {from:'cliente', text:'Sí, eso está genial.'},
        {from:'agent', text:`Apuntado. ¿Me da el nombre del alumno?`},
        {from:'cliente', text:'Pablo Serrano.'},
        {from:'agent', text:`Perfecto. Pablo empieza el martes. ¡Hasta pronto!`},
      ]
    }
    // Restaurante / Bar / Cafetería por defecto
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
            Siguiente mensaje â
          </button>
        ) : (
          <div style={{flex:1,padding:'11px 14px',background:C.greenDim,border:`1px solid ${C.green}33`,borderRadius:10,textAlign:'center' as const}}>
            <p style={{fontSize:13,color:C.green,fontWeight:700}}>â ¡Así de fácil! Tu recepcionista ya sabe cómo gestionar esto.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ââ Página principal ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
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
          special_cases: (() => {
            const type = tenant?.type || 'otro'
            if (['restaurante','bar','cafeteria'].includes(type)) return { allergies:'review', birthdays:'confirm', events:'review', vip:'confirm' }
            if (['clinica_dental','clinica_medica','fisioterapia'].includes(type)) return { urgency:'review', first_visit:'confirm', vip:'confirm' }
            if (type === 'veterinaria') return { urgency:'review', surgery:'review', vip:'confirm' }
            if (type === 'psicologia') return { crisis:'review', first_visit:'confirm' }
            if (type === 'hotel') return { large_group:'review', long_stay:'review', vip:'confirm' }
            if (type === 'taller') return { urgency:'review', tow_required:'review' }
            if (type === 'seguros') return { urgency:'review', siniestro:'review' }
            if (type === 'ecommerce') return { high_value:'review', return_request:'review' }
            return { vip:'confirm' }
          })(),
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
    // Guardar TODOS los datos recogidos en business_knowledge, business_rules y tenant
    try {
      await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenant.id,
          agent_phone: answers.agent_phone || null,
          business_name: tenant.name,
          business_type: tenant.type,
          agent_name: answers.agent_name || null,
          hours: answers.business_hours || null,
          services: answers.services || null,
          max_capacity: answers.total_tables ? (answers.total_tables * (answers.table_capacity || 4)) : (answers.max_group || null),
          advance_hours: 24,
          // Campos específicos por vertical
          num_professionals: answers.num_professionals || null,
          appointment_duration: answers.appointment_duration || null,
          has_urgencias: answers.has_urgencias || false,
          total_tables: answers.total_tables || null,
          table_capacity: answers.table_capacity || null,
          max_group: answers.max_group || null,
          reservation_duration: answers.reservation_duration || null,
          checkin_time: answers.checkin_time || null,
          checkout_time: answers.checkout_time || null,
          animal_types: answers.animal_types || null,
          meeting_types: answers.meeting_types || null,
          salon_tipo: answers.salon_tipo || null,
          num_dentists: answers.num_dentists || null,
        })
      })
    } catch(e) { console.error('onboarding/complete error', e) }
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
                    {isDone?'â':i+1}
                  </div>
                  <span style={{fontSize:9,color:isActive?C.amber:isDone?C.green:C.muted,fontWeight:isActive?700:400,whiteSpace:'nowrap' as const,maxWidth:70,textAlign:'center' as const,lineHeight:1.2}}>
                    {label.slice(0,18)}{label.length>18?'â¦':''}
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
                  â Atrás
                </button>
              )}
              <button onClick={saveAndNext} disabled={saving||!canContinue()}
                style={{flex:1,padding:'12px',background:canContinue()?`linear-gradient(135deg,${C.amber},#E8923A)`:'rgba(255,255,255,0.06)',border:'none',borderRadius:10,cursor:canContinue()?'pointer':'not-allowed',color:canContinue()?'#0C1018':C.muted,fontSize:14,fontWeight:700,fontFamily:'inherit',transition:'all 0.15s',opacity:saving?0.7:1}}>
                {saving ? 'Guardandoâ¦' : step >= flow.steps.length-1 ? 'Ver demostración â' : 'Continuar â'}
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
              Ir al panel â
            </button>
            <button onClick={()=>setStep(flow.steps.length-1)}
              style={{width:'100%',marginTop:8,padding:'8px',background:'none',border:'none',cursor:'pointer',color:C.muted,fontSize:12,fontFamily:'inherit'}}>
              â Volver a configurar
            </button>
          </div>
        )}

        {/* PANTALLA FINAL */}
        {done && (
          <div className="rz-ob-card" style={{background:C.card,border:`1px solid ${C.green}22`,borderRadius:18,padding:28,textAlign:'center' as const}}>
            <div style={{width:72,height:72,background:C.greenDim,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px',fontSize:36}}></div>
            <h2 style={{fontSize:24,fontWeight:800,color:C.text,letterSpacing:'-0.02em',marginBottom:8}}>¡Todo listo!</h2>
            <p style={{fontSize:14,color:C.muted,marginBottom:24,lineHeight:1.6}}>
              <strong style={{color:C.text}}>{answers.agent_name || flow.agentDefaultName}</strong> está lista para atender las llamadas de <strong style={{color:C.text}}>{tenant.name}</strong>.
            </p>

            <div style={{background:'rgba(255,255,255,0.02)',border:`1px solid ${C.border}`,borderRadius:12,padding:16,marginBottom:20,textAlign:'left' as const}}>
              {[
                {icon:'â',color:C.green,text:`Recepcionista configurada: ${answers.agent_name || flow.agentDefaultName}`},
                {icon:'â',color:C.green,text:'Horario de atención guardado'},
                {icon:'â',color:C.green,text:`Tipo de negocio: ${flow.label}`},
                {icon:'â',color:C.green,text:`Servicios activados: ${(answers.services||[]).length > 0 ? (answers.services||[]).length+' seleccionados' : 'configurados'}`},
                {icon:'',color:C.amber,text:'10 llamadas gratuitas disponibles para probar'},
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
                ' Configura el número de teléfono en Configuración',
                ' Añade tu carta o servicios en "Carta y productos"',
                'â️ Ajusta cómo gestiona reservas especiales',
              ].map((t,i)=>(
                <div key={i} style={{display:'flex',gap:8,alignItems:'center',marginBottom:i<2?6:0}}>
                  <span style={{fontSize:12,color:C.sub}}>{t}</span>
                </div>
              ))}
            </div>

            <button onClick={completeOnboarding} disabled={saving}
              style={{width:'100%',padding:'14px',background:`linear-gradient(135deg,${C.amber},#E8923A)`,border:'none',borderRadius:12,cursor:'pointer',color:'#0C1018',fontSize:15,fontWeight:800,fontFamily:'inherit',transition:'all 0.15s',opacity:saving?0.7:1}}>
              {saving ? 'Activandoâ¦' : 'Ir al centro de control â'}
            </button>
          </div>
        )}

      </div>{/* maxWidth */}
    </div>
  )
}
