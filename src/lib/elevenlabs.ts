/**
 * RESERVO.AI — ElevenLabs Integration
 * Usa el agentContext ya definido en templates.ts para cada tipo de negocio.
 * No duplica lógica — se adapta completamente a la arquitectura existente.
 */
import { resolveTemplate } from '@/lib/templates'
import { sanitizeForLLM } from '@/lib/sanitize'

export interface ElevenLabsConfig {
  voice_id: string
  stability: number
  similarity_boost: number
  style: number
}

// Voces por tipo de plantilla (hostelería = voz cálida, servicios = voz profesional)
const VOICE_BY_TEMPLATE: Record<string, ElevenLabsConfig> = {
  hosteleria: { voice_id: 'EXAVITQu4vr4xnSDxMaL', stability: 0.5, similarity_boost: 0.8, style: 0.3 },
  servicios:  { voice_id: 'ErXwobaYiN019PkySvjV', stability: 0.7, similarity_boost: 0.8, style: 0.1 },
}

// Overrides por tipo específico donde la voz importa más
const VOICE_OVERRIDES: Record<string, ElevenLabsConfig> = {
  psicologia: { voice_id: 'ErXwobaYiN019PkySvjV', stability: 0.85, similarity_boost: 0.9, style: 0.0 },
  veterinaria:{ voice_id: 'EXAVITQu4vr4xnSDxMaL', stability: 0.6,  similarity_boost: 0.8, style: 0.2 },
  inmobiliaria:{ voice_id: 'VR6AewLTigWG4xSOukaG', stability: 0.6, similarity_boost: 0.8, style: 0.2 },
}

export function getVoiceConfig(businessType: string): ElevenLabsConfig {
  if (VOICE_OVERRIDES[businessType]) return VOICE_OVERRIDES[businessType]
  const tmpl = resolveTemplate(businessType)
  return VOICE_BY_TEMPLATE[tmpl.id] ?? VOICE_BY_TEMPLATE.servicios
}

export async function createConversation(params: {
  tenantId:     string
  businessType: string
  tenantName:   string
  elAgentId?:   string
}): Promise<{ conversationId: string; signedUrl: string }> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY no configurada')

  // El agentContext ya viene del template — no duplicamos lógica
  const tmpl   = resolveTemplate(params.businessType)
  const config = getVoiceConfig(params.businessType)
  const safeName = sanitizeForLLM(params.tenantName).slice(0, 100)
  const prompt = tmpl.agentContext + `\n\nNegocio: ${safeName}. Detecta el idioma del cliente automáticamente y responde en ese idioma. Sé natural, rápida y concisa.`

  const res = await fetch('https://api.elevenlabs.io/v1/convai/conversations', {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agent_id: params.elAgentId || process.env.ELEVENLABS_AGENT_ID || '',
      conversation_config_override: {
        agent: {
          prompt: { prompt },
          first_message: `${safeName}, buenas, dígame.`,
        },
        tts: {
          voice_id:        config.voice_id,
          stability:       config.stability,
          similarity_boost:config.similarity_boost,
        },
      },
      metadata: { tenant_id: params.tenantId, business_type: params.businessType },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`ElevenLabs ${res.status}: ${err}`)
  }

  const data = await res.json()
  return {
    conversationId: data.conversation_id,
    signedUrl:      data.signed_url ?? '',
  }
}

export async function endConversation(conversationId: string): Promise<void> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) return
  await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`, {
    method: 'DELETE',
    headers: { 'xi-api-key': apiKey },
  }).catch(() => {})
}
