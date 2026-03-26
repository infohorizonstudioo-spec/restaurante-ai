// ─────────────────────────────────────────────────────────────────────────────
// RESERVO.AI — PRESETS DE ELEMENTOS POR TIPO DE NEGOCIO
// Define qué elementos puede añadir cada tipo de negocio a su plano.
// ─────────────────────────────────────────────────────────────────────────────

export interface ElementPreset {
  id: string
  label: string
  icon: string
  shape: 'square' | 'round' | 'rectangle'
  w: number
  h: number
  capacity: number
  category: string
}

export interface StarterLayout {
  label: string
  description: string
  icon: string
  elements: Array<{
    preset: string    // preset id
    x: number
    y: number
    name?: string
    zone?: string
  }>
  zones: string[]
}

export interface BusinessPresets {
  elements: ElementPreset[]
  categories: string[]
  starterLayouts: StarterLayout[]
}

// ── RESTAURANTE / BAR / CAFETERÍA ──────────────────────────────────────────
const HOSTELERIA_PRESETS: BusinessPresets = {
  categories: ['Mesas', 'Zonas especiales'],
  elements: [
    { id: 'mesa-2', label: 'Mesa para 2', icon: '🪑', shape: 'square', w: 70, h: 70, capacity: 2, category: 'Mesas' },
    { id: 'mesa-4', label: 'Mesa para 4', icon: '🍽️', shape: 'square', w: 90, h: 90, capacity: 4, category: 'Mesas' },
    { id: 'mesa-6', label: 'Mesa para 6', icon: '🍽️', shape: 'rectangle', w: 140, h: 80, capacity: 6, category: 'Mesas' },
    { id: 'mesa-8', label: 'Mesa para 8', icon: '🍽️', shape: 'rectangle', w: 180, h: 90, capacity: 8, category: 'Mesas' },
    { id: 'mesa-redonda', label: 'Mesa redonda', icon: '⭕', shape: 'round', w: 90, h: 90, capacity: 4, category: 'Mesas' },
    { id: 'barra', label: 'Barra', icon: '🍸', shape: 'rectangle', w: 200, h: 50, capacity: 6, category: 'Zonas especiales' },
    { id: 'reservado', label: 'Reservado VIP', icon: '⭐', shape: 'rectangle', w: 160, h: 100, capacity: 6, category: 'Zonas especiales' },
  ],
  starterLayouts: [
    {
      label: 'Restaurante básico',
      description: '8 mesas + barra',
      icon: '🍽️',
      zones: ['Interior', 'Terraza'],
      elements: [
        { preset: 'mesa-4', x: 60, y: 80, name: 'Mesa 1', zone: 'Interior' },
        { preset: 'mesa-4', x: 180, y: 80, name: 'Mesa 2', zone: 'Interior' },
        { preset: 'mesa-4', x: 300, y: 80, name: 'Mesa 3', zone: 'Interior' },
        { preset: 'mesa-2', x: 60, y: 200, name: 'Mesa 4', zone: 'Interior' },
        { preset: 'mesa-2', x: 160, y: 200, name: 'Mesa 5', zone: 'Interior' },
        { preset: 'mesa-6', x: 280, y: 200, name: 'Mesa 6', zone: 'Interior' },
        { preset: 'mesa-4', x: 500, y: 80, name: 'Mesa 7', zone: 'Terraza' },
        { preset: 'mesa-4', x: 620, y: 80, name: 'Mesa 8', zone: 'Terraza' },
        { preset: 'barra', x: 60, y: 340 },
      ],
    },
    {
      label: 'Café pequeño',
      description: '5 mesas íntimas',
      icon: '☕',
      zones: ['Sala'],
      elements: [
        { preset: 'mesa-2', x: 60, y: 80, name: 'Mesa 1', zone: 'Sala' },
        { preset: 'mesa-2', x: 180, y: 80, name: 'Mesa 2', zone: 'Sala' },
        { preset: 'mesa-2', x: 300, y: 80, name: 'Mesa 3', zone: 'Sala' },
        { preset: 'mesa-4', x: 120, y: 200, name: 'Mesa 4', zone: 'Sala' },
        { preset: 'mesa-4', x: 260, y: 200, name: 'Mesa 5', zone: 'Sala' },
      ],
    },
  ],
}

