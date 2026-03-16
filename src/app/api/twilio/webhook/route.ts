export const runtime = 'edge'

function safe(s: string) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

export async function POST(req: Request) {
  const host = req.headers.get('host') || 'restaurante-ai.vercel.app'
  const url = `https://${host}/api/twilio/webhook`

  try {
    const text = await req.text()
    const params = new URLSearchParams(text)
    const speech = (params.get('SpeechResult') || '').trim()

    // Sin speech: respuesta instantánea en español
    if (!speech) {
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Conchita" language="es-ES">Hola, gracias por llamar. Soy su recepcionista virtual. ¿En qué puedo ayudarle?</Say>
  <Gather input="speech" language="es-ES" timeout="10" speechTimeout="auto" action="${url}" method="POST">
    <Say voice="Polly.Conchita" language="es-ES">Le escucho.</Say>
  </Gather>
  <Say voice="Polly.Conchita" language="es-ES">No le he podido escuchar. Por favor llámenos de nuevo. Hasta luego.</Say>
</Response>`
      return new Response(twiml, { headers: { 'Content-Type': 'text/xml; charset=utf-8' } })
    }

    // Con speech: Claude con timeout 6s
    let respuesta = 'Entendido. ¿En qué más puedo ayudarle?'
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 6000)
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
          system: 'Eres una recepcionista española amable. Responde SIEMPRE en español, máximo 2 frases cortas. Ayudas con reservas, horarios e información del negocio.',
          messages: [{ role: 'user', content: speech }]
        })
      })
      clearTimeout(timer)
      const d = await r.json()
      if (d.content?.[0]?.text) respuesta = d.content[0].text
    } catch(e) { /* timeout o error: usa respuesta por defecto */ }

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Conchita" language="es-ES">${safe(respuesta)}</Say>
  <Gather input="speech" language="es-ES" timeout="10" speechTimeout="auto" action="${url}" method="POST">
    <Say voice="Polly.Conchita" language="es-ES">¿Algo más en lo que pueda ayudarle?</Say>
  </Gather>
  <Say voice="Polly.Conchita" language="es-ES">Gracias por llamar. Hasta pronto.</Say>
</Response>`
    return new Response(twiml, { headers: { 'Content-Type': 'text/xml; charset=utf-8' } })

  } catch(e) {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Conchita" language="es-ES">Hola, gracias por llamar. Un momento por favor.</Say>
</Response>`
    return new Response(twiml, { headers: { 'Content-Type': 'text/xml; charset=utf-8' } })
  }
}