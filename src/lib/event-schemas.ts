/**
 * RESERVO.AI — EVENT SCHEMA ENGINE
 * ─────────────────────────────────────────────────────────────────────────────
 * Motor central de schemas de eventos por tipo de negocio.
 * Un mismo motor RT, schemas configurables por tipo.
 *
 * Arquitectura:
 *   BusinessType → EventSchema[] → EventField[] + EventAction[]
 *
 * Cada schema define:
 *   - qué datos recoge el agente de voz
 *   - cómo se llama el evento en la UI
 *   - qué campos mostrar en tiempo real
 *   - qué acciones están disponibles
 *   - estados posibles durante la llamada activa
 *   - eventos de demo realistas para ese negocio
 */

// ── Tipos base ────────────────────────────────────────────────────────────────

export interface EventField {
  key:       string
  label:     string
  icon?:     string
  format?:   'text' | 'phone' | 'time' | 'number' | 'badge'
  color?:    string
  important?: boolean  // mostrar siempre aunque esté vacío
}

export interface EventAction {
  id:     string
  label:  string
  icon:   string
  color:  string
  href?:  string       // navegar a esta ruta
  rpc?:   string       // llamar a este RPC de Supabase
  style:  'primary' | 'secondary' | 'danger'
}

export interface EventSchema {
  type:         string           // id interno del evento
  label:        string           // nombre humano
  labelPlural:  string
  icon:         string
  color:        string
  priority:     'high' | 'normal'
  fields:       EventField[]     // campos que el agente extrae
  actions:      EventAction[]    // acciones posibles tras el evento
  callStates:   Record<string, { label: string; color: string }>  // estados durante llamada activa
}

export interface BusinessEventConfig {
  businessType:  string
  schemas:       EventSchema[]
  demoEvents:    DemoEvent[]
  intentMap:     Record<string, string>  // intent del agente → schema.type
  activeCallLabel: string                // "Llamada activa" | "Consulta en curso" | etc.
}

export interface DemoEvent {
  schemaType: string
  title:      string
  sub:        string
  priority:   'high' | 'normal'
  fields?:    Record<string, string>
}

// ── Paleta compartida ─────────────────────────────────────────────────────────
const COL = {
  teal:   '#2DD4BF', tealDim:   'rgba(45,212,191,0.12)',
  amber:  '#F0A84E', amberDim:  'rgba(240,168,78,0.12)',
  green:  '#34D399', greenDim:  'rgba(52,211,153,0.10)',
  red:    '#F87171', redDim:    'rgba(248,113,113,0.10)',
  violet: '#A78BFA', violetDim: 'rgba(167,139,250,0.12)',
  blue:   '#60A5FA', blueDim:   'rgba(96,165,250,0.10)',
  yellow: '#FBB53F', yellowDim: 'rgba(251,181,63,0.10)',
}

// ── SCHEMAS POR TIPO DE NEGOCIO ────────────────────────────────────────────

