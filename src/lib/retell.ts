/**
 * RESERVO.AI — Retell AI Client
 *
 * Cliente para la API de Retell. Gestión de agentes, LLMs, llamadas.
 * Reemplaza ElevenLabs como motor de voz.
 */

const RETELL_API = 'https://api.retellai.com'
const RETELL_KEY = process.env.RETELL_API_KEY || ''

// ─────────────────────────────────────────────────────────────
// VOCES POR TIPO DE NEGOCIO
// ─────────────────────────────────────────────────────────────

// Voces españolas seleccionadas por personalidad/sector
export const VOICE_MAP: Record<string, {
  voice_id: string
  fallbacks: string[]
  speed: number
  temperature: number
}> = {
  // Hostelería: voz cálida, joven, cercana
  restaurante: {
    voice_id: '11labs-Gaby',       // Gaby: cálida, natural, española
    fallbacks: ['cartesia-Isabel', 'openai-Santiago'],
    speed: 1.05,
    temperature: 0.8,
  },
  bar: {
    voice_id: '11labs-Gaby',
    fallbacks: ['cartesia-Isabel', 'openai-Santiago'],
    speed: 1.1,
    temperature: 0.9,
  },
  cafeteria: {
    voice_id: '11labs-Gaby',
    fallbacks: ['cartesia-Isabel', 'openai-Santiago'],
    speed: 1.05,
    temperature: 0.8,
  },

  // Clínicas: voz profesional, tranquila
  clinica_dental: {
    voice_id: 'cartesia-Isabel',
    fallbacks: ['11labs-Gaby', 'cartesia-Elena'],
    speed: 0.95,
    temperature: 0.6,
  },
  clinica_medica: {
    voice_id: 'cartesia-Isabel',
    fallbacks: ['cartesia-Elena', '11labs-Gaby'],
    speed: 0.92,
    temperature: 0.5,
  },
  psicologia: {
    voice_id: 'cartesia-Isabel',
    fallbacks: ['cartesia-Elena'],
    speed: 0.88,
    temperature: 0.4,
  },

  // Estética/belleza: voz alegre, energía
  peluqueria: {
    voice_id: '11labs-Gaby',
    fallbacks: ['cartesia-Isabel', 'cartesia-Elena'],
    speed: 1.05,
    temperature: 0.85,
  },
  barberia: {
    voice_id: 'cartesia-Manuel',    // Voz masculina para barbería
    fallbacks: ['11labs-Santiago', 'openai-Santiago'],
    speed: 1.05,
    temperature: 0.85,
  },
  spa: {
    voice_id: 'cartesia-Isabel',
    fallbacks: ['cartesia-Elena', '11labs-Gaby'],
    speed: 0.9,
    temperature: 0.5,
  },

  // Servicios profesionales: voz seria, confiable
  asesoria: {
    voice_id: 'cartesia-Isabel',
    fallbacks: ['cartesia-Elena'],
    speed: 0.95,
    temperature: 0.5,
  },
  inmobiliaria: {
    voice_id: 'cartesia-Isabel',
    fallbacks: ['cartesia-Elena', '11labs-Gaby'],
    speed: 0.98,
    temperature: 0.6,
  },
  seguros: {
    voice_id: 'cartesia-Isabel',
    fallbacks: ['cartesia-Elena'],
    speed: 0.95,
    temperature: 0.5,
  },

  // Otros
  veterinaria: {
    voice_id: '11labs-Gaby',
    fallbacks: ['cartesia-Isabel', 'cartesia-Elena'],
    speed: 1.0,
    temperature: 0.75,
  },
  fisioterapia: {
    voice_id: 'cartesia-Isabel',
    fallbacks: ['11labs-Gaby', 'cartesia-Elena'],
    speed: 0.95,
    temperature: 0.65,
  },
  hotel: {
    voice_id: 'cartesia-Isabel',
    fallbacks: ['cartesia-Elena', '11labs-Gaby'],
    speed: 0.95,
    temperature: 0.6,
  },
  gimnasio: {
    voice_id: '11labs-Gaby',
    fallbacks: ['cartesia-Isabel'],
    speed: 1.05,
    temperature: 0.8,
  },
  academia: {
    voice_id: 'cartesia-Isabel',
    fallbacks: ['11labs-Gaby'],
    speed: 0.95,
    temperature: 0.6,
  },
  taller: {
    voice_id: 'cartesia-Manuel',
    fallbacks: ['11labs-Santiago', 'openai-Santiago'],
    speed: 1.0,
    temperature: 0.7,
  },
  ecommerce: {
    voice_id: '11labs-Gaby',
    fallbacks: ['cartesia-Isabel'],
    speed: 1.0,
    temperature: 0.7,
  },
  otro: {
    voice_id: 'cartesia-Isabel',
    fallbacks: ['11labs-Gaby', 'cartesia-Elena'],
    speed: 1.0,
    temperature: 0.65,
  },
}

export function getVoiceForBusiness(businessType: string) {
  return VOICE_MAP[businessType] || VOICE_MAP.otro
}

