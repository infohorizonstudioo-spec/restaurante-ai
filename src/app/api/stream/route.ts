import { NextResponse } from 'next/server'
// WebSocket endpoint eliminado — el audio lo gestiona ElevenLabs Conversational AI directamente.
// Este endpoint se mantiene por compatibilidad de rutas.
export async function GET() {
  return NextResponse.json({ status: 'ok', note: 'Audio handled by ElevenLabs ConvAI' })
}
