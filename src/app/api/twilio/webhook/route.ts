export const runtime = 'edge'

function safe(s: string) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')
}

async function generarTextoIA(speech: string, agentName: string, businessName: string, tipo: string): Promise<string> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 7000)
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'anthropic-version': '2023-06-01',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 100,
        system: `Eres ${agentName}, recepcionista de ${businessName} (tipo: ${tipo}).
INSTRUCCIONES CRÍTICAS:
- Habla SIEMPRE en español natural y coloquial, como una persona real
- Máximo 2 frases cortas y directas
- Sé cálida, cercana y profesional a la vez
- NO uses frases robóticas ni formales en exceso
- Si preguntan por reserva: pide nombre, fecha y número de personas
- Si no entiendes: pide que repitan con amabilidad
- NUNCA menciones que eres una IA o un robot`,
        messages: [{ role: 'user', content: speech }]
      })
    })
    clearTimeout(timer)
    const d = await r.json()
    return d.content?.[0]?.text || '¿Puedes repetirlo, por favor?'
  } catch(e) {
    clearTimeout(timer)
    return '¿Puedes repetirlo, por favor? No te he escuchado bien.'
  }
}

export async function POST(req: Request) {
  const host = req.headers.get('host') || 'restaurante-ai.vercel.app'
  const base = `https://${host}`
  const webhookUrl = `${base}/api/twilio/webhook`

  try {
    const form = await req.text()
    const params = new URLSearchParams(form)
    const speech = (params.get('SpeechResult') || '').trim()
    const to = params.get('To') || ''

    // Tenant info
    let agentName = 'Gabriela'
    let businessName = 'nuestro negocio'
    let tipo = 'restaurante'

    // Determinar texto a hablar
    let texto: string
    if (!speech) {
      texto = `¡Hola! Gracias por llamar a ${businessName}. Te atiende ${agentName}. ¿En qué puedo ayudarte?`
    } else {
      texto = await generarTextoIA(speech, agentName, businessName, tipo)
    }

    // URL del audio generado por ElevenLabs (Gabriela)
    const audioUrl = `${base}/api/tts?t=${encodeURIComponent(texto)}`

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${safe(audioUrl)}</Play>
  <Gather input="speech" language="es-ES" timeout="10" speechTimeout="auto" action="${webhookUrl}" method="POST">
  </Gather>
  <Play>${safe(`${base}/api/tts?t=${encodeURIComponent('Ha sido un placer atenderte. ¡Hasta pronto!')}`)}</Play>
</Response>`

    return new Response(twiml, {
      headers: { 'Content-Type': 'text/xml; charset=utf-8' }
    })
  } catch(e) {
    console.error('Webhook error:', e)
    const audioUrl = `https://${host}/api/tts?t=${encodeURIComponent('Hola, un momento por favor.')}`
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Play>${audioUrl}</Play></Response>`,
      { headers: { 'Content-Type': 'text/xml; charset=utf-8' } }
    )
  }
}