// ── CLÍNICA DENTAL ──────────────────────────────────────────────────────────
const CLINICA_DENTAL_PRESETS: BusinessPresets = {
  categories: ['Consultas', 'Zonas comunes'],
  elements: [
    { id: 'silla-dental', label: 'Silla dental', icon: '🦷', shape: 'rectangle', w: 100, h: 80, capacity: 1, category: 'Consultas' },
    { id: 'consulta', label: 'Consulta', icon: '🏥', shape: 'rectangle', w: 120, h: 100, capacity: 1, category: 'Consultas' },
    { id: 'sala-rx', label: 'Sala Rx', icon: '📷', shape: 'square', w: 100, h: 100, capacity: 1, category: 'Zonas comunes' },
    { id: 'sala-espera', label: 'Sala de espera', icon: '🪑', shape: 'rectangle', w: 200, h: 100, capacity: 10, category: 'Zonas comunes' },
  ],
  starterLayouts: [
    {
      label: 'Clínica 3 gabinetes',
      description: '3 sillas + consulta + espera',
      icon: '🦷',
      zones: ['Planta 1'],
      elements: [
        { preset: 'silla-dental', x: 60, y: 80, name: 'Gabinete 1', zone: 'Planta 1' },
        { preset: 'silla-dental', x: 200, y: 80, name: 'Gabinete 2', zone: 'Planta 1' },
        { preset: 'silla-dental', x: 340, y: 80, name: 'Gabinete 3', zone: 'Planta 1' },
        { preset: 'consulta', x: 60, y: 220, name: 'Despacho Dr.', zone: 'Planta 1' },
        { preset: 'sala-espera', x: 240, y: 220, name: 'Espera', zone: 'Planta 1' },
      ],
    },
  ],
}

// ── CLÍNICA MÉDICA ──────────────────────────────────────────────────────────
const CLINICA_MEDICA_PRESETS: BusinessPresets = {
  categories: ['Consultas', 'Zonas comunes'],
  elements: [
    { id: 'consulta-med', label: 'Consulta', icon: '🩺', shape: 'rectangle', w: 120, h: 100, capacity: 1, category: 'Consultas' },
    { id: 'box-urgencias', label: 'Box urgencias', icon: '🚑', shape: 'rectangle', w: 110, h: 90, capacity: 1, category: 'Consultas' },
    { id: 'sala-espera', label: 'Sala de espera', icon: '🪑', shape: 'rectangle', w: 200, h: 100, capacity: 15, category: 'Zonas comunes' },
    { id: 'enfermeria', label: 'Enfermería', icon: '💉', shape: 'rectangle', w: 110, h: 80, capacity: 2, category: 'Zonas comunes' },
  ],
  starterLayouts: [
    {
      label: 'Consultorio médico',
      description: '4 consultas + enfermería',
      icon: '🩺',
      zones: ['Planta baja'],
      elements: [
        { preset: 'consulta-med', x: 60, y: 80, name: 'Consulta 1', zone: 'Planta baja' },
        { preset: 'consulta-med', x: 220, y: 80, name: 'Consulta 2', zone: 'Planta baja' },
        { preset: 'consulta-med', x: 380, y: 80, name: 'Consulta 3', zone: 'Planta baja' },
        { preset: 'consulta-med', x: 60, y: 220, name: 'Consulta 4', zone: 'Planta baja' },
        { preset: 'enfermeria', x: 220, y: 220, name: 'Enfermería', zone: 'Planta baja' },
        { preset: 'sala-espera', x: 370, y: 220, name: 'Espera', zone: 'Planta baja' },
      ],
    },
  ],
}

