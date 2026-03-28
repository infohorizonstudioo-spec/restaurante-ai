import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: Request) {
  const rl = rateLimitByIp(req, RATE_LIMITS.api, 'stream:chat')
  if (rl.blocked) return rl.response

  const auth = await requireAuth(req)
  if (!auth.ok || !auth.tenantId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { messages } = body as { messages: Array<{ role: string; content: string }> }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages required' }, { status: 400 })
    }

    // Load tenant context
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id,name,type,agent_name')
      .eq('id', auth.tenantId)
      .single()

    // Load recent stats for context
    const today = new Date().toISOString().slice(0, 10)
    const [resResult, callResult, custResult] = await Promise.all([
      supabase.from('reservations').select('id', { count: 'exact', head: true })
        .eq('tenant_id', auth.tenantId).gte('date', today),
      supabase.from('calls').select('id', { count: 'exact', head: true })
        .eq('tenant_id', auth.tenantId).gte('started_at', today + 'T00:00:00'),
      supabase.from('customers').select('id', { count: 'exact', head: true })
        .eq('tenant_id', auth.tenantId),
    ])

    const systemPrompt = `Eres el asistente inteligente de Reservo.AI integrado en el panel de gestión de "${tenant?.name || 'el negocio'}".
Tipo de negocio: ${tenant?.type || 'restaurante'}.
Nombre de la recepcionista IA: ${tenant?.agent_name || 'Recepcionista IA'}.

DATOS EN TIEMPO REAL:
- Reservas/citas próximas: ${resResult.count ?? 0}
- Llamadas hoy: ${callResult.count ?? 0}
- Clientes totales: ${custResult.count ?? 0}

TU ROL:
- Ayudar al dueño del negocio a entender y gestionar su sistema Reservo.AI
- Responder preguntas sobre reservas, clientes, llamadas, configuración
- Dar consejos para mejorar la gestión del negocio
- Explicar funcionalidades del sistema
- Sugerir acciones basadas en los datos

REGLAS:
- Responde SIEMPRE en español
- Sé conciso y directo — máximo 3-4 frases por respuesta
- Usa un tono profesional pero cercano
- Si no sabes algo, dilo honestamente
- No inventes datos — usa solo lo que tienes
- Puedes usar markdown para formato (negritas, listas)
- NO uses emojis a menos que el usuario los use primero`

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: systemPrompt,
      messages: messages.slice(-10).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    })

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')

    return NextResponse.json({ response: text })
  } catch (err: any) {
    console.error('Stream error:', err)
    return NextResponse.json(
      { error: 'Error procesando tu mensaje. Inténtalo de nuevo.' },
      { status: 500 },
    )
  }
}