// ─────────────────────────────────────────────────────────
// RESTAURANTE / BAR
// ─────────────────────────────────────────────────────────
const RESTAURANTE_CONFIG: BusinessEventConfig = {
  businessType: 'restaurante',
  activeCallLabel: 'Llamada activa',
  intentMap: {
    reserva:      'reservation',
    pedido:       'order',
    cancelacion:  'cancellation',
    consulta:     'inquiry',
    queja:        'complaint',
    otro:         'inquiry',
  },
  schemas: [
    {
      type: 'reservation', label: 'Reserva', labelPlural: 'Reservas',
      icon: '📅', color: COL.teal, priority: 'high',
      fields: [
        { key:'customer_name', label:'A nombre de',  icon:'👤', important:true },
        { key:'party_size',    label:'Personas',      icon:'👥', format:'number' },
        { key:'date',          label:'Fecha',         icon:'📆' },
        { key:'time',          label:'Hora',          icon:'🕐', format:'time', important:true },
        { key:'zone',          label:'Zona',          icon:'🪑' },
        { key:'notes',         label:'Notas',         icon:'📝' },
      ],
      actions: [
        { id:'confirm',  label:'Confirmar',      icon:'✓', color:COL.green,  style:'primary',   href:'/reservas' },
        { id:'review',   label:'Revisar',        icon:'👁', color:COL.amber,  style:'secondary', href:'/reservas' },
        { id:'cancel',   label:'Cancelar',       icon:'✕', color:COL.red,    style:'danger' },
      ],
      callStates: {
        escuchando:         { label:'Escuchando…',             color:COL.teal  },
        procesando:         { label:'Procesando…',             color:COL.amber },
        tomando_reserva:    { label:'Tomando datos de reserva', color:COL.teal  },
        confirmando:        { label:'Confirmando reserva…',    color:COL.green },
        finalizando:        { label:'Cerrando llamada…',       color:'#8895A7' },
      },
    },
    {
      type: 'order', label: 'Pedido', labelPlural: 'Pedidos',
      icon: '🛍️', color: COL.violet, priority: 'high',
      fields: [
        { key:'customer_name', label:'Cliente',       icon:'👤' },
        { key:'items',         label:'Productos',     icon:'🍽️', important:true },
        { key:'total',         label:'Total',         icon:'💶', format:'text' },
        { key:'pickup_time',   label:'Recogida',      icon:'🕐', format:'time' },
        { key:'delivery_type', label:'Tipo',          icon:'📦', format:'badge' },
      ],
      actions: [
        { id:'confirm',  label:'Confirmar pedido',  icon:'✓', color:COL.green,  style:'primary',   href:'/pedidos' },
        { id:'review',   label:'Ver pedido',        icon:'👁', color:COL.amber,  style:'secondary', href:'/pedidos' },
      ],
      callStates: {
        escuchando:      { label:'Escuchando…',          color:COL.teal   },
        tomando_pedido:  { label:'Tomando pedido',        color:COL.violet },
        confirmando:     { label:'Confirmando pedido…',   color:COL.green  },
        finalizando:     { label:'Cerrando llamada…',     color:'#8895A7'  },
      },
    },
    {
      type: 'cancellation', label: 'Cancelación', labelPlural: 'Cancelaciones',
      icon: '❌', color: COL.red, priority: 'high',
      fields: [
        { key:'customer_name', label:'Cliente',    icon:'👤', important:true },
        { key:'date',          label:'Fecha',      icon:'📆' },
        { key:'time',          label:'Hora',       icon:'🕐' },
        { key:'reason',        label:'Motivo',     icon:'💬' },
      ],
      actions: [
        { id:'process',  label:'Procesar cancelación', icon:'✓', color:COL.red,   style:'primary',   href:'/reservas' },
        { id:'review',   label:'Revisar',              icon:'👁', color:COL.amber, style:'secondary', href:'/reservas' },
      ],
      callStates: { escuchando:{label:'Escuchando…',color:COL.teal}, finalizando:{label:'Procesando cancelación…',color:COL.red} },
    },
    {
      type: 'inquiry', label: 'Consulta', labelPlural: 'Consultas',
      icon: '❓', color: COL.blue, priority: 'normal',
      fields: [
        { key:'question', label:'Pregunta',  icon:'💬', important:true },
        { key:'answered', label:'Respuesta', icon:'✓',  format:'badge' },
      ],
      actions: [{ id:'view', label:'Ver llamada', icon:'📞', color:COL.blue, style:'secondary', href:'/llamadas' }],
      callStates: { escuchando:{label:'Escuchando…',color:COL.teal}, respondiendo:{label:'Respondiendo consulta…',color:COL.blue} },
    },
  ],
  demoEvents: [
    { schemaType:'reservation', priority:'high',   title:'Nueva reserva — Martínez, 21:30', sub:'4 personas · terraza · esta noche' },
    { schemaType:'order',       priority:'high',   title:'Pedido en curso — 2 chuletones + bebidas', sub:'Para recoger · García · 21:30h' },
    { schemaType:'reservation', priority:'high',   title:'Reserva confirmada — López, 14:00', sub:'2 personas · interior · mañana' },
    { schemaType:'cancellation',priority:'high',   title:'Cancelación recibida — Rodríguez', sub:'Reserva del viernes · 4 personas' },
    { schemaType:'inquiry',     priority:'normal',  title:'Consulta sobre el menú respondida', sub:'Preguntó por el menú del día y alérgenos' },
    { schemaType:'reservation', priority:'high',   title:'Grupo de 9 — pendiente de revisar', sub:'Supera el máximo configurado (6 personas)' },
  ],
}