// ── PELUQUERÍA / BARBERÍA ───────────────────────────────────────────────────
const PELUQUERIA_PRESETS: BusinessPresets = {
  categories: ['Puestos', 'Zonas'],
  elements: [
    { id: 'sillon', label: 'Sillón', icon: '✂️', shape: 'square', w: 80, h: 80, capacity: 1, category: 'Puestos' },
    { id: 'lavacabezas', label: 'Lavacabezas', icon: '🚿', shape: 'rectangle', w: 80, h: 60, capacity: 1, category: 'Puestos' },
    { id: 'tocador', label: 'Tocador', icon: '💇', shape: 'rectangle', w: 100, h: 70, capacity: 1, category: 'Puestos' },
    { id: 'espera', label: 'Espera', icon: '🪑', shape: 'rectangle', w: 160, h: 70, capacity: 4, category: 'Zonas' },
  ],
  starterLayouts: [
    {
      label: 'Peluquería estándar',
      description: '4 sillones + lavacabezas',
      icon: '✂️',
      zones: ['Sala principal'],
      elements: [
        { preset: 'sillon', x: 60, y: 80, name: 'Sillón 1', zone: 'Sala principal' },
        { preset: 'sillon', x: 170, y: 80, name: 'Sillón 2', zone: 'Sala principal' },
        { preset: 'sillon', x: 280, y: 80, name: 'Sillón 3', zone: 'Sala principal' },
        { preset: 'sillon', x: 390, y: 80, name: 'Sillón 4', zone: 'Sala principal' },
        { preset: 'lavacabezas', x: 60, y: 220, name: 'Lavacabezas 1', zone: 'Sala principal' },
        { preset: 'lavacabezas', x: 170, y: 220, name: 'Lavacabezas 2', zone: 'Sala principal' },
        { preset: 'espera', x: 300, y: 220, name: 'Espera', zone: 'Sala principal' },
      ],
    },
  ],
}

// ── HOTEL ────────────────────────────────────────────────────────────────────
const HOTEL_PRESETS: BusinessPresets = {
  categories: ['Habitaciones', 'Zonas comunes'],
  elements: [
    { id: 'hab-individual', label: 'Individual', icon: '🛏️', shape: 'rectangle', w: 90, h: 80, capacity: 1, category: 'Habitaciones' },
    { id: 'hab-doble', label: 'Doble', icon: '🛏️', shape: 'rectangle', w: 110, h: 90, capacity: 2, category: 'Habitaciones' },
    { id: 'hab-suite', label: 'Suite', icon: '👑', shape: 'rectangle', w: 160, h: 110, capacity: 3, category: 'Habitaciones' },
    { id: 'salon-eventos', label: 'Salón eventos', icon: '🎪', shape: 'rectangle', w: 200, h: 140, capacity: 50, category: 'Zonas comunes' },
  ],
  starterLayouts: [
    {
      label: 'Hotel pequeño',
      description: '6 habitaciones en 1 planta',
      icon: '🏨',
      zones: ['Planta 1'],
      elements: [
        { preset: 'hab-doble', x: 60, y: 60, name: 'Hab 101', zone: 'Planta 1' },
        { preset: 'hab-doble', x: 200, y: 60, name: 'Hab 102', zone: 'Planta 1' },
        { preset: 'hab-doble', x: 340, y: 60, name: 'Hab 103', zone: 'Planta 1' },
        { preset: 'hab-individual', x: 60, y: 190, name: 'Hab 104', zone: 'Planta 1' },
        { preset: 'hab-individual', x: 180, y: 190, name: 'Hab 105', zone: 'Planta 1' },
        { preset: 'hab-suite', x: 300, y: 180, name: 'Suite 106', zone: 'Planta 1' },
      ],
    },
  ],
}

