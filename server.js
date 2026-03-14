// server.js — Servidor custom Next.js con WebSocket para Twilio Media Streams
const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const WebSocket = require('ws')

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

// Estado de sesiones en memoria
const sessions = new Map()

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true)
    handle(req, res, parsedUrl)
  })

  // WebSocket server para Twilio Media Streams
  const wss = new WebSocket.Server({ noServer: true })

  server.on('upgrade', (req, socket, head) => {
    if (req.url === '/api/stream') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req)
      })
    }
  })

  wss.on('connection', async (ws) => {
    console.log('📞 Nueva conexión Twilio Media Stream')

    let session = null
    let deepgramConn = null
    let streamSid = ''

    const { createClient } = require('@deepgram/sdk')
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY)

    ws.on('message', async (data) => {
      let msg
      try { msg = JSON.parse(data) } catch { return }

      // ── START ──────────────────────────────────────────
      if (msg.event === 'start') {
        streamSid = msg.start.streamSid
        const params = msg.start.customParameters || {}
        const { restaurantId, orderId, callerPhone } = params

        console.log(`▶ Stream iniciado: ${streamSid} | Restaurante: ${restaurantId}`)

        // Cargar datos
        const { createClient: createSupabase } = require('@supabase/supabase-js')
        const supabase = createSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

        const { data: restaurant } = await supabase.from('restaurants').select('*').eq('id', restaurantId).single()
        if (!restaurant) { ws.close(); return }

        session = { restaurantId, orderId, callerPhone, restaurant, transcript: [], order: { customerPhone: callerPhone } }
        sessions.set(streamSid, session)

        // Iniciar Deepgram live
        deepgramConn = deepgram.listen.live({
          model: 'nova-2', language: 'es', punctuate: true,
          interim_results: false, encoding: 'mulaw', sample_rate: 8000
        })

        deepgramConn.on('open', () => console.log('🎙️ Deepgram conectado'))

        deepgramConn.on('Results', async (result) => {
          const text = result?.channel?.alternatives?.[0]?.transcript?.trim()
          if (!text) return
          console.log('👤 Usuario:', text)

          session.transcript.push({ role: 'user', content: text })

          // IA procesa
          const { processConversation } = require('./src/lib/ai-agent')
          const { reply, order, hangup } = await processConversation(session.transcript, restaurant, session.order)
          session.order = order
          session.transcript.push({ role: 'assistant', content: reply })
          console.log('🤖 IA:', reply)

          // Actualizar BD
          await supabase.from('orders').update({
            transcript: session.transcript,
            customer_name: order.customerName,
            customer_phone: order.customerPhone || callerPhone,
            delivery_address: order.deliveryAddress,
            payment_method: order.paymentMethod,
            items: order.items || [],
            notes: order.notes,
            total: order.total,
            status: hangup ? 'confirmado' : 'nuevo',
            updated_at: new Date().toISOString()
          }).eq('id', orderId)

          // ElevenLabs → audio → Twilio
          const { textToSpeech } = require('./src/lib/elevenlabs')
          const audioBuffer = await textToSpeech(reply)
          const payload = audioBuffer.toString('base64')

          ws.send(JSON.stringify({ event: 'media', streamSid, media: { payload } }))

          if (hangup) {
            setTimeout(() => {
              ws.send(JSON.stringify({ event: 'stop', streamSid }))
              ws.close()
            }, 4000)
          }
        })

        // Enviar saludo
        setTimeout(async () => {
          const greeting = restaurant.greeting
          session.transcript.push({ role: 'assistant', content: greeting })

          const { textToSpeech } = require('./src/lib/elevenlabs')
          const audioBuffer = await textToSpeech(greeting)
          ws.send(JSON.stringify({ event: 'media', streamSid, media: { payload: audioBuffer.toString('base64') } }))
        }, 500)
      }

      // ── MEDIA ─────────────────────────────────────────
      if (msg.event === 'media' && deepgramConn) {
        const audio = Buffer.from(msg.media.payload, 'base64')
        if (deepgramConn.getReadyState() === 1) {
          deepgramConn.send(audio)
        }
      }

      // ── STOP ──────────────────────────────────────────
      if (msg.event === 'stop') {
        console.log('⏹ Stream terminado')
        deepgramConn?.finish()
        sessions.delete(streamSid)
      }
    })

    ws.on('close', () => {
      deepgramConn?.finish()
      sessions.delete(streamSid)
    })

    ws.on('error', (err) => console.error('WS Error:', err))
  })

  const PORT = process.env.PORT || 3001
  server.listen(PORT, () => {
    console.log(`🚀 Servidor arrancado en puerto ${PORT}`)
    console.log(`📞 WebSocket listo en ws://localhost:${PORT}/api/stream`)
  })
})