// ─────────────────────────────────────────────────────────
// CLÍNICA (dental / médica)
// ─────────────────────────────────────────────────────────
const CLINICA_CONFIG: BusinessEventConfig = {
  businessType: 'clinica_dental',
  activeCallLabel: 'Paciente en línea',
  intentMap: {
    reserva:     'appointment',
    cita:        'appointment',
    urgencia:    'urgency',
    cancelacion: 'cancellation',
    consulta:    'inquiry',
    otro:        'inquiry',
  },
  schemas: [
    {
      type: 'appointment', label: 'Cita', labelPlural: 'Citas',
      icon: '🗓️', color: COL.teal, priority: 'high',
      fields: [
        { key:'patient_name',   label:'Paciente',     icon:'👤', important:true },
        { key:'treatment',      label:'Tratamiento',  icon:'⚕️', important:true },
        { key:'date',           label:'Fecha',        icon:'📆' },
        { key:'time',           label:'Hora',         icon:'🕐', format:'time' },
        { key:'doctor',         label:'Doctor',       icon:'👨‍⚕️' },
        { key:'is_first_visit', label:'Primera visita', icon:'⭐', format:'badge' },
      ],
      actions: [
        { id:'confirm', label:'Confirmar cita',   icon:'✓', color:COL.green,  style:'primary',   href:'/reservas' },
        { id:'review',  label:'Revisar',          icon:'👁', color:COL.amber,  style:'secondary', href:'/reservas' },
      ],
      callStates: {
        escuchando:   { label:'Escuchando al paciente…', color:COL.teal  },
        procesando:   { label:'Procesando…',             color:COL.amber },
        tomando_cita: { label:'Recogiendo datos de cita', color:COL.teal  },
        confirmando:  { label:'Confirmando cita…',       color:COL.green },
        finalizando:  { label:'Cerrando llamada…',       color:'#8895A7' },
      },
    },
    {
      type: 'urgency', label: 'Urgencia', labelPlural: 'Urgencias',
      icon: '🚨', color: COL.red, priority: 'high',
      fields: [
        { key:'patient_name', label:'Paciente',  icon:'👤', important:true },
        { key:'symptom',      label:'Síntoma',   icon:'🤕', important:true },
        { key:'phone',        label:'Teléfono',  icon:'📞', format:'phone' },
      ],
      actions: [
        { id:'call_back', label:'Llamar ahora', icon:'📞', color:COL.red,   style:'primary' },
        { id:'schedule',  label:'Cita urgente', icon:'🗓️', color:COL.amber, style:'secondary', href:'/reservas' },
      ],
      callStates: {
        escuchando:  { label:'Escuchando urgencia…',  color:COL.red   },
        finalizando: { label:'Derivando a urgencias…', color:COL.red   },
      },
    },
    {
      type: 'cancellation', label: 'Cancelación', labelPlural: 'Cancelaciones',
      icon: '❌', color: COL.yellow, priority: 'normal',
      fields: [
        { key:'patient_name', label:'Paciente', icon:'👤', important:true },
        { key:'date',         label:'Fecha',    icon:'📆' },
        { key:'treatment',    label:'Cita',     icon:'⚕️' },
      ],
      actions: [{ id:'process', label:'Procesar', icon:'✓', color:COL.yellow, style:'primary', href:'/reservas' }],
      callStates: { escuchando:{label:'Escuchando…',color:COL.teal}, finalizando:{label:'Procesando cancelación…',color:COL.yellow} },
    },
    {
      type: 'inquiry', label: 'Consulta', labelPlural: 'Consultas',
      icon: '❓', color: COL.blue, priority: 'normal',
      fields: [{ key:'question', label:'Consulta', icon:'💬', important:true }],
      actions: [{ id:'view', label:'Ver llamada', icon:'📞', color:COL.blue, style:'secondary', href:'/llamadas' }],
      callStates: { escuchando:{label:'Escuchando…',color:COL.teal}, respondiendo:{label:'Informando al paciente…',color:COL.blue} },
    },
  ],
  demoEvents: [
    { schemaType:'appointment', priority:'high',   title:'Nueva cita — García, limpieza dental', sub:'Mañana a las 10:00 · Primera visita' },
    { schemaType:'urgency',     priority:'high',   title:'🚨 Urgencia — López, dolor molar', sub:'Solicita cita urgente hoy' },
    { schemaType:'appointment', priority:'high',   title:'Cita confirmada — Martínez, revisión', sub:'Jueves 11:30 · Dr. Rodríguez' },
    { schemaType:'cancellation',priority:'normal',  title:'Cancelación — Sánchez', sub:'Cita del miércoles a las 16:00' },
    { schemaType:'inquiry',     priority:'normal',  title:'Consulta sobre ortodoncia respondida', sub:'Preguntó por precios y plazos de tratamiento' },
    { schemaType:'appointment', priority:'high',   title:'Cita — González, empaste', sub:'Viernes a las 09:00 · Pendiente de confirmar' },
  ],
}