// ── SPA ──────────────────────────────────────────────────────────────────────
const SPA_PRESETS: BusinessPresets = {
  categories: ['Cabinas', 'Zonas'],
  elements: [
    { id: 'cabina-masaje', label: 'Cabina masaje', icon: '💆', shape: 'rectangle', w: 110, h: 90, capacity: 1, category: 'Cabinas' },
    { id: 'cabina-facial', label: 'Cabina facial', icon: '✨', shape: 'square', w: 90, h: 90, capacity: 1, category: 'Cabinas' },
    { id: 'jacuzzi', label: 'Jacuzzi', icon: '🌊', shape: 'round', w: 120, h: 120, capacity: 4, category: 'Zonas' },
    { id: 'sauna', label: 'Sauna', icon: '🧖', shape: 'rectangle', w: 140, h: 100, capacity: 6, category: 'Zonas' },
  ],
  starterLayouts: [
    {
      label: 'Spa básico',
      description: '3 cabinas + jacuzzi',
      icon: '💆',
      zones: ['Zona tratamientos', 'Zona relax'],
      elements: [
        { preset: 'cabina-masaje', x: 60, y: 80, name: 'Cabina 1', zone: 'Zona tratamientos' },
        { preset: 'cabina-masaje', x: 200, y: 80, name: 'Cabina 2', zone: 'Zona tratamientos' },
        { preset: 'cabina-facial', x: 340, y: 80, name: 'Cabina 3', zone: 'Zona tratamientos' },
        { preset: 'jacuzzi', x: 120, y: 240, name: 'Jacuzzi', zone: 'Zona relax' },
        { preset: 'sauna', x: 300, y: 240, name: 'Sauna', zone: 'Zona relax' },
      ],
    },
  ],
}

// ── ASESORÍA / OFICINA ──────────────────────────────────────────────────────
const OFICINA_PRESETS: BusinessPresets = {
  categories: ['Despachos', 'Zonas comunes'],
  elements: [
    { id: 'despacho', label: 'Despacho', icon: '💼', shape: 'rectangle', w: 120, h: 90, capacity: 2, category: 'Despachos' },
    { id: 'sala-reuniones', label: 'Sala reuniones', icon: '🤝', shape: 'rectangle', w: 160, h: 120, capacity: 8, category: 'Zonas comunes' },
    { id: 'recepcion', label: 'Recepción', icon: '🔔', shape: 'rectangle', w: 140, h: 60, capacity: 1, category: 'Zonas comunes' },
  ],
  starterLayouts: [
    {
      label: 'Oficina estándar',
      description: '3 despachos + sala reuniones',
      icon: '💼',
      zones: ['Planta'],
      elements: [
        { preset: 'despacho', x: 60, y: 80, name: 'Despacho 1', zone: 'Planta' },
        { preset: 'despacho', x: 220, y: 80, name: 'Despacho 2', zone: 'Planta' },
        { preset: 'despacho', x: 380, y: 80, name: 'Despacho 3', zone: 'Planta' },
        { preset: 'sala-reuniones', x: 140, y: 220, name: 'Sala Reuniones', zone: 'Planta' },
        { preset: 'recepcion', x: 350, y: 240, name: 'Recepción', zone: 'Planta' },
      ],
    },
  ],
}

