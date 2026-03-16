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

    // Find tenant by phone number
    let tenant: any = null
    try {
      const { data } = await admin.from('tenants').select('*').eq('agent_phone', to).single()
      tenant = data
    } catch(e) {}

    const agentName = tenant?.agent_name || 'Recepcionista'
    const businessName = tenant?.name || 'el negocio'

    // Log call
    if (tenant) {
      await admin.from('calls').upsert({
        tenant_id: tenant.id,
        call_sid: callSid,
        from_number: from,
        to_number: to,
        status: 'in-progress',
        direction: 'inbound',
        transcript: speechResult ? (speechResult + ' ') : ''
      }, { onConflict: 'call_sid' }).catch(() => {})

      if (tenant.plan === 'trial' || tenant.plan === 'free') {
        await admin.from('tenants').update({
          free_calls_used: (tenant.free_calls_used || 0) + 1
        }).eq('id', tenant.id).catch(() => {})
      }
    }

    // Generate AI response
    let aiResponse = `Hola, gracias por llamar a ${businessName}. Soy ${agentName}, tu recepcionista virtual. ¿En qué puedo ayudarte hoy?`

    if (speechResult) {
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
            max_tokens: 150,
            system: `Eres ${agentName}, la recepcionista virtual de ${businessName}. 
Responde en español de forma amable, profesional y concisa (máximo 2 frases).
Puedes ayudar con: reservas, horarios, información del negocio, y consultas generales.
Tipo de negocio: ${tenant?.type || 'negocio'}`,
            messages: [{ role: 'user', content: speechResult }]
          })
        })
        const aiData = await aiRes.json()
        aiResponse = aiData.content?.[0]?.text || aiResponse
      } catch(e) {
        console.error('AI error:', e)
      }
    }

    // Convert AI response to speech via ElevenLabs
    const voiceId = process.env.ELEVENLABS_VOICE_ID || 'ERYLdjEaddaiN9sDjaMX'
    const elKey = process.env.ELEVENLABS_API_KEY || ''
    
    let audioUrl = ''
    try {
      const elRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
        method: 'POST',
        headers: { 'xi-api-key': elKey, 'content-type': 'application/json' },
        body: JSON.stringify({
          text: aiResponse,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true }
        })
      })
      
      if (elRes.ok) {
        const audioBuffer = await elRes.arrayBuffer()
        const base64Audio = Buffer.from(audioBuffer).toString('base64')
        audioUrl = `data:audio/mpeg;base64,${base64Audio}`
      }
    } catch(e) {
      console.error('ElevenLabs error:', e)
    }

    // Build TwiML response
    const twiml = audioUrl 
      ? `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${audioUrl}</Play>
  <Gather input="speech" timeout="5" speechTimeout="auto" action="https://${host}/api/twilio/webhook" method="POST" language="es-ES">
    <Say language="es-ES">Continúa hablando cuando quieras.</Say>
  </Gather>
</Response>`
      : `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="es-ES" voice="Polly.Conchita">${aiResponse}</Say>
  <Gather input="speech" timeout="5" speechTimeout="auto" action="https://${host}/api/twilio/webhook" method="POST" language="es-ES">
    <Say language="es-ES" voice="Polly.Conchita">¿En qué más puedo ayudarte?</Say>
  </Gather>
</Response>`

    return new NextResponse(twiml, {
      headers: { 
        'Content-Type': 'text/xml',
        'Cache-Control': 'no-cache'
      }
    })
  } catch(e: any) {
    console.error('Webhook error:', e)
    const fallback = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="es-ES" voice="Polly.Conchita">Hola, gracias por llamar. En este momento no podemos atenderte. Por favor, inténtalo de nuevo más tarde.</Say>
</Response>`
    return new NextResponse(fallback, { headers: { 'Content-Type': 'text/xml' } })
  }
}