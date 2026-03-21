// ─────────────────────────────────────────────────────────────────────────────
// RESERVO.AI — MOTOR DE PLANTILLAS
// Única fuente de verdad para toda la lógica de negocio por tipo.
// Nada en frontend ni backend debe tener if(type==='restaurante').
// ─────────────────────────────────────────────────────────────────────────────

export type MasterTemplate = 'hosteleria' | 'servicios'

export interface NavModule {
  id: string
  href: string
  icon: string
  label: string           // etiqueta dinámica según plantilla
  pro?: boolean
  hidden?: boolean        // módulo técnicamente presente pero oculto en nav
}

export interface UnitLabels {
  singular: string        // "Mesa" | "Consulta" | "Despacho" | "Sillón"
  plural: string          // "Mesas" | "Consultas" | "Despachos" | "Sillones"
  icon: string            // letra/icono para el grid
  zoneLabel: string       // "Zona" | "Área" | "Planta"
  zonesLabel: string      // "Zonas" | "Áreas" | "Plantas"
}

export interface DynamicLabels {
  reserva: string         // "Reserva" | "Cita"
  reservas: string        // "Reservas" | "Citas"
  reservar: string        // "Reservar" | "Pedir cita"
  cliente: string         // "Cliente" | "Paciente" | "Cliente"
  clientes: string        // "Clientes" | "Pacientes"
  agenda: string          // "Agenda"
  buscarPlaceholder: string
  emptyReservas: string
  pageTitle: string       // título de la sección principal
  unit: UnitLabels
}

export interface TemplateConfig {
  id: MasterTemplate
  label: string
  icon: string

  // módulos activos (en orden de aparición en sidebar)
  modules: NavModule[]

  // flags de capacidades
  hasOrders: boolean       // /pedidos activo
  hasSpaces: boolean       // /mesas activo (mesas, consultas, despachos...)
  hasZones: boolean        // subdivisión por zonas/áreas
  hasDelivery: boolean     // pedidos a domicilio / para recoger

  // etiquetas dinámicas
  labels: DynamicLabels

  // comportamiento del agente de voz
  agentContext: string     // texto inyectado en el contexto del agente
}

// ─────────────────────────────────────────────────────────────────────────────
// PLANTILLA 1: HOSTELERÍA (restaurantes, bares)
// ─────────────────────────────────────────────────────────────────────────────
const HOSTELERIA: TemplateConfig = {
  id: 'hosteleria',
  label: 'Hostelería',
  icon: '🍽️',
  hasOrders: true,
  hasSpaces: true,
  hasZones: true,
  hasDelivery: true,
  modules: [
    { id:'panel',        href:'/panel',        icon:'grid',  label:'Resumen del día' },
    { id:'reservas',     href:'/reservas',     icon:'cal',   label:'Reservas' },
    { id:'agenda',       href:'/agenda',       icon:'clock', label:'Agenda' },
    { id:'llamadas',     href:'/llamadas',     icon:'phone', label:'Llamadas' },
    { id:'clientes',     href:'/clientes',     icon:'users', label:'Clientes' },
    { id:'mesas',        href:'/mesas',        icon:'layout',label:'Mesas y zonas' },
    { id:'turnos',       href:'/turnos',       icon:'clock2', label:'Turnos y franjas' },
    { id:'productos',    href:'/productos',    icon:'menu',   label:'Carta y productos' },
    { id:'pedidos',      href:'/pedidos',      icon:'bag',   label:'Pedidos', pro:true },
    { id:'estadisticas', href:'/estadisticas', icon:'bar',   label:'Estadísticas', pro:true },
    { id:'facturacion',  href:'/facturacion',  icon:'card',  label:'Facturación' },
    { id:'agente',       href:'/agente',       icon:'cpu',   label:'Mi recepcionista' },
    { id:'configuracion',href:'/configuracion',icon:'gear',  label:'Configuración' },
  ],
  labels: {
    reserva: 'Reserva', reservas: 'Reservas', reservar: 'Reservar',
    cliente: 'Cliente', clientes: 'Clientes', agenda: 'Agenda',
    buscarPlaceholder: 'Buscar reservas…',
    emptyReservas: 'Sin reservas este día',
    pageTitle: 'Reservas',
    unit: { singular:'Mesa', plural:'Mesas', icon:'M', zoneLabel:'Zona', zonesLabel:'Zonas' },
  },
  agentContext: 'Eres la recepcionista de este negocio de hostelería. Gestiona reservas de mesa. Pregunta: nombre, fecha, hora y número de personas. Pregunta si tienen preferencia de zona (terraza, interior, etc.).',
}

