import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Construye el contexto completo del negocio para el agente
async function buildAgentContext(tenant: any): Promise<string> {
  const tid = tenant.id
  const today = new Date().toISOString().split('T')[0]
  const now = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  const dayName = new Date().toLocaleDateString('es-ES', { weekday: 'long' })

  // Carga zonas y mesas del local
  const [{ data: zones }, { data: tables }, { data: reservasHoy }] = await Promise.all([
    admin.from('zones').select('*').eq('tenant_id', tid).eq('active', true).order('name'),
    admin.from('tables').select('*').eq('tenant_id', tid).order('name'),
    admin.from('reservations').select('*').eq('tenant_id', tid).eq('reservation_date', today).in('status', ['confirmada', 'pendiente']),
  ])

  const tieneZonas = zones && zones.length > 0
  const tieneMesas = tables && tables.length > 0

  let contextoLocal = ''

  if (tieneZonas && tieneMesas) {
    contextoLocal += '\n\nDISPOSICIÓN DEL LOCAL:\n'
    for (const zone of zones!) {
      const mesasZona = (tables || []).filter(m => m.zone_id === zone.id)
      const reservasZona = (reservasHoy || []).filter(r => r.zone_id === zone.id)
      const mesasLibres = mesasZona.filter(m => !reservasZona.some(r => r.table_id === m.id))
      
      contextoLocal += `\nZona "${zone.name}"${zone.description ? ' (' + zone.description + ')' : ''}:\n`
      for (const mesa of mesasZona) {
        const ocupada = reservasZona.some(r => r.table_id === mesa.id)
        contextoLocal += `  - Mesa ${mesa.name}: ${mesa.capacity} personas, ${ocupada ? 'OCUPADA hoy' : 'DISPONIBLE'}${mesa.notes ? ', ' + mesa.notes : ''}\n`
      }
      contextoLocal += `  → ${mesasLibres.length} mesas disponibles en ${zone.name}\n`
    }

    contextoLocal += '\nINSTRUCCIONES DE ASIGNACIÓN:\n'
    contextoLocal += '- Si el cliente menciona zona (terraza, interior, jardín, etc.), asigna mesa en esa zona.\n'
    contextoLocal += '- Si no menciona zona, asigna la primera mesa disponible con capacidad suficiente.\n'
    contextoLocal += '- Si la zona pedida no tiene disponibilidad, ofrece alternativa.\n'
    contextoLocal += '- Al llamar create_reservation, incluye SIEMPRE zone_name y table_name.\n'
  } else if (!tieneZonas) {
    contextoLocal += '\n\nNota: El local aún no tiene zonas configuradas. Puedes hacer reservas sin asignar mesa específica.\n'
  }

  // Horario del negocio
  const hours = tenant.business_hours?.[dayName.toLowerCase()]
  const horario = hours && !hours.closed
    ? `Hoy (${dayName}): ${hours.open} - ${hours.close}`
    : hours?.closed
      ? `Hoy (${dayName}): cerrado`
      : 'Horario no configurado'

  // Resumen de reservas de hoy
  const totalHoy = reservasHoy?.length || 0
  const resumenHoy = totalHoy > 0
    ? `Hoy hay ${totalHoy} reserva${totalHoy !== 1 ? 's' : ''} confirmada${totalHoy !== 1 ? 's' : ''}.`
    : 'Hoy no hay reservas todavía.'

  const basePrompts: Record<string, string> = {
    restaurante: 'Eres la recepcionista del restaurante. Gestiona reservas de mesa. Pregunta siempre: nombre del cliente, fecha, hora y número de personas. Si mencionan zona preferida (terraza, interior, jardín, etc.) tenla en cuenta.',
    bar: 'Eres la recepcionista del bar. Gestiona reservas de mesa y espacios. Pregunta: nombre, fecha, hora, personas. Si mencionan zona, tenla en cuenta.',
    clinica_dental: 'Eres la recepcionista de la clínica dental. Gestiona citas. Pregunta: nombre completo, tipo de consulta, fecha y hora preferida.',
    clinica_medica: 'Eres la recepcionista médica. Gestiona citas. Pregunta: nombre, especialidad o médico, fecha y hora.',
    asesoria: 'Eres la recepcionista de la asesoría. Gestiona citas de consultoría. Pregunta: nombre, motivo de consulta, fecha y hora.',
    peluqueria: 'Eres la recepcionista de la peluquería. Gestiona citas. Pregunta: nombre, servicio deseado, fecha y hora.',
    seguros: 'Eres la recepcionista de la correduría. Gestiona citas. Pregunta: nombre, tipo de seguro de interés, fecha y hora.',
    inmobiliaria: 'Eres la recepcionista de la inmobiliaria. Gestiona visitas a propiedades y citas. Pregunta: nombre, interés (compra/alquiler), fecha y hora.',
    otro: 'Eres la recepcionista virtual. Gestiona citas y consultas. Sé amable y eficiente.',
  }

  const basePrompt = basePrompts[tenant.type] || basePrompts.otro

  return `IDENTIDAD: Eres ${tenant.agent_name || 'Gabriela'}, recepcionista de ${tenant.name}. NUNCA digas que eres IA o robot. Habla siempre en ${tenant.language === 'ca' ? 'catalán' : tenant.language === 'eu' ? 'euskera' : 'español'}, con naturalidad.

ROL: ${basePrompt}

FECHA Y HORA ACTUAL: ${dayName} ${today}, ${now}
HORARIO: ${horario}
ESTADO HOY: ${resumenHoy}
TENANT_ID (necesario para herramientas): ${tid}
${contextoLocal}
REGLAS IMPORTANTES:
- Respuestas cortas y naturales (máx 2-3 frases).
- Cuando tengas todos los datos necesarios (nombre, fecha, hora, personas), USA INMEDIATAMENTE la herramienta create_reservation.
- Para restaurante/bar: si hay mesas configuradas, asigna mesa automáticamente según disponibilidad y preferencia de zona.
- Si no hay disponibilidad en la zona pedida, ofrece alternativa de inmediato.
- Confirma siempre la reserva con: nombre, fecha, hora, personas y mesa/zona asignada.
- Si preguntan por disponibilidad antes de reservar, usa check_availability.
- Si el negocio está cerrado hoy, comunícalo amablemente y ofrece otra fecha.`
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const toNumber = body?.call?.to_number || body?.To || ''

    let tenant: any = null
    if (toNumber) {
      const { data } = await admin.from('tenants')
        .select('*').eq('agent_phone', toNumber).maybeSingle()
      tenant = data
    }

    if (!tenant) {
      return NextResponse.json({
        type: 'conversation_initiation_client_data',
        conversation_config_override: {
          agent: {
            prompt: { prompt: 'Eres una recepcionista virtual. Di que no puedes atender en este momento.' },
            first_message: 'Hola, en este momento no puedo atenderte. Por favor inténtalo más tarde.',
          }
        },
        dynamic_variables: { tenant_id: '', business_name: 'el negocio', agent_name: 'Gabriela' }
      })
    }

    // Incrementar contador y registrar llamada
    await Promise.all([
      admin.from('tenants').update({ call_count: (tenant.call_count || 0) + 1 }).eq('id', tenant.id),
      admin.from('calls').insert({
        tenant_id: tenant.id,
        call_sid: body?.call?.conversation_id || 'conv_' + Date.now(),
        from_number: body?.call?.from_number || 'unknown',
        to_number: toNumber,
        status: 'in-progress',
        direction: 'inbound',
      }),
    ]).catch(() => {})

    const systemPrompt = await buildAgentContext(tenant)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://restaurante-ai.vercel.app'

    return NextResponse.json({
      type: 'conversation_initiation_client_data',
      conversation_config_override: {
        agent: {
          prompt: {
            prompt: systemPrompt,
            // Herramientas que Gabriela puede usar durante la llamada
            tools: [
              {
                type: 'webhook',
                name: 'check_availability',
                description: 'Comprueba disponibilidad de mesas para una fecha, hora y número de personas. Úsala cuando el cliente pregunte si hay sitio antes de hacer la reserva.',
                api: {
                  url: `${appUrl}/api/voice/availability`,
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                },
                input_schema: {
                  type: 'object',
                  properties: {
                    tenant_id:   { type: 'string', description: 'ID del tenant' },
                    date:        { type: 'string', description: 'Fecha en formato YYYY-MM-DD' },
                    time:        { type: 'string', description: 'Hora en formato HH:MM' },
                    party_size:  { type: 'number', description: 'Número de personas' },
                    zone_name:   { type: 'string', description: 'Zona preferida (terraza, interior, jardín, etc.). Opcional.' },
                  },
                  required: ['tenant_id', 'date', 'time', 'party_size'],
                },
              },
              {
                type: 'webhook',
                name: 'create_reservation',
                description: 'Crea una reserva. Úsala cuando tengas nombre, fecha, hora y personas confirmados por el cliente.',
                api: {
                  url: `${appUrl}/api/voice/reservation`,
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                },
                input_schema: {
                  type: 'object',
                  properties: {
                    tenant_id:       { type: 'string', description: 'ID del tenant' },
                    customer_name:   { type: 'string', description: 'Nombre completo del cliente' },
                    customer_phone:  { type: 'string', description: 'Teléfono del cliente si lo ha dado' },
                    reservation_date:{ type: 'string', description: 'Fecha en formato YYYY-MM-DD' },
                    reservation_time:{ type: 'string', description: 'Hora en formato HH:MM' },
                    party_size:      { type: 'number', description: 'Número de personas' },
                    zone_preference: { type: 'string', description: 'Zona preferida mencionada por el cliente (terraza, interior, etc.). Opcional.' },
                    notes:           { type: 'string', description: 'Notas especiales (alergias, ocasión especial, etc.)' },
                  },
                  required: ['tenant_id', 'customer_name', 'reservation_date', 'reservation_time', 'party_size'],
                },
              },
            ],
          },
          first_message: `¡Hola! Gracias por llamar a ${tenant.name}. Soy ${tenant.agent_name || 'Gabriela'}, ¿en qué puedo ayudarte?`,
        },
      },
      dynamic_variables: {
        tenant_id: tenant.id,
        business_name: tenant.name,
        agent_name: tenant.agent_name || 'Gabriela',
      },
    })
  } catch (e: any) {
    console.error('Voice context error:', e)
    return NextResponse.json({
      type: 'conversation_initiation_client_data',
      conversation_config_override: {
        agent: {
          prompt: { prompt: 'Eres una recepcionista virtual amable.' },
          first_message: '¡Hola! ¿En qué puedo ayudarte?',
        }
      },
      dynamic_variables: { tenant_id: '', business_name: 'el negocio', agent_name: 'Gabriela' }
    })
  }
}