// ─────────────────────────────────────────────────────────
// VETERINARIA
// ─────────────────────────────────────────────────────────
const VETERINARIA_CONFIG: BusinessEventConfig = {
  businessType: 'veterinaria',
  activeCallLabel: 'Dueño en línea',
  intentMap: {
    reserva:     'appointment',
    cita:        'appointment',
    urgencia:    'urgency',
    vacuna:      'appointment',
    cancelacion: 'cancellation',
    consulta:    'inquiry',
    otro:        'inquiry',
  },
  schemas: [
    {
      type: 'appointment', label: 'Cita', labelPlural: 'Citas',
      icon: '🐾', color: COL.teal, priority: 'high',
      fields: [
        { key:'owner_name',   label:'Dueño',      icon:'👤', important:true },
        { key:'pet_name',     label:'Mascota',    icon:'🐕', important:true },
        { key:'pet_type',     label:'Animal',     icon:'🐾', format:'badge' },
        { key:'service',      label:'Servicio',   icon:'⚕️' },
        { key:'date',         label:'Fecha',      icon:'📆' },
        { key:'time',         label:'Hora',       icon:'🕐', format:'time' },
      ],
      actions: [
        { id:'confirm', label:'Confirmar cita',   icon:'✓', color:COL.green,  style:'primary',   href:'/reservas' },
        { id:'review',  label:'Revisar',          icon:'👁', color:COL.amber,  style:'secondary', href:'/reservas' },
      ],
      callStates: {
        escuchando:   { label:'Escuchando…',              color:COL.teal  },
        tomando_cita: { label:'Recogiendo datos de cita',  color:COL.teal  },
        confirmando:  { label:'Confirmando cita…',         color:COL.green },
        finalizando:  { label:'Cerrando llamada…',         color:'#8895A7' },
      },
    },
    {
      type: 'urgency', label: 'Urgencia veterinaria', labelPlural: 'Urgencias',
      icon: '🚨', color: COL.red, priority: 'high',
      fields: [
        { key:'owner_name', label:'Dueño',    icon:'👤', important:true },
        { key:'pet_name',   label:'Mascota',  icon:'🐕', important:true },
        { key:'symptom',    label:'Síntoma',  icon:'🤕', important:true },
        { key:'phone',      label:'Teléfono', icon:'📞', format:'phone' },
      ],
      actions: [
        { id:'call_back', label:'Llamar ahora', icon:'📞', color:COL.red, style:'primary' },
      ],
      callStates: {
        escuchando:  { label:'Escuchando urgencia…', color:COL.red },
        finalizando: { label:'Derivando a urgencias…', color:COL.red },
      },
    },
    {
      type: 'cancellation', label: 'Cancelación', labelPlural: 'Cancelaciones',
      icon: '❌', color: COL.yellow, priority: 'normal',
      fields: [
        { key:'owner_name', label:'Dueño',   icon:'👤', important:true },
        { key:'pet_name',   label:'Mascota', icon:'🐕' },
      ],
      actions: [{ id:'process', label:'Procesar', icon:'✓', color:COL.yellow, style:'primary', href:'/reservas' }],
      callStates: { escuchando:{label:'Escuchando…',color:COL.teal}, finalizando:{label:'Procesando…',color:COL.yellow} },
    },
    {
      type: 'inquiry', label: 'Consulta', labelPlural: 'Consultas',
      icon: '❓', color: COL.blue, priority: 'normal',
      fields: [{ key:'question', label:'Consulta', icon:'💬', important:true }],
      actions: [{ id:'view', label:'Ver llamada', icon:'📞', color:COL.blue, style:'secondary', href:'/llamadas' }],
      callStates: { escuchando:{label:'Escuchando…',color:COL.teal}, respondiendo:{label:'Informando…',color:COL.blue} },
    },
  ],
  demoEvents: [
    { schemaType:'appointment', priority:'high',  title:'Nueva cita — Perro de los Martínez', sub:'Luna · vacunación anual · mañana 10:00' },
    { schemaType:'urgency',     priority:'high',  title:'🚨 Urgencia — Gato de García', sub:'Pelusa · dificultad para respirar · ahora' },
    { schemaType:'appointment', priority:'high',  title:'Cita confirmada — Conejo de López', sub:'Coco · revisión · jueves 11:30' },
    { schemaType:'inquiry',     priority:'normal', title:'Consulta sobre desparasitación respondida', sub:'Frecuencia y productos recomendados' },
    { schemaType:'cancellation',priority:'normal', title:'Cancelación — perro de Sánchez', sub:'Cita del miércoles a las 16:00' },
    { schemaType:'appointment', priority:'high',  title:'Cita — Pez tropicales de Ruiz', sub:'Consulta · viernes 09:00' },
  ],
}

// ─────────────────────────────────────────────────────────
// PELUQUERÍA / BARBERÍA
// ─────────────────────────────────────────────────────────
const PELUQUERIA_CONFIG: BusinessEventConfig = {
  businessType: 'peluqueria',
  activeCallLabel: 'Cliente en línea',
  intentMap: {
    reserva:     'appointment',
    cita:        'appointment',
    cancelacion: 'cancellation',
    consulta:    'inquiry',
    otro:        'inquiry',
  },
  schemas: [
    {
      type: 'appointment', label: 'Cita', labelPlural: 'Citas',
      icon: '✂️', color: COL.violet, priority: 'high',
      fields: [
        { key:'customer_name', label:'Cliente',      icon:'👤', important:true },
        { key:'service',       label:'Servicio',     icon:'✂️', important:true },
        { key:'professional',  label:'Profesional',  icon:'💇' },
        { key:'date',          label:'Fecha',        icon:'📆' },
        { key:'time',          label:'Hora',         icon:'🕐', format:'time' },
        { key:'duration',      label:'Duración est.',icon:'⏱️' },
      ],
      actions: [
        { id:'confirm', label:'Confirmar cita', icon:'✓', color:COL.green,  style:'primary',   href:'/reservas' },
        { id:'review',  label:'Revisar',        icon:'👁', color:COL.amber,  style:'secondary', href:'/reservas' },
      ],
      callStates: {
        escuchando:   { label:'Escuchando…',             color:COL.teal   },
        tomando_cita: { label:'Recogiendo datos de cita', color:COL.violet },
        confirmando:  { label:'Confirmando cita…',        color:COL.green  },
        finalizando:  { label:'Cerrando llamada…',        color:'#8895A7'  },
      },
    },
    {
      type: 'cancellation', label: 'Cancelación', labelPlural: 'Cancelaciones',
      icon: '❌', color: COL.yellow, priority: 'normal',
      fields: [
        { key:'customer_name', label:'Cliente',  icon:'👤', important:true },
        { key:'date',          label:'Fecha',    icon:'📆' },
        { key:'service',       label:'Servicio', icon:'✂️' },
      ],
      actions: [{ id:'process', label:'Procesar', icon:'✓', color:COL.yellow, style:'primary', href:'/reservas' }],
      callStates: { escuchando:{label:'Escuchando…',color:COL.teal}, finalizando:{label:'Procesando cancelación…',color:COL.yellow} },
    },
    {
      type: 'inquiry', label: 'Consulta', labelPlural: 'Consultas',
      icon: '❓', color: COL.blue, priority: 'normal',
      fields: [{ key:'question', label:'Consulta', icon:'💬', important:true }],
      actions: [{ id:'view', label:'Ver llamada', icon:'📞', color:COL.blue, style:'secondary', href:'/llamadas' }],
      callStates: { escuchando:{label:'Escuchando…',color:COL.teal}, respondiendo:{label:'Respondiendo…',color:COL.blue} },
    },
  ],
  demoEvents: [
    { schemaType:'appointment', priority:'high',   title:'Nueva cita — Laura García', sub:'Corte + tinte · viernes 16:00 · Marta' },
    { schemaType:'appointment', priority:'high',   title:'Cita confirmada — Carlos Ruiz', sub:'Corte y barba · sábado 10:00 · Pedro' },
    { schemaType:'appointment', priority:'normal',  title:'Cita — Ana López', sub:'Mechas y keratina · jueves 11:30' },
    { schemaType:'cancellation',priority:'normal',  title:'Cancelación — María Sánchez', sub:'Cita del miércoles a las 18:00' },
    { schemaType:'inquiry',     priority:'normal',  title:'Consulta sobre tratamiento capilar respondida', sub:'Preguntó por precios y disponibilidad' },
    { schemaType:'appointment', priority:'high',   title:'Cita — Javier Martín', sub:'Barba y afeitado clásico · hoy 17:00' },
  ],
}

