/**
 * Retell envia body con:
 * - call: { agent_id, transcript, from_number, ... }
 * - name: "check_availability"
 * - args: {} (VACIO - bug de Retell)
 *
 * Los argumentos del modelo NO llegan. Extraemos datos del transcript.
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function parseRetellBody(body: Record<string, any>): Promise<Record<string, any>> {
  // Try args first (in case Retell fixes the bug)
  let parsed: Record<string, any> = {}

  if (body.args && typeof body.args === 'object' && Object.keys(body.args).length > 0) {
    parsed = { ...body.args }
  } else if (body.date || body.tenant_id || body.customer_name) {
    // Args at top level (args_only mode working)
    parsed = { ...body }
  }

  // Remove execution_message
  delete parsed.execution_message
  delete parsed.call

  // Get tenant_id from agent_id
  if (!parsed.tenant_id) {
    const agentId = body.call?.agent_id
    if (agentId) {
      const { data } = await supabase.from('tenants').select('id').eq('retell_agent_id', agentId).maybeSingle()
      if (data) parsed.tenant_id = data.id
    }
  }

  // Get caller phone
  parsed.customer_phone = parsed.customer_phone || body.call?.from_number || ''

  // Extract data from transcript if args are empty
  const transcript = body.call?.transcript || ''
  if (transcript) {
    const extracted = extractFromTranscript(transcript)
    if (!parsed.date && extracted.date) parsed.date = extracted.date
    if (!parsed.time && extracted.time) parsed.time = extracted.time
    if (!parsed.party_size && extracted.party_size) parsed.party_size = extracted.party_size
    if (!parsed.customer_name && extracted.customer_name) parsed.customer_name = extracted.customer_name
    if (!parsed.intent && extracted.intent) parsed.intent = extracted.intent
    if (!parsed.summary) parsed.summary = extracted.summary
    if (!parsed.items || (Array.isArray(parsed.items) && parsed.items.length === 0)) parsed.items = extracted.items
    if (!parsed.order_type && extracted.order_type) parsed.order_type = extracted.order_type
    if (!parsed.notes && extracted.notes) parsed.notes = extracted.notes
  }

  parsed._call = body.call || {}
  return parsed
}

function extractFromTranscript(transcript: string): Record<string, any> {
  const result: Record<string, any> = {}
  const lower = transcript.toLowerCase()

  // Date
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  const dayAfter = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)

  if (lower.includes('mañana') || lower.includes('manana')) result.date = tomorrow
  else if (lower.includes('pasado mañana') || lower.includes('pasado manana')) result.date = dayAfter
  else if (lower.includes('hoy')) result.date = today
  else {
    // Try to find day of week
    const days: Record<string, number> = { lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6, domingo: 0 }
    for (const [day, num] of Object.entries(days)) {
      if (lower.includes(day)) {
        const now = new Date()
        const currentDay = now.getDay()
        let diff = num - currentDay
        if (diff <= 0) diff += 7
        const target = new Date(now.getTime() + diff * 86400000)
        result.date = target.toISOString().slice(0, 10)
        break
      }
    }
  }
  if (!result.date) result.date = tomorrow // default tomorrow

  // Time
  const timePatterns = [
    /a las? (\d{1,2})(?:\s*y\s*(media|cuarto))?/i,
    /(\d{1,2})(?:\s*y\s*(media|cuarto))?\s*(?:de la |del )/i,
    /(\d{1,2}):(\d{2})/,
    /una y media/i,
    /la una/i,
    /las? dos/i,
    /las? tres/i,
    /las? cuatro/i,
    /las? ocho/i,
    /las? nueve/i,
    /las? diez/i,
  ]

  // Extract ALL time mentions and use the LAST one (the confirmed one)
  const timeMap: Record<string, string> = {
    'una y media': '13:30', 'la una': '13:00',
    'dos y media': '14:30', 'las dos': '14:00',
    'tres y media': '15:30', 'las tres': '15:00',
    'cuatro y media': '16:30', 'las cuatro': '16:00',
    'ocho y media': '20:30', 'las ocho': '20:00',
    'nueve y media': '21:30', 'las nueve': '21:00',
    'diez y media': '22:30', 'las diez': '22:00',
    'once y media': '23:30', 'las once': '23:00',
  }
  // Find ALL matches and keep last
  let lastTime = ''
  for (const [phrase, time] of Object.entries(timeMap)) {
    const idx = lower.lastIndexOf(phrase)
    if (idx >= 0) {
      // Check if this is the latest mention
      if (!lastTime || idx > lower.lastIndexOf(Object.entries(timeMap).find(([,v]) => v === lastTime)?.[0] || '')) {
        lastTime = time
      }
    }
  }
  if (lastTime) result.time = lastTime
  else {
    // Try numeric patterns - use last match
    const matches = [...lower.matchAll(/a las? (\d{1,2})(?:\s*y\s*(media|cuarto))?/g)]
    if (matches.length) {
      const m = matches[matches.length - 1]
      let h = parseInt(m[1])
      if (h < 6) h += 12
      const min = m[2] === 'media' ? '30' : m[2] === 'cuarto' ? '15' : '00'
      result.time = `${h.toString().padStart(2, '0')}:${min}`
    }
  }
  if (!result.time) result.time = '13:00'

  // Party size
  const sizePatterns = [
    /(\d+)\s*personas/i,
    /para\s*(\d+)/i,
    /somos\s*(\d+)/i,
    /seremos\s*(\d+)/i,
  ]
  for (const p of sizePatterns) {
    const m = transcript.match(p)
    if (m) { result.party_size = parseInt(m[1]); break }
  }
  if (lower.includes('dos personas') || lower.includes('dos dos')) result.party_size = 2
  if (lower.includes('tres personas')) result.party_size = 3
  if (lower.includes('cuatro personas')) result.party_size = 4
  if (!result.party_size) result.party_size = 2

  // Customer name
  const namePatterns = [
    /(?:nombre|nombre de|a nombre de|me llamo|soy)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)/i,
    /(?:Arturo|Pedro|Juan|Maria|Ana|Carlos|Luis|Miguel|Jose|Antonio|David|Pablo|Laura|Sara|Elena)/i,
  ]
  for (const p of namePatterns) {
    const m = transcript.match(p)
    if (m) { result.customer_name = m[1] || m[0]; break }
  }

  // Intent
  if (lower.includes('reserv') || lower.includes('mesa') || lower.includes('comer')) result.intent = 'reserva'
  else if (lower.includes('pedido') || lower.includes('pedir') || lower.includes('domicilio') || lower.includes('llevar')) result.intent = 'pedido'
  else if (lower.includes('cancel')) result.intent = 'cancelacion'
  else if (lower.includes('horario') || lower.includes('carta') || lower.includes('precio')) result.intent = 'informacion'

  // Order type
  if (lower.includes('domicilio') || lower.includes('a casa') || lower.includes('llevar a')) result.order_type = 'domicilio'
  else if (lower.includes('recoger') || lower.includes('pasar a') || lower.includes('para llevar')) result.order_type = 'recoger'
  else if (lower.includes('mesa') || lower.includes('comer aqui')) result.order_type = 'mesa'

  // Items - extract food items from transcript
  // Normalize: remove accents for matching
  const norm = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const menu: Array<{keywords: string[], name: string, price: number}> = [
    { keywords: ['paella'], name: 'Paella', price: 13 },
    { keywords: ['arroz banda', 'arroz a banda'], name: 'Arroz a banda', price: 14 },
    { keywords: ['arroz negro'], name: 'Arroz negro', price: 15 },
    { keywords: ['lubina'], name: 'Lubina', price: 18 },
    { keywords: ['dorada'], name: 'Dorada', price: 16 },
    { keywords: ['chuleton', 'chuletón', 'chuleton', 'txuleta'], name: 'Chuleton', price: 22 },
    { keywords: ['solomillo'], name: 'Solomillo', price: 20 },
    { keywords: ['ensalada', 'ensaladita'], name: 'Ensalada', price: 8 },
    { keywords: ['croquetas', 'croqueta'], name: 'Croquetas', price: 7 },
    { keywords: ['bravas', 'patatas bravas'], name: 'Bravas', price: 7 },
    { keywords: ['gambas', 'gamba'], name: 'Gambas al ajillo', price: 12 },
    { keywords: ['tarta', 'tarta de queso'], name: 'Tarta de queso', price: 6 },
    { keywords: ['flan'], name: 'Flan', price: 5 },
    { keywords: ['helado'], name: 'Helado', price: 4 },
    { keywords: ['hamburguesa', 'burger'], name: 'Hamburguesa gourmet', price: 16 },
    { keywords: ['pulpo'], name: 'Pulpo a la gallega', price: 17 },
    { keywords: ['tortilla'], name: 'Tortilla', price: 8 },
    { keywords: ['chorizo'], name: 'Chorizo a la sidra', price: 9 },
    { keywords: ['coca cola', 'cocacola', 'coca-cola'], name: 'Coca Cola', price: 3 },
    { keywords: ['seven up', 'sevenup', '7up', '7 up'], name: 'Seven Up', price: 3 },
    { keywords: ['fanta'], name: 'Fanta', price: 3 },
    { keywords: ['nestea'], name: 'Nestea', price: 3 },
    { keywords: ['agua'], name: 'Agua', price: 2 },
    { keywords: ['cerveza', 'birra', 'cana', 'cania'], name: 'Cerveza', price: 3 },
    { keywords: ['vino', 'tinto', 'blanco', 'ribera', 'rioja'], name: 'Vino', price: 4 },
    { keywords: ['sangria'], name: 'Sangria', price: 5 },
    { keywords: ['cafe', 'cortado', 'solo'], name: 'Cafe', price: 2 },
    { keywords: ['pan', 'panecillo'], name: 'Pan', price: 1 },
  ]
  const items: Array<{name: string, quantity: number, price: number}> = []
  for (const item of menu) {
    for (const kw of item.keywords) {
      if (norm.includes(kw) || lower.includes(kw)) {
        items.push({ name: item.name, quantity: 1, price: item.price })
        break
      }
    }
  }
  if (items.length > 0) result.items = items

  // Address from transcript
  if (lower.includes('calle') || lower.includes('avenida') || lower.includes('plaza') || lower.includes('numero')) {
    const addressMatch = transcript.match(/(?:calle|avenida|plaza|c\/)[^.!?\n]*/i)
    if (addressMatch) result.notes = addressMatch[0].trim()
  }

  // Summary
  result.summary = transcript.split('\n').slice(-3).join(' ').slice(0, 200)

  return result
}