// ── ACADEMIA ─────────────────────────────────────────────────────────────────
const ACADEMIA_PRESETS: BusinessPresets = {
  categories: ['Aulas', 'Zonas comunes'],
  elements: [
    { id: 'aula-peq', label: 'Aula pequeña', icon: '📚', shape: 'rectangle', w: 120, h: 100, capacity: 10, category: 'Aulas' },
    { id: 'aula-grande', label: 'Aula grande', icon: '📖', shape: 'rectangle', w: 180, h: 120, capacity: 25, category: 'Aulas' },
    { id: 'laboratorio', label: 'Laboratorio', icon: '🔬', shape: 'rectangle', w: 160, h: 110, capacity: 15, category: 'Aulas' },
    { id: 'biblioteca', label: 'Biblioteca', icon: '📕', shape: 'rectangle', w: 200, h: 120, capacity: 20, category: 'Zonas comunes' },
  ],
  starterLayouts: [
    {
      label: 'Academia básica',
      description: '4 aulas + biblioteca',
      icon: '📚',
      zones: ['Planta 1'],
      elements: [
        { preset: 'aula-peq', x: 60, y: 80, name: 'Aula 1', zone: 'Planta 1' },
        { preset: 'aula-peq', x: 220, y: 80, name: 'Aula 2', zone: 'Planta 1' },
        { preset: 'aula-grande', x: 380, y: 60, name: 'Aula 3', zone: 'Planta 1' },
        { preset: 'aula-peq', x: 60, y: 230, name: 'Aula 4', zone: 'Planta 1' },
        { preset: 'biblioteca', x: 230, y: 230, name: 'Biblioteca', zone: 'Planta 1' },
      ],
    },
  ],
}

// ── VETERINARIA ──────────────────────────────────────────────────────────────
const VETERINARIA_PRESETS: BusinessPresets = {
  categories: ['Consultas', 'Zonas'],
  elements: [
    { id: 'consulta-vet', label: 'Consulta', icon: '🐾', shape: 'rectangle', w: 120, h: 100, capacity: 1, category: 'Consultas' },
    { id: 'quirofano', label: 'Quirófano', icon: '🏥', shape: 'rectangle', w: 140, h: 110, capacity: 1, category: 'Consultas' },
    { id: 'peluqueria-can', label: 'Peluquería canina', icon: '🐕', shape: 'square', w: 100, h: 100, capacity: 1, category: 'Zonas' },
    { id: 'espera-vet', label: 'Sala espera', icon: '🪑', shape: 'rectangle', w: 180, h: 80, capacity: 8, category: 'Zonas' },
  ],
  starterLayouts: [
    {
      label: 'Clínica veterinaria',
      description: '2 consultas + quirófano',
      icon: '🐾',
      zones: ['Clínica'],
      elements: [
        { preset: 'consulta-vet', x: 60, y: 80, name: 'Consulta 1', zone: 'Clínica' },
        { preset: 'consulta-vet', x: 220, y: 80, name: 'Consulta 2', zone: 'Clínica' },
        { preset: 'quirofano', x: 380, y: 70, name: 'Quirófano', zone: 'Clínica' },
        { preset: 'espera-vet', x: 120, y: 230, name: 'Espera', zone: 'Clínica' },
      ],
    },
  ],
}

// ── FISIOTERAPIA ─────────────────────────────────────────────────────────────
const FISIO_PRESETS: BusinessPresets = {
  categories: ['Boxes', 'Zonas'],
  elements: [
    { id: 'box-fisio', label: 'Box fisioterapia', icon: '🏋️', shape: 'rectangle', w: 110, h: 90, capacity: 1, category: 'Boxes' },
    { id: 'camilla', label: 'Camilla', icon: '🛏️', shape: 'rectangle', w: 90, h: 60, capacity: 1, category: 'Boxes' },
    { id: 'sala-ejercicios', label: 'Sala ejercicios', icon: '💪', shape: 'rectangle', w: 200, h: 140, capacity: 6, category: 'Zonas' },
  ],
  starterLayouts: [
    {
      label: 'Centro fisioterapia',
      description: '3 boxes + sala ejercicios',
      icon: '🏋️',
      zones: ['Centro'],
      elements: [
        { preset: 'box-fisio', x: 60, y: 80, name: 'Box 1', zone: 'Centro' },
        { preset: 'box-fisio', x: 200, y: 80, name: 'Box 2', zone: 'Centro' },
        { preset: 'box-fisio', x: 340, y: 80, name: 'Box 3', zone: 'Centro' },
        { preset: 'sala-ejercicios', x: 120, y: 220, name: 'Sala ejercicios', zone: 'Centro' },
      ],
    },
  ],
}

