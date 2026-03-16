export const runtime = 'edge'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const text = searchParams.get('t') || 'Hola'
  const voiceId = process.env.ELEVENLABS_VOICE_ID || 'ERYLdjEaddaiN9sDjaMX'
  const elKey = process.env.ELEVENLABS_API_KEY || ''

  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: { 'xi-api-key': elKey, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.4, similarity_boost: 0.85, style: 0.35, use_speaker_boost: true }
      })
    })
    if (!r.ok) return new Response('error', { status: 500 })
    const audio = await r.arrayBuffer()
    return new Response(audio, {
      headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=3600', 'Access-Control-Allow-Origin': '*' }
    })
  } catch(e) {
    return new Response('error', { status: 500 })
  }
}