// ─────────────────────────────────────────────────────────
// ASESORÍA
// ─────────────────────────────────────────────────────────
const ASESORIA_CONFIG: BusinessEventConfig = {
  businessType: 'asesoria',
  activeCallLabel: 'Cliente en línea',
  intentMap: {
    reserva:     'appointment',
    cita:        'appointment',
    consulta:    'inquiry',
    cancelacion: 'cancellation',
    urgente:     'inquiry',
    otro:        'inquiry',
  },
  schemas: [
    {
      type: 'appointment', label: 'Cita', labelPlural: 'Citas',
      icon: '💼', color: COL.blue, priority: 'high',
      fields: [
        { key:'client_name',    label:'Cliente',      icon:'👤', important:true },
        { key:'service_type',   label:'Especialidad', icon:'📋', important:true },
        { key:'date',           label:'Fecha',        icon:'📆' },
        { key:'time',           label:'Hora',         icon:'🕐', format:'time' },
        { key:'meeting_type',   label:'Modalidad',    icon:'💻', format:'badge' },
        { key:'is_new_client',  label:'Nuevo cliente', icon:'⭐', format:'badge' },
      ],
      actions: [
        { id:'confirm', label:'Confirmar cita',  icon:'✓', color:COL.green, style:'primary',   href:'/reservas' },
        { id:'review',  label:'Revisar',         icon:'👁', color:COL.amber, style:'secondary', href:'/reservas' },
      ],
      callStates: {
        escuchando:   { label:'Escuchando al cliente…',    color:COL.teal },
        tomando_cita: { label:'Recogiendo datos de cita',   color:COL.blue },
        confirmando:  { label:'Confirmando cita…',          color:COL.green },
        finalizando:  { label:'Cerrando llamada…',          color:'#8895A7' },
      },
    },
    {
      type: 'inquiry', label: 'Consulta', labelPlural: 'Consultas',
      icon: '❓', color: COL.violet, priority: 'normal',
      fields: [
        { key:'client_name',  label:'Cliente',      icon:'👤' },
        { key:'topic',        label:'Tema',         icon:'📋', important:true },
        { key:'urgency',      label:'Urgencia',     icon:'⚡', format:'badge' },
      ],
      actions: [{ id:'view', label:'Ver llamada', icon:'📞', color:COL.blue, style:'secondary', href:'/llamadas' }],
      callStates: { escuchando:{label:'Escuchando…',color:COL.teal}, respondiendo:{label:'Atendiendo consulta…',color:COL.violet} },
    },
    {
      type: 'cancellation', label: 'Cancelación', labelPlural: 'Cancelaciones',
      icon: '❌', color: COL.yellow, priority: 'normal',
      fields: [
        { key:'client_name', label:'Cliente', icon:'👤', important:true },
        { key:'date',        label:'Fecha',   icon:'📆' },
      ],
      actions: [{ id:'process', label:'Procesar', icon:'✓', color:COL.yellow, style:'primary', href:'/reservas' }],
      callStates: { escuchando:{label:'Escuchando…',color:COL.teal}, finalizando:{label:'Procesando…',color:COL.yellow} },
    },
  ],
  demoEvents: [
    { schemaType:'appointment', priority:'high',   title:'Nueva cita — Empresa García SL', sub:'Laboral (contratos) · lunes 10:00 · presencial' },
    { schemaType:'inquiry',     priority:'normal',  title:'Consulta sobre IRPF respondida', sub:'Preguntó por deducciones y plazos' },
    { schemaType:'appointment', priority:'high',   title:'Cita — Martínez Autónomos', sub:'Fiscal (IVA trimestral) · miércoles 11:00' },
    { schemaType:'inquiry',     priority:'normal',  title:'Consulta sobre constitución de SL', sub:'Cliente nuevo · presupuesto solicitado' },
    { schemaType:'cancellation',priority:'normal',  title:'Cancelación — López Inversiones', sub:'Cita del viernes · reagendar la próxima semana' },
    { schemaType:'appointment', priority:'high',   title:'Cita urgente — herencia pendiente', sub:'Extranjería · nueva cliente · hoy 17:00' },
  ],
}

