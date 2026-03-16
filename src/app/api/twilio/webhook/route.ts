import { NextResponse } from 'next/server'

function safe(str: string) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

function twiml(texto: string, webhookUrl: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="es-MX">${safe(texto)}</Say>
  <Gather input="speech" language="es-ES" timeout="8" speechTimeout="auto" action="${webhookUrl}" method="POST">
  </Gather>
  <Say language="es-MX">Gracias por llamar. Hasta pronto.</Say>
</Response>`
}

export async function POST(req: Request) {
  const host = req.headers.get('host') || 'restaurante-ai.vercel.app'
  const webhookUrl = `https://${host}/api/twilio/webhook`

  try {
    const form = await req.formData()
    const speech = (form.get('SpeechResult') as string || '').trim()

    // PRIMERA LLAMADA: respuesta instantánea sin IA
    if (!speech) {
      const xml = twiml('Hola, gracias por llamar. Soy tu recepcionista virtual. ¿En qué puedo ayudarte?', webhookUrl)
      return new NextResponse(xml, { headers: { 'Content-Type': 'text/xml; charset=utf-8' } })
    }

    // CON SPEECH: llamar Claude con timeout estricto
    let respuesta = 'Entendido. ¿En qué más le puedo ayudar?'
    
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 7000)
    
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'anthropic-version': '2023-06-01',
          'x-api-key': process.env.ANTHROPIC_API_KEY || '',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 80,
          system: 'Eres una recepcionista virtual. Responde SIEMPRE en español, en 1 frase corta y amable. Puedes ayudar con reservas, horarios e información general.',
          messages: [{ role: 'user', content: speech }]
        })
      })
      clearTimeout(timer)
      const d = await r.json()
      if (d.content?.[0]?.text) respuesta = d.content[0].text
    } catch(e) {
      clearTimeout(timer)
      console.error('Claude timeout:', e)
    }

    const xml = twiml(respuesta, webhookUrl)
    return new NextResponse(xml, { headers: { 'Content-Type': 'text/xml; charset=utf-8' } })

  } catch(e) {
    console.error('Error:', e)
    const xml = twiml('Hola, gracias por llamar. Un momento por favor.', webhookUrl)
    return new NextResponse(xml, { headers: { 'Content-Type': 'text/xml; charset=utf-8' } })
  }
}