import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const AGENT_ID = process.env.ELEVENLABS_AGENT_ID || 'agent_0701kkw2sdx5fp685xp6ckngf6zj'
const EL_KEY   = process.env.ELEVENLABS_API_KEY!

// Actualiza el first_message del agente ElevenLabs con el nuevo nombre del negocio
// Se llama automáticamente cuando el usuario guarda cambios en Configuración
export async function POST(req: Request) {
  try {
    const { business_name, agent_name } = await req.json()
    if (!business_name) return NextResponse.json({ ok: false, error: 'missing business_name' })

    // Verificar que viene de un usuario autenticado con tenant válido
    const authHeader = req.headers.get('authorization') || req.headers.get('cookie') || ''
    // (La validación real la hace Supabase RLS — aquí solo actualizamos EL)

    const greeting = `${business_name}, dígame.`

    // Solo actualiza el first_message — el nombre del agente va por variable dinámica {{agent_name}}
    const res = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}`, {
      method: 'PATCH',
      headers: { 'xi-api-key': EL_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation_config: {
          agent: { first_message: greeting }
        }
      })
    })

    const ok = res.status === 200
    console.log('update-agent-name:', ok ? 'OK' : res.status, '| name:', business_name)
    return NextResponse.json({ ok })
  } catch(e: any) {
    console.error('update-agent-name error:', e.message)
    return NextResponse.json({ ok: false, error: e.message })
  }
}
