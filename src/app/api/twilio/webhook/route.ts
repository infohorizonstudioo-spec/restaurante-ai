import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

function xmlSafe(str: string) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

export async function POST(req: Request) {
  const host = req.headers.get('host') || 'restaurante-ai.vercel.app'
  const webhookUrl = `https://${host}/api/twilio/webhook`

  try {
    const form = await req.formData()
    const from = form.get('From') as string || ''
    const to   = form.get('To')   as string || ''
    const sid  = form.get('CallSid') as string || ''
    const speech = (form.get('SpeechResult') as string || '').trim()

    // Buscar tenant por teléfono
    let tenant: any = null
    try {
      const { data } = await supabase.from('tenants').select('*').eq('agent_phone', to).maybeSingle()
      tenant = data
    } catch(e) {}

    const nombre   = tenant?.agent_name   || 'Recepcionista'
    const negocio  = tenant?.name         || 'nuestro negocio'
    const tipo     = tenant?.type         || 'restaurante'

    // Generar respuesta con Claude
    let texto = `¡Hola! Gracias por llamar a ${negocio}. Soy ${nombre}, su recepcionista virtual. ¿En qué le puedo ayudar?`

    if (speech) {
      try {
        const msg = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 100,
          system: `Eres ${nombre}, recepcionista de ${negocio} (tipo: ${tipo}).
REGLAS ESTRICTAS:
- Responde SIEMPRE en español castellano
- Máximo 2 frases cortas
- Sé amable y profesional
- Si piden reserva: pide nombre, fecha, personas`,
          messages: [{ role: 'user', content: speech }]
        })
        texto = msg.content[0].type === 'text' ? msg.content[0].text : texto
      } catch(e) {
        console.error('Claude error:', e)
        texto = 'Entendido. ¿En qué más le puedo ayudar?'
      }
    }

    // TwiML limpio — Polly.Conchita funciona en trial
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="es-ES" voice="Polly.Conchita">${xmlSafe(texto)}</Say>
  <Gather input="speech" language="es-ES" timeout="10" speechTimeout="auto" action="${webhookUrl}" method="POST">
  </Gather>
  <Say language="es-ES" voice="Polly.Conchita">Gracias por llamar a ${xmlSafe(negocio)}. ¡Hasta luego!</Say>
</Response>`

    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'text/xml; charset=utf-8' }
    })

  } catch(e: any) {
    console.error('Error:', e)
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="es-ES" voice="Polly.Conchita">Hola, gracias por llamar. Un momento por favor, inténtelo de nuevo en breve.</Say>
</Response>`,
      { headers: { 'Content-Type': 'text/xml; charset=utf-8' } }
    )
  }
}