// ── GIMNASIO ─────────────────────────────────────────────────────────────────
const GIMNASIO_PRESETS: BusinessPresets = {
  categories: ['Salas', 'Zonas'],
  elements: [
    { id: 'sala-fitness', label: 'Sala fitness', icon: '🏋️', shape: 'rectangle', w: 200, h: 140, capacity: 30, category: 'Salas' },
    { id: 'sala-clases', label: 'Sala de clases', icon: '🧘', shape: 'rectangle', w: 160, h: 120, capacity: 20, category: 'Salas' },
    { id: 'piscina', label: 'Piscina', icon: '🏊', shape: 'rectangle', w: 220, h: 120, capacity: 15, category: 'Zonas' },
    { id: 'vestuario', label: 'Vestuario', icon: '🚿', shape: 'rectangle', w: 120, h: 80, capacity: 10, category: 'Zonas' },
  ],
  starterLayouts: [
    {
      label: 'Gimnasio estándar',
      description: 'Fitness + clases + vestuarios',
      icon: '🏋️',
      zones: ['Planta'],
      elements: [
        { preset: 'sala-fitness', x: 60, y: 60, name: 'Sala fitness', zone: 'Planta' },
        { preset: 'sala-clases', x: 300, y: 60, name: 'Sala yoga', zone: 'Planta' },
        { preset: 'sala-clases', x: 60, y: 240, name: 'Sala spinning', zone: 'Planta' },
        { preset: 'vestuario', x: 280, y: 260, name: 'Vestuarios', zone: 'Planta' },
      ],
    },
  ],
}

// ── GENÉRICO (para tipos sin presets específicos) ────────────────────────────
const GENERIC_PRESETS: BusinessPresets = {
  categories: ['Espacios', 'Zonas'],
  elements: [
    { id: 'espacio-peq', label: 'Espacio pequeño', icon: '▫️', shape: 'square', w: 80, h: 80, capacity: 2, category: 'Espacios' },
    { id: 'espacio-med', label: 'Espacio mediano', icon: '◻️', shape: 'rectangle', w: 120, h: 90, capacity: 4, category: 'Espacios' },
    { id: 'espacio-grande', label: 'Espacio grande', icon: '⬜', shape: 'rectangle', w: 180, h: 120, capacity: 8, category: 'Espacios' },
    { id: 'espacio-redondo', label: 'Espacio redondo', icon: '⭕', shape: 'round', w: 100, h: 100, capacity: 4, category: 'Espacios' },
    { id: 'sala-comun', label: 'Zona común', icon: '🏢', shape: 'rectangle', w: 200, h: 100, capacity: 10, category: 'Zonas' },
  ],
  starterLayouts: [],
}

// ── MAPEO TIPO → PRESETS ────────────────────────────────────────────────────
const PRESETS_MAP: Record<string, BusinessPresets> = {
  restaurante: HOSTELERIA_PRESETS,
  bar: HOSTELERIA_PRESETS,
  cafeteria: HOSTELERIA_PRESETS,
  hotel: HOTEL_PRESETS,
  clinica_dental: CLINICA_DENTAL_PRESETS,
  clinica_medica: CLINICA_MEDICA_PRESETS,
  veterinaria: VETERINARIA_PRESETS,
  fisioterapia: FISIO_PRESETS,
  peluqueria: PELUQUERIA_PRESETS,
  barberia: PELUQUERIA_PRESETS,
  spa: SPA_PRESETS,
  asesoria: OFICINA_PRESETS,
  seguros: OFICINA_PRESETS,
  inmobiliaria: OFICINA_PRESETS,
  academia: ACADEMIA_PRESETS,
  gimnasio: GIMNASIO_PRESETS,
  taller: GENERIC_PRESETS,
  psicologia: GENERIC_PRESETS,
  ecommerce: GENERIC_PRESETS,
  otro: GENERIC_PRESETS,
}

export function getPresetsForType(businessType: string): BusinessPresets {
  return PRESETS_MAP[businessType] || GENERIC_PRESETS
}