// ─────────────────────────────────────────────────────────────────────────────
// PLANTILLA 2: SERVICIOS / CITAS (asesorías, clínicas, peluquerías, etc.)
// ─────────────────────────────────────────────────────────────────────────────
const SERVICIOS: TemplateConfig = {
  id: 'servicios',
  label: 'Servicios / Citas',
  icon: '📋',
  hasOrders: false,
  hasSpaces: false,   // por defecto false — algunos negocios lo activan (peluquería con sillones)
  hasZones: false,
  hasDelivery: false,
  modules: [
    { id:'panel',        href:'/panel',        icon:'grid',  label:'Resumen del día' },
    { id:'reservas',     href:'/reservas',     icon:'cal',   label:'Citas' },
    { id:'agenda',       href:'/agenda',       icon:'clock', label:'Agenda' },
    { id:'llamadas',     href:'/llamadas',     icon:'phone', label:'Llamadas' },
    { id:'clientes',     href:'/clientes',     icon:'users', label:'Clientes' },
    { id:'estadisticas', href:'/estadisticas', icon:'bar',   label:'Estadísticas', pro:true },
    { id:'facturacion',  href:'/facturacion',  icon:'card',  label:'Facturación' },
    { id:'agente',       href:'/agente',       icon:'cpu',   label:'Mi recepcionista' },
    { id:'configuracion',href:'/configuracion',icon:'gear',  label:'Configuración' },
  ],
  labels: {
    reserva: 'Cita', reservas: 'Citas', reservar: 'Pedir cita',
    cliente: 'Cliente', clientes: 'Clientes', agenda: 'Agenda',
    buscarPlaceholder: 'Buscar citas…',
    emptyReservas: 'Sin citas este día',
    pageTitle: 'Citas',
    unit: { singular:'Consulta', plural:'Consultas', icon:'+', zoneLabel:'Área', zonesLabel:'Áreas' },
  },
  agentContext: 'Eres la recepcionista de este negocio. Gestiona citas. Pregunta: nombre del cliente, tipo de servicio o consulta, fecha y hora preferida. Confirma disponibilidad antes de cerrar la cita.',
}

// ─────────────────────────────────────────────────────────────────────────────
// MAPEO: tipo de negocio → plantilla maestra + sobreescrituras por subtipo
// ─────────────────────────────────────────────────────────────────────────────

export type BusinessType =
  | 'restaurante' | 'bar' | 'cafeteria'
  | 'clinica_dental' | 'clinica_medica' | 'asesoria'
  | 'peluqueria' | 'barberia' | 'seguros' | 'inmobiliaria'
  | 'veterinaria' | 'fisioterapia' | 'psicologia'
  | 'academia' | 'otro'

interface TypeOverride {
  template: MasterTemplate
  unitLabels?: Partial<UnitLabels>
  hasSpaces?: boolean
  agentContext?: string
  clienteLabel?: string
  clientesLabel?: string
  reservaLabel?: string
  reservasLabel?: string
  extraModules?: NavModule[]   // módulos extra por tipo (ej: carta para hostelería)
}

