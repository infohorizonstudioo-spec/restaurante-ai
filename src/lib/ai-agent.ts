import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface OrderData {
  customerName?: string
  customerPhone?: string
  deliveryAddress?: string
  paymentMethod?: 'efectivo' | 'tarjeta'
  items?: Array<{ name: string; qty: number; price: number }>
  notes?: string
  total?: number
  complete?: boolean
}

export async function processConversation(
  transcript: Array<{ role: 'user' | 'assistant'; content: string }>,
  restaurant: { name: string; menu: any[]; greeting: string },
  currentOrder: OrderData
): Promise<{ reply: string; order: OrderData; hangup: boolean }> {

  const menuText = restaurant.menu
    .map((item: any) => `- ${item.name}: ${item.price}€ (${item.description})`)
    .join('\n')

  const systemPrompt = `Eres el asistente de pedidos de "${restaurant.name}". Tomas pedidos a domicilio.

MENÚ:
${menuText}

PEDIDO ACTUAL: ${JSON.stringify(currentOrder)}

FLUJO: saluda → anota productos → dirección → nombre → pago (efectivo/tarjeta) → notas → confirma con total → despídete.
Habla en español, tono amable, respuestas CORTAS (2-3 frases).
Cuando el pedido esté completo añade [PEDIDO_COMPLETO] al final del reply.

Responde SOLO con JSON:
{"reply":"texto al cliente","order":{pedido actualizado},"hangup":false}`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 400,
    system: systemPrompt,
    messages: transcript.map(t => ({ role: t.role, content: t.content }))
  })

  try {
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
    const hangup = parsed.reply?.includes('[PEDIDO_COMPLETO]') || false
    return {
      reply: parsed.reply?.replace('[PEDIDO_COMPLETO]', '').trim(),
      order: parsed.order || currentOrder,
      hangup
    }
  } catch {
    return { reply: 'Perdone, ¿puede repetirlo?', order: currentOrder, hangup: false }
  }
}