// ─────────────────────────────────────────────────────────
// INMOBILIARIA
// ─────────────────────────────────────────────────────────
const INMOBILIARIA_CONFIG: BusinessEventConfig = {
  businessType: 'inmobiliaria',
  activeCallLabel: 'Cliente en línea',
  intentMap: {
    visita:      'visit',
    reserva:     'visit',
    consulta:    'lead',
    interesado:  'lead',
    cancelacion: 'cancellation',
    otro:        'lead',
  },
  schemas: [
    {
      type: 'lead', label: 'Nuevo contacto', labelPlural: 'Contactos',
      icon: '🏠', color: COL.amber, priority: 'high',
      fields: [
        { key:'client_name',      label:'Cliente',          icon:'👤', important:true },
        { key:'phone',            label:'Teléfono',         icon:'📞', format:'phone', important:true },
        { key:'operation',        label:'Busca',            icon:'🔍', format:'badge' },
        { key:'property_type',    label:'Tipo inmueble',    icon:'🏠' },
        { key:'location',         label:'Zona',             icon:'📍' },
        { key:'price_range',      label:'Presupuesto',      icon:'💶' },
        { key:'bedrooms',         label:'Habitaciones',     icon:'🛏️', format:'number' },
      ],
      actions: [
        { id:'create_lead',    label:'Crear ficha cliente', icon:'👤', color:COL.amber, style:'primary',   href:'/clientes' },
        { id:'schedule_visit', label:'Programar visita',    icon:'📅', color:COL.teal,  style:'secondary', href:'/reservas' },
      ],
      callStates: {
        escuchando:       { label:'Escuchando al cliente…',      color:COL.teal  },
        tomando_datos:    { label:'Recogiendo datos del cliente', color:COL.amber },
        confirmando:      { label:'Confirmando visita…',         color:COL.green },
        finalizando:      { label:'Cerrando contacto…',          color:'#8895A7' },
      },
    },
    {
      type: 'visit', label: 'Visita', labelPlural: 'Visitas',
      icon: '🔑', color: COL.teal, priority: 'high',
      fields: [
        { key:'client_name', label:'Cliente',   icon:'👤', important:true },
        { key:'property',    label:'Inmueble',  icon:'🏠', important:true },
        { key:'date',        label:'Fecha',     icon:'📆' },
        { key:'time',        label:'Hora',      icon:'🕐', format:'time' },
        { key:'agent',       label:'Agente',    icon:'👔' },
      ],
      actions: [
        { id:'confirm', label:'Confirmar visita', icon:'✓', color:COL.green, style:'primary',   href:'/reservas' },
        { id:'review',  label:'Revisar',          icon:'👁', color:COL.amber, style:'secondary', href:'/reservas' },
      ],
      callStates: {
        escuchando:    { label:'Escuchando…',             color:COL.teal  },
        tomando_visita:{ label:'Programando visita',      color:COL.teal  },
        confirmando:   { label:'Confirmando visita…',     color:COL.green },
        finalizando:   { label:'Cerrando llamada…',       color:'#8895A7' },
      },
    },
    {
      type: 'cancellation', label: 'Cancelación', labelPlural: 'Cancelaciones',
      icon: '❌', color: COL.yellow, priority: 'normal',
      fields: [{ key:'client_name', label:'Cliente', icon:'👤', important:true }],
      actions: [{ id:'process', label:'Procesar', icon:'✓', color:COL.yellow, style:'primary', href:'/reservas' }],
      callStates: { escuchando:{label:'Escuchando…',color:COL.teal}, finalizando:{label:'Procesando…',color:COL.yellow} },
    },
  ],
  demoEvents: [
    { schemaType:'lead',   priority:'high',   title:'Nuevo contacto — García Martín', sub:'Compra piso · 3 hab · zona norte · hasta 280k' },
    { schemaType:'visit',  priority:'high',   title:'Visita programada — López', sub:'C/ Mayor 12, 3B · mañana 11:00 · con Carlos' },
    { schemaType:'lead',   priority:'high',   title:'Contacto interesada en alquiler — Ana Ruiz', sub:'1-2 hab · centro · máx 900€/mes' },
    { schemaType:'visit',  priority:'normal',  title:'Visita confirmada — empresa Construcciones SL', sub:'Local comercial · jueves 17:00' },
    { schemaType:'lead',   priority:'normal',  title:'Consulta sobre venta de piso respondida', sub:'Tasación gratuita solicitada' },
    { schemaType:'cancellation',priority:'normal', title:'Cancelación visita — Sánchez', sub:'Piso Av. Constitución · miércoles' },
  ],
}

