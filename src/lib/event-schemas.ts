export interface BusinessEventConfig {
  eventLabel: string
  eventLabelPlural: string
  fields: string[]
  actions: string[]
  callStates: string[]
}

const DEFAULT_CONFIG: BusinessEventConfig = {
  eventLabel: 'Reserva',
  eventLabelPlural: 'Reservas',
  fields: ['customer_name', 'date', 'time', 'people', 'notes'],
  actions: ['confirm', 'cancel', 'modify'],
  callStates: ['nueva', 'confirmada', 'cancelada', 'completada'],
}

const CONFIGS: Record<string, BusinessEventConfig> = {
  restaurante: DEFAULT_CONFIG,
  bar: { ...DEFAULT_CONFIG, eventLabel: 'Reserva', eventLabelPlural: 'Reservas' },
  clinica_dental: { ...DEFAULT_CONFIG, eventLabel: 'Cita', eventLabelPlural: 'Citas' },
  clinica_medica: { ...DEFAULT_CONFIG, eventLabel: 'Cita', eventLabelPlural: 'Citas' },
  veterinaria: { ...DEFAULT_CONFIG, eventLabel: 'Visita', eventLabelPlural: 'Visitas' },
  peluqueria: { ...DEFAULT_CONFIG, eventLabel: 'Cita', eventLabelPlural: 'Citas' },
  barberia: { ...DEFAULT_CONFIG, eventLabel: 'Cita', eventLabelPlural: 'Citas' },
  fisioterapia: { ...DEFAULT_CONFIG, eventLabel: 'Sesión', eventLabelPlural: 'Sesiones' },
  psicologia: { ...DEFAULT_CONFIG, eventLabel: 'Sesión', eventLabelPlural: 'Sesiones' },
  inmobiliaria: { ...DEFAULT_CONFIG, eventLabel: 'Visita', eventLabelPlural: 'Visitas' },
}

export function getEventConfig(businessType: string): BusinessEventConfig {
  return CONFIGS[businessType] || DEFAULT_CONFIG
}

export function getAllCallStates(businessType: string): string[] {
  const config = getEventConfig(businessType)
  return config.callStates
}
