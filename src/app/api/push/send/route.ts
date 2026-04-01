/**
 * POST /api/push/send
 * Envía notificación push a todos los dispositivos de un tenant.
 * Llamado internamente desde createNotification.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimitByIp, RATE_LIMITS } from '@/lib/rate-limit'
import { sanitizeUUID, sanitizeString } from '@/lib/sanitize'
import { logger } from '@/lib/logger'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Construir header Authorization VAPID sin librería externa
async function buildVapidAuth(endpoint: string): Promise<string> {
  const pubKey  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
  const privKey = process.env.VAPID_PRIVATE_KEY!
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@reservo.ai'

  const url     = new URL(endpoint)
  const audience = `${url.protocol}//${url.host}`
  const exp      = Math.floor(Date.now() / 1000) + 12 * 3600

  const header  = { typ: 'JWT', alg: 'ES256' }
  const payload = { aud: audience, exp, sub: subject }

  const enc = (obj: object) => btoa(JSON.stringify(obj))
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'')
  const toSign = `${enc(header)}.${enc(payload)}`

  // Importar clave privada EC P-256
  const privBytes = Uint8Array.from(atob(privKey.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0))
  const key = await crypto.subtle.importKey(
    'raw', privBytes, { name:'ECDSA', namedCurve:'P-256' }, false, ['sign']
  ).catch(async () => {
    // Fallback: intentar como PKCS8
    const pkcs8 = new Uint8Array(39 + privBytes.length)
    pkcs8.set([0x30,0x41,0x02,0x01,0x00,0x30,0x13,0x06,0x07,0x2a,0x86,0x48,0xce,0x3d,0x02,0x01,0x06,0x08,0x2a,0x86,0x48,0xce,0x3d,0x03,0x01,0x07,0x04,0x27,0x30,0x25,0x02,0x01,0x01,0x04,0x20], 0)
    pkcs8.set(privBytes, 35)
    return crypto.subtle.importKey('pkcs8', pkcs8, { name:'ECDSA', namedCurve:'P-256' }, false, ['sign'])
  })

  const sig = await crypto.subtle.sign({ name:'ECDSA', hash:'SHA-256' }, key, new TextEncoder().encode(toSign))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'')
  const token = `${toSign}.${sigB64}`

  return `vapid t=${token},k=${pubKey}`
}

export async function POST(req: NextRequest) {
  try {
    const rl = rateLimitByIp(req, RATE_LIMITS.messaging, 'push:send')
    if (rl.blocked) return rl.response

    let raw: any
    try { raw = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
    const tenant_id = sanitizeUUID(raw.tenant_id)
    const title = sanitizeString(raw.title, 200)
    const body = sanitizeString(raw.body, 500)
    const url = sanitizeString(raw.url || '/panel', 500)
    const priority = ['info', 'warning', 'critical'].includes(raw.priority) ? raw.priority : 'info'
    const tag = sanitizeString(raw.tag, 50)
    if (!tenant_id) return NextResponse.json({ error: 'tenant_id requerido' }, { status: 400 })

    // Solo enviar si viene de servidor (no exponer al cliente)
    const internalKey = req.headers.get('x-internal-key')
    const expectedKey = process.env.INTERNAL_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-40)
    if (!internalKey || !expectedKey || internalKey !== expectedKey) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { data: subs } = await admin.from('push_subscriptions')
      .select('endpoint, p256dh, auth').eq('tenant_id', tenant_id)

    if (!subs || subs.length === 0) return NextResponse.json({ ok: true, sent: 0 })

    const payload = JSON.stringify({ title, body, url, priority, tag: tag || 'reservo' })
    let sent = 0, failed = 0

    await Promise.all(subs.map(async sub => {
      try {
        const vapidAuth = await buildVapidAuth(sub.endpoint)
        const controller = new AbortController()
        const fetchTimeout = setTimeout(() => controller.abort(), 30000)
        let res: Response
        try {
          res = await fetch(sub.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type':  'application/octet-stream',
              'Authorization': vapidAuth,
              'TTL':           '86400',
            },
            signal: controller.signal,
            body: new TextEncoder().encode(payload),
          })
        } finally {
          clearTimeout(fetchTimeout)
        }
        if (res.ok || res.status === 201) { sent++ }
        else if (res.status === 410 || res.status === 404) {
          // Suscripción expirada — eliminar
          await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
          failed++
        }
      } catch { failed++ }
    }))

    return NextResponse.json({ ok: true, sent, failed })
  } catch (e: any) {
    logger.error('push/send error', {}, e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
