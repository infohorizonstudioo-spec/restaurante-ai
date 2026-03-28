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
  if (transcript && (!parsed.date || !parsed.customer_name)) {
    const extracted = extractFromTranscript(transcript)
    if (!parsed.date && extracted.date) parsed.date = extracted.date
    if (!parsed.time && extracted.time) parsed.time = extracted.time
    if (!parsed.party_size && extracted.party_size) parsed.party_size = extracted.party_size
    if (!parsed.customer_name && extracted.customer_name) parsed.customer_name = extracted.customer_name
    if (!parsed.intent && extracted.intent) parsed.intent = extracted.intent
    if (!parsed.summary) parsed.summary = extracted.summary
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

  if (lower.includes('una y media')) result.time = '13:30'
  else if (lower.includes('la una')) result.time = '13:00'
  else if (lower.includes('las dos y media')) result.time = '14:30'
  else if (lower.includes('las dos')) result.time = '14:00'
  else if (lower.includes('las tres')) result.time = '15:00'
  else if (lower.includes('las ocho y media')) result.time = '20:30'
  else if (lower.includes('las ocho')) result.time = '20:00'
  else if (lower.includes('las nueve y media')) result.time = '21:30'
  else if (lower.includes('las nueve')) result.time = '21:00'
  else if (lower.includes('las diez')) result.time = '22:00'
  else {
    const m = lower.match(/a las? (\d{1,2})(?:\s*y\s*(media|cuarto))?/)
    if (m) {
      let h = parseInt(m[1])
      if (h < 6) h += 12 // assume PM for small numbers
      const min = m[2] === 'media' ? '30' : m[2] === 'cuarto' ? '15' : '00'
      result.time = `${h.toString().padStart(2, '0')}:${min}`
    }
  }
  if (!result.time) result.time = '13:00' // default lunch

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

  // Summary
  result.summary = transcript.split('\n').slice(-3).join(' ').slice(0, 200)

  return result
}
