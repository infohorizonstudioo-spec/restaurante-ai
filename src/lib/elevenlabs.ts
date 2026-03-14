import { ElevenLabsClient } from 'elevenlabs'

const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY })
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL'

export async function textToSpeech(text: string): Promise<Buffer> {
  const audio = await client.textToSpeech.convert(VOICE_ID, {
    text,
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.8,
      style: 0.2,
      use_speaker_boost: true
    },
    output_format: 'ulaw_8000' // formato que entiende Twilio
  })

  const chunks: Buffer[] = []
  for await (const chunk of audio as AsyncIterable<Buffer>) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}
