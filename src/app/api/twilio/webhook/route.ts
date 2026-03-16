import { NextResponse } from 'next/server'

const VOZ = 'Polly.Conchita'
const LANG = 'es-ES'

function xml(texto: string, url: string) {
  const t = texto.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${VOZ}" language="${LANG}">${t}</Say>
  <Gather input="speech" language="${LANG}" timeout="10" speechTimeout="auto" action="${url}" method="POST">
    <Say voice="${VOZ}" language="${LANG}">Le escucho.</Say>
  </Gather>
  <Say voice="${VOZ}" language="${LANG}">No le he podido escuchar. Llámenos de nuevo. Hasta luego.</Say>
</Response>`
}

export async function POST(req: Request) {
  const host = req.headers.get('host') || 'restaurante-ai.vercel.app'
  const url = `https://${host}/api/twilio/webhook`

  try {
    const form = await req.formData()
    const speech = (form.get('SpeechResult') as string || '').trim()

    // Sin speech = primera llamada, respuesta instantánea
    if (!speech) {
      return new NextResponse(
        xml('Hola, gracias por llamar. Soy su recepcionista virtual. ¿En qué puedo ayudarle?', url),
        { headers: { 'Content-Type': 'text/xml; charset=utf-8' } }
      )
    }

    // Con speech: Claude Haiku con timeout
    let respuesta = 'Entendido, ¿en qué más puedo ayudarle?'
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 6000)
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', signal: ctrl.signal,
        headers: {
          'anthropic-version': '2023-06-01',
          'x-api-key': process.env.ANTHROPIC_API_KEY || '',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 80,
          system: 'Eres una recepcionista española. Responde SIEMPRE en español, en máximo 2 frases cortas y amables. Puedes ayudar con reservas, horarios e información general del negocio.',
          messages: [{ role: 'user', content: speech }]
        })
      })
      clearTimeout(t)
      const d = await r.json()
      if (d.content?.[0]?.text) respuesta = d.content[0].text
    } catch(e) {
      clearTimeout(t)
    }

    return new NextResponse(
      xml(respuesta, url),
      { headers: { 'Content-Type': 'text/xml; charset=utf-8' } }
    )
  } catch(e) {
    return new NextResponse(
      xml('Hola, un momento por favor, inténtelo de nuevo en breve.', url),
      { headers: { 'Content-Type': 'text/xml; charset=utf-8' } }
    )
  }
}