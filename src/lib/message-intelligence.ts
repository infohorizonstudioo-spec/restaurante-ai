/**
 * MESSAGE INTELLIGENCE — Classifies inbound messages before agent processing.
 * Two-tier system:
 *   Tier 1: Fast keyword matching (zero latency, zero cost)
 *   Tier 2: Claude Haiku classification (only if Tier 1 inconclusive)
 */
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })

// ── Types ──────────────────────────────────────────────────────
export interface MessageClassification {
  intent: 'reservation' | 'cancellation' | 'modification' | 'complaint' | 'inquiry' |
          'emergency' | 'vip_request' | 'order' | 'greeting' | 'followup' | 'unknown'
  priority: 'low' | 'medium' | 'high' | 'critical'
  urgency: boolean
  entities: {
    name?: string
    phone?: string
    date?: string
    time?: string
    service?: string
    party_size?: number
  }
  needsEscalation: boolean
  escalationReason?: string
}

// ── Keyword sets (aligned with agent-decision.ts) ─────────────
const URGENCY_KEYWORDS = [
  'urgente', 'urgencia', 'emergencia', 'ahora mismo', 'inmediato',
  'cuanto antes', 'lo antes posible', 'asap', 'ya mismo', 'de inmediato',
]

const CRISIS_KEYWORDS = [
  'suicidio', 'suicidarme', 'hacerme daño', 'autolesión', 'no puedo más',
  'acabar con todo', 'quitarme la vida', 'morir', 'no quiero vivir',
]

const COMPLAINT_KEYWORDS = [
  'queja', 'reclamación', 'denuncia', 'inaceptable', 'indignado', 'vergüenza',
  'horrible', 'pésimo', 'asco', 'nunca más', 'devolver', 'reembolso',
  'estafa', 'abuso', 'engaño', 'incumplimiento', 'mentira',
  'hoja de reclamaciones', 'poner una queja', 'hablar con el responsable',
  'hablar con el jefe', 'hablar con el encargado', 'no me atienden',
]

const RESERVATION_KEYWORDS = [
  'reservar', 'reserva', 'cita', 'mesa', 'hora', 'disponibilidad',
  'hueco', 'turno', 'sesión', 'clase', 'visita', 'agendar',
]

const CANCEL_KEYWORDS = [
  'cancelar', 'anular', 'borrar', 'eliminar', 'quitar',
  'no puedo ir', 'no voy a poder',
]

const MODIFY_KEYWORDS = [
  'cambiar', 'modificar', 'mover', 'aplazar', 'adelantar',
  'otra hora', 'otro día', 'reprogramar',
]

const ORDER_KEYWORDS = [
  'pedido', 'pedir', 'encargar', 'llevar', 'domicilio', 'delivery',
  'para llevar', 'recoger', 'takeaway',
]

const VIP_KEYWORDS = [
  'vip', 'especial', 'premium', 'evento privado', 'celebración',
  'aniversario', 'cumpleaños', 'boda', 'grupo grande',
]

// ── Tier 1: Fast keyword matching ──────────────────────────────
function tier1Classify(content: string, tenantType: string): Partial<MessageClassification> | null {
  const lower = content.toLowerCase()

  // Crisis detection (highest priority — psychology)
  if (tenantType === 'psicologia' && CRISIS_KEYWORDS.some(k => lower.includes(k))) {
    return {
      intent: 'emergency',
      priority: 'critical',
      urgency: true,
      needsEscalation: true,
      escalationReason: 'Detección de crisis psicológica — derivar a profesional',
    }
  }

  // Complaint detection
  const complaintScore = COMPLAINT_KEYWORDS.filter(k => lower.includes(k)).length
  if (complaintScore >= 2) {
    return {
      intent: 'complaint',
      priority: 'high',
      urgency: true,
      needsEscalation: true,
      escalationReason: 'Reclamación o queja detectada',
    }
  }

  // Urgency detection
  const isUrgent = URGENCY_KEYWORDS.some(k => lower.includes(k))

  // Intent detection by keywords
  if (CANCEL_KEYWORDS.some(k => lower.includes(k))) {
    return { intent: 'cancellation', priority: isUrgent ? 'high' : 'medium', urgency: isUrgent, needsEscalation: false }
  }
  if (MODIFY_KEYWORDS.some(k => lower.includes(k))) {
    return { intent: 'modification', priority: isUrgent ? 'high' : 'medium', urgency: isUrgent, needsEscalation: false }
  }
  if (RESERVATION_KEYWORDS.some(k => lower.includes(k))) {
    return { intent: 'reservation', priority: isUrgent ? 'high' : 'medium', urgency: isUrgent, needsEscalation: false }
  }
  if (ORDER_KEYWORDS.some(k => lower.includes(k))) {
    return { intent: 'order', priority: 'medium', urgency: isUrgent, needsEscalation: false }
  }
  if (VIP_KEYWORDS.some(k => lower.includes(k))) {
    return { intent: 'vip_request', priority: 'high', urgency: false, needsEscalation: false }
  }

  // Single complaint keyword with urgency
  if (complaintScore === 1 && isUrgent) {
    return { intent: 'complaint', priority: 'high', urgency: true, needsEscalation: true, escalationReason: 'Posible queja urgente' }
  }

  // Greeting (short messages with greetings)
  if (content.length < 30 && /^(hola|buenas|buenos|hey|hi|hello)/i.test(content.trim())) {
    return { intent: 'greeting', priority: 'low', urgency: false, needsEscalation: false }
  }

  return null // Tier 1 inconclusive
}