// ─────────────────────────────────────────────────────────
// FALLBACK GENÉRICO
// ─────────────────────────────────────────────────────────
const GENERIC_CONFIG: BusinessEventConfig = {
  businessType: 'otro',
  activeCallLabel: 'Llamada activa',
  intentMap: {
    reserva:     'appointment',
    cita:        'appointment',
    cancelacion: 'cancellation',
    consulta:    'inquiry',
    otro:        'inquiry',
  },
  schemas: [
    {
      type: 'appointment', label: 'Cita', labelPlural: 'Citas',
      icon: '📅', color: COL.teal, priority: 'high',
      fields: [
        { key:'customer_name', label:'Cliente', icon:'👤', important:true },
        { key:'date',          label:'Fecha',   icon:'📆' },
        { key:'time',          label:'Hora',    icon:'🕐', format:'time' },
      ],
      actions: [{ id:'confirm', label:'Confirmar', icon:'✓', color:COL.green, style:'primary', href:'/reservas' }],
      callStates: { escuchando:{label:'Escuchando…',color:COL.teal}, tomando_cita:{label:'Tomando datos…',color:COL.teal}, confirmando:{label:'Confirmando…',color:COL.green}, finalizando:{label:'Cerrando…',color:'#8895A7'} },
    },
    {
      type: 'inquiry', label: 'Consulta', labelPlural: 'Consultas',
      icon: '❓', color: COL.blue, priority: 'normal',
      fields: [{ key:'question', label:'Consulta', icon:'💬', important:true }],
      actions: [{ id:'view', label:'Ver llamada', icon:'📞', color:COL.blue, style:'secondary', href:'/llamadas' }],
      callStates: { escuchando:{label:'Escuchando…',color:COL.teal}, respondiendo:{label:'Respondiendo…',color:COL.blue} },
    },
    {
      type: 'cancellation', label: 'Cancelación', labelPlural: 'Cancelaciones',
      icon: '❌', color: COL.yellow, priority: 'normal',
      fields: [{ key:'customer_name', label:'Cliente', icon:'👤', important:true }],
      actions: [{ id:'process', label:'Procesar', icon:'✓', color:COL.yellow, style:'primary' }],
      callStates: { escuchando:{label:'Escuchando…',color:COL.teal} },
    },
  ],
  demoEvents: [
    { schemaType:'appointment', priority:'high',   title:'Nueva cita confirmada', sub:'Cliente anotado para mañana' },
    { schemaType:'inquiry',     priority:'normal',  title:'Consulta atendida', sub:'Pregunta respondida correctamente' },
    { schemaType:'appointment', priority:'high',   title:'Cita pendiente de revisar', sub:'Datos recogidos — revisar disponibilidad' },
  ],
}

