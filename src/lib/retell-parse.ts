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

// ── Dynamic menu cache ──────────────────────────────────────────
type MenuItem = { keywords: string[]; name: string; price: number }
type MenuCache = { items: MenuItem[]; ts: number }
const menuCache = new Map<string, MenuCache>()
const MENU_TTL = 5 * 60 * 1000 // 5 minutes

/** Hardcoded fallback menu (FormaNova defaults) */
const FALLBACK_MENU: MenuItem[] = [
  { keywords: ['paella'], name: 'Paella', price: 13 },
  { keywords: ['arroz banda', 'arroz a banda'], name: 'Arroz a banda', price: 14 },
  { keywords: ['arroz negro'], name: 'Arroz negro', price: 15 },
  { keywords: ['lubina'], name: 'Lubina', price: 18 },
  { keywords: ['dorada'], name: 'Dorada', price: 16 },
  { keywords: ['chuleton', 'chuletón', 'txuleta'], name: 'Chuleton', price: 22 },
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

/**
 * Parse menu text from business_knowledge into MenuItem[].
 * Handles patterns like:
 *   "Arroz a banda 14 euros, paella 13, arroz negro 15"
 *   "Lubina 18€, dorada 16 eur"
 */
function parseMenuText(text: string): MenuItem[] {
  const items: MenuItem[] = []
  // Split on commas or periods that separate items
  const segments = text.split(/[,.]/).map(s => s.trim()).filter(Boolean)

  for (const seg of segments) {
    // Match: item name (words) followed by price number, optionally followed by euros/eur/€
    const m = seg.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(?:euros?|eur|€)?$/i)
    if (m) {
      const rawName = m[1].trim()
      const price = parseFloat(m[2].replace(',', '.'))
      if (rawName && price > 0) {
        // Generate keywords: the full name lowercased + individual significant words
        const nameLower = rawName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        const keywords = [nameLower]
        // Add individual words longer than 2 chars as extra keywords
        const words = nameLower.split(/\s+/).filter(w => w.length > 2)
        if (words.length > 1) {
          for (const w of words) keywords.push(w)
        }
        items.push({ keywords, name: rawName, price })
      }
    }
  }
  return items
}

/**
 * Load menu for a tenant from business_knowledge, with 5-min cache.
 * Returns FALLBACK_MENU if no menu found in DB.
 */
async function loadMenuForTenant(tenantId: string): Promise<MenuItem[]> {
  const cached = menuCache.get(tenantId)
  if (cached && Date.now() - cached.ts < MENU_TTL) {
    return cached.items
  }

  try {
    const { data: knowledge } = await supabase
      .from('business_knowledge')
      .select('content')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .in('category', ['menu', 'carta', 'productos', 'precios'])

    if (knowledge && knowledge.length > 0) {
      const allItems: MenuItem[] = []
      for (const row of knowledge) {
        const parsed = parseMenuText(row.content)
        allItems.push(...parsed)
      }
      if (allItems.length > 0) {
        menuCache.set(tenantId, { items: allItems, ts: Date.now() })
        return allItems
      }
    }
  } catch {
    // DB error — fall through to fallback
  }

  // No menu in DB or parse failed — use fallback
  menuCache.set(tenantId, { items: FALLBACK_MENU, ts: Date.now() })
  return FALLBACK_MENU
}

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
    const tenantMenu = parsed.tenant_id ? await loadMenuForTenant(parsed.tenant_id) : FALLBACK_MENU
    const extracted = extractFromTranscript(transcript, tenantMenu)
    if (!parsed.date && extracted.date) parsed.date = extracted.date
    if (!parsed.time && extracted.time) parsed.time = extracted.time
    if (!parsed.party_size && extracted.party_size) parsed.party_size = extracted.party_size
    if (!parsed.customer_name && extracted.customer_name) parsed.customer_name = extracted.customer_name
    if (!parsed.intent && extracted.intent) parsed.intent = extracted.intent
    if (!parsed.summary) parsed.summary = extracted.summary
    if ((!parsed.items || (Array.isArray(parsed.items) && parsed.items.length === 0)) && extracted.items) parsed.items = extracted.items
    if (!parsed.order_type && extracted.order_type) parsed.order_type = extracted.order_type
    if (!parsed.notes && extracted.notes) parsed.notes = extracted.notes
  }

  parsed._call = body.call || {}
  return parsed
}