const TYPE_MAP: Record<string, TypeOverride> = {
  restaurante: { template: 'hosteleria' },
  bar:         { template: 'hosteleria',
    unitLabels: { singular:'Barra/Mesa', plural:'Mesas', icon:'B' } },
  cafeteria:   { template: 'hosteleria',
    unitLabels: { singular:'Mesa', plural:'Mesas', icon:'C' } },

  clinica_dental: { template: 'servicios', hasSpaces: true,
    clienteLabel: 'Paciente', clientesLabel: 'Pacientes',
    reservaLabel: 'Cita', reservasLabel: 'Citas',
    unitLabels: { singular:'Silla', plural:'Sillas dental', icon:'🦷', zoneLabel:'Sala', zonesLabel:'Salas' },
    agentContext: 'Eres la recepcionista de una clínica dental. Gestiona citas. Pregunta: nombre del paciente, tipo de tratamiento (revisión, limpieza, ortodoncia…), fecha preferida y si es urgente.' },

  clinica_medica: { template: 'servicios', hasSpaces: true,
    clienteLabel: 'Paciente', clientesLabel: 'Pacientes',
    reservaLabel: 'Cita', reservasLabel: 'Citas',
    unitLabels: { singular:'Consulta', plural:'Consultas', icon:'+', zoneLabel:'Planta', zonesLabel:'Plantas' },
    agentContext: 'Eres la recepcionista de una clínica médica. Gestiona citas. Pregunta: nombre del paciente, especialidad o motivo de consulta, fecha preferida y si es urgente.' },

  veterinaria:   { template: 'servicios', hasSpaces: true,
    clienteLabel: 'Cliente', clientesLabel: 'Clientes',
    reservaLabel: 'Cita', reservasLabel: 'Citas',
    unitLabels: { singular:'Consulta', plural:'Consultas', icon:'🐾', zoneLabel:'Sala', zonesLabel:'Salas' },
    agentContext: 'Eres la recepcionista de una clínica veterinaria. Gestiona citas para mascotas. Pregunta: nombre del dueño, nombre y especie de la mascota, motivo de la visita (consulta, vacuna, urgencia…) y fecha preferida.' },

  peluqueria:   { template: 'servicios', hasSpaces: true,
    reservaLabel: 'Cita', reservasLabel: 'Citas',
    unitLabels: { singular:'Sillón', plural:'Sillones', icon:'✂️', zoneLabel:'Zona', zonesLabel:'Zonas' },
    agentContext: 'Eres la recepcionista de una peluquería. Gestiona citas. Pregunta: nombre, servicio deseado (corte, tinte, mechas…), profesional preferido si lo tiene y fecha.' },

  barberia:     { template: 'servicios', hasSpaces: true,
    reservaLabel: 'Cita', reservasLabel: 'Citas',
    unitLabels: { singular:'Sillón', plural:'Sillones', icon:'🪒', zoneLabel:'Zona', zonesLabel:'Zonas' },
    agentContext: 'Eres la recepcionista de una barbería. Gestiona citas. Pregunta: nombre del cliente, servicio deseado (corte, barba, afeitado, tinte…), barbero preferido si lo tiene y fecha.' },

  fisioterapia:  { template: 'servicios', hasSpaces: false,
    clienteLabel: 'Paciente', clientesLabel: 'Pacientes',
    reservaLabel: 'Cita', reservasLabel: 'Citas',
    agentContext: 'Eres la recepcionista de una clínica de fisioterapia. Gestiona citas. Pregunta: nombre del paciente, tipo de problema o lesión, fisioterapeuta preferido si lo tiene y fecha.' },

  psicologia:    { template: 'servicios', hasSpaces: false,
    clienteLabel: 'Paciente', clientesLabel: 'Pacientes',
    reservaLabel: 'Sesión', reservasLabel: 'Sesiones',
    agentContext: 'Eres la recepcionista de un centro de psicología. Gestiona citas. Con total discreción y sin preguntar el motivo, recoge: nombre del paciente, si es primera vez o seguimiento, terapeuta preferido y fecha.' },

  asesoria:     { template: 'servicios', hasSpaces: true,
    reservaLabel: 'Cita', reservasLabel: 'Citas',
    unitLabels: { singular:'Despacho', plural:'Despachos', icon:'💼', zoneLabel:'Planta', zonesLabel:'Plantas' },
    agentContext: 'Eres la recepcionista de una asesoría. Gestiona citas. Pregunta: nombre del cliente, tipo de consulta (laboral, fiscal, jurídica…) y fecha preferida.' },

  seguros:      { template: 'servicios',
    reservaLabel: 'Cita', reservasLabel: 'Citas',
    agentContext: 'Eres la recepcionista de una correduría de seguros. Gestiona llamadas y citas. Pregunta: nombre del cliente, tipo de seguro (auto, hogar, salud, vida…) y motivo de la consulta.' },

  inmobiliaria: { template: 'servicios',
    reservaLabel: 'Visita', reservasLabel: 'Visitas',
    agentContext: 'Eres la recepcionista de una inmobiliaria. Gestiona llamadas y visitas. Pregunta: si el cliente busca comprar, vender o alquilar, zona de interés y datos de contacto.' },

  academia: {
    template: 'servicios',
    hasSpaces: true,
    clienteLabel: 'Alumno',
    clientesLabel: 'Alumnos',
    reservaLabel: 'Clase',
    reservasLabel: 'Clases',
    unitLabels: {
      singular: 'Aula', plural: 'Aulas', icon: '📚',
      zoneLabel: 'Planta', zonesLabel: 'Plantas'
    },
    agentContext: 'Eres la recepcionista virtual de esta academia. Gestiona inscripciones y consultas sobre clases. Pregunta: nombre del alumno, curso o materia de interés, nivel (principiante/intermedio/avanzado), horario preferido. Si llama un padre/tutor, anota también el nombre del menor.',
  },

  otro:         { template: 'servicios' },
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL: dada el tipo de negocio, devuelve la plantilla resuelta
// ─────────────────────────────────────────────────────────────────────────────
export function resolveTemplate(businessType: string): TemplateConfig {
  const override = TYPE_MAP[businessType] || TYPE_MAP['otro']
  const base     = override.template === 'hosteleria' ? { ...HOSTELERIA } : { ...SERVICIOS }

  // Clonar labels para no mutar el original
  const labels: DynamicLabels = {
    ...base.labels,
    cliente:   override.clienteLabel  || base.labels.cliente,
    clientes:  override.clientesLabel || base.labels.clientes,
    reserva:   override.reservaLabel  || base.labels.reserva,
    reservas:  override.reservasLabel || base.labels.reservas,
    reservar:  override.reservaLabel  ? ('Pedir ' + (override.reservaLabel || 'cita').toLowerCase()) : base.labels.reservar,
    buscarPlaceholder: override.reservasLabel ? `Buscar ${(override.reservasLabel||'citas').toLowerCase()}…` : base.labels.buscarPlaceholder,
    emptyReservas: override.reservasLabel ? `Sin ${(override.reservasLabel||'citas').toLowerCase()} este día` : base.labels.emptyReservas,
    pageTitle: override.reservasLabel || base.labels.pageTitle,
    unit: { ...base.labels.unit, ...(override.unitLabels || {}) },
  }

  // Construir módulos: si hasSpaces se activa, añadir /mesas al nav de servicios
  let modules = [...base.modules]
  const hasSpaces = override.hasSpaces ?? base.hasSpaces

  if (override.template === 'servicios' && hasSpaces) {
    const clientesIdx = modules.findIndex(m => m.id === 'clientes')
    const espacioMod: NavModule = {
      id: 'mesas', href: '/mesas', icon: 'layout',
      label: labels.unit.plural,
    }
    modules = [
      ...modules.slice(0, clientesIdx + 1),
      espacioMod,
      ...modules.slice(clientesIdx + 1),
    ]
  }

  // Peluquería y barbería tienen "Servicios y tarifas" (productos)
  const tipoConProductos = ['peluqueria','barberia']
  if (tipoConProductos.includes(businessType)) {
    const agenteIdx = modules.findIndex(m => m.id === 'agente')
    const productosMod: NavModule = {
      id: 'productos', href: '/productos', icon: 'menu',
      label: 'Servicios y tarifas',
    }
    modules = [
      ...modules.slice(0, agenteIdx),
      productosMod,
      ...modules.slice(agenteIdx),
    ]
  }

  return {
    ...base,
    hasSpaces,
    hasOrders:    override.template === 'hosteleria' ? base.hasOrders : false,
    hasDelivery:  override.template === 'hosteleria' ? base.hasDelivery : false,
    hasZones:     override.template === 'hosteleria' ? base.hasZones : (hasSpaces && override.unitLabels?.zoneLabel !== undefined),
    modules,
    labels,
    agentContext: override.agentContext || base.agentContext,
  }
}

// Helper: ¿el tipo es hostelería?
export function isHosteleria(type: string): boolean {
  return resolveTemplate(type).id === 'hosteleria'
}

// Helper: ¿tiene módulo de espacios/mesas?
export function hasSpacesModule(type: string): boolean {
  return resolveTemplate(type).hasSpaces
}

// Helper: ¿tiene módulo de pedidos?
export function hasOrdersModule(type: string): boolean {
  return resolveTemplate(type).hasOrders
}
