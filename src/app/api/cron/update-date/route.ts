import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * CRON: Actualiza la fecha en el prompt de TODOS los agentes ElevenLabs.
 * Se ejecuta cada día a las 00:05 via Vercel Cron.
 *
 * vercel.json:
 * { "crons": [{ "path": "/api/cron/update-date", "schedule": "5 0 * * *" }] }
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const EL_KEY = process.env.ELEVENLABS_API_KEY

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  // Verificar que viene de Vercel Cron (o de nosotros)
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (!EL_KEY) return NextResponse.json({ error: 'EL key not set' }, { status: 503 })

  // Se ejecuta a las 23:55 → inyectar fecha de MAÑANA para que al dar las 00:00 sea correcta
  const tomorrow = new Date(Date.now() + 60 * 60 * 1000) // +1h = ya es el día siguiente
  const currentDate = tomorrow.toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  // Obtener todos los tenants con agente configurado
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, name, el_agent_id')
    .not('el_agent_id', 'is', null)

  if (!tenants || tenants.length === 0) {
    return NextResponse.json({ ok: true, updated: 0, date: currentDate })
  }

  let updated = 0
  let errors = 0

  for (const tenant of tenants) {
    try {
      // Leer prompt actual del agente
      const getRes = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${tenant.el_agent_id}`, {
        headers: { 'xi-api-key': EL_KEY }
      })
      if (!getRes.ok) { errors++; continue }

      const agent = await getRes.json()
      let prompt = agent.conversation_config?.agent?.prompt?.prompt || ''

      // Reemplazar la fecha en el prompt (cualquier formato)
      const dateRegex = /HOY ES: [^\n]+/
      if (dateRegex.test(prompt)) {
        prompt = prompt.replace(dateRegex, `HOY ES: ${currentDate}`)
      }

      // PATCH el agente
      const patchRes = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${tenant.el_agent_id}`, {
        method: 'PATCH',
        headers: { 'xi-api-key': EL_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_config: { agent: { prompt: { prompt } } }
        })
      })

      if (patchRes.ok) updated++
      else errors++
    } catch { errors++ }
  }

  return NextResponse.json({
    ok: true,
    date: currentDate,
    tenants: tenants.length,
    updated,
    errors,
  })
}
