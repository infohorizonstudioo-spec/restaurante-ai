import { NextResponse } from 'next/server'
function safe(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }
export async function POST(req: Request) {
  const host = req.headers.get('host') || 'restaurante-ai.vercel.app'
  const url = `https://${host}/api/twilio/webhook`
  try {
    const text = await req.text()
    const params = new URLSearchParams(text)
    const speech = (params.get('SpeechResult') || '').trim()
    let respuesta = 'Hola, gracias por llamar. ¿En qué puedo ayudarte?'
    if (speech) {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 7000)
      try {
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST', signal: ctrl.signal,
          headers: { 'anthropic-version': '2023-06-01', 'x-api-key': process.env.ANTHROPIC_API_KEY || '', 'content-type': 'application/json' },
          body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 80, system: 'Eres una recepcionista española amable. Responde SIEMPRE en español, máximo 2 frases.', messages: [{ role: 'user', content: speech }] })
        })
        clearTimeout(timer)
        const d = await r.json()
        if (d.content?.[0]?.text) respuesta = d.content[0].text
      } catch(e) { clearTimeout(timer) }
    }
    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Conchita" language="es-ES">${safe(respuesta)}</Say><Gather input="speech" language="es-ES" timeout="10" speechTimeout="auto" action="${url}" method="POST"><Say voice="Polly.Conchita" language="es-ES">Le escucho.</Say></Gather><Say voice="Polly.Conchita" language="es-ES">Gracias.</Say></Response>`
    return new NextResponse(twiml, { headers: { 'Content-Type': 'text/xml; charset=utf-8' } })
  } catch(e) {
    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Conchita" language="es-ES">Gracias por llamar.</Say></Response>', { headers: { 'Content-Type': 'text/xml; charset=utf-8' } })
  }
}