// ─────────────────────────────────────────────────────────────
// API CLIENT
// ─────────────────────────────────────────────────────────────

async function retellFetch(path: string, options: RequestInit = {}): Promise<any> {
  const res = await fetch(`${RETELL_API}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${RETELL_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Retell API ${res.status} ${path}: ${text}`)
  }

  const text = await res.text()
  return text ? JSON.parse(text) : null
}

// ─────────────────────────────────────────────────────────────
// RETELL LLM
// ─────────────────────────────────────────────────────────────

export async function createRetellLLM(config: {
  general_prompt: string
  general_tools: any[]
  begin_message?: string
  model?: string
  inbound_dynamic_variables_webhook_url?: string
}): Promise<{ llm_id: string }> {
  return retellFetch('/create-retell-llm', {
    method: 'POST',
    body: JSON.stringify({
      model: config.model || 'claude-4.6-sonnet',
      s2s_model: null,
      general_prompt: config.general_prompt,
      general_tools: config.general_tools,
      begin_message: config.begin_message || null,
      inbound_dynamic_variables_webhook_url: config.inbound_dynamic_variables_webhook_url || null,
      starting_state: null,
      states: null,
    }),
  })
}

export async function updateRetellLLM(llmId: string, config: {
  general_prompt?: string
  general_tools?: any[]
  begin_message?: string
  model?: string
  inbound_dynamic_variables_webhook_url?: string
}): Promise<any> {
  return retellFetch(`/update-retell-llm/${llmId}`, {
    method: 'PATCH',
    body: JSON.stringify(config),
  })
}

export async function getRetellLLM(llmId: string): Promise<any> {
  return retellFetch(`/get-retell-llm/${llmId}`)
}

// ─────────────────────────────────────────────────────────────
// RETELL AGENT
// ─────────────────────────────────────────────────────────────

export async function createRetellAgent(config: Record<string, any>): Promise<{ agent_id: string }> {
  return retellFetch('/create-agent', {
    method: 'POST',
    body: JSON.stringify(config),
  })
}

export async function updateRetellAgent(agentId: string, config: Record<string, any>): Promise<any> {
  return retellFetch(`/update-agent/${agentId}`, {
    method: 'PATCH',
    body: JSON.stringify(config),
  })
}

export async function getRetellAgent(agentId: string): Promise<any> {
  return retellFetch(`/get-agent/${agentId}`)
}

// ─────────────────────────────────────────────────────────────
// LLAMADAS
// ─────────────────────────────────────────────────────────────

/**
 * Registra una llamada inbound de Twilio en Retell.
 * Retell devuelve un call_id que se usa en el WebSocket Stream de Twilio.
 */
export async function registerInboundCall(config: {
  agent_id: string
  from_number: string
  to_number: string
  metadata?: Record<string, any>
  retell_llm_dynamic_variables?: Record<string, string>
}): Promise<{ call_id: string; sample_rate: number }> {
  return retellFetch('/v2/create-phone-call', {
    method: 'POST',
    body: JSON.stringify({
      from_number: config.from_number,
      to_number: config.to_number,
      agent_id: config.agent_id,
      direction: 'inbound',
      metadata: config.metadata || {},
      retell_llm_dynamic_variables: config.retell_llm_dynamic_variables || {},
    }),
  })
}

export async function createOutboundCall(config: {
  agent_id: string
  customer_number: string
  from_number?: string
  metadata?: Record<string, any>
  retell_llm_dynamic_variables?: Record<string, string>
}): Promise<{ call_id: string }> {
  return retellFetch('/v2/create-phone-call', {
    method: 'POST',
    body: JSON.stringify({
      from_number: config.from_number || null,
      to_number: config.customer_number,
      agent_id: config.agent_id,
      metadata: config.metadata || {},
      retell_llm_dynamic_variables: config.retell_llm_dynamic_variables || {},
    }),
  })
}

export async function getCall(callId: string): Promise<any> {
  return retellFetch(`/get-call/${callId}`)
}

export async function listCalls(filters?: {
  agent_id?: string
  limit?: number
  sort_order?: 'ascending' | 'descending'
}): Promise<any[]> {
  const params: Record<string, any> = {}
  if (filters?.agent_id) params.filter_criteria = [{ member: 'agent_id', operator: 'eq', value: [filters.agent_id] }]
  if (filters?.limit) params.limit = filters.limit
  if (filters?.sort_order) params.sort_order = filters.sort_order

  return retellFetch('/list-calls', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

// ─────────────────────────────────────────────────────────────
// NÚMEROS DE TELÉFONO
// ─────────────────────────────────────────────────────────────

export async function importPhoneNumber(config: {
  phone_number: string
  agent_id: string
  termination_uri?: string
}): Promise<any> {
  return retellFetch('/import-phone-number', {
    method: 'POST',
    body: JSON.stringify(config),
  })
}

export async function listPhoneNumbers(): Promise<any[]> {
  return retellFetch('/list-phone-numbers')
}