// ── Tier 2: Claude Haiku classification (only if Tier 1 fails) ──
async function tier2Classify(content: string, tenantType: string): Promise<Partial<MessageClassification>> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: `Clasifica este mensaje de cliente para un negocio tipo "${tenantType}". Responde SOLO con JSON válido, sin markdown:
{
  "intent": "reservation|cancellation|modification|complaint|inquiry|emergency|order|greeting|followup|unknown",
  "priority": "low|medium|high|critical",
  "urgency": true/false,
  "needsEscalation": true/false,
  "escalationReason": "razón si necesita escalación, o null"
}
Escalación = true solo si: queja grave, emergencia, solicitud imposible de resolver automáticamente, o contenido delicado.`,
      messages: [{ role: 'user', content }],
    })

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '{}'
    const parsed = JSON.parse(text)
    return {
      intent: parsed.intent || 'unknown',
      priority: parsed.priority || 'medium',
      urgency: parsed.urgency || false,
      needsEscalation: parsed.needsEscalation || false,
      escalationReason: parsed.escalationReason || undefined,
    }
  } catch {
    return { intent: 'unknown', priority: 'medium', urgency: false, needsEscalation: false }
  }
}

// ── Entity extraction (lightweight, regex-based) ───────────────
function extractEntities(content: string): MessageClassification['entities'] {
  const entities: MessageClassification['entities'] = {}

  // Date patterns: "mañana", "hoy", "lunes", "15 de marzo", "2026-03-27"
  const dateMatch = content.match(/(\d{4}-\d{2}-\d{2})/)?.[1]
  if (dateMatch) entities.date = dateMatch

  // Time patterns: "a las 20:00", "20:30", "8 de la tarde"
  const timeMatch = content.match(/(\d{1,2}[:.]\d{2})/)?.[1]
  if (timeMatch) entities.time = timeMatch.replace('.', ':')

  // Party size: "para 4", "mesa de 6", "somos 3"
  const sizeMatch = content.match(/(?:para|de|somos|seremos)\s+(\d{1,2})\s*(?:personas|pax)?/i)?.[1]
  if (sizeMatch) entities.party_size = parseInt(sizeMatch)

  // Phone: +34... or 6xx xxx xxx
  const phoneMatch = content.match(/(\+?\d[\d\s]{8,})/)?.[1]
  if (phoneMatch) entities.phone = phoneMatch.replace(/\s/g, '')

  return entities
}

// ── Main classification function ───────────────────────────────
export async function classifyMessage(
  content: string,
  tenantType: string,
  _customerData?: any,
): Promise<MessageClassification> {
  // Tier 1: Fast keywords
  const tier1 = tier1Classify(content, tenantType)

  if (tier1 && tier1.intent) {
    return {
      intent: tier1.intent,
      priority: tier1.priority || 'medium',
      urgency: tier1.urgency || false,
      entities: extractEntities(content),
      needsEscalation: tier1.needsEscalation || false,
      escalationReason: tier1.escalationReason,
    }
  }

  // Tier 2: Claude classification (only for ambiguous messages)
  const tier2 = await tier2Classify(content, tenantType)

  return {
    intent: tier2.intent || 'unknown',
    priority: tier2.priority || 'medium',
    urgency: tier2.urgency || false,
    entities: extractEntities(content),
    needsEscalation: tier2.needsEscalation || false,
    escalationReason: tier2.escalationReason,
  }
}
