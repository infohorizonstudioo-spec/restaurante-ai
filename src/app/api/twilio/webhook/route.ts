import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const from = formData.get('From') as string || ''
    const to = formData.get('To') as string || ''
    const callSid = formData.get('CallSid') as string || ''
    const speechResult = formData.get('SpeechResult') as string || ''
    const host = req.headers.get('host') || 'restaurante-ai.vercel.app'
    const webhookUrl = `https://${host}/api/twilio/webhook`

    // Find tenant
    let tenant: any = null
    try {
      const { data } = await admin.from('tenants').select('*').eq('agent_phone', to).single()
      tenant = data
    } catch(e) {}

    const agentName = tenant?.agent_name || 'Recepcionista'
    const businessName = tenant?.name || 'nuestro negocio'

    // Log call
    if (tenant) {
      await admin.from('calls').upsert({
        tenant_id: tenant.id,
        call_sid: callSid,
        from_number: from,
        to_number: to,
        status: 'in-progress',
        direction: 'inbound',
      }, { onConflict: 'call_sid' }).catch(() => {})

      if (tenant.plan === 'trial' || tenant.plan === 'free') {
        await admin.from('tenants').update({
          free_calls_used: (tenant.free_calls_used || 0) + 1
        }).eq('id', tenant.id).catch(() => {})
      }
    }

    // Generate AI response text
    let responseText = `Hola, gracias por llamar a ${businessName}. Soy ${agentName}, tu recepcionista virtual. ¿En qué puedo ayudarte hoy?`

    if (speechResult && speechResult.trim()) {
      try {
        const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'anthropic-version': '2023-06-01',
            'x-api-key': process.env.ANTHROPIC_API_KEY || '',
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 120,
            system: `Eres ${agentName}, recepcionista virtual de ${businessName}. 
IMPORTANTE: Responde SIEMPRE en español, de forma amable y concisa (1-2 frases máximo).
Puedes ayudar con: reservas, horarios, información general, y consultas del negocio.
Si preguntan por una reserva, pide nombre, fecha y número de personas.
Tipo de negocio: ${tenant?.type || 'restaurante'}`,
            messages: [{ role: 'user', content: speechResult }]
          })
        })
        const aiData = await aiRes.json()
        if (aiData.content?.[0]?.text) {
          responseText = aiData.content[0].text
        }
      } catch(e) {
        console.error('AI error:', e)
        responseText = 'Entendido. ¿En qué más puedo ayudarte?'
      }
    }

    // Build TwiML - usar Say en español directamente (funciona sin latencia)
    // ElevenLabs via URL separada en futuro
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="es-ES" voice="Polly.Conchita-Neural">${responseText.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</Say>
  <Gather input="speech" language="es-ES" timeout="8" speechTimeout="auto" enhanced="true" action="${webhookUrl}" method="POST">
    <Say language="es-ES" voice="Polly.Conchita-Neural"> </Say>
  </Gather>
  <Say language="es-ES" voice="Polly.Conchita-Neural">Gracias por llamar. Hasta luego.</Say>
</Response>`

    return new NextResponse(twiml, {
      headers: { 
        'Content-Type': 'text/xml; charset=utf-8',
        'Cache-Control': 'no-cache, no-store'
      }
    })
  } catch(e: any) {
    console.error('Webhook error:', e)
    const fallback = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="es-ES" voice="Polly.Conchita-Neural">Hola, gracias por llamar. En este momento no podemos atenderte. Por favor inténtalo de nuevo en unos minutos.</Say>
</Response>`
    return new NextResponse(fallback, { headers: { 'Content-Type': 'text/xml; charset=utf-8' } })
  }
}