function extractFromTranscript(transcript: string, menu: MenuItem[]): Record<string, any> {
  const result: Record<string, any> = {}
  const lower = transcript.toLowerCase()

  // Date — check "pasado mañana" BEFORE "mañana" to avoid false match
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  const dayAfter = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)

  if (lower.includes('pasado mañana') || lower.includes('pasado manana')) result.date = dayAfter
  else if (lower.includes('mañana') || lower.includes('manana')) result.date = tomorrow
  else if (lower.includes('hoy')) result.date = today
  else {
    // Try explicit date format: "el 15 de marzo", "el 3 de abril", "día 22"
    const monthMap: Record<string, number> = {
      enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
      julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
    }
    const explicitDate = lower.match(/(?:el |dia |día )?(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i)
    if (explicitDate) {
      const day = parseInt(explicitDate[1])
      const month = monthMap[explicitDate[2].toLowerCase()]
      const now = new Date()
      let year = now.getFullYear()
      const target = new Date(year, month, day)
      if (target < now) { target.setFullYear(year + 1) }
      result.date = target.toISOString().slice(0, 10)
    } else {
      // Try to find day of week
      const days: Record<string, number> = { lunes: 1, martes: 2, miercoles: 3, miércoles: 3, jueves: 4, viernes: 5, sabado: 6, sábado: 6, domingo: 0 }
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
  // Include all hours that a restaurant might use, with "y media" and "y cuarto" variants
  const timeMap: Record<string, string> = {
    'una y media': '13:30', 'una y cuarto': '13:15', 'la una': '13:00', 'a la una': '13:00',
    'dos y media': '14:30', 'dos y cuarto': '14:15', 'las dos': '14:00',
    'tres y media': '15:30', 'tres y cuarto': '15:15', 'las tres': '15:00',
    'cuatro y media': '16:30', 'cuatro y cuarto': '16:15', 'las cuatro': '16:00',
    'cinco y media': '17:30', 'cinco y cuarto': '17:15', 'las cinco': '17:00',
    'seis y media': '18:30', 'seis y cuarto': '18:15', 'las seis': '18:00',
    'siete y media': '19:30', 'siete y cuarto': '19:15', 'las siete': '19:00',
    'ocho y media': '20:30', 'ocho y cuarto': '20:15', 'las ocho': '20:00',
    'nueve y media': '21:30', 'nueve y cuarto': '21:15', 'las nueve': '21:00',
    'diez y media': '22:30', 'diez y cuarto': '22:15', 'las diez': '22:00',
    'once y media': '23:30', 'once y cuarto': '23:15', 'las once': '23:00',
    'doce y media': '12:30', 'las doce': '12:00',
  }
  // Find ALL matches and keep the one with the highest index (last mention = confirmed)
  let lastTime = ''
  let lastTimeIdx = -1
  for (const [phrase, time] of Object.entries(timeMap)) {
    const idx = lower.lastIndexOf(phrase)
    if (idx >= 0 && idx > lastTimeIdx) {
      lastTimeIdx = idx
      lastTime = time
    }
  }
  if (lastTime) result.time = lastTime
  else {
    // Try numeric patterns - use last match
    const timeRe = /a las? (\d{1,2})(?:\s*y\s*(media|cuarto))?/g
    let tm: RegExpExecArray | null
    let lastTm: RegExpExecArray | null = null
    while ((tm = timeRe.exec(lower)) !== null) { lastTm = tm }
    if (lastTm) {
      const m = lastTm
      let h = parseInt(m[1])
      if (h < 6) h += 12
      const min = m[2] === 'media' ? '30' : m[2] === 'cuarto' ? '15' : '00'
      result.time = `${h.toString().padStart(2, '0')}:${min}`
    }
  }
  if (!result.time) result.time = '13:00'

  // Party size — support Spanish number words and digit patterns
  const spanishNums: Record<string, number> = {
    un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
    seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
  }

  // First try digit-based patterns (most reliable)
  const sizePatterns = [
    /(\d+)\s*personas/i,
    /para\s*(\d+)/i,
    /somos\s*(\d+)/i,
    /seremos\s*(\d+)/i,
    /mesa\s+(?:para|de)\s*(\d+)/i,
  ]
  for (const p of sizePatterns) {
    const m = transcript.match(p)
    if (m) { result.party_size = parseInt(m[1]); break }
  }

  // Then try Spanish number words if no digit match found
  if (!result.party_size) {
    const wordPatterns = [
      /(?:para|somos|seremos)\s+(un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\b/i,
      /(un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\s+personas?/i,
      /mesa\s+(?:para|de)\s+(un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\b/i,
    ]
    for (const p of wordPatterns) {
      const m = lower.match(p)
      if (m && spanishNums[m[1].toLowerCase()]) {
        result.party_size = spanishNums[m[1].toLowerCase()]
        break
      }
    }
  }

  if (!result.party_size) result.party_size = 2

  // Customer name — robust extraction with multiple patterns
  // Support: "me llamo X", "soy X", "a nombre de X", "para X Apellido", "mi nombre es X"
  // Allow 1-3 word names (first + optional last names), capitalized words
  const capName = '[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+'
  const fullName = `(${capName}(?:\\s+${capName}){0,2})`
  const namePatterns = [
    new RegExp(`(?:me llamo|mi nombre es|soy)\\s+${fullName}`, 'i'),
    new RegExp(`(?:a nombre de|el nombre es|nombre)\\s+${fullName}`, 'i'),
    new RegExp(`(?:para|de parte de)\\s+${fullName}`, 'i'),
  ]
  // Use last match in transcript (the confirmed name, not an early mention)
  let lastNameMatch = ''
  for (const p of namePatterns) {
    const globalP = new RegExp(p.source, 'gi')
    let m: RegExpExecArray | null
    let lastM: RegExpExecArray | null = null
    while ((m = globalP.exec(transcript)) !== null) { lastM = m }
    if (lastM && lastM[1]) { lastNameMatch = lastM[1].trim(); break }
  }
  // Fallback: detect common Spanish first names anywhere in transcript
  if (!lastNameMatch) {
    const commonNames = /\b(Arturo|Pedro|Juan|María|Maria|Ana|Carlos|Luis|Miguel|José|Jose|Antonio|David|Pablo|Laura|Sara|Elena|Carmen|Marta|Lucia|Lucía|Javier|Fernando|Manuel|Diego|Raúl|Raul|Sergio|Alejandro|Alejandra|Patricia|Isabel|Rosa|Pilar|Roberto|Ricardo|Jorge|Ángel|Angel|Andrés|Andres|Daniel|Adrián|Adrian|Álvaro|Alvaro|Marcos|Cristina|Silvia|Sandra|Beatriz|Rocío|Rocio|Alberto|Francisco|Paco|Sofía|Sofia|Paula|Claudia|Nuria|Inés|Ines|Teresa|Natalia|Irene|Alicia|Mario|Iván|Ivan|Víctor|Victor|Hugo|Gonzalo|Tomás|Tomas|Emilio|Gabriel|Samuel|Hector|Héctor|Rubén|Ruben|Óscar|Oscar|Enrique|Guillermo)\b/g
    let nm: RegExpExecArray | null
    let lastNm: RegExpExecArray | null = null
    while ((nm = commonNames.exec(transcript)) !== null) { lastNm = nm }
    if (lastNm) lastNameMatch = lastNm[0]
  }
  if (lastNameMatch) result.customer_name = lastNameMatch

  // Intent
  if (lower.includes('reserv') || lower.includes('mesa') || lower.includes('comer')) result.intent = 'reserva'
  else if (lower.includes('pedido') || lower.includes('pedir') || lower.includes('domicilio') || lower.includes('llevar')) result.intent = 'pedido'
  else if (lower.includes('cancel')) result.intent = 'cancelacion'
  else if (lower.includes('horario') || lower.includes('carta') || lower.includes('precio')) result.intent = 'informacion'

  // Order type
  if (lower.includes('domicilio') || lower.includes('a casa') || lower.includes('llevar a')) result.order_type = 'domicilio'
  else if (lower.includes('recoger') || lower.includes('pasar a') || lower.includes('para llevar')) result.order_type = 'recoger'
  else if (lower.includes('mesa') || lower.includes('comer aqui')) result.order_type = 'mesa'

  // Items - extract food items from transcript using dynamic menu
  // Normalize: remove accents for matching
  const norm = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
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