// ─────────────────────────────────────────────────────────
// MAPA TIPO → CONFIGURACIÓN
// ─────────────────────────────────────────────────────────
const CONFIG_MAP: Record<string, BusinessEventConfig> = {
  restaurante:    RESTAURANTE_CONFIG,
  bar:            { ...RESTAURANTE_CONFIG, businessType:'bar' },
  cafeteria:      { ...RESTAURANTE_CONFIG, businessType:'cafeteria' },
  clinica_dental: CLINICA_CONFIG,
  clinica_medica: { ...CLINICA_CONFIG, businessType:'clinica_medica',
    activeCallLabel:'Paciente en línea',
    demoEvents:[
      { schemaType:'appointment', priority:'high',   title:'Nueva cita — García, médico general', sub:'Mañana 09:30 · primera visita' },
      { schemaType:'urgency',     priority:'high',   title:'🚨 Urgencia — López, fiebre alta', sub:'Solicita atención urgente hoy' },
      { schemaType:'appointment', priority:'high',   title:'Cita — Martínez, pediatría', sub:'Niño 3 años · jueves 10:00 · Dra. López' },
      { schemaType:'inquiry',     priority:'normal',  title:'Consulta sobre ginecología respondida', sub:'Preguntó por servicios y precios' },
      { schemaType:'cancellation',priority:'normal',  title:'Cancelación — Sánchez', sub:'Cita de cardiología del lunes' },
      { schemaType:'appointment', priority:'high',   title:'Cita — González, traumatología', sub:'Revisión rodilla · viernes 11:00' },
    ],
  },
  peluqueria:     PELUQUERIA_CONFIG,
  barberia:       { ...PELUQUERIA_CONFIG, businessType:'barberia',
    activeCallLabel:'Cliente en línea',
    demoEvents:[
      { schemaType:'appointment', priority:'high',   title:'Nueva cita — Carlos Ruiz', sub:'Corte y barba · sábado 10:00 · Pedro' },
      { schemaType:'appointment', priority:'high',   title:'Cita — Javier García', sub:'Afeitado clásico · hoy 17:00' },
      { schemaType:'appointment', priority:'normal',  title:'Cita — Miguel Sánchez', sub:'Tinte y corte · jueves 16:00' },
      { schemaType:'cancellation',priority:'normal',  title:'Cancelación — López', sub:'Cita del viernes a las 11:00' },
      { schemaType:'inquiry',     priority:'normal',  title:'Consulta sobre diseño de barba', sub:'Preguntó por técnicas y precios' },
      { schemaType:'appointment', priority:'high',   title:'Cita — Alberto Martín', sub:'Corte y diseño de barba · mañana 09:00' },
    ],
  },
  veterinaria:    VETERINARIA_CONFIG,
  asesoria:       ASESORIA_CONFIG,
  inmobiliaria:   INMOBILIARIA_CONFIG,
  seguros:        { ...ASESORIA_CONFIG, businessType:'seguros',
    activeCallLabel:'Cliente en línea',
    demoEvents:[
      { schemaType:'appointment', priority:'high',   title:'Nueva cita — García, seguro de hogar', sub:'Comparativa de coberturas · lunes 10:00' },
      { schemaType:'inquiry',     priority:'normal',  title:'Consulta sobre seguro de coche respondida', sub:'Preguntó por franchisas y precios' },
      { schemaType:'appointment', priority:'high',   title:'Cita — Martínez, seguro de vida', sub:'Nuevo cliente · miércoles 11:30' },
      { schemaType:'inquiry',     priority:'normal',  title:'Reclamación de siniestro atendida', sub:'Urgente — derivado a gestor' },
    ],
  },
  fisioterapia:   { ...CLINICA_CONFIG, businessType:'fisioterapia',
    activeCallLabel:'Paciente en línea',
    demoEvents:[
      { schemaType:'appointment', priority:'high',   title:'Nueva cita — García, cervical', sub:'Lesión deportiva · mañana 09:00 · Carlos' },
      { schemaType:'appointment', priority:'high',   title:'Cita — López, rodilla operada', sub:'Rehabilitación · sesión 5/12 · jueves' },
      { schemaType:'inquiry',     priority:'normal',  title:'Consulta sobre dolor lumbar respondida', sub:'Derivado a valoración inicial' },
    ],
  },
  psicologia:     { ...CLINICA_CONFIG, businessType:'psicologia',
    activeCallLabel:'Paciente en línea',
    schemas:[
      {
        type:'appointment', label:'Sesión', labelPlural:'Sesiones',
        icon:'🧠', color:COL.violet, priority:'high',
        fields:[
          { key:'patient_name',   label:'Paciente',      icon:'👤', important:true },
          { key:'session_type',   label:'Tipo',          icon:'💬', format:'badge' },
          { key:'date',           label:'Fecha',         icon:'📆' },
          { key:'time',           label:'Hora',          icon:'🕐', format:'time' },
          { key:'therapist',      label:'Terapeuta',     icon:'🧑‍⚕️' },
        ],
        actions:[{ id:'confirm', label:'Confirmar sesión', icon:'✓', color:COL.green, style:'primary', href:'/reservas' }],
        callStates:{
          escuchando:  {label:'Escuchando con discreción…', color:COL.teal  },
          tomando_cita:{label:'Recogiendo datos de sesión',  color:COL.violet},
          confirmando: {label:'Confirmando sesión…',         color:COL.green },
          finalizando: {label:'Cerrando llamada…',           color:'#8895A7' },
        },
      },
      { type:'inquiry', label:'Consulta', labelPlural:'Consultas', icon:'❓', color:COL.blue, priority:'normal',
        fields:[{key:'question',label:'Consulta',icon:'💬',important:true}],
        actions:[{id:'view',label:'Ver llamada',icon:'📞',color:COL.blue,style:'secondary',href:'/llamadas'}],
        callStates:{escuchando:{label:'Escuchando…',color:COL.teal}},
      },
    ],
    demoEvents:[
      { schemaType:'appointment', priority:'high',   title:'Nueva sesión — García', sub:'Seguimiento · lunes 11:00 · Dra. Martínez' },
      { schemaType:'appointment', priority:'high',   title:'Sesión — Nuevo paciente', sub:'Primera consulta · miércoles 10:00' },
      { schemaType:'inquiry',     priority:'normal',  title:'Información sobre terapia de pareja', sub:'Primer contacto — enviado dossier informativo' },
    ],
  },
}

// ─────────────────────────────────────────────────────────
// API PÚBLICA
// ─────────────────────────────────────────────────────────

/** Devuelve la configuración de eventos para un tipo de negocio */
export function getEventConfig(businessType: string): BusinessEventConfig {
  return CONFIG_MAP[businessType] || GENERIC_CONFIG
}

/** Devuelve el schema de un evento específico */
export function getEventSchema(businessType: string, schemaType: string): EventSchema | undefined {
  const config = getEventConfig(businessType)
  return config.schemas.find(s => s.type === schemaType)
}

/** Convierte un intent del agente en tipo de schema para ese negocio */
export function intentToSchema(businessType: string, intent: string): string {
  const config = getEventConfig(businessType)
  return config.intentMap[intent] || 'inquiry'
}

/** Devuelve los estados de llamada activa para un schema */
export function getCallStates(businessType: string, schemaType: string): Record<string, {label:string;color:string}> {
  const schema = getEventSchema(businessType, schemaType)
  return schema?.callStates || {
    escuchando: { label:'Escuchando…', color:'#2DD4BF' },
    procesando: { label:'Procesando…', color:'#F0A84E' },
    finalizando:{ label:'Cerrando…',   color:'#8895A7' },
  }
}

/** Todos los estados posibles para el bloque de llamada activa */
export function getAllCallStates(businessType: string): Record<string, {label:string;color:string}> {
  const config = getEventConfig(businessType)
  const merged: Record<string, {label:string;color:string}> = {}
  config.schemas.forEach(s => Object.assign(merged, s.callStates))
  return merged
}
